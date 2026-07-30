import { supabase } from './supabase';

export interface SystemUpdatePayload {
  type: 'soft_update' | 'force_update';
  version: string;
  message: string;
  timestamp: string;
  admin_email?: string;
}

export const UPDATE_CHANNEL_NAME = 'mes_system_updates_channel';
export const UPDATE_EVENT_NAME = 'system_update_event';

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

  // Log in user access logs
  try {
    await supabase.from('user_access_logs').insert([{
      user_email: adminEmail,
      event_type: 'action',
      module: 'System Management',
      action_details: `Admin broadcasted ${type.toUpperCase()} (${version}): ${message}`,
      ip_address: '127.0.0.1'
    }]);
  } catch (e) {
    console.warn('Failed to log update event:', e);
  }
}
