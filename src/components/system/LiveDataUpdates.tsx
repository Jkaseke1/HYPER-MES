import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { backendAvailability, canRefreshInBackground } from '../../lib/backendAvailability';

const LIVE_TABLES = [
  'weigh_bridge_tickets',
  'goods_received_notes',
  'grn_items',
  'sync_log',
  'material_transfers',
  'production_orders',
  'stock_movements',
  'sage_stock_balances',
  'finished_goods_transfers',
  'dispatches',
];

/** Broadcast core operational changes to open PlantControl pages and users. */
export default function LiveDataUpdates() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [active, setActive] = useState(canRefreshInBackground());
  const authenticated = Boolean(user && !loading && pathname !== '/login');
  const enabled = authenticated && active;

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const updateActivity = () => {
      clearTimeout(resumeTimer);
      setActive(canRefreshInBackground());
      const delay = backendAvailability.retryDelay();
      if (delay > 0) resumeTimer = setTimeout(updateActivity, delay);
    };
    document.addEventListener('visibilitychange', updateActivity);
    window.addEventListener('online', updateActivity);
    window.addEventListener('offline', updateActivity);
    window.addEventListener('plantcontrol:backend-state', updateActivity);
    return () => {
      clearTimeout(resumeTimer);
      document.removeEventListener('visibilitychange', updateActivity);
      window.removeEventListener('online', updateActivity);
      window.removeEventListener('offline', updateActivity);
      window.removeEventListener('plantcontrol:backend-state', updateActivity);
    };
  }, []);

  useEffect(() => {
    // disconnect() destroys channel bindings in this SDK, so only use it after
    // signing out. Authenticated pages keep their own subscriptions intact.
    if (!authenticated) supabase.realtime.disconnect();
  }, [authenticated]);

  useEffect(() => {
    if (!enabled) return;
    let notificationTimer: number | undefined;

    const announceChange = () => {
      if (!canRefreshInBackground()) return;
      if (notificationTimer) window.clearTimeout(notificationTimer);
      notificationTimer = window.setTimeout(() => {
        if (!canRefreshInBackground()) return;
        window.dispatchEvent(new Event('plantcontrol:data-changed'));
        toast.success('Live data updated', {
          id: 'plantcontrol-live-update',
          duration: 2400,
        });
      }, 500);
    };

    const channel = supabase.channel('plantcontrol-live-updates');
    LIVE_TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, announceChange);
    });
    channel.subscribe();

    return () => {
      if (notificationTimer) window.clearTimeout(notificationTimer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return null;
}
