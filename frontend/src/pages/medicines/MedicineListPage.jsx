import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Edit, Eye, Pill, RefreshCw, Power, AlertCircle, CheckCircle2,
  Clock, Package, ShieldAlert, Barcode, Calendar, Layers, Building2,
  FileSpreadsheet
} from 'lucide-react';
import { MedicineImportModal } from './MedicineImportModal';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { SearchBar } from '../../components/common/SearchBar';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import { Select } from '../../components/common/Input';
import { Modal, ConfirmDialog } from '../../components/common/Modal';
import { demoMedicines, demoCategories, demoDosageForms } from '../../data/demoData';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { medicineApi } from '../../api';
import clsx from 'clsx';

const PAGE_SIZE = 10;

export function MedicineListPage() {
  const { isDemo, hasRole } = useAuth();
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dosageFilter, setDosageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState(demoCategories);
  const [dosageForms, setDosageForms] = useState(demoDosageForms);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal & Status Toggle Modal states
  const [detailModal, setDetailModal] = useState({ open: false, medicine: null, loading: false });
  const [statusDialog, setStatusDialog] = useState({ open: false, medicine: null, newStatus: null });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);

  const canManage = hasRole(['admin', 'pharmacist']);

  // Load category and dosage form references
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      medicineApi.fetchCategories().catch(() => null),
      medicineApi.fetchDosageForms().catch(() => null),
    ]).then(([catRes, formRes]) => {
      if (!isMounted) return;
      if (catRes && catRes.data) {
        setCategories(catRes.data);
      }
      if (formRes && formRes.data) {
        setDosageForms(formRes.data.map(f => f.name || f));
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Fetch medicines from live API or fall back to demo data
  const loadMedicines = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await medicineApi.fetchMedicines({
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        dosageForm: dosageFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });

      if (res && res.data) {
        setMedicines(res.data);
        setTotalCount(res.pagination?.totalItems ?? res.data.length);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setIsLive(true);
        setIsLoading(false);
        return;
      }
    } catch {
      setIsLive(false);
    }

    // Demo data fallback filter
    const q = search.toLowerCase();
    const demoFiltered = demoMedicines.filter(m => {
      const matchSearch = !q ||
        m.genericName.toLowerCase().includes(q) ||
        m.brandName.toLowerCase().includes(q) ||
        (m.barcode && m.barcode.includes(q)) ||
        (m.sku && m.sku.toLowerCase().includes(q)) ||
        m.manufacturer.toLowerCase().includes(q);
      const matchCategory = !categoryFilter || m.category === categoryFilter;
      const matchDosage = !dosageFilter || m.dosageForm === dosageFilter;
      const matchStatus = !statusFilter || m.status === statusFilter;
      return matchSearch && matchCategory && matchDosage && matchStatus;
    });

    setTotalCount(demoFiltered.length);
    setTotalPages(Math.ceil(demoFiltered.length / PAGE_SIZE) || 1);
    setMedicines(demoFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
    setIsLoading(false);
  }, [search, categoryFilter, dosageFilter, statusFilter, page]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const handleSearch = (v) => {
    setSearch(v);
    setPage(1);
  };

  // Open detail view modal and fetch active batches
  const openDetail = async (med) => {
    setDetailModal({ open: true, medicine: med, loading: true });
    try {
      const res = await medicineApi.fetchMedicine(med.id);
      if (res && res.data) {
        setDetailModal({ open: true, medicine: res.data, loading: false });
        return;
      }
    } catch {
      // Keep basic data if fetch fails
    }
    setDetailModal(prev => ({ ...prev, loading: false }));
  };

  // Safe status toggle confirmation (Active <-> Inactive)
  const promptStatusToggle = (med) => {
    const next = med.status === 'active' ? 'inactive' : 'active';
    setStatusDialog({ open: true, medicine: med, newStatus: next });
  };

  const confirmStatusToggle = async () => {
    if (!statusDialog.medicine || !statusDialog.newStatus) return;
    const { id, brandName, genericName } = statusDialog.medicine;
    const targetStatus = statusDialog.newStatus;
    setStatusDialog({ open: false, medicine: null, newStatus: null });

    try {
      await medicineApi.updateMedicineStatus(id, targetStatus);
      setActionAlert({
        type: 'success',
        msg: `"${genericName} (${brandName})" marked as ${targetStatus}.`,
      });
      loadMedicines();
    } catch (err) {
      // Local fallback for demo mode
      setMedicines(prev =>
        prev.map(m => m.id === id ? { ...m, status: targetStatus } : m)
      );
      setActionAlert({
        type: 'success',
        msg: `"${genericName} (${brandName})" status updated (Demo Mode).`,
      });
    }

    setTimeout(() => setActionAlert(null), 4000);
  };

  return (
    <div>
      <PageHeader
        title="Medicine Catalogue"
        subtitle={
          isLive
            ? `${totalCount} pharmaceutical items catalogued in MySQL database.`
            : `${totalCount} medicines in demo catalogue.`
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Medicines' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadMedicines}
              title="Refresh catalogue"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <>
                <Button
                  variant="secondary"
                  leftIcon={<FileSpreadsheet size={16} />}
                  onClick={() => setImportModalOpen(true)}
                >
                  Import CSV
                </Button>
                <Link to="/medicines/new">
                  <Button leftIcon={<Plus size={16} />}>Add Medicine</Button>
                </Link>
              </>
            )}
          </div>
        }
      />

      {/* Action Notification Alert */}
      {actionAlert && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{actionAlert.msg}</span>
        </div>
      )}

      <Card padding={false}>
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-3">
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder="Search by name, generic name, brand, SKU or barcode…"
            className="flex-1"
          />
          <Select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className="md:w-44"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id || c.name} value={c.name}>{c.name}</option>
            ))}
          </Select>
          <Select
            value={dosageFilter}
            onChange={e => { setDosageFilter(e.target.value); setPage(1); }}
            className="md:w-44"
          >
            <option value="">All Forms</option>
            {dosageForms.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="md:w-36"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discontinued">Discontinued</option>
          </Select>
        </div>

        {/* Table */}
        {medicines.length === 0 ? (
          <EmptyState
            icon={Pill}
            title={search || categoryFilter || dosageFilter || statusFilter ? "No matching medicines found" : "No medicines in catalog"}
            description={
              search || categoryFilter || dosageFilter || statusFilter
                ? "Try adjusting your search query or clear active filters."
                : "Your pharmacy catalog is currently empty. Add your first clinical medicine or import via CSV."
            }
            action={
              !search && canManage ? (
                <Link to="/medicines/new">
                  <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}>
                    Add First Medicine
                  </Button>
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>SKU / Barcode</Th>
                  <Th>Generic Name</Th>
                  <Th>Brand Name</Th>
                  <Th>Strength</Th>
                  <Th>Form</Th>
                  <Th>Category</Th>
                  <Th>Pack</Th>
                  <Th>Stock</Th>
                  <Th>Rx</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {medicines.map(m => (
                  <Tr key={m.id}>
                    <Td>
                      <div className="font-mono text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{m.sku || `SKU-${m.id}`}</span>
                        {m.barcode && (
                          <span className="text-[10px] text-slate-400 block tracking-tight">{m.barcode}</span>
                        )}
                      </div>
                    </Td>
                    <Td className="font-semibold text-slate-900 dark:text-slate-100">{m.genericName}</Td>
                    <Td className="text-slate-700 dark:text-slate-300 font-medium">{m.brandName}</Td>
                    <Td>{m.strength} {m.strengthUnit || 'mg'}</Td>
                    <Td>
                      <Badge variant="blue">{m.dosageForm}</Badge>
                    </Td>
                    <Td className="text-slate-500 text-xs">{m.category}</Td>
                    <Td className="text-xs text-slate-500">{m.packSize ? `${m.packSize} ${m.packUnit || ''}` : '10 Tablets'}</Td>
                    <Td>
                      <span className={clsx('font-semibold text-xs', m.stock <= (m.reorderLevel || 50) && m.status === 'active' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded' : 'text-slate-700 dark:text-slate-300')}>
                        {Number(m.stock).toLocaleString()}
                      </span>
                    </Td>
                    <Td>
                      {m.requiresPrescription ? (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">Rx</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">OTC</span>
                      )}
                    </Td>
                    <Td><StatusBadge status={m.status} /></Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetail(m)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="View clinical details"
                          aria-label="View"
                        >
                          <Eye size={15} />
                        </button>
                        {canManage && (
                          <>
                            <Link to={`/medicines/${m.id}/edit`}>
                              <button
                                className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                title="Edit medicine"
                                aria-label="Edit"
                              >
                                <Edit size={15} />
                              </button>
                            </Link>
                            <button
                              onClick={() => promptStatusToggle(m)}
                              className={clsx(
                                'p-1.5 rounded-lg transition-colors',
                                m.status === 'active'
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                              )}
                              title={m.status === 'active' ? 'Deactivate medicine' : 'Activate medicine'}
                              aria-label="Toggle status"
                            >
                              <Power size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {/* ─── Detail View Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, medicine: null, loading: false })}
        title={detailModal.medicine ? `${detailModal.medicine.genericName} — ${detailModal.medicine.brandName}` : 'Medicine Details'}
        size="lg"
      >
        {detailModal.loading ? (
          <div className="py-12 flex justify-center"><LoadingSpinner size="lg" /></div>
        ) : detailModal.medicine && (
          <div className="flex flex-col gap-5 text-sm">
            {/* Top overview card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400">SKU</p>
                <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {detailModal.medicine.sku || `SKU-${detailModal.medicine.id}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Barcode</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  {detailModal.medicine.barcode || 'None'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Dosage Form</p>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {detailModal.medicine.dosageFormName || detailModal.medicine.dosageForm}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <div className="mt-0.5"><StatusBadge status={detailModal.medicine.status} /></div>
              </div>
            </div>

            {/* Clinical & Packaging Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill size={14} /> Pharmaceutical Information
                </h4>
                <div>
                  <span className="text-xs text-slate-400 block">Generic / Chemical Name</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{detailModal.medicine.genericName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Strength & Unit</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{detailModal.medicine.strength} {detailModal.medicine.strengthUnit || 'mg'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Therapeutic Category</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{detailModal.medicine.categoryName || detailModal.medicine.category}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Manufacturer / Licensee</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{detailModal.medicine.manufacturerName || detailModal.medicine.manufacturer || 'N/A'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} /> Packaging & Storage
                </h4>
                <div>
                  <span className="text-xs text-slate-400 block">Pack Size & Unit</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {detailModal.medicine.packSize || '10'} {detailModal.medicine.packUnit || 'Tablets'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Storage Instructions</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {detailModal.medicine.storageInstructions || 'Store below 30°C in a dry place away from sunlight.'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Clinical Warnings</span>
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {detailModal.medicine.warnings || (detailModal.medicine.requiresPrescription ? 'Rx: Requires doctor prescription.' : 'Keep out of reach of children.')}
                  </span>
                </div>
              </div>
            </div>

            {/* Inventory Batches Summary */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Active Stock Batches (FEFO Dispensing Order)</span>
                <span className="text-green-600 font-bold">{Number(detailModal.medicine.stock || detailModal.medicine.activeStock || 0).toLocaleString()} Units Total</span>
              </h4>
              {detailModal.medicine.batches && detailModal.medicine.batches.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Batch No</th>
                        <th className="px-3 py-2 text-left">Expiry Date</th>
                        <th className="px-3 py-2 text-right">On Hand</th>
                        <th className="px-3 py-2 text-right">Retail Price</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {detailModal.medicine.batches.map(b => (
                        <tr key={b.id}>
                          <td className="px-3 py-2 font-mono font-medium">{b.batchNumber}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{formatDate(b.expiryDate)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{b.quantityOnHand}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(b.sellingPrice, settings.currencyCode)}</td>
                          <td className="px-3 py-2 text-center"><StatusBadge status={b.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No batches currently registered for this medicine catalogue entry.</p>
              )}
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
              <span>Created: {formatDate(detailModal.medicine.createdAt || new Date())}</span>
              <Button variant="secondary" onClick={() => setDetailModal({ open: false, medicine: null, loading: false })}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Activate / Deactivate Confirmation Dialog ────────────────── */}
      <ConfirmDialog
        isOpen={statusDialog.open}
        onClose={() => setStatusDialog({ open: false, medicine: null, newStatus: null })}
        onConfirm={confirmStatusToggle}
        title={statusDialog.newStatus === 'active' ? 'Activate Medicine' : 'Deactivate Medicine'}
        message={`Are you sure you want to change status to "${statusDialog.newStatus}" for ${statusDialog.medicine?.genericName} (${statusDialog.medicine?.brandName})? ${statusDialog.newStatus === 'inactive' ? 'This medicine will be hidden from the active POS billing terminal, while preserving all historical sales, purchases, and batch records.' : 'This medicine will become available for dispensing.'}`}
        confirmLabel={statusDialog.newStatus === 'active' ? 'Activate' : 'Deactivate'}
        variant={statusDialog.newStatus === 'active' ? 'primary' : 'warning'}
      />

      {/* ─── Bulk CSV Import Modal ─────────────────────────────────────── */}
      <MedicineImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={(result) => {
          setActionAlert({
            type: 'success',
            msg: `Bulk import completed: ${result.importedCount} medicines added, ${result.skippedCount} duplicates skipped.`,
          });
          loadMedicines();
        }}
      />
    </div>
  );
}
