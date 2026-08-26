import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

type RefreshCallback = () => void | Promise<void>;

/** Refreshes a page when one of its source tables changes, without a browser reload. */
export function useRealtimeRefresh(
  channelName: string,
  tables: string[],
  refresh: RefreshCallback,
  debounceMs = 450,
) {
  const refreshRef = useRef(refresh);
  const tableKey = tables.join('|');

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let timeoutId: number | undefined;
    const scheduleRefresh = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        void refreshRef.current();
      }, debounceMs);
    };

    const channel = supabase.channel(channelName);
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
    });
    channel.subscribe();

    const refreshWhenVisible = () => {
      if (!document.hidden) scheduleRefresh();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
    // tableKey intentionally stabilizes the subscription against equivalent array literals.
  }, [channelName, tableKey, debounceMs]);
}
