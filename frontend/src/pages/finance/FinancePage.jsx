import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Calendar,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  RefreshCw,
  Receipt,
  FileSpreadsheet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { financeApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Maintenance',
  'Marketing',
  'Supplies',
  'Taxes',
  'Logistics',
  'Miscellaneous',
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_wallet', label: 'EasyPaisa / JazzCash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export function FinancePage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cashRegister, setCashRegister] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [formModal, setFormModal] = useState({ open: false, mode: 'create', expense: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, expense: null });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Miscellaneous',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'cash',
    referenceNo: '',
    description: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, sumRes, regRes] = await Promise.all([
        financeApi.fetchExpenses({
          search: search || undefined,
          category: selectedCategory || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        financeApi.getFinancialSummary({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        financeApi.getCashRegister(),
      ]);

      if (expRes && expRes.data) {
        setExpenses(expRes.data);
      }
      if (sumRes && sumRes.data) {
        setSummary(sumRes.data);
      }
      if (regRes && regRes.data) {
        setCashRegister(regRes.data);
      }
    } catch (err) {
      console.error('Failed to load financial data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setErrorMsg('');
    setFormData({
      title: '',
      category: 'Miscellaneous',
      amount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'cash',
      referenceNo: '',
      description: '',
    });
    setFormModal({ open: true, mode: 'create', expense: null });
  };

  const handleOpenEdit = (exp) => {
    setErrorMsg('');
    setFormData({
      title: exp.title || '',
      category: exp.category || 'Miscellaneous',
      amount: exp.amount || '',
      expenseDate: exp.expenseDate ? exp.expenseDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      paymentMethod: exp.paymentMethod || 'cash',
      referenceNo: exp.referenceNo || '',
      description: exp.description || '',
    });
    setFormModal({ open: true, mode: 'edit', expense: exp });
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.amount || parseFloat(formData.amount) <= 0) {
      setErrorMsg('Please enter a valid expense title and amount.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (formModal.mode === 'create') {
        await financeApi.createExpense(formData);
      } else {
        await financeApi.updateExpense(formModal.expense.id, formData);
      }
      setFormModal({ open: false, mode: 'create', expense: null });
      loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.expense) return;
    setSubmitting(true);
    try {
      await financeApi.deleteExpense(deleteModal.expense.id);
      setDeleteModal({ open: false, expense: null });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Management & Accounting"
        subtitle="Profit & Loss, Cost of Goods Sold (COGS), Cash Register reconciliation, and operational expense ledger."
        breadcrumbs={[{ label: 'Finance' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              title="Refresh"
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus size={16} /> Record Expense
            </button>
          </div>
        }
      />

      {/* P&L Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sales Revenue</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatCurrency(summary?.revenue || 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {summary?.totalTransactions || 0} completed orders
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cost of Goods (COGS)</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatCurrency(summary?.cogs || 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Gross Profit: {formatCurrency(summary?.grossProfit || 0)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Receipt size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-500/10 to-red-500/5 border-rose-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Operating Expenses</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {formatCurrency(summary?.totalExpenses || 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Rent, Utilities, Payroll, Ops</p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <ArrowDownRight size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Net Profit</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  (summary?.netProfit || 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(summary?.netProfit || 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Margin: {summary?.profitMarginPercent || 0}%
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <TrendingUp size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* Daily Cash Register Reconciliation Widget */}
      {cashRegister && (
        <Card className="p-5 border-l-4 border-l-emerald-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="text-emerald-600 dark:text-emerald-400" size={20} />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Daily Cash Register Reconciliation ({cashRegister.date})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Automated cash drawer calculation comparing opening float, cash sales, and day payouts.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-slate-400">Opening Float</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatCurrency(cashRegister.openingFloat)}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                <p className="text-emerald-700 dark:text-emerald-300">Cash Sales Today</p>
                <p className="font-semibold text-emerald-800 dark:text-emerald-200 mt-0.5">
                  +{formatCurrency(cashRegister.cashSales)}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40">
                <p className="text-rose-700 dark:text-rose-300">Cash Expenses Disbursed</p>
                <p className="font-semibold text-rose-800 dark:text-rose-200 mt-0.5">
                  -{formatCurrency(cashRegister.cashExpenses)}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <p className="text-blue-700 dark:text-blue-300 font-bold">Expected Drawer Cash</p>
                <p className="font-bold text-blue-900 dark:text-blue-100 text-sm mt-0.5">
                  {formatCurrency(cashRegister.expectedCashInDrawer)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Expense Management Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-200"
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card padding={false}>
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading expense ledger...</div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No expense records found"
            description="Record commercial operational expenses to calculate authentic Net Profit."
            action={
              <button
                onClick={handleOpenCreate}
                className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
              >
                Record Expense
              </button>
            }
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Expense Date</Th>
                <Th>Title / Description</Th>
                <Th>Category</Th>
                <Th>Payment Method</Th>
                <Th>Reference / Invoice #</Th>
                <Th>Recorded By</Th>
                <Th className="text-right">Amount (PKR)</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {expenses.map((exp) => (
                <Tr key={exp.id}>
                  <Td>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {formatDate(exp.expenseDate)}
                    </span>
                  </Td>
                  <Td>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {exp.title}
                    </p>
                    {exp.description && (
                      <p className="text-xs text-slate-400 truncate max-w-xs">{exp.description}</p>
                    )}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {exp.category}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs capitalize text-slate-600 dark:text-slate-400">
                      {exp.paymentMethod?.replace('_', ' ')}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-slate-500">
                      {exp.referenceNo || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-500">
                      {exp.createdByName || 'Administrator'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(exp.amount)}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user?.role === 'admin' && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit expense"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, expense: exp })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete expense"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, mode: 'create', expense: null })}
        title={formModal.mode === 'create' ? 'Record Pharmacy Expense' : 'Edit Expense Record'}
        size="md"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Expense Title / Purpose *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Commercial Electricity Bill (IESCO)"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Amount (PKR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="25000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={formData.expenseDate}
                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Reference / Invoice / Receipt #
            </label>
            <input
              type="text"
              placeholder="e.g. IESCO-889921 or RENT-OCT-2026"
              value={formData.referenceNo}
              onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows="2"
              placeholder="Additional explanation or breakdown..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setFormModal({ open: false, mode: 'create', expense: null })}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : formModal.mode === 'create' ? 'Record Expense' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, expense: null })}
        title="Confirm Soft Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to remove expense record for{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {deleteModal.expense?.title}
            </span>{' '}
            ({formatCurrency(deleteModal.expense?.amount || 0)})?
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteModal({ open: false, expense: null })}
              className="px-3.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
