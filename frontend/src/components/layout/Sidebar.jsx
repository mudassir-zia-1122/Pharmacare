import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Pill,
  Archive,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  Tag,
  Layers,
  FileText,
  Shield,
  X,
  Stethoscope,
  UserCheck,
  DollarSign,
  HeartPulse,
  UserPlus,
  Calendar,
  Activity
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

// ─── Complete Navigation Items ──────────────────────────────────────────────
export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
    roles: ['admin', 'pharmacist', 'stock_manager', 'cashier'],
  },
  {
    label: 'Medicines',
    icon: Pill,
    roles: ['admin', 'pharmacist', 'stock_manager'],
    children: [
      { label: 'Catalogue', to: '/medicines', icon: Pill },
      { label: 'Categories', to: '/medicines/categories', icon: Tag },
      { label: 'Dosage Forms', to: '/medicines/dosage-forms', icon: Layers },
    ],
  },
  {
    label: 'Inventory',
    icon: Archive,
    to: '/inventory',
    roles: ['admin', 'pharmacist', 'stock_manager'],
  },
  {
    label: 'Categories',
    icon: Tag,
    to: '/medicines/categories',
    roles: ['admin', 'pharmacist', 'stock_manager'],
  },
  {
    label: 'Suppliers',
    icon: Building2,
    to: '/suppliers',
    roles: ['admin', 'stock_manager'],
  },
  {
    label: 'Customers',
    icon: UserCheck,
    to: '/customers',
    roles: ['admin', 'pharmacist', 'cashier'],
  },
  {
    label: 'Patients',
    icon: HeartPulse,
    to: '/patients',
    roles: ['admin', 'pharmacist', 'cashier'],
  },
  {
    label: 'Doctors',
    icon: Stethoscope,
    to: '/doctors',
    roles: ['admin', 'pharmacist'],
  },
  {
    label: 'Appointments',
    icon: Calendar,
    to: '/appointments',
    roles: ['admin', 'doctor', 'reception', 'pharmacist'],
  },
  {
    label: 'Clinic Queue',
    icon: Activity,
    to: '/appointments/queue',
    roles: ['admin', 'doctor', 'reception', 'pharmacist'],
  },
  {
    label: 'Reception Desk',
    icon: UserPlus,
    to: '/reception',
    roles: ['admin', 'doctor', 'reception', 'pharmacist'],
  },
  {
    label: 'Sales',
    icon: FileText,
    to: '/sales',
    roles: ['admin', 'pharmacist', 'cashier'],
  },
  {
    label: 'Purchases',
    icon: ShoppingCart,
    to: '/purchases',
    roles: ['admin', 'stock_manager'],
  },
  {
    label: 'Finance',
    icon: DollarSign,
    to: '/finance',
    roles: ['admin', 'stock_manager'],
  },
  {
    label: 'Prescriptions',
    icon: Shield,
    to: '/prescriptions',
    roles: ['admin', 'pharmacist'],
    badge: 'Restricted',
  },
  {
    label: 'Inquiries',
    icon: Stethoscope,
    to: '/inquiries',
    roles: ['admin', 'pharmacist'],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    to: '/reports',
    roles: ['admin', 'pharmacist', 'stock_manager'],
  },
  {
    label: 'Users',
    icon: Users,
    to: '/users',
    roles: ['admin'],
  },
  {
    label: 'Settings',
    icon: Settings,
    to: '/settings',
    roles: ['admin'],
  },
];

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({ item, onClose }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { hasRole } = useAuth();

  // Role guard
  if (item.roles && !hasRole(item.roles)) return null;

  const isChildActive = item.children?.some(c => location.pathname.startsWith(c.to));
  const isActive = item.to ? location.pathname === item.to : false;

  if (item.children) {
    return (
      <div className="my-0.5">
        <button
          onClick={() => setOpen(o => !o)}
          className={clsx(
            'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-medium',
            'transition-colors duration-150',
            isChildActive
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
          )}
        >
          <span className="flex items-center gap-2.5">
            <item.icon size={16} className={clsx('shrink-0', isChildActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')} />
            {item.label}
          </span>
          {open || isChildActive ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </button>
        {(open || isChildActive) && (
          <div className="ml-5 pl-2 mt-1 border-l border-slate-200 dark:border-slate-800 flex flex-col gap-0.5">
            {item.children.map(child => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onClose}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors duration-150',
                  isActive
                    ? 'bg-emerald-600 text-white font-medium shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <child.icon size={13} className="shrink-0" />
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      className={clsx(
        'flex items-center justify-between gap-2.5 px-3 py-2 my-0.5 rounded-lg text-xs font-medium transition-all duration-150',
        isActive
          ? 'bg-emerald-600 text-white font-semibold shadow-xs'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
      )}
    >
      <span className="flex items-center gap-2.5">
        <item.icon size={16} className={clsx('shrink-0', isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500')} />
        <span>{item.label}</span>
      </span>
      {item.badge && (
        <span className={clsx(
          'text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide uppercase',
          isActive
            ? 'bg-white/20 text-white'
            : item.badge === 'Restricted'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/40'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        )}>
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

// ─── Sidebar Component ────────────────────────────────────────────────────────
export function Sidebar({ mobileOpen, onMobileClose }) {
  const { user } = useAuth();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0 shadow-xs">
            <Pill size={20} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">PharmaCare</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Clinical Suite</p>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-thin">
        <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} item={item} onClose={onMobileClose} />
        ))}
      </nav>

      {/* User Footer Card */}
      {user && (
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5 p-1.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0 border border-emerald-200 dark:border-emerald-800">
              {user.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name || user.username}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize truncate">{user.role?.replace('_', ' ')}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="System Online" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen border-r border-slate-200/80 dark:border-slate-800 fixed top-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-slate-200 dark:border-slate-800 z-50 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
