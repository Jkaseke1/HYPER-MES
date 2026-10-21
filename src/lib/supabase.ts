import { createClient } from '@supabase/supabase-js';
import { backendAvailability } from './backendAvailability';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: backendAvailability.fetch,
  },
  realtime: {
    reconnectAfterMs: (attempt: number) => [10000, 30000, 60000, 120000][Math.min(attempt - 1, 3)] ?? 120000,
  },
});
