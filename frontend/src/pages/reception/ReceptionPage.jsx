import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  Clock,
  Printer,
  CheckCircle,
  AlertCircle,
  Building2,
  Stethoscope,
  Sparkles,
  RefreshCw,
  Activity,
  Tv,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { appointmentApi, doctorApi } from '../../api';

export function ReceptionPage() {
  const [doctors, setDoctors] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Walk-in Registration Form
  const [walkInForm, setWalkInForm] = useState({
    doctorId: '',
    patientName: '',
    patientPhone: '',
    age: '',
    gender: 'male',
    priorityLevel: 'normal',
    reasonForVisit: '',
  });
  const [registering, setRegistering] = useState(false);
  const [generatedSlip, setGeneratedSlip] = useState(null);

  // Arriving Patient Check-in Search
  const [checkInSearch, setCheckInSearch] = useState('');
  const [checkInResults, setCheckInResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState('');

  // Load doctors on mount
  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await doctorApi.fetchDoctors({ status: 'active' });
        if (res && res.data) {
          setDoctors(res.data);
          if (res.data.length > 0) {
            setWalkInForm((prev) => ({ ...prev, doctorId: res.data[0].id }));
          }
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
      } finally {
        setLoadingDocs(false);
      }
    }
    loadDoctors();
  }, []);

  // Quick Walk-in Registration
  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (!walkInForm.doctorId || !walkInForm.patientName.trim() || !walkInForm.patientPhone.trim()) {
      alert('Please fill in doctor, patient name, and phone number.');
      return;
    }

    setRegistering(true);
    try {
      const res = await appointmentApi.registerWalkInToken({
        doctorId: walkInForm.doctorId,
        patientName: walkInForm.patientName.trim(),
        patientPhone: walkInForm.patientPhone.trim(),
        age: walkInForm.age ? parseInt(walkInForm.age, 10) : undefined,
        gender: walkInForm.gender,
        priorityLevel: walkInForm.priorityLevel,
        reasonForVisit: walkInForm.reasonForVisit.trim() || undefined,
      });

      if (res && res.data) {
        setGeneratedSlip(res.data);
        // Reset patient inputs, keep doctor selected
        setWalkInForm((prev) => ({
          ...prev,
          patientName: '',
          patientPhone: '',
          age: '',
          gender: 'male',
          priorityLevel: 'normal',
          reasonForVisit: '',
        }));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Walk-in registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  // Search Arriving Patients
  const handleSearchCheckIn = async (e) => {
    e?.preventDefault();
    if (!checkInSearch.trim()) return;

    setSearching(true);
    setCheckInMsg('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await appointmentApi.fetchAppointments({
        search: checkInSearch.trim(),
        date: today,
        limit: 10,
      });
      if (res && res.data) {
        setCheckInResults(res.data);
        if (res.data.length === 0) {
          setCheckInMsg('No today appointments found matching your search.');
        }
      }
    } catch (err) {
      console.error('Check-in search failed:', err);
      setCheckInMsg('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // Perform Check-in
  const handleCheckInPatient = async (aptId) => {
    try {
      await appointmentApi.updateAppointmentStatus(aptId, 'checked_in', 'Checked in at reception desk');
      setCheckInResults((prev) =>
        prev.map((a) => (a.id === aptId ? { ...a, status: 'checked_in' } : a))
      );
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to check in patient.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reception & Patient Check-In Desk"
        subtitle="Fast walk-in token issuance, arriving patient check-in, and clinic queue dispatch."
        breadcrumbs={[{ label: 'Reception Desk' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/appointments/queue"
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Activity className="w-4 h-4" />
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Quick Walk-in Token Registration Form */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <Plus className="w-5 h-5 text-teal-600" />
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Issue Walk-in Queue Token
                </h3>
                <p className="text-xs text-slate-500">
                  Instantly register a walk-in patient and issue their daily consultation token slip.
                </p>
              </div>
            </div>

            <form onSubmit={handleWalkInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Consulting Doctor *
                </label>
                <select
                  required
                  value={walkInForm.doctorId}
                  onChange={(e) => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-teal-500"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} — {d.specialization} ({d.roomNumber || 'Room 1'}, Fee: PKR {d.consultationFee || 1500})
                    </option>
                  ))}
                </select>
              </div>

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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="emergency">Emergency / Acute Triage</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Symptoms / Chief Complaint
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cough, stomach ache, routine blood pressure check"
                    value={walkInForm.reasonForVisit}
                    onChange={(e) => setWalkInForm({ ...walkInForm, reasonForVisit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {registering ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Token Slip...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    Issue & Print Walk-in Token
                  </>
                )}
              </button>
            </form>
          </Card>
        </div>

        {/* RIGHT: Fast Arriving Patient Check-in */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <UserCheck className="w-5 h-5 text-sky-600" />
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Fast Check-In for Arriving Patients
                </h3>
                <p className="text-xs text-slate-500">
                  Search by phone or reference number to check in booked patients arriving today.
                </p>
              </div>
            </div>

            <form onSubmit={handleSearchCheckIn} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter phone or reference (e.g. 0300 or APT-...)"
                  value={checkInSearch}
                  onChange={(e) => setCheckInSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                Search
              </button>
            </form>

            {checkInMsg && <p className="text-xs text-slate-400 mb-3">{checkInMsg}</p>}

            {/* Results List */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto">
              {checkInResults.map((apt) => {
                const isCheckedIn = apt.status === 'checked_in';
                const isCompleted = apt.status === 'completed';
                return (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-800 dark:text-teal-300">
                          {apt.token_display || `T-${String(apt.token_number).padStart(3, '0')}`}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {apt.patient_name}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Doctor: {apt.doctor_name} • Slot: {apt.appointment_time}
                      </p>
                    </div>

                    <div>
                      {apt.status === 'scheduled' ? (
                        <button
                          onClick={() => handleCheckInPatient(apt.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Check In
                        </button>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCheckedIn
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                              : isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {apt.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Slip Modal after Walk-in Generation */}
      {generatedSlip && (
        <Modal
          isOpen={!!generatedSlip}
          onClose={() => setGeneratedSlip(null)}
          title="Walk-In Token Slip Generated"
        >
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-teal-600 text-white text-center shadow-lg">
              <span className="text-[10px] uppercase font-bold tracking-widest text-teal-100">
                DAILY CONSULTATION TOKEN
              </span>
              <div className="text-4xl font-black my-1">
                {generatedSlip.token?.token_display}
              </div>
              <p className="text-xs text-teal-100">
                Room: {generatedSlip.appointment?.room_number || 'Room 1'} • {generatedSlip.doctor?.full_name}
              </p>
            </div>

            <div className="text-xs space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <p>
                <strong>Patient:</strong> {generatedSlip.appointment?.patient_name} (
                {generatedSlip.appointment?.patient_phone})
              </p>
              <p>
                <strong>Reference:</strong> {generatedSlip.appointment?.reference_number}
              </p>
              <p>
                <strong>Consultation Fee:</strong> PKR {generatedSlip.appointment?.consultation_fee || 1500}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Token
              </button>
              <button
                type="button"
                onClick={() => setGeneratedSlip(null)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
