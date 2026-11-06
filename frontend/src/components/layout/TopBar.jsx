import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Sun, Moon, Bell, LogOut, User, Settings, ChevronDown, Database, RefreshCw,
  AlertTriangle, Clock, ShieldCheck, CheckCheck, Inbox
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { systemApi, notificationApi } from '../../api';

export function TopBar({ onMenuToggle }) {
  const { user, logout, isDemo } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [healthStatus, setHealthStatus] = useState({ loading: true, status: 'checking', dbOk: false });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await systemApi.checkSystemHealth();
      if (res && res.database) {
        setHealthStatus({
          loading: false,
          status: res.status,
          dbOk: Boolean(res.database.ok && res.database.connected),
          host: res.database.host,
        });
      } else {
        setHealthStatus({ loading: false, status: 'offline', dbOk: false });
      }
    } catch {
      setHealthStatus({ loading: false, status: 'offline', dbOk: false });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.fetchNotifications({ limit: 15 });
      if (res && res.data) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadNotifications();
    const interval = setInterval(() => {
      checkHealth();
      loadNotifications();
    }, 45000);
    return () => clearInterval(interval);
  }, [checkHealth, loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await notificationApi.markAsRead(notif.id);
        setUnreadCount(c => Math.max(0, c - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: 1 } : n));
      }
      setNotifOpen(false);
      if (notif.link) {
        navigate(notif.link);
      }
    } catch (err) {
      console.error('Failed to handle notification click:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      {/* Left: mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Center: System & Database Health Badge */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          onClick={checkHealth}
          title="Click to re-check API & MySQL connectivity"
          className={clsx(
            'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            healthStatus.dbOk
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : healthStatus.status === 'degraded'
              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
          )}
        >
          <span
            className={clsx(
              'w-2 h-2 rounded-full',
              healthStatus.dbOk
                ? 'bg-emerald-500'
                : healthStatus.status === 'degraded'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-slate-400'
            )}
          />
          <Database size={13} className="opacity-70" />
          <span>
            {healthStatus.dbOk
              ? 'API Live • TiDB Serverless'
              : healthStatus.status === 'degraded'
              ? 'API Online • Database Reconnecting'
              : 'API Offline • Demo Mode'}
          </span>
          <RefreshCw size={11} className={clsx('opacity-50 hover:opacity-100', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 px-1.5 py-0.2 text-[10px] font-bold bg-rose-600 text-white rounded-full min-w-4 text-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-20 overflow-hidden">
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                      <Inbox size={28} className="opacity-40" />
                      <span>All caught up! No notifications.</span>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={clsx(
                          'w-full p-3 text-left transition-colors flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50',
                          !n.isRead && 'bg-emerald-50/40 dark:bg-emerald-950/20'
                        )}
                      >
                        <div
                          className={clsx(
                            'p-2 rounded-xl shrink-0 mt-0.5',
                            n.type === 'low_stock' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
                            n.type === 'near_expiry' && 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
                            n.type === 'new_prescription' && 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
                            n.type === 'system' && 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          )}
                        >
                          {n.type === 'low_stock' && <AlertTriangle size={15} />}
                          {n.type === 'near_expiry' && <Clock size={15} />}
                          {n.type === 'new_prescription' && <ShieldCheck size={15} />}
                          {n.type === 'system' && <Bell size={15} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(o => !o)}
            className={clsx(
              'flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg',
              'text-slate-700 dark:text-slate-200',
              'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
            )}
            aria-label="User menu"
          >
            <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-semibold text-green-700 dark:text-green-400">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm font-medium">{user?.name}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
                  {isDemo && (
                    <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-semibold">
                      Demo Mode
                    </span>
                  )}
                </div>

                {/* Menu items */}
                <div className="p-1">
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                  >
                    <Settings size={15} />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
