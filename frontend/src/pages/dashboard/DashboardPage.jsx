import { useState, useEffect } from 'react';
import {
  Pill,
  Archive,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  Building2,
  Stethoscope,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Receipt,
  Tag,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../api';

export function DashboardPage() {
  const { settings } = useSettings();
  const { user, isDemo } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: {
      totalMedicines: 0,
      totalStockUnits: 0,
      todayRevenue: 0,
      todaySales: 0,
      lowStockCount: 0,
      nearExpiryCount: 0,
      totalCustomers: 0,
      totalSuppliers: 0,
      saleableStockUnits: 0,
      blockedStockUnits: 0,
      totalInquiries: 0,
      pendingInquiries: 0,
    },
    recentSales: [],
    salesTrend: [],
    recentInquiries: [],
    lowStockAlerts: [],
    nearExpiryAlerts: [],
    categoryBreakdown: [],
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getDashboardSummary();
      if (res && res.data) {
        setData({
          stats: res.data.stats || {},
          recentSales: res.data.recentSales || [],
          salesTrend: res.data.salesTrend || [],
          recentInquiries: res.data.recentInquiries || [],
          lowStockAlerts: res.data.lowStockAlerts || [],
          nearExpiryAlerts: res.data.nearExpiryAlerts || [],
          categoryBreakdown: res.data.categoryBreakdown || [],
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics from live API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const { stats, recentSales, salesTrend, lowStockAlerts, nearExpiryAlerts, categoryBreakdown } = data;

  // 6 Primary Summary Metric Cards (as specifically requested)
  const primarySummaryCards = [
    {
      id: 'total-medicines',
      title: 'Total Medicines',
      value: (stats.totalMedicines || 0).toLocaleString(),
      subtext: 'Active catalog items',
      icon: Pill,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
      borderAccent: 'border-l-4 border-l-emerald-500',
      linkTo: '/medicines',
    },
    {
      id: 'total-stock',
      title: 'Total Stock',
      value: (stats.totalStockUnits || stats.saleableStockUnits || 0).toLocaleString(),
      subtext: `${(stats.saleableStockUnits || 0).toLocaleString()} saleable units`,
      icon: Archive,
      iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
      borderAccent: 'border-l-4 border-l-blue-500',
      linkTo: '/inventory',
    },
    {
      id: 'today-sales',
      title: "Today's Sales",
      value: formatCurrency(stats.todayRevenue || 0, settings.currencyCode),
      subtext: `${stats.todaySales || 0} completed orders`,
      icon: TrendingUp,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
      borderAccent: 'border-l-4 border-l-indigo-500',
      linkTo: '/sales',
    },
    {
      id: 'low-stock',
      title: 'Low Stock',
      value: (stats.lowStockCount || 0).toLocaleString(),
      subtext: 'Below reorder threshold',
      icon: AlertTriangle,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
      borderAccent: 'border-l-4 border-l-amber-500',
      alert: (stats.lowStockCount || 0) > 0,
      linkTo: '/inventory',
    },
    {
      id: 'expiring-medicines',
      title: 'Expiring Medicines',
      value: (stats.nearExpiryCount || 0).toLocaleString(),
      subtext: 'Expiring in ≤ 90 days',
      icon: Clock,
      iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
      borderAccent: 'border-l-4 border-l-rose-500',
      alert: (stats.nearExpiryCount || 0) > 0,
      linkTo: '/inventory',
    },
    {
      id: 'total-customers',
      title: 'Total Customers',
      value: (stats.totalCustomers || 0).toLocaleString(),
      subtext: 'Registered client profiles',
      icon: Users,
      iconBg: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
      borderAccent: 'border-l-4 border-l-slate-400',
      linkTo: '/customers',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Pharmacy Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time inventory, sales analytics, and clinical alerts from TiDB Cloud.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            title="Refresh database metrics"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <Receipt size={14} />
            <span>Open POS</span>
          </Link>

          <Link
            to="/medicines/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40 text-xs font-semibold hover:bg-emerald-100/80 transition-colors"
          >
            <PlusCircle size={14} />
            <span>Add Medicine</span>
          </Link>
        </div>
      </div>

      {/* 1. Summary Cards Grid (6 Clean Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {primarySummaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.id}
              to={card.linkTo}
              className={`block bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all ${card.borderAccent}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {card.title}
                </span>
                <span className={`p-1.5 rounded-lg ${card.iconBg}`}>
                  <Icon size={16} />
                </span>
              </div>
              <div className="mt-2.5">
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {loading ? '—' : card.value}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {card.subtext}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 2. Charts Section (Sales Revenue & Category Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales Trend (Area Chart) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Sales & Revenue Analytics
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Past 14 days completed sales revenue
              </p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1"
            >
              Detailed Report <ArrowRight size={13} />
            </Link>
          </div>

          <div className="pt-4 h-64 w-full">
            {salesTrend.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Receipt size={32} className="stroke-[1.5] mb-2 opacity-40" />
                <p className="text-xs font-medium">No sales recorded in the past 14 days</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Transactions completed at the POS terminal will appear here.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val, settings.currencyCode), 'Revenue']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#059669"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown (Bar Chart) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Inventory Categories
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Medicines registered per category
              </p>
            </div>
            <Link
              to="/medicines/categories"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1"
            >
              Categories <ArrowRight size={13} />
            </Link>
          </div>

          <div className="pt-4 h-64 w-full">
            {categoryBreakdown.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Tag size={32} className="stroke-[1.5] mb-2 opacity-40" />
                <p className="text-xs font-medium">No category distribution data</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.4} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={{ fontSize: 10, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => (val.length > 16 ? `${val.substring(0, 16)}…` : val)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Bar dataKey="medicineCount" fill="#0284c7" radius={[0, 4, 4, 0]} name="Medicines" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 3. Alerts & Real Data Section (Recent Sales, Low Stock, Near Expiry) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Sales Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Recent Sales
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latest customer checkouts
              </p>
            </div>
            <Link
              to="/sales"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1"
            >
              View All <ArrowRight size={13} />
            </Link>
          </div>

          <div className="pt-3 flex-1 overflow-x-auto">
            {recentSales.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Receipt size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  No sales recorded yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Process your first customer invoice in the{' '}
                  <Link to="/pos" className="text-emerald-600 underline">
                    POS terminal
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2 font-medium">Invoice</th>
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentSales.map((sale) => (
                    <tr key={sale.id || sale.invoiceNumber} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {sale.invoiceNumber || `INV-${sale.id}`}
                      </td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">
                        {sale.customer || 'Walk-in'}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(sale.total, settings.currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Low Stock Alerts
                </h2>
                {lowStockAlerts.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {lowStockAlerts.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Items requiring purchase reorders
              </p>
            </div>
            <Link
              to="/inventory"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1"
            >
              Inventory <ArrowRight size={13} />
            </Link>
          </div>

          <div className="pt-3 flex-1">
            {lowStockAlerts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  All inventory healthy
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No medicines currently below their reorder levels.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {lowStockAlerts.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.brandName || item.genericName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.genericName} • {item.strength || ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        {item.stock} left
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Reorder at {item.reorderLevel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Medicines Approaching Expiry */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Approaching Expiry
                </h2>
                {nearExpiryAlerts.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                    {nearExpiryAlerts.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Batches expiring within 90 days
              </p>
            </div>
            <Link
              to="/inventory"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1"
            >
              Batches <ArrowRight size={13} />
            </Link>
          </div>

          <div className="pt-3 flex-1">
            {nearExpiryAlerts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <ShieldCheck size={28} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  No immediate expiries
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  All active batches have valid expiration dates &gt; 90 days.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {nearExpiryAlerts.map((batch) => (
                  <div key={batch.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {batch.brandName || batch.genericName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        Batch: {batch.batchNumber} • {batch.quantity} units
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {batch.daysUntilExpiry} days
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Exp: {formatDate(batch.expiryDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
