import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Tv,
  ArrowRight,
  ShieldAlert,
  Edit,
  Eye,
  Activity,
  Stethoscope,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { appointmentApi, doctorApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

export function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Priority Modal
  const [priorityModal, setPriorityModal] = useState({ open: false, appointment: null, level: 'emergency', reason: '' });
  // Reschedule Modal
  const [rescheduleModal, setRescheduleModal] = useState({ open: false, appointment: null, date: '', time: '', reason: '' });
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  // Status Modal
  const [statusModal, setStatusModal] = useState({ open: false, appointment: null, status: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  // Load doctors for filter
  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await doctorApi.fetchDoctors({ limit: 100 });
        if (res && res.data) {
          setDoctors(res.data);
        }
      } catch (err) {
        console.error('Failed to load doctors list:', err);
      }
    }
    loadDoctors();
  }, []);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appointmentApi.fetchAppointments({
        page,
        limit: 15,
        search: search || undefined,
        doctorId: selectedDoctor || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        date: selectedDate || undefined,
      });

      if (res && res.data) {
        setAppointments(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedDoctor, selectedStatus, selectedPriority, selectedDate]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Handle Quick Status Change
  const handleQuickStatus = async (appointment, nextStatus, defaultReason = '') => {
    try {
      await appointmentApi.updateAppointmentStatus(appointment.id, nextStatus, defaultReason);
      loadAppointments();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Status update failed.');
    }
  };

  // Submit Priority Change
  const handleSavePriority = async (e) => {
    e.preventDefault();
    if (!priorityModal.reason.trim()) {
      alert('Please enter a clinical or triage authorization reason.');
      return;
    }
    setSubmitting(true);
    try {
      await appointmentApi.assignEmergencyPriority(
        priorityModal.appointment.id,
        priorityModal.level,
        priorityModal.reason
      );
      setPriorityModal({ open: false, appointment: null, level: 'emergency', reason: '' });
      loadAppointments();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Priority update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reschedule Modal & Fetch slots
  const handleOpenReschedule = async (apt) => {
    const defaultDate = apt.appointment_date || new Date().toISOString().split('T')[0];
    setRescheduleModal({
      open: true,
      appointment: apt,
      date: defaultDate,
      time: '',
      reason: '',
    });
    fetchSlotsForDate(apt.doctor_id, defaultDate);
  };

  const fetchSlotsForDate = async (docId, dateStr) => {
    setLoadingSlots(true);
    try {
      const res = await appointmentApi.fetchAvailableSlots(docId, dateStr);
      if (res && res.data) {
        setRescheduleSlots(res.data.slots?.filter((s) => s.available) || []);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setRescheduleSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleModal.date || !rescheduleModal.time) {
      alert('Please select date and time slot.');
      return;
    }
    setSubmitting(true);
    try {
      await appointmentApi.rescheduleAppointment(
        rescheduleModal.appointment.id,
        rescheduleModal.date,
        rescheduleModal.time,
        rescheduleModal.reason || 'Staff rescheduled'
      );
      setRescheduleModal({ open: false, appointment: null, date: '', time: '', reason: '' });
      loadAppointments();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Reschedule failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Doctor Appointments & Queue Ledger"
        subtitle="Manage patient appointments, scheduled consultations, emergency priorities, and daily tokens."
        breadcrumbs={[{ label: 'Appointments' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/reception"
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Reception Desk
            </Link>
            <Link
              to="/appointments/queue"
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              Live Queue Desk
            </Link>
            <Link
              to="/queue-display"
              target="_blank"
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Tv className="w-4 h-4 text-indigo-500" />
              Waiting Room TV
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 block">Total Today</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {summary.totalToday || 0}
            </span>
          </Card>
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block">Scheduled</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {summary.scheduled || 0}
            </span>
          </Card>
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold block">Checked In (Waiting)</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {summary.checkedIn || 0}
            </span>
          </Card>
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold block">In Consultation</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {summary.inConsultation || 0}
            </span>
          </Card>
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold block">Completed</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {summary.completed || 0}
            </span>
          </Card>
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold block">Emergency Cases</span>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 block">
              {summary.emergencyCount || 0}
            </span>
          </Card>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ref, patient, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Date */}
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Doctor Filter */}
          <div>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="checked_in">Checked In</option>
              <option value="in_consultation">In Consultation</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Priorities</option>
              <option value="normal">Normal</option>
              <option value="emergency">Emergency / Urgent</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Appointments Ledger Table */}
      <Card className="overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-500" />
            <p className="text-sm">Loading appointment records...</p>
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No appointments found"
            description="No appointments match your selected date and filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Token / Priority</Th>
                  <Th>Reference / Time</Th>
                  <Th>Patient</Th>
                  <Th>Doctor / Room</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {appointments.map((apt) => {
                  const isEmergency = apt.priority_level === 'emergency';
                  return (
                    <Tr key={apt.id} className={isEmergency ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}>
                      {/* Token & Priority */}
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-800 dark:text-teal-300">
                            {apt.token_display || `T-${String(apt.token_number).padStart(3, '0')}`}
                          </span>
                          {isEmergency && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              Emergency
                            </span>
                          )}
                        </div>
                      </Td>

                      {/* Reference & Time */}
                      <Td>
                        <div className="text-xs">
                          <span className="font-mono font-bold text-slate-900 dark:text-white block">
                            {apt.reference_number}
                          </span>
                          <span className="text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {apt.appointment_time} • {apt.appointment_date}
                          </span>
                        </div>
                      </Td>

                      {/* Patient Details */}
                      <Td>
                        <div className="text-xs">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {apt.patient_name}
                          </span>
                          <span className="text-slate-500">
                            {apt.patient_phone} {apt.age ? `• ${apt.age}y` : ''} {apt.gender ? `• ${apt.gender}` : ''}
                          </span>
                        </div>
                      </Td>

                      {/* Doctor & Room */}
                      <Td>
                        <div className="text-xs">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {apt.doctor_name}
                          </span>
                          <span className="text-slate-500">
                            {apt.room_number || 'Room 1'} • {apt.department_name}
                          </span>
                        </div>
                      </Td>

                      {/* Status */}
                      <Td>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            apt.status === 'in_consultation'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse'
                              : apt.status === 'checked_in'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                              : apt.status === 'scheduled'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : apt.status === 'completed'
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {apt.status?.replace('_', ' ')}
                        </span>
                      </Td>

                      {/* Actions */}
                      <Td>
                        <div className="flex items-center gap-1.5 text-xs">
                          {apt.status === 'scheduled' && (
                            <button
                              onClick={() => handleQuickStatus(apt, 'checked_in', 'Patient checked in at reception')}
                              className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold transition-colors"
                              title="Check In Patient"
                            >
                              Check In
                            </button>
                          )}

                          {apt.status === 'checked_in' && (
                            <button
                              onClick={() => handleQuickStatus(apt, 'in_consultation', 'Doctor called patient')}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                              title="Start Consultation"
                            >
                              Consult
                            </button>
                          )}

                          {apt.status === 'in_consultation' && (
                            <button
                              onClick={() => handleQuickStatus(apt, 'completed', 'Consultation finished')}
                              className="px-2 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-colors"
                              title="Complete"
                            >
                              Finish
                            </button>
                          )}

                          {/* Emergency Toggle */}
                          <button
                            onClick={() =>
                              setPriorityModal({
                                open: true,
                                appointment: apt,
                                level: isEmergency ? 'normal' : 'emergency',
                                reason: '',
                              })
                            }
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isEmergency
                                ? 'bg-rose-100 text-rose-700 border-rose-300'
                                : 'border-slate-300 text-slate-500 hover:text-rose-600'
                            }`}
                            title={isEmergency ? 'Demote to Normal Priority' : 'Elevate to Emergency Priority'}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>

                          {/* Reschedule */}
                          {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenReschedule(apt)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-teal-600 transition-colors"
                              title="Reschedule Appointment"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* Emergency Priority Modal */}
      {priorityModal.open && (
        <Modal
          isOpen={priorityModal.open}
          onClose={() => setPriorityModal({ open: false, appointment: null, level: 'emergency', reason: '' })}
          title={
            priorityModal.level === 'emergency'
              ? 'Assign Emergency Priority'
              : 'Revert to Normal Priority'
          }
        >
          <form onSubmit={handleSavePriority} className="space-y-4">
            <p className="text-xs text-slate-500">
              {priorityModal.level === 'emergency'
                ? 'Elevating this patient to Emergency will prioritize their token at the top of the queue for immediate call.'
                : 'Reverting this token to Normal priority will restore standard sequential queue ordering.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Triage / Clinical Authorization Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Patient acute chest pain, oxygen saturation drop, severe bleeding"
                value={priorityModal.reason}
                onChange={(e) =>
                  setPriorityModal({ ...priorityModal, reason: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPriorityModal({ open: false, appointment: null, level: 'emergency', reason: '' })}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Confirm Priority'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal.open && (
        <Modal
          isOpen={rescheduleModal.open}
          onClose={() => setRescheduleModal({ open: false, appointment: null, date: '', time: '', reason: '' })}
          title="Reschedule Patient Appointment"
        >
          <form onSubmit={handleSaveReschedule} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Date
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={rescheduleModal.date}
                onChange={(e) => {
                  const d = e.target.value;
                  setRescheduleModal((prev) => ({ ...prev, date: d, time: '' }));
                  fetchSlotsForDate(rescheduleModal.appointment.doctor_id, d);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Time Slot
              </label>
              {loadingSlots ? (
                <div className="py-3 text-center text-xs text-slate-400">Loading slots...</div>
              ) : rescheduleSlots.length === 0 ? (
                <p className="text-xs text-rose-500 py-1">No slots available on this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                  {rescheduleSlots.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRescheduleModal((prev) => ({ ...prev, time: s.time }))}
                      className={`p-2 rounded-lg text-xs font-semibold border ${
                        rescheduleModal.time === s.time
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Rescheduling
              </label>
              <input
                type="text"
                placeholder="Reason"
                value={rescheduleModal.reason}
                onChange={(e) => setRescheduleModal({ ...rescheduleModal, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleModal({ open: false, appointment: null, date: '', time: '', reason: '' })}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !rescheduleModal.time}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {submitting ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
