const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadTypeScript(relativePath, overrides = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const context = { exports, require, console, globalThis, fetch, Request, Response, AbortController,
    setTimeout, clearTimeout, Event, ...overrides };
  vm.runInNewContext(js, context, { filename: relativePath });
  return exports;
}

function fakeTimers() {
  let next = 0;
  const timers = new Map();
  return {
    timers,
    setTimeout: (callback, delay) => { timers.set(++next, { callback, delay }); return next; },
    clearTimeout: (id) => timers.delete(id),
    async tick() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      await timer.callback();
      return timer.delay;
    },
  };
}

async function testFetchGuard() {
  const { createFetchGuard } = loadTypeScript('src/lib/backendAvailability.ts');
  let now = 0;
  let calls = 0;
  let status = 504;
  let releaseProbe;
  const guard = createFetchGuard({ now: () => now, fetch: async () => {
    calls++;
    if (status === 999) return new Promise(resolve => { releaseProbe = resolve; });
    return new Response('{}', { status });
  } });
  const url = 'https://fixture.supabase.co/rest/v1/sync_log';
  assert.equal((await guard.fetch(url)).status, 503);
  await Promise.all(Array.from({ length: 50 }, () => guard.fetch(url)));
  assert.equal(calls, 1, 'Cooldown must stop actual network traffic');
  now = 30000;
  await guard.fetch(url);
  assert.equal(guard.retryDelay(), 60000, 'Repeated failures extend cooldown');
  now = 90000;
  status = 999;
  const probe = guard.fetch(url);
  await guard.fetch(url);
  assert.equal(calls, 3, 'Only one recovery probe may reach the server');
  releaseProbe(new Response('{}', { status: 200 }));
  await probe;
  assert.equal(guard.retryDelay(), 0);
  status = 200;
  await guard.fetch(url);
  assert.equal(calls, 4, 'Traffic resumes after recovery');

  let writes = 0;
  const writer = createFetchGuard({ fetch: async () => { writes++; throw new TypeError('Network failure after sending'); } });
  await writer.fetch(url, { method: 'POST', body: '{}' });
  await writer.fetch(url, { method: 'POST', body: '{}' });
  assert.equal(writes, 1, 'Never replay ambiguous writes');
  const validation = createFetchGuard({ fetch: async () => new Response('{"message":"Invalid password"}', { status: 400 }) });
  assert.equal((await validation.fetch(url)).status, 400);
  assert.equal(validation.retryDelay(), 0, 'A validation error must not trip the outage guard');

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(validation.fetch(url, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(validation.retryDelay(), 0);
  const timeout = createFetchGuard({ timeoutMs: 5, fetch: async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  }) });
  assert.equal((await timeout.fetch(url)).status, 503, 'Stalled requests time out');
  assert.ok(timeout.retryDelay() > 0);

  const limited = createFetchGuard({ now: () => 0, fetch: async () => new Response('{}', { status: 429, headers: { 'Retry-After': '90' } }) });
  await limited.fetch(url);
  assert.equal(limited.retryDelay(), 90000, 'Honor the server cooldown');
}

async function testBackgroundPolling() {
  const clock = fakeTimers();
  const document = { hidden: true };
  const navigator = { onLine: true };
  const { startBackgroundPolling } = loadTypeScript('src/lib/backendAvailability.ts', { ...clock, document, navigator });
  let reads = 0;
  let release;
  const stop = startBackgroundPolling(() => { reads++; return new Promise(resolve => { release = resolve; }); }, 15000);
  await clock.tick();
  assert.equal(reads, 0, 'Hidden tabs do not poll');
  document.hidden = false;
  navigator.onLine = false;
  await clock.tick();
  assert.equal(reads, 0, 'Offline tabs do not poll');
  navigator.onLine = true;
  const running = clock.tick();
  assert.equal(reads, 1);
  assert.equal(clock.timers.size, 0, 'A slow request cannot overlap the next poll');
  stop();
  release();
  await running;
  assert.equal(clock.timers.size, 0, 'Stopping during a request cannot restart polling');
}

async function testBridgePolling() {
  const clock = fakeTimers();
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'bridge/lib/adaptiveQueuePoller.js'), 'utf8'), { module, console, ...clock });
  let result = { idle: true };
  const stop = module.exports.startAdaptiveQueuePolling(async () => result, { intervalMs: 5000, log() {} });
  await new Promise(setImmediate);
  assert.equal(await clock.tick(), 30000);
  assert.equal(await clock.tick(), 60000);
  result = { readFailed: true };
  await clock.tick();
  assert.equal(await clock.tick(), 30000);
  assert.equal(await clock.tick(), 60000);
  assert.equal(await clock.tick(), 120000);
  assert.equal(await clock.tick(), 240000);
  assert.equal(await clock.tick(), 300000);
  result = { idle: false };
  await clock.tick();
  assert.equal(await clock.tick(), 15000, 'Normal processing resumes after database recovery');
  stop();
  assert.equal(clock.timers.size, 0);
}

