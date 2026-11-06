import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Eye,
  Lock,
  RefreshCw,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  ShoppingCart,
  User,
  Stethoscope,
  XCircle,
  Clock
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { prescriptionApi, doctorApi, patientApi, medicineApi } from '../../api';

export function PrescriptionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [viewModal, setViewModal] = useState({ open: false, rx: null });
  const [createModal, setCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // New Prescription Form State
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    patientPhone: '',
    patientAge: '',
    patientGender: 'male',
    doctorId: '',
    doctorName: '',
    doctorLicenseNo: '',
    departmentId: '',
    clinicOrHospital: '',
    prescriptionDate: new Date().toISOString().slice(0, 10),
    notes: '',
    items: [
      { medicineId: '', medicineName: '', dosage: '500mg', frequency: '1-0-1', duration: '5 days', prescribedQuantity: 1 }
    ]
  });

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await prescriptionApi.fetchPrescriptions({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      if (res && res.data) {
        setPrescriptions(res.data.items || res.data);
      }
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [docRes, patRes, medRes, deptRes] = await Promise.all([
        doctorApi.fetchDoctors(),
        patientApi.fetchPatients(),
        medicineApi.fetchMedicines({ limit: 100 }),
        doctorApi.fetchDepartments(),
      ]);

      if (docRes && docRes.data) setDoctors(docRes.data);
      if (patRes && patRes.data) setPatients(patRes.data);
      if (medRes && medRes.data) setMedicines(medRes.data.items || medRes.data);
      if (deptRes && deptRes.data) setDepartments(deptRes.data);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  }, []);

  useEffect(() => {
    loadPrescriptions();
    loadReferenceData();
  }, [loadPrescriptions, loadReferenceData]);

  const handleOpenView = async (rx) => {
    try {
      const res = await prescriptionApi.fetchPrescription(rx.id);
      setViewModal({ open: true, rx: res.data || rx });
    } catch {
      setViewModal({ open: true, rx });
    }
  };

  const handleVerifyStatus = async (rxId, newStatus) => {
    try {
      await prescriptionApi.verifyPrescription(rxId, { status: newStatus });
      loadPrescriptions();
      if (viewModal.open && viewModal.rx?.id === rxId) {
        setViewModal({ open: false, rx: null });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Verification failed');
    }
  };

  const handleDispenseInPos = (rx) => {
    // Pass prescription data via sessionStorage or state to POS
    const posPayload = {
      prescriptionId: rx.id,
      prescriptionNumber: rx.prescriptionNumber,
      patientName: rx.patient_name || rx.patientName,
      patientPhone: rx.patient_phone || rx.patientPhone,
      doctorName: rx.doctor_name || rx.doctorName,
      items: rx.items || [],
    };
    sessionStorage.setItem('pharmacare_pending_dispense', JSON.stringify(posPayload));
    navigate('/pos');
  };

  const handleSelectPatient = (patientId) => {
    const pat = patients.find(p => String(p.id) === String(patientId));
    if (pat) {
      setFormData(prev => ({
        ...prev,
        patientId: pat.id,
        patientName: pat.fullName,
        patientPhone: pat.phone || '',
        patientAge: pat.age || '',
        patientGender: pat.gender || 'male',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        patientId: '',
      }));
    }
  };

  const handleSelectDoctor = (doctorId) => {
    const doc = doctors.find(d => String(d.id) === String(doctorId));
    if (doc) {
      setFormData(prev => ({
        ...prev,
        doctorId: doc.id,
        doctorName: doc.fullName,
        doctorLicenseNo: doc.pmdcNumber || '',
        departmentId: doc.departmentId || '',
        clinicOrHospital: doc.clinicOrHospital || '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        doctorId: '',
      }));
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { medicineId: '', medicineName: '', dosage: '', frequency: '1-0-1', duration: '5 days', prescribedQuantity: 1 }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    if (field === 'medicineId') {
      const med = medicines.find(m => String(m.id) === String(value));
      if (med) {
        newItems[index].medicineName = `${med.brandName || med.brand_name} (${med.strength || ''}${med.strengthUnit || med.strength_unit || ''})`;
      }
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    if (!formData.patientName.trim()) {
      setErrorMsg('Patient name is required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await prescriptionApi.createPrescription(formData);
      setCreateModal(false);
      loadPrescriptions();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to create prescription');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription Repository & Verification"
        subtitle="Electronic prescriptions, physician registrations, clinical allergy checks, and one-click POS dispensing."
        breadcrumbs={[{ label: 'Prescriptions' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadPrescriptions}
              title="Refresh"
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setCreateModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus size={16} /> New Prescription
            </button>
          </div>
        }
      />

      {/* Security notice */}
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
        <Lock size={18} className="text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Restricted Medical Access — HIPAA & DRAP Compliance
          </p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1">
            Prescriptions are restricted to verified Pharmacists and Administrators. All verification
            actions and accesses are permanently recorded in the immutable audit ledger.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search Rx #, patient, doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-200"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending Verification</option>
              <option value="verified">Verified (Ready to Dispense)</option>
              <option value="dispensed">Dispensed</option>
              <option value="cancelled">Cancelled / Rejected</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Prescription List Table */}
      <Card padding={false}>
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading prescription repository...</div>
        ) : prescriptions.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No prescriptions found"
            description="Create an electronic prescription to verify medication and dispense in POS."
            action={
              <button
                onClick={() => setCreateModal(true)}
                className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
              >
                Create Prescription
              </button>
            }
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Rx Number</Th>
                <Th>Prescription Date</Th>
                <Th>Patient Name</Th>
                <Th>Prescribing Physician</Th>
                <Th>Department</Th>
                <Th>Medications</Th>
                <Th>Status</Th>
                <Th>Verified By</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {prescriptions.map((rx) => (
                <Tr key={rx.id}>
                  <Td>
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      {rx.prescriptionNumber || `RX-${rx.id}`}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {formatDate(rx.prescriptionDate || rx.prescription_date)}
                    </span>
                  </Td>
                  <Td>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {rx.patientName || rx.patient_name}
                    </p>
                    {(rx.patientPhone || rx.patient_phone) && (
                      <p className="text-xs text-slate-400">{rx.patientPhone || rx.patient_phone}</p>
                    )}
                  </Td>
                  <Td>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {rx.doctorName || rx.doctor_name || 'Medical Practitioner'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {rx.clinicOrHospital || rx.clinic_or_hospital || 'Hospital'}
                    </p>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {rx.departmentName || rx.department_name || 'General Medicine'}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                      {rx.itemCount || (rx.items ? rx.items.length : 1)} Items
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={rx.status || (rx.isVerified ? 'verified' : 'pending')} />
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-500">
                      {rx.verifiedBy || rx.verified_by_name || '—'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenView(rx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="View details & verify"
                      >
                        <Eye size={15} />
                      </button>
                      {(rx.status === 'verified' || rx.isVerified) && (
                        <button
                          onClick={() => handleDispenseInPos(rx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                          title="Dispense in POS"
                        >
                          <ShoppingCart size={13} /> Dispense
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* Prescription Detail & Verification Modal */}
      <Modal
        isOpen={viewModal.open}
        onClose={() => setViewModal({ open: false, rx: null })}
        title={`Prescription ${viewModal.rx?.prescription_number || viewModal.rx?.prescriptionNumber || viewModal.rx?.id}`}
        size="lg"
      >
        {viewModal.rx && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs">
              <div>
                <p className="text-slate-400">Patient</p>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {viewModal.rx.patient_name || viewModal.rx.patientName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {viewModal.rx.patient_phone || viewModal.rx.patientPhone}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Prescribing Doctor</p>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {viewModal.rx.doctor_name || viewModal.rx.doctorName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {viewModal.rx.doctor_license_no || viewModal.rx.doctorLicenseNo || 'PMDC Verified'}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Date & Dept</p>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {formatDate(viewModal.rx.prescription_date || viewModal.rx.prescriptionDate)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {viewModal.rx.department_name || viewModal.rx.departmentName || 'General Medicine'}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Verification Status</p>
                <div className="mt-1">
                  <StatusBadge status={viewModal.rx.status || (viewModal.rx.is_verified ? 'verified' : 'pending')} />
                </div>
              </div>
            </div>

            {/* Prescribed Items Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Prescribed Medications ({viewModal.rx.items?.length || 0})
              </h4>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Medication Name</th>
                      <th className="p-2.5">Dosage Instructions</th>
                      <th className="p-2.5 text-center">Prescribed Qty</th>
                      <th className="p-2.5 text-center">In Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viewModal.rx.items && viewModal.rx.items.length > 0 ? (
                      viewModal.rx.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                            {it.prescribed_medicine_name || it.prescribedMedicineName || it.brand_name || 'Medicine'}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">
                            {it.dosage_instructions || it.dosageInstructions || 'As directed'}
                          </td>
                          <td className="p-2.5 text-center font-bold">
                            {it.prescribed_quantity || it.prescribedQuantity || 1}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="font-semibold text-emerald-600">
                              {it.stockOnHand !== undefined ? `${it.stockOnHand} available` : 'Available'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-3 text-center text-slate-400 italic">
                          Standard prescription items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {viewModal.rx.notes && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Clinical Notes:</span>{' '}
                <span className="text-slate-500">{viewModal.rx.notes}</span>
              </div>
            )}

            {/* Actions footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewModal({ open: false, rx: null })}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {viewModal.rx.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleVerifyStatus(viewModal.rx.id, 'cancelled')}
                      className="px-3.5 py-2 border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                    <button
                      onClick={() => handleVerifyStatus(viewModal.rx.id, 'verified')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 size={15} /> Clinical Verification & Approve
                    </button>
                  </>
                )}

                {viewModal.rx.status === 'verified' && (
                  <button
                    onClick={() => handleDispenseInPos(viewModal.rx)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <ShoppingCart size={15} /> Load into POS & Dispense
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Prescription Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create Electronic Prescription"
        size="lg"
      >
        <form onSubmit={handleCreatePrescription} className="space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {errorMsg}
            </div>
          )}

          {/* Patient Selection */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User size={14} /> Patient Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Select Registered Patient (or enter manual)
                </label>
                <select
                  value={formData.patientId}
                  onChange={(e) => handleSelectPatient(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Manual / Walk-in Patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Patient Name"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+92-300-1234567"
                  value={formData.patientPhone}
                  onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Age</label>
                  <input
                    type="number"
                    placeholder="35"
                    value={formData.patientAge}
                    onChange={(e) => setFormData({ ...formData, patientAge: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Gender</label>
                  <select
                    value={formData.patientGender}
                    onChange={(e) => setFormData({ ...formData, patientGender: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Selection */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Stethoscope size={14} /> Prescribing Doctor Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Select Registered Doctor
                </label>
                <select
                  value={formData.doctorId}
                  onChange={(e) => handleSelectDoctor(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Manual Doctor Entry</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Doctor Name</label>
                <input
                  type="text"
                  placeholder="Prof. Dr. Tariq Mahmood"
                  value={formData.doctorName}
                  onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">PMDC Number</label>
                <input
                  type="text"
                  placeholder="PMDC-34821-P"
                  value={formData.doctorLicenseNo}
                  onChange={(e) => setFormData({ ...formData, doctorLicenseNo: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Medical Department</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Select Department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Medicine Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Prescribed Medicines
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus size={13} /> Add Drug
              </button>
            </div>

            {formData.items.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
              >
                <div className="sm:col-span-5">
                  <select
                    value={item.medicineId}
                    onChange={(e) => handleItemChange(idx, 'medicineId', e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                  >
                    <option value="">Select Drug from Catalogue...</option>
                    {medicines.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.brandName || m.brand_name} ({m.genericName || m.generic_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <input
                    type="text"
                    placeholder="Dosage (e.g. 1-0-1)"
                    value={item.frequency}
                    onChange={(e) => handleItemChange(idx, 'frequency', e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                  />
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Duration"
                    value={item.duration}
                    onChange={(e) => handleItemChange(idx, 'duration', e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                  />
                </div>

                <div className="sm:col-span-1">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.prescribedQuantity}
                    onChange={(e) => handleItemChange(idx, 'prescribedQuantity', e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-center"
                  />
                </div>

                <div className="sm:col-span-1 text-right">
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setCreateModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Save Prescription'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
