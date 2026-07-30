import { useEffect, useRef, useState } from 'react';
import { Bell, Loader2, Search, Menu, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Radio, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import NetworkStatusBadge from '../ui/NetworkStatusBadge';
import { UPDATE_CHANNEL_NAME, UPDATE_EVENT_NAME, SystemUpdatePayload, fetchRecentSystemUpdates } from '../../lib/updateManager';
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
  const updateRef = useRef<HTMLDivElement>(null);

  // System Update state
  const [softUpdate, setSoftUpdate] = useState<SystemUpdatePayload | null>(null);
  const [forceUpdateModal, setForceUpdateModal] = useState<SystemUpdatePayload | null>(null);
  const [countdown, setCountdown] = useState<number>(5);
  const [updateMenuOpen, setUpdateMenuOpen] = useState(false);

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
      if (updateMenuOpen && updateRef.current && !updateRef.current.contains(event.target as Node)) {
        setUpdateMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, updateMenuOpen]);

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
        {/* User System Version & Update Status Tab */}
        <div className="relative" ref={updateRef}>
          <button
            onClick={() => setUpdateMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-full transition-all border shadow-xs ${
              softUpdate
                ? 'bg-gradient-to-r from-amber-500 via-teal-600 to-emerald-600 text-white border-amber-300 animate-pulse hover:scale-105'
                : 'bg-teal-50/80 text-teal-800 border-teal-200 hover:bg-teal-100'
            }`}
          >
            {softUpdate ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Update Available ({softUpdate.version})</span>
                <span className="ml-1 px-1.5 py-0.5 bg-white text-teal-900 rounded text-[10px] font-black uppercase shadow-xs">
                  Apply
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>MES {APP_VERSION}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </>
            )}
          </button>

          {/* System Update Details Popover Card */}
          {updateMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">HYPER MES System Version</h4>
                    <p className="text-[10px] text-slate-400 font-mono">Active Build: {APP_VERSION}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Online
                </span>
              </div>

              {softUpdate ? (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>New Update Available ({softUpdate.version})</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {softUpdate.message || 'New manufacturing features, BOM optimizations, and performance enhancements.'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Announced by: {softUpdate.admin_email || 'System Admin'}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Apply & Refresh Now
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>System Up to Date</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    You are running the latest production build of HYPER MES ({APP_VERSION}). System operating at optimal performance.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-500" /> Check for Updates / Refresh
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
