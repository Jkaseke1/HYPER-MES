import { supabase } from './supabase';
import { APP_VERSION } from '../config/version';

export interface SystemUpdatePayload {
  type: 'soft_update' | 'force_update';
  version: string;
  message: string;
  timestamp: string;
  admin_email?: string;
}

export interface SystemUpdateLogRecord {
  id: string;
  version: string;
  type: 'soft_update' | 'force_update';
  message: string;
  admin_email: string;
  timestamp: string;
}

export type UpdateStatusState = 'up_to_date' | 'soft_update_available' | 'force_update_pending';

export const UPDATE_CHANNEL_NAME = 'mes_system_updates_channel';
export const UPDATE_EVENT_NAME = 'system_update_event';
export const LAST_APPLIED_VERSION_KEY = 'hyper_mes_last_applied_version';

export function getInstalledVersion(): string {
  return APP_VERSION;
}

export function saveLastAppliedVersion(version: string) {
  try {
    localStorage.setItem(LAST_APPLIED_VERSION_KEY, version);
  } catch (e) {
    console.warn('Failed to save last applied version:', e);
  }
}

export async function broadcastSystemUpdate(
  type: 'soft_update' | 'force_update',
  version: string,
  message: string,
  adminEmail: string
) {
  const payload: SystemUpdatePayload = {
    type,
    version,
    message,
    timestamp: new Date().toISOString(),
    admin_email: adminEmail,
  };

  const channel = supabase.channel(UPDATE_CHANNEL_NAME);
  await channel.subscribe();
  
  await channel.send({
    type: 'broadcast',
    event: UPDATE_EVENT_NAME,
    payload,
  });

  // Log in user_access_logs with structured action_details
  try {
    await supabase.from('user_access_logs').insert([{
      user_email: adminEmail,
      event_type: 'action',
      module: 'System Management',
      action_details: `SYSTEM_UPDATE|[${type.toUpperCase()}]|v${version}|${message}`,
      ip_address: '127.0.0.1'
    }]);
  } catch (e) {
    console.warn('Failed to log update event:', e);
  }
}

export async function fetchRecentSystemUpdates(): Promise<SystemUpdateLogRecord[]> {
  try {
    const { data, error } = await supabase
      .from('user_access_logs')
      .select('*')
      .eq('module', 'System Management')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return data.map((log: any) => {
      const details = log.action_details || '';
      let type: 'soft_update' | 'force_update' = 'soft_update';
      let version = APP_VERSION;
      let message = details;

      if (details.includes('SYSTEM_UPDATE')) {
        const parts = details.split('|');
        if (parts[1]?.includes('FORCE')) type = 'force_update';
        if (parts[2]) version = parts[2].replace('v', '');
        if (parts[3]) message = parts[3];
      } else if (details.toLowerCase().includes('force')) {
        type = 'force_update';
      }

      return {
        id: log.id,
        version,
        type,
        message,
        admin_email: log.user_email || 'admin@hyperfeeds.co.zw',
        timestamp: log.created_at,
      };
    });
  } catch (e) {
    console.warn('Error fetching system updates history:', e);
    return [];
  }
}

export function computeUpdateStatus(
  installedVersion: string,
  latestBroadcast: SystemUpdatePayload | null
): { state: UpdateStatusState; label: string; badgeColor: string; description: string } {
  if (!latestBroadcast || latestBroadcast.version === installedVersion) {
    return {
      state: 'up_to_date',
      label: '🟢 UP TO DATE',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description: `Running latest build (${installedVersion}). System operating normally.`,
    };
  }

  if (latestBroadcast.type === 'soft_update') {
    return {
      state: 'soft_update_available',
      label: '🟡 UPDATE AVAILABLE',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      description: `New version (${latestBroadcast.version}) announced. Update available when convenient.`,
    };
  }

  return {
    state: 'force_update_pending',
    label: '🔴 CRITICAL PUSH ACTIVE',
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
    description: `Critical update (${latestBroadcast.version}) forced by Admin. Auto-refresh in progress.`,
  };
}
