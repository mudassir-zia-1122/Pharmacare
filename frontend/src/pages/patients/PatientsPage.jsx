import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  FileText,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Heart,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { patientApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

export function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [formModal, setFormModal] = useState({ open: false, mode: 'create', patient: null });
  const [viewModal, setViewModal] = useState({ open: false, patient: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, patient: null });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    mrn: '',
    fullName: '',
    age: '',
    dateOfBirth: '',
    gender: 'male',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bloodGroup: '',
    allergies: '',
    medicalNotes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patientApi.fetchPatients({
        search: search || undefined,
      });
      if (res && res.data) {
        setPatients(res.data);
      }
    } catch (err) {
      console.error('Failed to load patient records:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setErrorMsg('');
    const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    setFormData({
      mrn: `PAT-${datePrefix}-${randSuffix}`,
      fullName: '',
      age: '',
      dateOfBirth: '',
      gender: 'male',
      phone: '',
      email: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      bloodGroup: 'B+',
      allergies: '',
      medicalNotes: '',
    });
    setFormModal({ open: true, mode: 'create', patient: null });
  };

  const handleOpenEdit = (pat) => {
    setErrorMsg('');
    setFormData({
      mrn: pat.mrn || '',
      fullName: pat.fullName || '',
      age: pat.age || '',
      dateOfBirth: pat.dateOfBirth || '',
      gender: pat.gender || 'male',
      phone: pat.phone || '',
      email: pat.email || '',
      address: pat.address || '',
      emergencyContactName: pat.emergencyContactName || '',
      emergencyContactPhone: pat.emergencyContactPhone || '',
      bloodGroup: pat.bloodGroup || '',
      allergies: pat.allergies || '',
      medicalNotes: pat.medicalNotes || '',
    });
    setFormModal({ open: true, mode: 'edit', patient: pat });
  };

  const handleOpenView = async (pat) => {
    try {
      const res = await patientApi.getPatient(pat.id);
      setViewModal({ open: true, patient: res.data || pat });
    } catch {
      setViewModal({ open: true, patient: pat });
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      setErrorMsg('Patient full name is required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (formModal.mode === 'create') {
        await patientApi.createPatient(formData);
      } else {
        await patientApi.updatePatient(formModal.patient.id, formData);
      }
      setFormModal({ open: false, mode: 'create', patient: null });
      loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.patient) return;
    setSubmitting(true);
    try {
      await patientApi.deletePatient(deleteModal.patient.id);
      setDeleteModal({ open: false, patient: null });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete patient');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const totalPatients = patients.length;
  const maleCount = patients.filter(p => p.gender === 'male').length;
  const femaleCount = patients.filter(p => p.gender === 'female').length;
  const withAllergies = patients.filter(p => p.allergies && p.allergies.trim() && p.allergies.toLowerCase() !== 'none').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients & Clinical Registry"
        subtitle="Medical Record Numbers (MRN), demographics, allergy contraindications, and electronic health history."
        breadcrumbs={[{ label: 'Patients' }]}
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
              <Plus size={16} /> Register Patient
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Patients</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalPatients}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Users size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Male / Female</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {maleCount} <span className="text-sm font-normal text-slate-400">/</span> {femaleCount}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <UserCheck size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-500/10 to-red-500/5 border-rose-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Known Drug Allergies</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{withAllergies}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <ShieldAlert size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">HIPAA Protected</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-2">Immutable Audit</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Heart size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, MRN, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </Card>

      {/* Patient Table */}
      <Card padding={false}>
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading patient records...</div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patient records found"
            description="Register a new patient to maintain electronic prescriptions and dispensing history."
            action={
              <button
                onClick={handleOpenCreate}
                className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
              >
                Register Patient
              </button>
            }
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>MRN / Patient ID</Th>
                <Th>Patient Full Name</Th>
                <Th>Demographics</Th>
                <Th>Contact Info</Th>
                <Th>Blood Group</Th>
                <Th>Drug Allergies</Th>
                <Th>Prescriptions</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {patients.map((pat) => (
                <Tr key={pat.id}>
                  <Td>
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      {pat.mrn}
                    </span>
                  </Td>
                  <Td>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {pat.fullName}
                    </p>
                    {pat.emergencyContactName && (
                      <p className="text-xs text-slate-400">
                        Emerg: {pat.emergencyContactName} ({pat.emergencyContactPhone || 'N/A'})
                      </p>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">
                      {pat.age ? `${pat.age} yrs` : 'Age N/A'} • {pat.gender}
                    </span>
                  </Td>
                  <Td>
                    <div className="text-xs space-y-0.5">
                      {pat.phone && (
                        <p className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <Phone size={11} /> {pat.phone}
                        </p>
                      )}
                      {pat.email && (
                        <p className="flex items-center gap-1 text-slate-400 truncate max-w-[150px]">
                          <Mail size={11} /> {pat.email}
                        </p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      {pat.bloodGroup || 'Unknown'}
                    </span>
                  </Td>
                  <Td>
                    {pat.allergies && pat.allergies.toLowerCase() !== 'none' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
                        <AlertTriangle size={12} className="text-red-600" />
                        {pat.allergies.slice(0, 24)}
                        {pat.allergies.length > 24 ? '...' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">None reported</span>
                    )}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                      {pat.prescriptionCount || 0} Rx
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenView(pat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="View clinical dossier"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(pat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit patient"
                      >
                        <Edit size={15} />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setDeleteModal({ open: true, patient: pat })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete patient"
                        >
                          <Trash2 size={15} />
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

      {/* Add / Edit Patient Modal */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, mode: 'create', patient: null })}
        title={formModal.mode === 'create' ? 'Register New Patient' : `Edit Patient: ${formModal.patient?.fullName}`}
        size="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Medical Record Number (MRN) *
              </label>
              <input
                type="text"
                required
                value={formData.mrn}
                onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Muhammad Usman"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Age (Years)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                placeholder="42"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+92-300-1122334"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Blood Group
              </label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="">Select Blood Group...</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Emergency Contact Person
              </label>
              <input
                type="text"
                placeholder="e.g. Fatima Usman (Wife)"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Emergency Phone Number
              </label>
              <input
                type="text"
                placeholder="+92-300-1122335"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                <AlertTriangle size={13} /> Known Drug Allergies & Adverse Reactions
              </label>
              <input
                type="text"
                placeholder="e.g. Penicillin (Anaphylaxis), Sulfa drugs, Aspirin"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg focus:ring-2 focus:ring-red-500 text-red-900 dark:text-red-200"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Confidential Clinical Notes & Diagnoses (Staff Access Only)
              </label>
              <textarea
                rows="3"
                placeholder="Chronic conditions (Diabetes, Hypertension), surgeries, active maintenance drugs..."
                value={formData.medicalNotes}
                onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setFormModal({ open: false, mode: 'create', patient: null })}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : formModal.mode === 'create' ? 'Register Patient' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Patient Dossier Modal */}
      <Modal
        isOpen={viewModal.open}
        onClose={() => setViewModal({ open: false, patient: null })}
        title={viewModal.patient?.fullName || 'Patient Clinical Dossier'}
        size="lg"
      >
        {viewModal.patient && (
          <div className="space-y-4">
            {/* Header banner */}
            <div className="flex items-start justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                  {viewModal.patient.mrn}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {viewModal.patient.fullName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {viewModal.patient.age ? `${viewModal.patient.age} yrs` : ''} •{' '}
                  <span className="capitalize">{viewModal.patient.gender}</span> • Blood Group:{' '}
                  <span className="font-bold text-rose-600">{viewModal.patient.bloodGroup || 'N/A'}</span>
                </p>
              </div>

              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {viewModal.patient.phone || 'No phone'}
                </p>
                <p>{viewModal.patient.emergencyContactName ? `Emerg: ${viewModal.patient.emergencyContactName}` : ''}</p>
                <p>{viewModal.patient.emergencyContactPhone}</p>
              </div>
            </div>

            {/* Allergy Alert Banner */}
            {viewModal.patient.allergies && viewModal.patient.allergies.toLowerCase() !== 'none' ? (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-wider">
                    Critical Allergy Contraindication Alert
                  </p>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300 mt-0.5">
                    {viewModal.patient.allergies}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <UserCheck size={16} /> No adverse drug reactions or allergies reported on file.
              </div>
            )}

            {/* Clinical Medical Notes */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <FileText size={14} /> Medical History & Diagnoses
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {viewModal.patient.medicalNotes || 'No specific chronic conditions or clinical notes recorded.'}
              </p>
            </div>

            {/* Prescriptions History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Historical Prescriptions ({viewModal.patient.prescriptions?.length || 0})
              </h4>
              {viewModal.patient.prescriptions && viewModal.patient.prescriptions.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {viewModal.patient.prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-emerald-600">
                          {rx.prescriptionNumber}
                        </span>
                        <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                          Dr. {rx.doctorName}
                        </span>
                        <span className="ml-2 text-slate-400">({rx.departmentName || 'Clinic'})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{rx.prescriptionDate}</span>
                        <StatusBadge status={rx.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No prescriptions recorded yet for this patient.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewModal({ open: false, patient: null })}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, patient: null })}
        title="Confirm Soft Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete patient record for{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {deleteModal.patient?.fullName}
            </span>{' '}
            ({deleteModal.patient?.mrn})? Historical sales and prescription linkages will be preserved.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteModal({ open: false, patient: null })}
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
