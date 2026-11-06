import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Archive, AlertTriangle, Clock, XCircle, RefreshCw, Plus,
  SlidersHorizontal, Trash2, CheckCircle2, ShieldAlert,
  ArrowUpDown, History, FileText, Check
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, StatCard } from '../../components/common/Card';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { SearchBar } from '../../components/common/SearchBar';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import { demoBatches } from '../../data/demoData';
import { formatDate, formatCurrency, getExpiryStatus } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import {
  fetchBatches,
  createBatch,
  adjustStock,
  disposeExpiredBatch,
  fetchExpiryAlerts,
  fetchInventoryReports,
  fetchStockMovements
} from '../../api/inventory';
import { fetchMedicines } from '../../api/medicines';
import clsx from 'clsx';

const PAGE_SIZE = 10;

const TABS = [
  { id: 'all', label: 'All Batches', icon: Archive },
  { id: 'near_expiry', label: 'Near Expiry (90 Days)', icon: Clock },
  { id: 'expired', label: 'Expired & Blocked', icon: XCircle },
  { id: 'quarantined', label: 'Quarantined & Recalled', icon: AlertTriangle },
  { id: 'movements', label: 'Audit Movements', icon: History },
];

export function InventoryPage() {
  const { settings } = useSettings();
  const { isDemo, hasRole } = useAuth();
  const canManage = hasRole(['admin', 'pharmacist', 'stock_manager']);

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Live Data States
  const [batches, setBatches] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState({ expiredBatches: [], nearExpiry: [] });
  const [reports, setReports] = useState(null);
  const [movements, setMovements] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);

  const [summary, setSummary] = useState({ activeBatches: 0, expiredBatches: 0, recalledBatches: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [newBatchModal, setNewBatchModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState({ open: false, batch: null });
  const [disposeModal, setDisposeModal] = useState({ open: false, batch: null });
  const [alertFeedback, setAlertFeedback] = useState(null);

  // Form States
  const [newBatchForm, setNewBatchForm] = useState({
    medicineId: '',
    batchNumber: '',
    expiryDate: '',
    manufacturingDate: '',
    quantity: '',
    costPrice: '',
    sellingPrice: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    newQuantity: '',
    reason: '',
    movementType: 'AUDIT_ADJUSTMENT',
  });

  const [disposeReason, setDisposeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch batches & valuation reports
  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [batchesRes, reportsRes, alertsRes] = await Promise.all([
        fetchBatches({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          page,
          limit: PAGE_SIZE,
        }).catch(() => null),
        fetchInventoryReports().catch(() => null),
        fetchExpiryAlerts(90).catch(() => null),
      ]);

      if (batchesRes && batchesRes.data) {
        const items = batchesRes.data.items || batchesRes.data;
        setBatches(items);
        if (batchesRes.data.summary) {
          setSummary(batchesRes.data.summary);
        }
        setTotalCount(batchesRes.data.pagination?.totalItems ?? items.length);
        setTotalPages(batchesRes.data.pagination?.totalPages ?? (Math.ceil(items.length / PAGE_SIZE) || 1));
        setIsLive(true);
      }

      if (reportsRes && reportsRes.data) {
        setReports(reportsRes.data);
      }

      if (alertsRes && alertsRes.data) {
        setExpiryAlerts(alertsRes.data);
      }

      setIsLoading(false);
      return;
    } catch {
      setIsLive(false);
    }

    // Demo data fallback
    const filtered = demoBatches.filter(b => {
      const matchSearch = !search || b.medicine.toLowerCase().includes(search.toLowerCase()) || b.batchNo.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || b.status === statusFilter;
      return matchSearch && matchStatus;
    });

    setTotalCount(filtered.length);
    setTotalPages(Math.ceil(filtered.length / PAGE_SIZE) || 1);
    setBatches(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
    setSummary({
      activeBatches: demoBatches.filter(b => b.status === 'active').length,
      expiredBatches: demoBatches.filter(b => b.status === 'expired').length,
      recalledBatches: demoBatches.filter(b => b.status === 'recalled').length,
    });
    setIsLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Load audit movements when movements tab is activated
  useEffect(() => {
    if (activeTab === 'movements') {
      fetchStockMovements({ limit: 50 })
        .then(res => {
          if (res && res.data) setMovements(res.data);
        })
        .catch(err => console.error('Movements fetch failed:', err));
    }
  }, [activeTab]);

  // Load medicines dropdown for new batch modal
  useEffect(() => {
    if (newBatchModal && medicinesList.length === 0) {
      fetchMedicines({ limit: 200 })
        .then(res => {
          if (res && res.data) setMedicinesList(res.data);
        })
        .catch(err => console.error('Medicines list fetch failed:', err));
    }
  }, [newBatchModal, medicinesList.length]);

  // Handle Create New Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!newBatchForm.medicineId || !newBatchForm.batchNumber || !newBatchForm.expiryDate || !newBatchForm.quantity || !newBatchForm.costPrice || !newBatchForm.sellingPrice) {
      setAlertFeedback({ type: 'error', msg: 'Please fill all required batch fields.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createBatch(newBatchForm);
      setNewBatchModal(false);
      setAlertFeedback({ type: 'success', msg: `Batch ${newBatchForm.batchNumber} created and entered into active inventory.` });
      setNewBatchForm({
        medicineId: '',
        batchNumber: '',
        expiryDate: '',
        manufacturingDate: '',
        quantity: '',
        costPrice: '',
        sellingPrice: '',
      });
      loadInventory();
    } catch (err) {
      setAlertFeedback({ type: 'error', msg: err.message || 'Failed to create batch' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Adjust Stock
  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustModal.batch) return;
    if (adjustForm.newQuantity === '' || !adjustForm.reason.trim()) {
      setAlertFeedback({ type: 'error', msg: 'New quantity and a formal audit justification reason are mandatory.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adjustStock(
        adjustModal.batch.id,
        Number(adjustForm.newQuantity),
        adjustForm.reason.trim(),
        adjustForm.movementType
      );
      setAdjustModal({ open: false, batch: null });
      setAlertFeedback({
        type: 'success',
        msg: `Stock adjusted for batch ${adjustModal.batch.batchNo || adjustModal.batch.batchNumber}: New quantity is ${res.data?.newQuantity ?? adjustForm.newQuantity} units.`,
      });
      loadInventory();
    } catch (err) {
      setAlertFeedback({ type: 'error', msg: err.message || 'Stock adjustment failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Dispose Expired Batch
  const handleDisposeBatch = async (e) => {
    e.preventDefault();
    if (!disposeModal.batch) return;
    if (!disposeReason.trim()) {
      setAlertFeedback({ type: 'error', msg: 'Disposal reason and regulatory protocol reference are mandatory.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await disposeExpiredBatch(disposeModal.batch.id, disposeReason.trim());
      setDisposeModal({ open: false, batch: null });
      setDisposeReason('');
      setAlertFeedback({
        type: 'success',
        msg: `Batch ${disposeModal.batch.batchNo || disposeModal.batch.batchNumber} has been safely written off to 0 units and recorded in the disposal ledger.`,
      });
      loadInventory();
    } catch (err) {
      setAlertFeedback({ type: 'error', msg: err.message || 'Disposal write-off failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Adjust Modal helper
  const openAdjustModal = (b) => {
    setAdjustModal({ open: true, batch: b });
    setAdjustForm({
      newQuantity: b.qty ?? b.quantityOnHand ?? 0,
      reason: '',
      movementType: 'AUDIT_ADJUSTMENT',
    });
  };

  // Open Dispose Modal helper
  const openDisposeModal = (b) => {
    setDisposeModal({ open: true, batch: b });
    setDisposeReason('');
  };

  // Tab Filtering for displayed batches
  const displayedBatches = useMemo(() => {
    if (activeTab === 'near_expiry') {
      return batches.filter(b => {
        const diff = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        return diff > 0 && diff <= 90;
      });
    }
    if (activeTab === 'expired') {
      return batches.filter(b => b.status === 'expired' || new Date(b.expiryDate) <= new Date());
    }
    if (activeTab === 'quarantined') {
      return batches.filter(b => b.status === 'quarantined' || b.status === 'recalled');
    }
    return batches;
  }, [batches, activeTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Batch Management"
        subtitle={
          isLive
            ? `Tracking ${totalCount} pharmaceutical batches with strict FEFO allocation and expiry prevention.`
            : 'Batch-level stock management with automated FEFO enforcement.'
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Inventory' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadInventory}
              title="Refresh inventory"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button
                variant="primary"
                leftIcon={<Plus size={16} />}
                onClick={() => setNewBatchModal(true)}
              >
                Receive New Batch
              </Button>
            )}
          </div>
        }
      />

      {/* Alert / Notification Feedback */}
      {alertFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-sm ${
            alertFeedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertFeedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{alertFeedback.msg}</span>
          </div>
          <button onClick={() => setAlertFeedback(null)} className="p-1 text-slate-400 hover:text-slate-600">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* ─── Inventory Valuation & Health Metric Cards ─────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Saleable Inventory"
          value={formatCurrency(reports?.valuation?.saleableValuation || 1245000, settings.currencyCode)}
          subtitle={`${Number(reports?.valuation?.saleableUnits || summary.activeBatches * 250).toLocaleString()} saleable units`}
          icon={Archive}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600"
        />
        <StatCard
          title="Blocked / Expired Value"
          value={formatCurrency(reports?.valuation?.blockedValuation || 34200, settings.currencyCode)}
          subtitle={`${Number(reports?.valuation?.blockedUnits || summary.expiredBatches * 50).toLocaleString()} blocked units`}
          icon={XCircle}
          iconBg="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-500"
        />
        <StatCard
          title="Near Expiry (90 Days)"
          value={expiryAlerts.nearExpiry?.length || 8}
          subtitle="Batches approaching expiry"
          icon={Clock}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Recalled / Quarantined"
          value={summary.recalledBatches || 0}
          subtitle="Strictly prohibited from dispensing"
          icon={AlertTriangle}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600"
        />
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.id === 'expired' && (summary.expiredBatches > 0) && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {summary.expiredBatches}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── TAB CONTENT ─────────────────────────────────────────────────── */}
      {activeTab === 'movements' ? (
        /* Audit Movements Ledger */
        <Card padding={false}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History size={16} className="text-green-600" /> Stock Audit Movements Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Immutable audit trail of all manual adjustments, sales deductions, PO receipts, and expired write-offs.
              </p>
            </div>
          </div>

          {movements.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <History size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No stock movements recorded yet.</p>
            </div>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>Medicine / Batch</Th>
                  <Th>Movement Type</Th>
                  <Th>Prev Qty</Th>
                  <Th>Change</Th>
                  <Th>New Qty</Th>
                  <Th>Justification / Reason</Th>
                  <Th>Performed By</Th>
                </tr>
              </Thead>
              <Tbody>
                {movements.map(m => (
                  <Tr key={m.id}>
                    <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(m.timestamp)}</Td>
                    <Td>
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">{m.genericName}</div>
                      <div className="font-mono text-[11px] text-slate-400">Batch: {m.batchNumber}</div>
                    </Td>
                    <Td>
                      <Badge variant={m.quantityChange >= 0 ? 'green' : 'red'}>
                        {m.movementType}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">{m.prevQty}</Td>
                    <Td className={`text-xs font-bold ${m.quantityChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </Td>
                    <Td className="text-xs font-semibold text-slate-900 dark:text-slate-100">{m.newQty}</Td>
                    <Td className="text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate" title={m.reason}>
                      {m.reason || '—'}
                    </Td>
                    <Td className="text-xs text-slate-500">{m.performedBy}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      ) : (
        /* Batches Table View (All / Near Expiry / Expired / Quarantined) */
        <Card padding={false}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
            <SearchBar
              value={search}
              onChange={v => { setSearch(v); setPage(1); }}
              placeholder="Search medicine name or batch number…"
              className="flex-1"
            />
            {activeTab === 'all' && (
              <Select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="sm:w-44"
              >
                <option value="">All Statuses</option>
                <option value="active">Active (Saleable)</option>
                <option value="expired">Expired (Blocked)</option>
                <option value="recalled">Recalled</option>
                <option value="quarantined">Quarantined</option>
                <option value="exhausted">Exhausted (0 Qty)</option>
              </Select>
            )}
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : displayedBatches.length === 0 ? (
            <EmptyState
              icon={Archive}
              title={search || statusFilter ? "No matching batches found" : "No inventory batches registered yet"}
              description={
                search || statusFilter
                  ? "Adjust search keywords or select another inventory category tab."
                  : "Receive purchase orders or add initial batches to start tracking active stock, batch expiry and FEFO allocation."
              }
              action={
                !search && canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() => {
                      setFormBatch({
                        medicineId: '',
                        batchNumber: '',
                        manufactureDate: '',
                        expiryDate: '',
                        quantityOnHand: '',
                        unitCostPrice: '',
                        unitSellingPrice: '',
                        supplierId: '',
                      });
                      setModalMode('add');
                      setIsModalOpen(true);
                    }}
                  >
                    Receive First Batch
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <Table>
                <Thead>
                  <tr>
                    <Th>Medicine</Th>
                    <Th>Batch Number</Th>
                    <Th>Mfg Date</Th>
                    <Th>Expiry Date</Th>
                    <Th>Qty on Hand</Th>
                    <Th>Cost Price</Th>
                    <Th>Selling Price</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {displayedBatches.map(b => {
                    const expiryInfo = getExpiryStatus(b.expiryDate);
                    const isBlocked = b.status !== 'active' || new Date(b.expiryDate) <= new Date();
                    const qty = Number(b.qty ?? b.quantityOnHand ?? 0);

                    return (
                      <Tr key={b.id} className={isBlocked ? 'bg-red-50/20 dark:bg-red-950/10' : ''}>
                        <Td className="font-semibold text-slate-900 dark:text-slate-100 max-w-[220px]">
                          <span className="truncate block">{b.medicine || b.genericName}</span>
                          {b.brandName && (
                            <span className="text-[11px] text-slate-400 block font-normal">{b.brandName}</span>
                          )}
                        </Td>
                        <Td className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                          {b.batchNo || b.batchNumber}
                        </Td>
                        <Td className="text-slate-500 text-xs">{formatDate(b.mfgDate || b.manufacturingDate)}</Td>
                        <Td>
                          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full inline-block', expiryInfo.cls)}>
                            {expiryInfo.label}
                          </span>
                        </Td>
                        <Td>
                          <span className={clsx('font-bold text-sm', qty <= 20 ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100')}>
                            {qty.toLocaleString()}
                          </span>
                        </Td>
                        <Td className="text-slate-500 text-xs">{formatCurrency(b.costPrice, settings.currencyCode)}</Td>
                        <Td className="text-xs font-medium">{formatCurrency(b.sellingPrice, settings.currencyCode)}</Td>
                        <Td>
                          <StatusBadge status={b.status} />
                          {isBlocked && (
                            <p className="text-[10px] text-red-600 dark:text-red-400 font-bold tracking-tight mt-0.5 flex items-center gap-0.5">
                              <ShieldAlert size={10} /> SALE BLOCKED
                            </p>
                          )}
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canManage && (
                              <button
                                onClick={() => openAdjustModal(b)}
                                title="Adjust Stock (Audit reconciliation)"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                              >
                                <SlidersHorizontal size={14} />
                              </button>
                            )}

                            {canManage && isBlocked && qty > 0 && (
                              <button
                                onClick={() => openDisposeModal(b)}
                                title="Safe Disposal & Write-off"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>

              {activeTab === 'all' && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </Card>
      )}

      {/* ─── MODAL: RECEIVE NEW BATCH ───────────────────────────────────────── */}
      <Modal
        isOpen={newBatchModal}
        onClose={() => setNewBatchModal(false)}
        title="Receive New Batch into Inventory"
        size="lg"
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Catalogue Medicine <span className="text-red-500">*</span>
              </label>
              <Select
                value={newBatchForm.medicineId}
                onChange={e => setNewBatchForm(f => ({ ...f, medicineId: e.target.value }))}
                required
              >
                <option value="">Select medicine from catalogue…</option>
                {medicinesList.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.brand_name || m.brandName} ({m.generic_name || m.genericName} {m.strength}) — {m.dosage_form || m.dosageForm}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Batch Number"
              placeholder="e.g. BTH-2026-99"
              required
              value={newBatchForm.batchNumber}
              onChange={e => setNewBatchForm(f => ({ ...f, batchNumber: e.target.value }))}
            />

            <Input
              label="Expiry Date"
              type="date"
              required
              value={newBatchForm.expiryDate}
              onChange={e => setNewBatchForm(f => ({ ...f, expiryDate: e.target.value }))}
            />

            <Input
              label="Manufacturing Date (Optional)"
              type="date"
              value={newBatchForm.manufacturingDate}
              onChange={e => setNewBatchForm(f => ({ ...f, manufacturingDate: e.target.value }))}
            />

            <Input
              label="Quantity Received (Packs/Units)"
              type="number"
              min="1"
              required
              value={newBatchForm.quantity}
              onChange={e => setNewBatchForm(f => ({ ...f, quantity: e.target.value }))}
            />

            <Input
              label={`Unit Cost Price (${settings.currencyCode})`}
              type="number"
              step="0.01"
              min="0"
              required
              value={newBatchForm.costPrice}
              onChange={e => setNewBatchForm(f => ({ ...f, costPrice: e.target.value }))}
            />

            <Input
              label={`Unit Selling Price (${settings.currencyCode})`}
              type="number"
              step="0.01"
              min="0"
              required
              value={newBatchForm.sellingPrice}
              onChange={e => setNewBatchForm(f => ({ ...f, sellingPrice: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setNewBatchModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Receive Batch
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL: ADJUST STOCK ────────────────────────────────────────────── */}
      <Modal
        isOpen={adjustModal.open}
        onClose={() => setAdjustModal({ open: false, batch: null })}
        title={`Adjust Stock — ${adjustModal.batch?.batchNo || adjustModal.batch?.batchNumber}`}
        size="md"
      >
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {adjustModal.batch?.medicine || adjustModal.batch?.genericName}
            </p>
            <p className="text-slate-500 mt-0.5">
              Current recorded on-hand quantity: <strong>{adjustModal.batch?.qty ?? adjustModal.batch?.quantityOnHand} units</strong>
            </p>
          </div>

          <Input
            label="New Physical Quantity on Hand"
            type="number"
            min="0"
            required
            value={adjustForm.newQuantity}
            onChange={e => setAdjustForm(f => ({ ...f, newQuantity: e.target.value }))}
          />

          <Select
            label="Movement Classification"
            value={adjustForm.movementType}
            onChange={e => setAdjustForm(f => ({ ...f, movementType: e.target.value }))}
          >
            <option value="AUDIT_ADJUSTMENT">Stock Audit Reconciliation</option>
            <option value="DAMAGED_WRITE_OFF">Damaged / Broken in Pharmacy</option>
            <option value="INTERNAL_USE">Internal Clinical Use</option>
            <option value="SUPPLIER_RETURN">Supplier Return</option>
          </Select>

          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Audit Reason / Discrepancy Explanation <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="e.g. Discrepancy noted during monthly physical inventory count. 5 packs found damaged on shelf 3B."
              rows={3}
              required
              value={adjustForm.reason}
              onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setAdjustModal({ open: false, batch: null })}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Apply Stock Adjustment
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL: DISPOSE EXPIRED BATCH ───────────────────────────────────── */}
      <Modal
        isOpen={disposeModal.open}
        onClose={() => setDisposeModal({ open: false, batch: null })}
        title="Regulatory Write-off & Disposal"
        size="md"
      >
        <form onSubmit={handleDisposeBatch} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-sm">
              <AlertTriangle size={16} /> Irreversible Stock Write-off
            </p>
            <p>
              Batch <strong>{disposeModal.batch?.batchNo || disposeModal.batch?.batchNumber}</strong> ({disposeModal.batch?.qty ?? disposeModal.batch?.quantityOnHand} units) will be permanently reduced to 0 quantity.
            </p>
            <p className="text-[11px] opacity-80">
              An immutable entry in the `stock_movements` ledger will be logged with type `EXPIRED_WRITE_OFF` for regulatory audit inspection.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Disposal Protocol & Certificate Reference <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="e.g. Incineration per Hospital Waste Management Protocol. Destruction cert #DISP-2026-44."
              rows={3}
              required
              value={disposeReason}
              onChange={e => setDisposeReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setDisposeModal({ open: false, batch: null })}>Cancel</Button>
            <Button type="submit" variant="danger" isLoading={isSubmitting}>
              Confirm Disposal Write-off
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default InventoryPage;