function testRealtimeLoginGuard() {
  const listeners = new Map();
  let channels = 0;
  let disconnects = 0;
  let user = null;
  let pathname = '/login';
  const supabase = {
    realtime: { disconnect() { disconnects++; }, connect() {} },
    getChannels: () => [],
    channel() { channels++; return { on() { return this; }, subscribe() {} }; },
    removeChannel() {},
  };
  const effects = [];
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const window = { addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener() {}, clearTimeout, setTimeout };
  const loaded = loadTypeScript('src/components/system/LiveDataUpdates.tsx', {
    document, window, navigator: { onLine: true },
    require: (name) => {
      if (name === 'react') return { useEffect: (fn) => effects.push(fn), useState: (value) => [value, () => {}] };
      if (name === 'react-hot-toast') return { default: { success() {} } };
      if (name.includes('/supabase')) return { supabase };
      if (name.includes('AuthContext')) return { useAuth: () => ({ user, loading: false }) };
      if (name === 'react-router-dom') return { useLocation: () => ({ pathname }) };
      if (name.includes('backendAvailability')) return { backendAvailability: { retryDelay: () => 0 }, canRefreshInBackground: () => !document.hidden };
      throw new Error(name);
    },
  });
  loaded.default();
  let cleanups = effects.splice(0).map(fn => fn());
  assert.equal(channels, 0, 'The login screen must not create a database subscription');
  assert.equal(disconnects, 1);
  cleanups.forEach(fn => fn?.());
  user = { id: 'fixture-user' }; pathname = '/production-orders';
  loaded.default();
  cleanups = effects.splice(0).map(fn => fn());
  assert.equal(channels, 1, 'Authenticated pages retain live updates');
  document.hidden = true;
  listeners.get('plantcontrol:backend-state')();
  assert.equal(disconnects, 1, 'Backgrounding must preserve authenticated channel bindings');
  cleanups.forEach(fn => fn?.());
  document.hidden = true;
  loaded.default();
  cleanups = effects.splice(0).map(fn => fn());
  assert.equal(channels, 1, 'An authenticated page opened in a hidden tab must not subscribe');
  cleanups.forEach(fn => fn?.());
}

async function testProfileRefresh() {
  const hooks = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  let authCallback;
  let inAuthCallback = false;
  let profileReads = 0;
  const session = { user: { id: 'fixture-user' } };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (callback) => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from(table) {
      assert.equal(inAuthCallback, false, 'Never fetch while holding the auth callback lock');
      assert.equal(table, 'profiles');
      const query = { select: () => query, eq: () => query, abortSignal: () => query,
        maybeSingle: async () => { profileReads++; return { data: { id: 'fixture-user', role: 'admin' }, error: null }; } };
      return query;
    },
  };
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => {
        const next = typeof value === 'function' ? value(hooks[index]) : value;
        if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true; }
      }];
    },
    useEffect: (effect, dependencies) => {
      const index = cursor++;
      if (!hooks[index] || dependencies.some((item, i) => !Object.is(item, hooks[index].dependencies[i]))) {
        effects.push(() => { hooks[index]?.cleanup?.(); hooks[index] = { dependencies, cleanup: effect() }; });
      }
    },
  };
  const { AuthProvider } = loadTypeScript('src/context/AuthContext.tsx', {
    window: { setTimeout, clearTimeout },
    require: (name) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (_type, props) => props };
      if (name.includes('/supabase')) return { supabase };
      throw new Error(name);
    },
  });
  const render = () => {
    cursor = 0; dirty = false;
    AuthProvider({ children: null });
    const queued = effects; effects = [];
    queued.forEach(fn => fn());
  };
  const settle = async () => {
    for (let i = 0; i < 6; i++) { await new Promise(setImmediate); if (dirty) render(); }
  };
  render();
  await settle();
  assert.equal(profileReads, 1);
  inAuthCallback = true;
  authCallback('TOKEN_REFRESHED', { ...session, user: { id: 'fixture-user' } });
  inAuthCallback = false;
  await settle();
  assert.equal(profileReads, 1, 'Refreshing a token must not reload the user profile');
  hooks.forEach(hook => hook?.cleanup?.());
}

(async () => {
  await testFetchGuard();
  await testBackgroundPolling();
  await testBridgePolling();
  testRealtimeLoginGuard();
  await testProfileRefresh();
  console.log('PASS: outage cooldown, single recovery probe, no write replay, cancellation, deadlines, hidden/offline polling, bridge backoff, login Realtime guard, and one profile read per user. No Supabase or Sage requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
