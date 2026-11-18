import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Calendar,
  Clock,
  User,
  Phone,
  Building2,
  Stethoscope,
  CheckCircle,
  XCircle,
  AlertCircle,
  Printer,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { appointmentApi } from '../../api';

export function MyAppointmentsPage() {
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reschedule state
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Cancellation state
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const handleLookup = async (e) => {
    e?.preventDefault();
    if (!reference.trim() || !phone.trim()) {
      setErrorMsg('Please enter both your Booking Reference Number and Phone Number.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await appointmentApi.lookupAppointment(reference.trim(), phone.trim());
      if (res && res.data) {
        setAppointment(res.data);
      }
    } catch (err) {
      setAppointment(null);
      setErrorMsg(
        err.response?.data?.message ||
          'Appointment not found. Please check your reference number and contact phone number.'
      );
    } finally {
      setLoading(false);
    }
  };

  const openReschedule = async () => {
    setRescheduleModal(true);
    setNewDate(appointment.appointment_date);
    setRescheduleReason('');
    await fetchSlotsForReschedule(appointment.doctor_id, appointment.appointment_date);
  };

  const fetchSlotsForReschedule = async (docId, dateStr) => {
    setLoadingSlots(true);
    setNewTime('');
    try {
      const res = await appointmentApi.fetchAvailableSlots(docId, dateStr);
      if (res && res.data) {
        setAvailableSlots(res.data.slots?.filter((s) => s.isAvailable ?? s.available) || []);
      }
    } catch (err) {
      console.error('Error fetching reschedule slots:', err);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (dateStr) => {
    setNewDate(dateStr);
    if (appointment?.doctor_id) {
      fetchSlotsForReschedule(appointment.doctor_id, dateStr);
    }
  };

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!newDate || !newTime) {
      alert('Please select both a new date and a time slot.');
      return;
    }

    setRescheduling(true);
    try {
      const res = await appointmentApi.rescheduleAppointment(
        appointment.id,
        newDate,
        newTime,
        rescheduleReason || 'Patient requested reschedule'
      );
      setRescheduleModal(false);
      setSuccessMsg('Your appointment has been rescheduled successfully! Updated token generated.');
      // Refresh appointment details
      if (res && res.data?.appointment) {
        setAppointment((prev) => ({
          ...prev,
          appointment_date: newDate,
          appointment_time: newTime,
          token_display: res.data.token?.token_display || prev.token_display,
          token_number: res.data.token?.token_number || prev.token_number,
          status: 'scheduled',
        }));
      } else {
        handleLookup();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Rescheduling failed.');
    } finally {
      setRescheduling(false);
    }
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    setCancelling(true);
    try {
      await appointmentApi.updateAppointmentStatus(
        appointment.id,
        'cancelled',
        cancelReason || 'Cancelled by patient via portal'
      );
      setCancelModal(false);
      setSuccessMsg('Your appointment has been cancelled.');
      setAppointment((prev) => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_consultation':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
            Now In Consultation
          </span>
        );
      case 'checked_in':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            Checked In (Waiting)
          </span>
        );
      case 'scheduled':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Confirmed (Not Checked In)
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Track & Manage My Appointment
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter your appointment reference number and contact phone to view your live token position, reschedule, or cancel.
          </p>
        </div>

        {/* Lookup Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Booking Reference Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. APT-20261102-1234"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0300-1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Link
                to="/book-appointment"
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold"
              >
                &larr; Book a New Appointment
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Lookup Appointment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm flex items-start gap-2">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
            <div>{successMsg}</div>
          </div>
        )}

        {/* Appointment Result Card */}
        {appointment && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Booking Reference
                </span>
                <h2 className="text-xl font-mono font-black text-slate-900 dark:text-white">
                  {appointment.reference_number}
                </h2>
              </div>
              <div>{getStatusBadge(appointment.status)}</div>
            </div>

            {/* Token Highlight Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
              <div className="text-center sm:text-left">
                <span className="text-[11px] uppercase tracking-wider text-teal-100 font-bold">
                  Queue Token Number
                </span>
                <div className="text-4xl sm:text-5xl font-black">
                  {appointment.token_display || `T-${String(appointment.token_number).padStart(3, '0')}`}
                </div>
              </div>

              <div className="text-center sm:text-right text-xs text-teal-100 space-y-1">
                <div>
                  Room Number: <strong className="text-white text-sm">{appointment.room_number || 'Room 1'}</strong>
                </div>
                <div>
                  Doctor:{' '}
                  <strong className="text-white text-sm">{appointment.doctor_name}</strong>
                </div>
                <div>
                  Scheduled Time:{' '}
                  <strong className="text-white text-sm">
                    {appointment.appointment_date} at {appointment.appointment_time}
                  </strong>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-medium block">Patient Name</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                  {appointment.patient_name}
                </span>
                <span className="text-slate-500">
                  Phone: {appointment.patient_phone} • {appointment.gender || 'N/A'}, Age: {appointment.age || 'N/A'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-medium block">Specialization & Fee</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                  {appointment.doctor_specialization || 'Consultant'}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Fee: PKR {appointment.consultation_fee || 1500}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" /> Print Token
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openReschedule}
                    className="px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-100 font-semibold text-xs transition-colors"
                  >
                    Reschedule Appointment
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelModal(true)}
                    className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-semibold text-xs transition-colors"
                  >
                    Cancel Appointment
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Reschedule Appointment
              </h3>
              <p className="text-xs text-slate-500">
                Choose a new date and consultation slot with {appointment.doctor_name}.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select New Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={newDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select New Time Slot
                </label>
                {loadingSlots ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline-block mr-1 text-teal-500" />
                    Loading available slots...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-xs text-rose-500 py-2">
                    No available slots on this date. Please pick another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                    {availableSlots.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewTime(s.time)}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                          newTime === s.time
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-teal-400'
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
                  placeholder="e.g. Schedule clash, travel, feeling better"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rescheduling || !newTime}
                  onClick={handleConfirmReschedule}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {rescheduling ? 'Rescheduling...' : 'Confirm New Slot'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {cancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-center text-slate-900 dark:text-white">
                Cancel Appointment?
              </h3>
              <p className="text-xs text-center text-slate-500">
                Are you sure you want to cancel appointment {appointment.reference_number}? Your token will be released.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Cancellation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Recovered, personal emergency"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
