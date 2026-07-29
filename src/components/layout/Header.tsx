import { useEffect, useRef, useState } from 'react';
import { Bell, Loader2, Search, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import NetworkStatusBadge from '../ui/NetworkStatusBadge';

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
    </header>
  );
}
