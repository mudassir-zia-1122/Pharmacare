import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  User,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Tv,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Stethoscope,
  Volume2,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { appointmentApi, doctorApi } from '../../api';

export function QueuePage() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [queueData, setQueueData] = useState({
    currentlyServing: null,
    waitingList: [],
    completedToday: [],
    totalWaiting: 0,
  });
  const [loading, setLoading] = useState(true);
  const [callingNext, setCallingNext] = useState(false);

  // Walk-in modal
  const [walkInModal, setWalkInModal] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    patientName: '',
    patientPhone: '',
    age: '',
    gender: 'male',
    reasonForVisit: '',
    priorityLevel: 'normal',
    notes: '',
  });
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);

  // Emergency priority modal
  const [emergencyModal, setEmergencyModal] = useState({ open: false, appointmentId: null, reason: '' });

  // Load doctors on mount
  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await doctorApi.fetchDoctors({ status: 'active' });
        if (res && res.data) {
          setDoctors(res.data);
          if (res.data.length > 0) {
            setSelectedDoctorId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
      }
    }
    loadDoctors();
  }, []);

  // Fetch queue data for selected doctor
  const loadQueue = useCallback(async () => {
    if (!selectedDoctorId) return;
    try {
      const res = await appointmentApi.fetchTodayQueue(selectedDoctorId);
      if (res && res.data) {
        if (Array.isArray(res.data)) {
          const list = res.data;
          const currentlyServing = list.find(a => a.status === 'in_consultation') || null;
          const waitingList = list.filter(a => a.status === 'waiting' || a.status === 'checked_in');
          const completedToday = list.filter(a => a.status === 'completed');
          setQueueData({
            currentlyServing,
            waitingList,
            completedToday,
            totalWaiting: waitingList.length,
          });
        } else {
          setQueueData({
            currentlyServing: res.data.currentlyServing || null,
            waitingList: Array.isArray(res.data.waitingList) ? res.data.waitingList : [],
            completedToday: Array.isArray(res.data.completedToday) ? res.data.completedToday : [],
            totalWaiting: res.data.totalWaiting ?? (Array.isArray(res.data.waitingList) ? res.data.waitingList.length : 0),
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch doctor queue:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    setLoading(true);
    loadQueue();
    const interval = setInterval(loadQueue, 5000); // 5-second live refresh
    return () => clearInterval(interval);
  }, [loadQueue]);

  // Handle Call Next Patient
  const handleCallNext = async () => {
    if (!selectedDoctorId) return;
    setCallingNext(true);
    try {
      const res = await appointmentApi.callNextPatient(selectedDoctorId);
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to call next patient.');
    } finally {
      setCallingNext(false);
    }
  };

  // Complete Current Consultation
  const handleCompleteCurrent = async (appointmentId) => {
    try {
      await appointmentApi.updateAppointmentStatus(appointmentId, 'completed', 'Consultation finished');
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to complete consultation.');
    }
  };

  // Mark No Show
  const handleMarkNoShow = async (appointmentId) => {
    if (!confirm('Mark this patient as No-Show and release consultation room?')) return;
    try {
      await appointmentApi.updateAppointmentStatus(appointmentId, 'no_show', 'Patient did not respond to call');
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to mark no-show.');
    }
  };

  // Submit Emergency Priority
  const handleAssignEmergency = async (e) => {
    e.preventDefault();
    if (!emergencyModal.reason.trim()) {
      alert('Please provide triage reason for emergency escalation.');
      return;
    }
    try {
      await appointmentApi.assignEmergencyPriority(
        emergencyModal.appointmentId,
        'emergency',
        emergencyModal.reason
      );
      setEmergencyModal({ open: false, appointmentId: null, reason: '' });
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to escalate priority.');
    }
  };

  // Submit Walk-in Token
  const handleSubmitWalkIn = async (e) => {
    e.preventDefault();
    if (!walkInForm.patientName.trim() || !walkInForm.patientPhone.trim()) {
      alert('Patient name and phone number are required.');
      return;
    }

    setSubmittingWalkIn(true);
    try {
      await appointmentApi.registerWalkInToken({
        doctorId: selectedDoctorId,
        patientName: walkInForm.patientName.trim(),
        patientPhone: walkInForm.patientPhone.trim(),
        age: walkInForm.age ? parseInt(walkInForm.age, 10) : undefined,
        gender: walkInForm.gender,
        reasonForVisit: walkInForm.reasonForVisit.trim() || undefined,
        priorityLevel: walkInForm.priorityLevel,
        notes: walkInForm.notes.trim() || undefined,
      });

      setWalkInModal(false);
      setWalkInForm({
        patientName: '',
        patientPhone: '',
        age: '',
        gender: 'male',
        reasonForVisit: '',
        priorityLevel: 'normal',
        notes: '',
      });
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Walk-in registration failed.');
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const activeDoctor = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Clinic Queue Desk"
        subtitle="Call waiting patients, oversee consultation room status, escalate emergency cases, and issue walk-in tokens."
        breadcrumbs={[{ label: 'Appointments', href: '/appointments' }, { label: 'Live Queue' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWalkInModal(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Quick Walk-in Token
            </button>
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

      {/* Doctor Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {doctors.map((doc) => {
          const isSelected = doc.id === selectedDoctorId;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDoctorId(doc.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                isSelected
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-400'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              {doc.fullName} ({doc.roomNumber || 'Room 1'})
            </button>
          );
        })}
      </div>

      {/* Main Queue Management Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Currently Serving & Action Desk */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Call Action Hero */}
          <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg text-center space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                {activeDoctor?.roomNumber || 'Consulting Room'}
              </span>
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                {activeDoctor?.specialization}
              </span>
            </div>

            {queueData.currentlyServing ? (
              <div className="space-y-4">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                  Currently In Consultation
                </span>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-600/5 border-2 border-emerald-500/30">
                  <div className="text-5xl font-black text-emerald-600 dark:text-emerald-400">
                    {queueData.currentlyServing.token_display}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                    {queueData.currentlyServing.patient_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phone: {queueData.currentlyServing.patient_phone} • Age: {queueData.currentlyServing.age || 'N/A'}
                  </p>
                  {queueData.currentlyServing.reason_for_visit && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 italic">
                      "{queueData.currentlyServing.reason_for_visit}"
                    </p>
                  )}
                </div>

                {/* Consultation Finished Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleCompleteCurrent(queueData.currentlyServing.id)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete Consultation
                  </button>
                  <button
                    onClick={() => handleMarkNoShow(queueData.currentlyServing.id)}
                    className="w-full py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Mark No-Show
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Consultation Room Available
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {queueData.totalWaiting} {queueData.totalWaiting === 1 ? 'patient is' : 'patients are'} waiting in queue.
                  </p>
                </div>
              </div>
            )}

            {/* CALL NEXT BUTTON */}
            <button
              onClick={handleCallNext}
              disabled={callingNext || queueData.totalWaiting === 0}
              className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {callingNext ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Calling Next Patient...
                </>
              ) : (
                <>
                  <Volume2 className="w-5 h-5 text-teal-200" />
                  Call Next Patient ({queueData.totalWaiting} Waiting)
                </>
              )}
            </button>
          </Card>
        </div>

        {/* Right Column: Waiting Queue & Today Completed */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-500" />
                  Waiting Queue ({(queueData.waitingList || []).length})
                </h3>
                <p className="text-xs text-slate-500">
                  Priority ordered: Emergency cases appear first, followed by sequential token order.
                </p>
              </div>
            </div>

            {(queueData.waitingList || []).length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  No patients waiting in queue
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  All checked-in patients have been served.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(queueData.waitingList || []).map((item, idx) => {
                  const isEmergency = item.priority_level === 'emergency';
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        isEmergency
                          ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-xs font-bold text-slate-400 text-center">
                          #{idx + 1}
                        </span>

                        <div className="font-mono font-black text-lg px-3 py-1 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:text-teal-300 shrink-0">
                          {item.token_display}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.patient_name}
                            </h4>
                            {isEmergency && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                                Emergency
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.patient_phone} • Slot: {item.appointment_time}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isEmergency && (
                          <button
                            onClick={() =>
                              setEmergencyModal({
                                open: true,
                                appointmentId: item.id,
                                reason: '',
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-xs font-semibold transition-colors flex items-center gap-1"
                            title="Escalate to Emergency Priority"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Escalate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Emergency Escalate Modal */}
      {emergencyModal.open && (
        <Modal
          isOpen={emergencyModal.open}
          onClose={() => setEmergencyModal({ open: false, appointmentId: null, reason: '' })}
          title="Escalate Waiting Patient to Emergency Priority"
        >
          <form onSubmit={handleAssignEmergency} className="space-y-4">
            <p className="text-xs text-slate-500">
              This patient will be prioritized to the front of the queue for the next consultation call.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Triage / Clinical Authorization Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Acute pain, hypertensive urgency, severe breathing difficulty"
                value={emergencyModal.reason}
                onChange={(e) => setEmergencyModal({ ...emergencyModal, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEmergencyModal({ open: false, appointmentId: null, reason: '' })}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Confirm Emergency Priority
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Walk-in Modal */}
      {walkInModal && (
        <Modal
          isOpen={walkInModal}
          onClose={() => setWalkInModal(false)}
          title={`Register Walk-in Token — ${activeDoctor?.fullName}`}
        >
          <form onSubmit={handleSubmitWalkIn} className="space-y-4">
            <p className="text-xs text-slate-500">
              Instantly allocate a sequential token for a patient arriving in person at the clinic.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Patient Name"
                  value={walkInForm.patientName}
                  onChange={(e) => setWalkInForm({ ...walkInForm, patientName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0300-1234567"
                  value={walkInForm.patientPhone}
                  onChange={(e) => setWalkInForm({ ...walkInForm, patientPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  placeholder="Age"
                  value={walkInForm.age}
                  onChange={(e) => setWalkInForm({ ...walkInForm, age: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Priority Level
                </label>
                <select
                  value={walkInForm.priorityLevel}
                  onChange={(e) => setWalkInForm({ ...walkInForm, priorityLevel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="emergency">Emergency / Acute Care</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Symptoms / Reason for Consultation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sudden severe headache, cut on hand"
                  value={walkInForm.reasonForVisit}
                  onChange={(e) => setWalkInForm({ ...walkInForm, reasonForVisit: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWalkInModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingWalkIn}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {submittingWalkIn ? 'Generating Token...' : 'Issue Walk-in Token'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
