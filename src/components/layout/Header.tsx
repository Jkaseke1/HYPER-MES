import { useEffect, useRef, useState } from 'react';
import { Bell, Loader2, Search, Menu, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import NetworkStatusBadge from '../ui/NetworkStatusBadge';
import { UPDATE_CHANNEL_NAME, UPDATE_EVENT_NAME, SystemUpdatePayload } from '../../lib/updateManager';
import { APP_VERSION } from '../../config/version';

interface NotificationItem {
  id: string;
  section: string;
  observation: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

interface HeaderProps {
  title: string;
  onMobileMenuToggle?: () => void;
}

export default function Header({ title, onMobileMenuToggle }: HeaderProps) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // System Update state
  const [softUpdate, setSoftUpdate] = useState<SystemUpdatePayload | null>(null);
  const [forceUpdateModal, setForceUpdateModal] = useState<SystemUpdatePayload | null>(null);
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const history = await fetchRecentSystemUpdates();
        if (history && history.length > 0) {
          const latest = history[0];
          // Check if latest broadcast exists
          if (latest && latest.type === 'soft_update') {
            setSoftUpdate({
              type: 'soft_update',
              version: latest.version,
              message: latest.message,
              timestamp: latest.timestamp,
              admin_email: latest.admin_email,
            });
          }
        }
      } catch (e) {
        console.warn('Error checking initial updates in Header:', e);
      }
    }

    checkForUpdates();

    const channel = supabase
      .channel(UPDATE_CHANNEL_NAME)
      .on('broadcast', { event: UPDATE_EVENT_NAME }, (response) => {
        const payload: SystemUpdatePayload = response.payload;
        if (payload.type === 'soft_update') {
          setSoftUpdate(payload);
        } else if (payload.type === 'force_update') {
          setForceUpdateModal(payload);
          setCountdown(5);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!forceUpdateModal) return;
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [forceUpdateModal, countdown]);

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    production_manager: 'Production Manager',
    supervisor: 'Supervisor',
    warehouse_manager: 'Warehouse Manager',
    operator: 'Operator',
    finance: 'Finance',
  };

  useEffect(() => {
    let isMounted = true;
    async function loadNotifications() {
      setLoadingNotifications(true);
      const { data } = await supabase
        .from('recon_observations')
        .select('id, section, observation, severity, created_at')
        .order('created_at', { ascending: false })
        .limit(8);
      if (!isMounted) return;
      setNotifications(data ?? []);
      setLoadingNotifications(false);
    }
    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (open && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  const severityStyles: Record<string, string> = {
    critical: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
    info: 'text-slate-600 bg-slate-50',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
      {/* Mobile menu button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6 text-slate-600" />
        </button>
        <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Soft Update Notification Banner (Non-disruptive) */}
        {softUpdate && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold rounded-full shadow-md animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Update Available ({softUpdate.version || APP_VERSION})</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-1 px-2 py-0.5 bg-white text-teal-800 rounded-md text-[11px] font-extrabold hover:bg-teal-50 transition-colors flex items-center gap-1 shadow-xs"
            >
              <RefreshCw className="w-3 h-3" /> Update Now
            </button>
          </div>
        )}

        {/* LIVE ONLINE/OFFLINE STATUS LIGHT BADGE */}
        <NetworkStatusBadge />

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-56 lg:w-64"
          />
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5 text-slate-500" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">Recent Alerts</p>
                <span className="text-xs text-slate-400">{notifications.length} items</span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {loadingNotifications && (
                  <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading alerts...
                  </div>
                )}
                {!loadingNotifications && notifications.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No alerts logged yet.</p>
                )}
                {notifications.map((notification) => (
                  <div key={notification.id} className="border border-slate-100 rounded-lg p-2 hover:border-slate-200">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${severityStyles[notification.severity] || severityStyles.info}`}>
                        {notification.severity.toUpperCase()}
                      </span>
                      <span className="text-slate-400">{formatDate(notification.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{notification.section}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{notification.observation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-semibold">
            {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-700">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-slate-400">{roleLabels[profile?.role || ''] || profile?.role}</p>
          </div>
        </div>
      </div>

      {/* FORCE UPDATE MODAL OVERLAY */}
      {forceUpdateModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-red-500 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Critical System Update Pushed</h3>
            <p className="text-sm text-slate-600 mb-4">
              An administrator has pushed a critical system update ({forceUpdateModal.version}). Your active session will automatically refresh in:
            </p>
            
            <div className="w-20 h-20 bg-red-50 text-red-600 font-mono font-black text-3xl rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-200 shadow-inner">
              {countdown}s
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 animate-spin" /> Refresh Now
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
