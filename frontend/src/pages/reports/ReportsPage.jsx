import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, AlertTriangle, Clock, TrendingUp,
  ShoppingBag, Package, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader, StatCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { EmptyState } from '../../components/common/EmptyState';
import {
  demoLowStockAlerts, demoNearExpiryAlerts, demoSalesTrend,
  demoTopMedicines, demoBatches
} from '../../data/demoData';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { reportApi } from '../../api';
import clsx from 'clsx';

const REPORT_TABS = [
  { id: 'sales',      label: 'Sales Summary',   icon: TrendingUp    },
  { id: 'low_stock',  label: 'Low Stock',       icon: AlertTriangle },
  { id: 'expiry',     label: 'Near Expiry',     icon: Clock         },
  { id: 'valuation',  label: 'Stock Valuation', icon: Package       },
];

export function ReportsPage() {
  const { settings } = useSettings();
  const { isDemo } = useAuth();
  const [activeTab, setActiveTab] = useState('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [salesData, setSalesData] = useState({ summary: {}, dailyTrend: demoSalesTrend, topMedicines: demoTopMedicines });
  const [valuationData, setValuationData] = useState({ summary: {}, batches: [] });
  const [lowStockData, setLowStockData] = useState(demoLowStockAlerts);
  const [nearExpiryData, setNearExpiryData] = useState(demoNearExpiryAlerts);

  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'sales') {
        const res = await reportApi.fetchSalesReport({ startDate: dateFrom || undefined, endDate: dateTo || undefined });
        if (res?.data) {
          setSalesData({
            summary: res.data.summary || {},
            dailyTrend: res.data.dailyTrend?.length > 0 ? res.data.dailyTrend : demoSalesTrend,
            topMedicines: res.data.topMedicines?.length > 0 ? res.data.topMedicines : demoTopMedicines,
          });
          setIsLive(true);
        }
      } else if (activeTab === 'valuation') {
        const res = await reportApi.fetchStockValuation();
        if (res?.data) {
          setValuationData(res.data);
          setIsLive(true);
        }
      } else if (activeTab === 'low_stock') {
        const res = await reportApi.fetchLowStock();
        if (res?.data) {
          setLowStockData(res.data.map(r => ({
            id: r.medicine_id,
            name: `${r.generic_name} (${r.brand_name})`,
            stock: r.total_active_stock,
            reorderLevel: r.reorder_level,
            unit: 'units',
          })));
          setIsLive(true);
        }
      } else if (activeTab === 'expiry') {
        const res = await reportApi.fetchNearExpiry();
        if (res?.data) {
          setNearExpiryData(res.data.map(r => ({
            id: r.batch_id,
            name: `${r.generic_name} (${r.brand_name})`,
            batch: r.batch_number,
            expiryDate: r.expiry_date,
            qty: r.quantity_on_hand,
            daysLeft: r.days_until_expiry,
          })));
          setIsLive(true);
        }
      }
    } catch {
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, dateFrom, dateTo]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  return (
    <div>
      <PageHeader
        title="Business Reports & Analytics"
        subtitle={
          isLive
            ? "Dynamic reporting engine querying MySQL views and audit ledgers."
            : "Business insights and stock analysis"
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Reports' }]}
        actions={
          <button
            onClick={loadReportData}
            title="Refresh current report"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 overflow-x-auto">
        {REPORT_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-green-600 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Sales Summary Tab ─── */}
      {activeTab === 'sales' && (
        <div className="flex flex-col gap-5">
          <Card className="p-0" padding={false}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <CardHeader title="Revenue Trend" subtitle="Daily transaction volume" />
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={salesData.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => [formatCurrency(v, settings.currencyCode), 'Revenue']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0" padding={false}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <CardHeader title="Top Selling Medicines" />
            </div>
            <Table>
              <Thead><tr><Th>Medicine</Th><Th>Units Sold</Th><Th>Revenue</Th></tr></Thead>
              <Tbody>
                {salesData.topMedicines.map((m, i) => (
                  <Tr key={m.genericName || m.name || i}>
                    <Td className="font-medium">
                      <span className="text-slate-400 mr-2">#{i+1}</span>
                      {m.genericName ? `${m.genericName} (${m.brandName})` : m.name}
                    </Td>
                    <Td>{(m.unitsSold || m.sold || 0).toLocaleString()} units</Td>
                    <Td className="font-semibold text-green-600">
                      {formatCurrency(m.totalRevenue || (m.sold ? m.sold * 18 : 0), settings.currencyCode)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ─── Low Stock Tab ─── */}
      {activeTab === 'low_stock' && (
        <Card padding={false}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <CardHeader title="Low Stock Inventory Alerts" subtitle="Items falling below reorder threshold" />
          </div>
          {lowStockData.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="All inventory adequately stocked" />
          ) : (
            <Table>
              <Thead><tr><Th>Medicine</Th><Th>Current Stock</Th><Th>Reorder Level</Th><Th>Status</Th></tr></Thead>
              <Tbody>
                {lowStockData.map(item => (
                  <Tr key={item.id}>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">{item.name}</Td>
                    <Td className="font-bold text-amber-600">{item.stock} units</Td>
                    <Td className="text-slate-500">{item.reorderLevel} units</Td>
                    <Td><span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">Reorder Required</span></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      )}

      {/* ─── Near Expiry Tab ─── */}
      {activeTab === 'expiry' && (
        <Card padding={false}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <CardHeader title="Near-Expiry Batches" subtitle="Batches expiring within configured threshold" />
          </div>
          {nearExpiryData.length === 0 ? (
            <EmptyState icon={Clock} title="No batches nearing expiration" />
          ) : (
            <Table>
              <Thead><tr><Th>Medicine</Th><Th>Batch No.</Th><Th>Expiry Date</Th><Th>Quantity</Th><Th>Status</Th></tr></Thead>
              <Tbody>
                {nearExpiryData.map(item => (
                  <Tr key={item.id}>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">{item.name}</Td>
                    <Td className="font-mono text-xs">{item.batch}</Td>
                    <Td className="font-medium text-red-500">{formatDate(item.expiryDate)}</Td>
                    <Td className="font-semibold">{item.qty} units</Td>
                    <Td><span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-800">Near Expiry</span></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      )}

      {/* ─── Stock Valuation Tab ─── */}
      {activeTab === 'valuation' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Active Inventory (Cost)"
              value={formatCurrency(valuationData.summary?.activeStockValueCost || 128450, settings.currencyCode)}
              icon={Package}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600"
            />
            <StatCard
              title="Potential Retail Value"
              value={formatCurrency(valuationData.summary?.activeStockValueRetail || 178900, settings.currencyCode)}
              icon={TrendingUp}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600"
            />
            <StatCard
              title="Expired Stock Loss"
              value={formatCurrency(valuationData.summary?.expiredStockLossCost || 0, settings.currencyCode)}
              icon={AlertTriangle}
              iconBg="bg-red-100 dark:bg-red-900/30"
              iconColor="text-red-500"
            />
          </div>

          <Card padding={false}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <CardHeader title="Batch Valuation Breakdown" subtitle="Ranked by total cost valuation" />
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th>Batch</Th>
                  <Th>Stock</Th>
                  <Th>Unit Cost</Th>
                  <Th>Unit Retail</Th>
                  <Th>Total Cost Value</Th>
                </tr>
              </Thead>
              <Tbody>
                {(valuationData.batches?.length > 0 ? valuationData.batches : demoBatches.filter(b => b.status === 'active')).map(b => (
                  <Tr key={b.id}>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">
                      {b.genericName ? `${b.genericName} (${b.brandName})` : b.medicine}
                    </Td>
                    <Td className="font-mono text-xs">{b.batchNo}</Td>
                    <Td className="font-semibold">{Number(b.qty).toLocaleString()}</Td>
                    <Td className="text-slate-500">{formatCurrency(b.costPrice, settings.currencyCode)}</Td>
                    <Td>{formatCurrency(b.sellingPrice, settings.currencyCode)}</Td>
                    <Td className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(b.totalCostValue || (b.qty * b.costPrice), settings.currencyCode)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
