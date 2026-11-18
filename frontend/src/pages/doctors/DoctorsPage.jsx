import { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  Building2,
  Calendar,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Award,
  CheckCircle,
  FileText,
  Camera,
  Clock,
  CalendarOff,
  DollarSign,
  Upload,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { doctorApi, resolveMediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function DoctorsPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [formModal, setFormModal] = useState({ open: false, mode: 'create', doctor: null });
  const [viewModal, setViewModal] = useState({ open: false, doctor: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, doctor: null });
  const [photoModal, setPhotoModal] = useState({ open: false, doctor: null });
  const [scheduleModal, setScheduleModal] = useState({ open: false, doctor: null });
  const [leaveModal, setLeaveModal] = useState({ open: false, doctor: null });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Photo state
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  // Schedule state
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Leave state
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [newLeave, setNewLeave] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    pmdcNumber: '',
    specialization: '',
    departmentId: '',
    clinicOrHospital: '',
    phone: '',
    email: '',
    address: '',
    availability: '',
    status: 'active',
    consultationFee: 1500,
    roomNumber: 'Room 1',
    qualifications: '',
    bio: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, deptRes] = await Promise.all([
        doctorApi.fetchDoctors({
          search: search || undefined,
          departmentId: selectedDept || undefined,
          status: selectedStatus || undefined,
        }),
        doctorApi.fetchDepartments(),
      ]);

      if (docRes && docRes.data) {
        setDoctors(docRes.data);
      }
      if (deptRes && deptRes.data) {
        setDepartments(deptRes.data);
      }
    } catch (err) {
      console.error('Failed to load doctors data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedDept, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setErrorMsg('');
    setFormData({
      fullName: '',
      pmdcNumber: '',
      specialization: '',
      departmentId: departments[0]?.id || '',
      clinicOrHospital: '',
      phone: '',
      email: '',
      address: '',
      availability: 'Mon-Fri 09:00 - 14:00',
      status: 'active',
      consultationFee: 1500,
      roomNumber: 'Room 1',
      qualifications: 'MBBS, FCPS',
      bio: '',
    });
    setFormModal({ open: true, mode: 'create', doctor: null });
  };

  const handleOpenEdit = (doc) => {
    setErrorMsg('');
    setFormData({
      fullName: doc.fullName || '',
      pmdcNumber: doc.pmdcNumber || '',
      specialization: doc.specialization || '',
      departmentId: doc.departmentId || '',
      clinicOrHospital: doc.clinicOrHospital || '',
      phone: doc.phone || '',
      email: doc.email || '',
      address: doc.address || '',
      availability: doc.availability || '',
      status: doc.status || 'active',
      consultationFee: doc.consultationFee || 1500,
      roomNumber: doc.roomNumber || 'Room 1',
      qualifications: doc.qualifications || '',
      bio: doc.bio || '',
    });
    setFormModal({ open: true, mode: 'edit', doctor: doc });
  };

  const handleOpenView = async (doc) => {
    try {
      const res = await doctorApi.getDoctor(doc.id);
      setViewModal({ open: true, doctor: res.data || doc });
    } catch {
      setViewModal({ open: true, doctor: doc });
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.pmdcNumber.trim() || !formData.specialization.trim()) {
      setErrorMsg('Please fill in doctor name, PMDC number, and specialization.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (formModal.mode === 'create') {
        await doctorApi.createDoctor(formData);
      } else {
        await doctorApi.updateDoctor(formModal.doctor.id, formData);
      }
      setFormModal({ open: false, mode: 'create', doctor: null });
      loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.doctor) return;
    setSubmitting(true);
    try {
      await doctorApi.deleteDoctor(deleteModal.doctor.id);
      setDeleteModal({ open: false, doctor: null });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete doctor');
    } finally {
      setSubmitting(false);
    }
  };

  // Photo Handlers
  const handleOpenPhoto = (doc) => {
    setSelectedFile(null);
    setPhotoPreview(resolveMediaUrl(doc.photoUrl || doc.profilePhotoUrl));
    setPhotoModal({ open: true, doctor: doc });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('photo', selectedFile);
      await doctorApi.uploadDoctorPhoto(photoModal.doctor.id, form);
      setPhotoModal({ open: false, doctor: null });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Photo upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Remove doctor photograph?')) return;
    setSubmitting(true);
    try {
      await doctorApi.removeDoctorPhoto(photoModal.doctor.id);
      setPhotoModal({ open: false, doctor: null });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove photo');
    } finally {
      setSubmitting(false);
    }
  };

  // Schedule Handlers
  const handleOpenSchedule = async (doc) => {
    setScheduleModal({ open: true, doctor: doc });
    setLoadingSchedule(true);
    try {
      const res = await doctorApi.getDoctorSchedule(doc.id);
      const existing = res.data?.schedules || [];
      const populated = DAYS_OF_WEEK.map((day) => {
        const found = existing.find((s) => s.day_of_week === day);
        return (
          found || {
            day_of_week: day,
            is_active: day !== 'sunday' && day !== 'saturday',
            start_time: '09:00:00',
            end_time: '14:00:00',
            slot_duration_minutes: 20,
            break_start_time: null,
            break_end_time: null,
          }
        );
      });
      setScheduleData(populated);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await doctorApi.saveDoctorSchedule(scheduleModal.doctor.id, { schedules: scheduleData });
      setScheduleModal({ open: false, doctor: null });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  // Leaves Handlers
  const handleOpenLeaves = async (doc) => {
    setLeaveModal({ open: true, doctor: doc });
    setLoadingLeaves(true);
    try {
      const res = await doctorApi.fetchDoctorLeaves({ doctorId: doc.id });
      setLeaves(res.data || []);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const handleCreateLeave = async (e) => {
    e.preventDefault();
    if (!newLeave.startDate || !newLeave.endDate) {
      alert('Start date and end date are required');
      return;
    }
    setSubmitting(true);
    try {
      await doctorApi.createDoctorLeave({
        doctorId: leaveModal.doctor.id,
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        reason: newLeave.reason,
      });
      setNewLeave({ startDate: '', endDate: '', reason: '' });
      const res = await doctorApi.fetchDoctorLeaves({ doctorId: leaveModal.doctor.id });
      setLeaves(res.data || []);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLeaveStatus = async (leaveId, status) => {
    try {
      await doctorApi.updateDoctorLeaveStatus(leaveId, status);
      const res = await doctorApi.fetchDoctorLeaves({ doctorId: leaveModal.doctor.id });
      setLeaves(res.data || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update leave status');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors & Medical Specialists"
        subtitle="Manage PMDC-registered physicians, consultation schedules, clinic rooms, photos, and leaves."
        breadcrumbs={[{ label: 'Doctors' }]}
        actions={
          (user?.role === 'admin' || user?.role === 'pharmacist') && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus size={15} /> Add Doctor
            </button>
          )
        }
      />

      {/* Filter Card */}
      <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, PMDC, specialization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </Card>

      {/* Doctors Table */}
      <Card padding={false} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading doctor records...</div>
        ) : doctors.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No doctor records found"
            description="Try modifying search keywords or register a new physician."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Doctor</Th>
                <Th>Department & Room</Th>
                <Th>Fee (PKR)</Th>
                <Th>PMDC Reg #</Th>
                <Th>Contact</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {doctors.map((doc) => (
                <Tr key={doc.id}>
                  {/* Doctor Info & Photo */}
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                        {doc.photoUrl || doc.profilePhotoUrl ? (
                          <img
                            src={resolveMediaUrl(doc.photoUrl || doc.profilePhotoUrl)}
                            alt={doc.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold text-xs text-teal-700 dark:text-teal-300">
                            {doc.fullName
                              .replace('Prof. ', '')
                              .replace('Dr. ', '')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs">
                          {doc.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {doc.specialization} {doc.qualifications ? `• ${doc.qualifications}` : ''}
                        </p>
                      </div>
                    </div>
                  </Td>

                  {/* Department & Room */}
                  <Td>
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {doc.departmentName || 'General'}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Room: {doc.roomNumber || 'Room 1'}
                      </span>
                    </div>
                  </Td>

                  {/* Consultation Fee */}
                  <Td>
                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      PKR {doc.consultationFee || 1500}
                    </span>
                  </Td>

                  {/* PMDC */}
                  <Td>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {doc.pmdcNumber}
                    </span>
                  </Td>

                  {/* Contact */}
                  <Td>
                    <span className="text-xs text-slate-500 block">{doc.phone || 'N/A'}</span>
                  </Td>

                  {/* Status */}
                  <Td>
                    <StatusBadge status={doc.status} />
                  </Td>

                  {/* Action Buttons */}
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Photo Upload */}
                      <button
                        onClick={() => handleOpenPhoto(doc)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-600 transition-colors"
                        title="Upload Photograph"
                      >
                        <Camera size={14} />
                      </button>

                      {/* Schedule Manager */}
                      <button
                        onClick={() => handleOpenSchedule(doc)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
                        title="Configure Weekly Schedule"
                      >
                        <Clock size={14} />
                      </button>

                      {/* Leaves Manager */}
                      <button
                        onClick={() => handleOpenLeaves(doc)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 transition-colors"
                        title="Manage Leaves"
                      >
                        <CalendarOff size={14} />
                      </button>

                      {/* View Dossier */}
                      <button
                        onClick={() => handleOpenView(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                        title="View profile"
                      >
                        <Eye size={14} />
                      </button>

                      {/* Edit */}
                      {(user?.role === 'admin' || user?.role === 'pharmacist') && (
                        <button
                          onClick={() => handleOpenEdit(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit doctor"
                        >
                          <Edit size={14} />
                        </button>
                      )}

                      {/* Delete */}
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setDeleteModal({ open: true, doctor: doc })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete doctor"
                        >
                          <Trash2 size={14} />
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

      {/* Photo Upload Modal */}
      {photoModal.open && (
        <Modal
          isOpen={photoModal.open}
          onClose={() => setPhotoModal({ open: false, doctor: null })}
          title={`Doctor Photograph: ${photoModal.doctor?.fullName}`}
        >
          <form onSubmit={handleUploadPhoto} className="space-y-4">
            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              {photoPreview ? (
                <div className="w-28 h-28 rounded-2xl overflow-hidden mb-3 border border-teal-500 shadow-md">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <Camera size={36} />
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              {photoModal.doctor?.photoUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-3 py-1.5 text-xs text-rose-600 hover:underline font-semibold"
                >
                  Remove Photo
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setPhotoModal({ open: false, doctor: null })}
                  className="px-4 py-2 text-xs font-semibold border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedFile}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Uploading...' : 'Upload Photograph'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Weekly Schedule Modal */}
      {scheduleModal.open && (
        <Modal
          isOpen={scheduleModal.open}
          onClose={() => setScheduleModal({ open: false, doctor: null })}
          title={`Weekly Consultation Schedule: ${scheduleModal.doctor?.fullName}`}
          size="lg"
        >
          <form onSubmit={handleSaveSchedule} className="space-y-4">
            {loadingSchedule ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading schedule...</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {scheduleData.map((s, idx) => (
                  <div
                    key={s.day_of_week}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 w-28">
                      <input
                        type="checkbox"
                        checked={s.is_active}
                        onChange={(e) => {
                          const updated = [...scheduleData];
                          updated[idx].is_active = e.target.checked;
                          setScheduleData(updated);
                        }}
                        className="rounded text-teal-600"
                      />
                      <span className="font-bold uppercase text-slate-800 dark:text-slate-200">
                        {s.day_of_week.slice(0, 3)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        disabled={!s.is_active}
                        value={s.start_time?.slice(0, 5) || '09:00'}
                        onChange={(e) => {
                          const updated = [...scheduleData];
                          updated[idx].start_time = e.target.value;
                          setScheduleData(updated);
                        }}
                        className="px-2 py-1 rounded border text-xs"
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="time"
                        disabled={!s.is_active}
                        value={s.end_time?.slice(0, 5) || '14:00'}
                        onChange={(e) => {
                          const updated = [...scheduleData];
                          updated[idx].end_time = e.target.value;
                          setScheduleData(updated);
                        }}
                        className="px-2 py-1 rounded border text-xs"
                      />

                      <span className="text-slate-400 ml-2">Slot (mins):</span>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        disabled={!s.is_active}
                        value={s.slot_duration_minutes || 20}
                        onChange={(e) => {
                          const updated = [...scheduleData];
                          updated[idx].slot_duration_minutes = parseInt(e.target.value, 10);
                          setScheduleData(updated);
                        }}
                        className="w-16 px-2 py-1 rounded border text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setScheduleModal({ open: false, doctor: null })}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                {submitting ? 'Saving...' : 'Save Weekly Schedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Leaves Modal */}
      {leaveModal.open && (
        <Modal
          isOpen={leaveModal.open}
          onClose={() => setLeaveModal({ open: false, doctor: null })}
          title={`Doctor Leaves & Absences: ${leaveModal.doctor?.fullName}`}
          size="lg"
        >
          <div className="space-y-5">
            {/* Apply Leave Form */}
            <form onSubmit={handleCreateLeave} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border space-y-3">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                Apply New Leave
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.startDate}
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.endDate}
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Annual Leave, Medical"
                    value={newLeave.reason}
                    onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                >
                  Apply Leave
                </button>
              </div>
            </form>

            {/* Existing Leaves List */}
            <div>
              <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">
                Registered Leaves ({leaves.length})
              </h4>
              {loadingLeaves ? (
                <div className="py-4 text-center text-xs text-slate-400">Loading leaves...</div>
              ) : leaves.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No leaves registered for this doctor.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {leaves.map((l) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {l.start_date} to {l.end_date}
                        </span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Reason: {l.reason || 'Personal'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            l.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : l.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {l.status}
                        </span>

                        {l.status === 'pending' && user?.role === 'admin' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateLeaveStatus(l.id, 'approved')}
                              className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateLeaveStatus(l.id, 'rejected')}
                              className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setLeaveModal({ open: false, doctor: null })}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create / Edit Form Modal */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, mode: 'create', doctor: null })}
        title={formModal.mode === 'create' ? 'Register New Doctor' : `Edit Doctor: ${formModal.doctor?.fullName}`}
        size="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-red-50 text-red-700 border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name with Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Prof. Dr. Tariq Mahmood"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                PMDC License # *
              </label>
              <input
                type="text"
                required
                placeholder="PMDC-34821-P"
                value={formData.pmdcNumber}
                onChange={(e) => setFormData({ ...formData, pmdcNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Specialization *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Consultant Cardiologist"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Qualifications
              </label>
              <input
                type="text"
                placeholder="e.g. MBBS, FCPS, FRCP"
                value={formData.qualifications}
                onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Consulting Room Number
              </label>
              <input
                type="text"
                placeholder="e.g. Room 102"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Consultation Fee (PKR)
              </label>
              <input
                type="number"
                placeholder="1500"
                value={formData.consultationFee}
                onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="0300-1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setFormModal({ open: false, mode: 'create', doctor: null })}
              className="px-4 py-2 border rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {submitting ? 'Saving...' : formModal.mode === 'create' ? 'Register Doctor' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Doctor Modal */}
      {viewModal.open && viewModal.doctor && (
        <Modal
          isOpen={viewModal.open}
          onClose={() => setViewModal({ open: false, doctor: null })}
          title={viewModal.doctor.fullName}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-teal-100 flex items-center justify-center font-bold text-lg text-teal-700">
                {viewModal.doctor.photoUrl || viewModal.doctor.profilePhotoUrl ? (
                  <img
                    src={resolveMediaUrl(viewModal.doctor.photoUrl || viewModal.doctor.profilePhotoUrl)}
                    alt={viewModal.doctor.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  viewModal.doctor.fullName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {viewModal.doctor.fullName}
                </h3>
                <p className="text-teal-600 font-semibold">{viewModal.doctor.specialization}</p>
                <p className="text-slate-400">
                  Room: {viewModal.doctor.roomNumber || 'Room 1'} • Fee: PKR {viewModal.doctor.consultationFee || 1500}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px]">PMDC Number</span>
                <span className="font-bold font-mono">{viewModal.doctor.pmdcNumber}</span>
              </div>
              <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px]">Department</span>
                <span className="font-bold">{viewModal.doctor.departmentName || 'General'}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <Modal
          isOpen={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, doctor: null })}
          title="Confirm Deactivation"
          size="sm"
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deactivate doctor {deleteModal.doctor?.fullName}?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal({ open: false, doctor: null })}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                {submitting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
