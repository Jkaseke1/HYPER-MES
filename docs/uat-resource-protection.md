# UAT resource protection

Target: PlantControl Test, Supabase project `appyuqxetlphuxfybmus`.

The October 21 outage showed database connection timeouts, API gateway failures,
and Realtime queue timeouts. Disk I/O exhaustion was previously reported, but
these exports do not establish the outage's root cause.

## Request limits

- Login does not subscribe to database changes. Profile data is loaded once per
  signed-in user, rather than on every refreshed token.
- The fetch wrapper sends each request once. A network failure, rate limit, or
  gateway timeout pauses new HTTP requests for 30 seconds, then 60 and 120 seconds
  on further failures. Only one recovery probe is allowed through. Successful
  recovery restores normal requests. Server Retry-After values are respected up
  to five minutes. The Supabase Auth SDK retains its own session handling.
- Requests have a 20-second deadline and respect caller cancellation. A timed-out
  write may already have reached the server: check its saved status before
  submitting it again. Writes are never automatically replayed by the wrapper.
- Hidden/offline tabs skip shared page refreshes and production background reads.
  The global database-change subscription is removed while inactive. Individual
  authenticated page channels remain intact; their read callbacks are gated.
- Production list fallback refreshes run once a minute. Bursts of order/material
  and stock events are combined. Closing the detail dialog stops its polling;
  terminal Sage statuses no longer poll. Polls wait for completion before the
  next interval, and list summary refreshes share the order refresh.
- The retired recovery service worker is no longer updated every minute.

## Local bridge

The operating bridge is in the main workspace's `bridge` folder. Its worker has
the same adaptive queue scheduler as this checkout. It activates only when the
configured Supabase hostname matches UAT. Active queue reads wait at least 15
seconds between runs, empty queues slow to one read per minute, and database
errors back off to a maximum of five minutes. Sage event handling, claims, and
write/reconciliation rules are unchanged. LIVE retains its existing schedule.

An already-running worker must be restarted during an idle period to load the
new code. Do not start another worker alongside it. Browser deployment does not
restart the PC's bridge worker.

## Verification and rollout

Run `node scripts/test-backend-load.cjs` for simulated outage, cancellation,
recovery, polling, auth-profile and login-subscription tests. It performs no
Supabase or Sage operations. Build the app before deploying to the UAT repository.

After deployment, open one UAT tab, verify login and a production-order read,
then check Database Health's CPU, memory, connection and Disk I/O charts over the
same interval. Compare active use against idle periods. If health deteriorates
again, capture that interval and contact Supabase Support; these safeguards
reduce avoidable traffic but cannot guarantee availability or replenish an
exhausted compute budget. A compute change requires a separate cost decision.
