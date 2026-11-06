import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, RefreshCw, Send, CheckCircle2, Clock, AlertCircle,
  Eye, X, Plus, Trash2, Mail, ExternalLink, Image as ImageIcon,
  Building2, Phone, User, Check, ShieldAlert
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import {
  fetchInquiries,
  fetchInquiry,
  saveInquiryItems,
  respondToInquiry,
  retryInquiryEmail,
  getInquiryImageUrl
} from '../../api/inquiries';
import { fetchMedicines } from '../../api/medicines';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'in_review', label: 'In Review' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
];

const AVAILABILITY_STATUSES = [
  { value: 'Available', label: 'Available', color: 'green' },
  { value: 'Partially Available', label: 'Partially Available', color: 'amber' },
  { value: 'Out of Stock', label: 'Out of Stock', color: 'red' },
  { value: 'Needs Clarification', label: 'Needs Clarification', color: 'blue' },
];

export function InquiriesPage() {
  const { settings } = useSettings();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected Inquiry for Modal Review
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [imageLightbox, setImageLightbox] = useState(false);

  // Review & Matching state
  const [lineItems, setLineItems] = useState([]);
  const [responseNotes, setResponseNotes] = useState('');
  const [savingItems, setSavingItems] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Catalogue search for item matcher
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueResults, setCatalogueResults] = useState([]);
  const [searchingCatalogue, setSearchingCatalogue] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchInquiries({ status: statusFilter, search });
      if (res && res.data) {
        setInquiries(res.data);
      }
    } catch (err) {
      console.error('Failed to load doctor inquiries:', err);
      setError(err.message || 'Failed to load inquiries. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  // Open review modal and fetch full details (items + email status)
  const openReviewModal = async (inquirySummary) => {
    setModalOpen(true);
    setLoadingDetail(true);
    setActionSuccess('');
    setActionError('');
    try {
      const res = await fetchInquiry(inquirySummary.id);
      const detail = res.data;
      setSelectedInquiry(detail);
      setResponseNotes(detail.response_notes || '');
      setLineItems(
        (detail.items || []).map(item => ({
          id: item.id || null,
          item_name_raw: item.item_name_raw || '',
          matched_medicine_id: item.matched_medicine_id || '',
          matched_name: item.medicine_name || '',
          availability_status: item.availability_status || 'Available',
          available_quantity: item.available_quantity ?? 0,
          unit_price: item.unit_price ?? 0,
          notes: item.notes || '',
        }))
      );
    } catch (err) {
      console.error('Failed to load inquiry details:', err);
      setActionError(err.message || 'Failed to load inquiry details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Catalogue search debounce
  useEffect(() => {
    if (!catalogueSearch.trim() || activeItemIndex === null) {
      setCatalogueResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCatalogue(true);
      try {
        const res = await fetchMedicines({ search: catalogueSearch.trim(), limit: 8 });
        setCatalogueResults(res.data || []);
      } catch (err) {
        console.error('Search catalogue error:', err);
      } finally {
        setSearchingCatalogue(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [catalogueSearch, activeItemIndex]);

  // Select matched medicine for line item
  const handleSelectMedicine = (medicine, index) => {
    setLineItems(prev => {
      const updated = [...prev];
      const stock = medicine.total_stock ?? medicine.stock ?? 0;
      updated[index] = {
        ...updated[index],
        matched_medicine_id: medicine.id,
        matched_name: `${medicine.brand_name || medicine.brandName} (${medicine.generic_name || medicine.genericName} ${medicine.strength || ''})`,
        available_quantity: stock,
        unit_price: medicine.selling_price || medicine.sellingPrice || 0,
        availability_status: stock > 0 ? 'Available' : 'Out of Stock',
      };
      return updated;
    });
    setActiveItemIndex(null);
    setCatalogueSearch('');
    setCatalogueResults([]);
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        item_name_raw: '',
        matched_medicine_id: null,
        matched_name: '',
        availability_status: 'Available',
        available_quantity: 0,
        unit_price: 0,
        notes: '',
      },
    ]);
  };

  const removeLineItem = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
    if (activeItemIndex === index) {
      setActiveItemIndex(null);
      setCatalogueSearch('');
    }
  };

  const updateLineItem = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Save Draft Items
  const handleSaveItems = async () => {
    if (!selectedInquiry) return;
    setSavingItems(true);
    setActionSuccess('');
    setActionError('');
    try {
      await saveInquiryItems(selectedInquiry.id, lineItems);
      setActionSuccess('Line items saved successfully.');
      loadInquiries();
    } catch (err) {
      setActionError(err.message || 'Failed to save items');
    } finally {
      setSavingItems(false);
    }
  };

  // Send Availability Email to Doctor
  const handleSendResponse = async () => {
    if (!selectedInquiry) return;
    if (lineItems.length === 0) {
      setActionError('Please add at least one medicine item to the response before sending.');
      return;
    }
    setSendingEmail(true);
    setActionSuccess('');
    setActionError('');
    try {
      const res = await respondToInquiry(selectedInquiry.id, responseNotes, lineItems);
      setActionSuccess(`Email response successfully dispatched to ${selectedInquiry.doctor_email}!`);
      // Update selected inquiry state
      setSelectedInquiry(prev => ({
        ...prev,
        status: 'responded',
        email_status: res.data?.email_status || 'sent',
        response_notes: responseNotes,
      }));
      loadInquiries();
    } catch (err) {
      setActionError(err.message || 'Failed to dispatch email response');
    } finally {
      setSendingEmail(false);
    }
  };

  // Retry Failed Email
  const handleRetryEmail = async () => {
    if (!selectedInquiry) return;
    setRetryingEmail(true);
    setActionSuccess('');
    setActionError('');
    try {
      const res = await retryInquiryEmail(selectedInquiry.id);
      setActionSuccess(res.message || 'Email resent successfully');
      setSelectedInquiry(prev => ({
        ...prev,
        email_status: res.data?.email_status || 'sent',
      }));
      loadInquiries();
    } catch (err) {
      setActionError(err.message || 'Retry failed');
    } finally {
      setRetryingEmail(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="amber" dot>Pending Review</Badge>;
      case 'in_review':
        return <Badge variant="blue" dot>In Review</Badge>;
      case 'responded':
        return <Badge variant="green" dot>Responded</Badge>;
      case 'closed':
        return <Badge variant="slate">Closed</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getEmailBadge = (status) => {
    switch (status) {
      case 'sent':
        return <Badge variant="green">Email Sent</Badge>;
      case 'failed':
        return <Badge variant="red">Email Failed</Badge>;
      default:
        return <Badge variant="slate">Not Sent</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Medicine Inquiries"
        subtitle="Review prescriptions, verify inventory availability, and send fast itemized email responses to doctors"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Doctor Inquiries' },
        ]}
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}
            onClick={loadInquiries}
          >
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <Button size="xs" variant="secondary" onClick={loadInquiries}>Retry</Button>
        </div>
      )}

      {/* Filter Bar */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reference #, doctor name, clinic, or email…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="sm:w-52"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : inquiries.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No inquiries found"
            description="Doctors and clinics can submit medicine availability checks via the public portal."
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Ref Number</Th>
                <Th>Doctor / Clinic</Th>
                <Th>Contact</Th>
                <Th>Prescription</Th>
                <Th>Status</Th>
                <Th>Email</Th>
                <Th>Date</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </Thead>
            <Tbody>
              {inquiries.map((inq) => (
                <Tr key={inq.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  <Td className="font-mono text-xs font-semibold text-green-700 dark:text-green-400">
                    {inq.reference_no}
                  </Td>
                  <Td>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {inq.doctor_name}
                    </div>
                    {inq.clinic_hospital_name && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building2 size={12} /> {inq.clinic_hospital_name}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Mail size={12} className="text-slate-400" /> {inq.doctor_email}
                    </div>
                    {inq.doctor_phone && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone size={12} className="text-slate-400" /> {inq.doctor_phone}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {inq.image_filename ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-medium">
                        <ImageIcon size={12} /> Photo Attached
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Notes only</span>
                    )}
                  </Td>
                  <Td>{getStatusBadge(inq.status)}</Td>
                  <Td>{getEmailBadge(inq.email_status)}</Td>
                  <Td className="text-xs text-slate-500">{formatDate(inq.created_at)}</Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Eye size={14} />}
                      onClick={() => openReviewModal(inq)}
                    >
                      Review & Match
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* ─── REVIEW & MATCHING MODAL ────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedInquiry ? `Inquiry Review — ${selectedInquiry.reference_no}` : 'Inquiry Review'}
        size="full"
      >
        {loadingDetail || !selectedInquiry ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Feedback Alerts */}
            {actionSuccess && (
              <div className="p-3.5 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}
            {actionError && (
              <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Top Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doctor Information</p>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{selectedInquiry.doctor_name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{selectedInquiry.clinic_hospital_name || 'Individual Clinic'}</p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Mail size={12} /> {selectedInquiry.doctor_email}
                </p>
                {selectedInquiry.doctor_phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone size={12} /> {selectedInquiry.doctor_phone}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inquiry Metadata</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Status:</span>
                  {getStatusBadge(selectedInquiry.status)}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Email Status:</span>
                  {getEmailBadge(selectedInquiry.email_status)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted: {formatDate(selectedInquiry.created_at)}
                </p>
                {selectedInquiry.email_status === 'failed' && (
                  <div className="mt-2">
                    <Button
                      size="xs"
                      variant="warning"
                      leftIcon={<RefreshCw size={12} className={retryingEmail ? 'animate-spin' : ''} />}
                      onClick={handleRetryEmail}
                      disabled={retryingEmail}
                    >
                      {retryingEmail ? 'Retrying…' : 'Retry Failed Email'}
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doctor's Notes</p>
                <div className="mt-1 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 max-h-24 overflow-y-auto">
                  {selectedInquiry.doctor_notes || 'No extra notes provided by doctor.'}
                </div>
              </div>
            </div>

            {/* Split Screen: Prescription Viewer (Left) + Medicine Stock Matcher (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Prescription Image / Document Preview (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ImageIcon size={16} className="text-green-600" /> Attached Prescription
                  </h4>
                  {selectedInquiry.image_filename && (
                    <Button
                      size="xs"
                      variant="secondary"
                      leftIcon={<ExternalLink size={12} />}
                      onClick={() => setImageLightbox(true)}
                    >
                      Full Size
                    </Button>
                  )}
                </div>

                <div className="h-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden relative group">
                  {selectedInquiry.image_filename ? (
                    <img
                      src={getInquiryImageUrl(selectedInquiry.id)}
                      alt="Prescription"
                      className="max-h-full max-w-full object-contain cursor-zoom-in transition-transform group-hover:scale-105"
                      onClick={() => setImageLightbox(true)}
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-400">
                      <FileText size={48} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">No prescription image uploaded</p>
                      <p className="text-xs mt-1 text-slate-400">Doctor submitted text notes only.</p>
                    </div>
                  )}
                </div>
                {selectedInquiry.image_filename && (
                  <p className="text-xs text-slate-400 text-center">
                    Click image to expand in full lightbox viewer.
                  </p>
                )}
              </div>

              {/* Live Inventory Matching & Availability Tool (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Medicine Availability Report
                    </h4>
                    <p className="text-xs text-slate-500">
                      Transcribe and verify each prescription item against live saleable stock (FEFO).
                    </p>
                  </div>
                  <Button size="xs" variant="primary" leftIcon={<Plus size={14} />} onClick={addLineItem}>
                    Add Item
                  </Button>
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-visible">
                  {lineItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-sm">No medicines added to this review yet.</p>
                      <Button size="sm" variant="secondary" className="mt-3" onClick={addLineItem}>
                        + Add First Medicine
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lineItems.map((item, idx) => (
                        <div key={idx} className="p-4 space-y-3 bg-white dark:bg-slate-900">
                          <div className="flex items-start justify-between gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>

                            {/* Prescription Item Name */}
                            <div className="flex-1">
                              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                                Prescribed Medicine / Note
                              </label>
                              <Input
                                placeholder="e.g. Augmentin 625mg tabs 2x daily"
                                value={item.item_name_raw}
                                onChange={e => updateLineItem(idx, 'item_name_raw', e.target.value)}
                              />
                            </div>

                            {/* Status Selector */}
                            <div className="w-44 shrink-0">
                              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                                Availability
                              </label>
                              <Select
                                value={item.availability_status}
                                onChange={e => updateLineItem(idx, 'availability_status', e.target.value)}
                              >
                                {AVAILABILITY_STATUSES.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </Select>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeLineItem(idx)}
                              className="mt-6 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              aria-label="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Inventory Match Picker */}
                          <div className="relative">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                              <span>Match to Live Pharmacy Catalogue Item</span>
                              {item.matched_name && (
                                <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
                                  <Check size={12} /> Linked: {item.matched_name}
                                </span>
                              )}
                            </label>

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Search catalogue to link stock (e.g. Augmentin, Paracetamol)…"
                                value={activeItemIndex === idx ? catalogueSearch : (item.matched_name || '')}
                                onFocus={() => {
                                  setActiveItemIndex(idx);
                                  setCatalogueSearch(item.matched_name ? '' : item.item_name_raw);
                                }}
                                onChange={e => {
                                  setActiveItemIndex(idx);
                                  setCatalogueSearch(e.target.value);
                                }}
                                className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-600"
                              />
                            </div>

                            {/* Autocomplete Dropdown */}
                            {activeItemIndex === idx && (
                              <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                                {searchingCatalogue ? (
                                  <div className="p-3 text-xs text-slate-400 text-center">Searching pharmacy stock…</div>
                                ) : catalogueResults.length === 0 ? (
                                  <div className="p-3 text-xs text-slate-400 text-center">
                                    {catalogueSearch.trim() ? 'No matching medicines in catalogue' : 'Type name to search stock'}
                                  </div>
                                ) : (
                                  catalogueResults.map(m => (
                                    <div
                                      key={m.id}
                                      onClick={() => handleSelectMedicine(m, idx)}
                                      className="p-2.5 hover:bg-green-50 dark:hover:bg-slate-800 cursor-pointer text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center justify-between"
                                    >
                                      <div>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                                          {m.brand_name || m.brandName} <span className="font-normal text-slate-500">({m.generic_name || m.genericName} {m.strength})</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400">{m.category} • {m.dosage_form || m.dosageForm}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className={`font-semibold ${((m.total_stock ?? m.stock ?? 0) > 0) ? 'text-green-600' : 'text-red-500'}`}>
                                          {(m.total_stock ?? m.stock ?? 0)} in stock
                                        </span>
                                        <p className="text-[10px] text-slate-400">
                                          {formatCurrency(m.selling_price || m.sellingPrice || 0, settings.currencyCode)}
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          {/* Stock Quantity, Price, Notes */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-[11px] font-medium text-slate-500">Available Qty</label>
                              <Input
                                type="number"
                                min="0"
                                value={item.available_quantity}
                                onChange={e => updateLineItem(idx, 'available_quantity', Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-slate-500">Unit Price ({settings.currencyCode || 'PKR'})</label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_price}
                                onChange={e => updateLineItem(idx, 'unit_price', Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-slate-500">Remarks / Substitute</label>
                              <Input
                                placeholder="e.g. Substitute Panadol available"
                                value={item.notes}
                                onChange={e => updateLineItem(idx, 'notes', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Response Notes to Doctor */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Email Response Message to Doctor
                  </label>
                  <Textarea
                    placeholder="Enter personalized notes or pickup instructions (e.g. 'All prescribed items are ready for pickup at Main Branch until 10 PM')."
                    rows={3}
                    value={responseNotes}
                    onChange={e => setResponseNotes(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveItems}
                    isLoading={savingItems}
                  >
                    Save Draft Items
                  </Button>

                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      leftIcon={<Send size={15} />}
                      onClick={handleSendResponse}
                      isLoading={sendingEmail}
                    >
                      Send Availability Email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── FULL SIZE IMAGE LIGHTBOX ───────────────────────────────────── */}
      {imageLightbox && selectedInquiry && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setImageLightbox(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setImageLightbox(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <img
              src={getInquiryImageUrl(selectedInquiry.id)}
              alt="Prescription Full Size"
              className="max-h-[85vh] max-w-full object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default InquiriesPage;
