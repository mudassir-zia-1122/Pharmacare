import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  Building2,
  Stethoscope,
  Award,
  DollarSign,
  Printer,
  ChevronRight,
  ChevronLeft,
  Search,
  Sparkles,
  AlertCircle,
  RefreshCw,
  HeartPulse,
} from 'lucide-react';
import { doctorApi, appointmentApi } from '../../api';

export function BookAppointmentPage() {
  // Step indicator: 1 = Department, 2 = Doctor, 3 = Date & Slot, 4 = Patient Details, 5 = Confirmation Slip
  const [currentStep, setCurrentStep] = useState(1);

  // Data lists
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotMetadata, setSlotMetadata] = useState(null);

  // Selections
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    // Default to today or tomorrow in YYYY-MM-DD
    return today.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Form State
  const [patientData, setPatientData] = useState({
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    age: '',
    gender: 'male',
    bloodGroup: '',
    reasonForVisit: '',
    notes: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Load Departments and Doctors on Mount
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const [deptRes, docRes] = await Promise.all([
          doctorApi.fetchDepartments(),
          doctorApi.fetchDoctors({ status: 'active' }),
        ]);

        if (deptRes && deptRes.data) {
          setDepartments(deptRes.data);
        }
        if (docRes && docRes.data) {
          setDoctors(docRes.data);
        }
      } catch (err) {
        console.error('Failed to load initial booking data:', err);
        setErrorMsg('Failed to load clinic departments and doctors. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Fetch slots whenever doctor and date change
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchSlots(selectedDoctor.id, selectedDate);
    }
  }, [selectedDoctor, selectedDate]);

  const fetchSlots = async (docId, dateStr) => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await appointmentApi.fetchAvailableSlots(docId, dateStr);
      if (res && res.data) {
        setAvailableSlots(res.data.slots || []);
        setSlotMetadata({
          isAvailable: res.data.isAvailable,
          message: res.data.message,
          totalSlots: res.data.totalSlots,
          availableSlotsCount: res.data.availableSlotsCount,
          bookedSlotsCount: res.data.bookedSlotsCount,
          workingHours: res.data.workingHours,
        });
      }
    } catch (err) {
      console.error('Error fetching available slots:', err);
      setAvailableSlots([]);
      setSlotMetadata({
        isAvailable: false,
        message: err.response?.data?.message || 'Doctor is not available on this date.',
      });
    } finally {
      setSlotsLoading(false);
    }
  };

  // Filtered doctors based on department
  const filteredDoctors = selectedDept
    ? doctors.filter((d) => d.departmentId === selectedDept.id || d.departmentName === selectedDept.name)
    : doctors;

  // Handle department selection
  const handleSelectDepartment = (dept) => {
    setSelectedDept(dept);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setCurrentStep(2);
  };

  // Handle doctor selection
  const handleSelectDoctor = (doc) => {
    setSelectedDoctor(doc);
    setSelectedSlot(null);
    setCurrentStep(3);
  };

  // Handle slot selection
  const handleSelectSlot = (slot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
  };

  // Submit booking
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!patientData.patientName.trim() || !patientData.patientPhone.trim()) {
      setErrorMsg('Patient full name and phone number are required.');
      return;
    }
    if (!selectedSlot) {
      setErrorMsg('Please select an appointment time slot.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const payload = {
        doctorId: selectedDoctor.id,
        appointmentDate: selectedDate,
        appointmentTime: selectedSlot.time,
        patientName: patientData.patientName.trim(),
        patientPhone: patientData.patientPhone.trim(),
        patientEmail: patientData.patientEmail.trim() || undefined,
        age: patientData.age ? parseInt(patientData.age, 10) : undefined,
        gender: patientData.gender,
        bloodGroup: patientData.bloodGroup || undefined,
        reasonForVisit: patientData.reasonForVisit.trim() || undefined,
        notes: patientData.notes.trim() || undefined,
        appointmentType: 'consultation',
      };

      const res = await appointmentApi.bookAppointment(payload);
      if (res && res.data) {
        setConfirmedBooking(res.data);
        setCurrentStep(5);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Booking failed. The slot may have just been booked.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const resetBooking = () => {
    setSelectedDept(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setConfirmedBooking(null);
    setErrorMsg('');
    setPatientData({
      patientName: '',
      patientPhone: '',
      patientEmail: '',
      age: '',
      gender: 'male',
      bloodGroup: '',
      reasonForVisit: '',
      notes: '',
    });
    setCurrentStep(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Header Banner */}
      <div className="max-w-5xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold mb-3">
          <Sparkles className="w-4 h-4 text-teal-500" />
          PharmaCare Digital Healthcare & Clinic
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Book Doctor Appointment & Live Token
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Choose a medical department, consult certified specialists, pick your preferred time slot, and get your sequential queue token instantly.
        </p>

        {/* Quick Links */}
        <div className="mt-4 flex items-center justify-center gap-4 text-sm font-medium">
          <Link
            to="/my-appointments"
            className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 underline underline-offset-4"
          >
            Already booked? Track or Reschedule Appointment &rarr;
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <Link
            to="/queue-display"
            target="_blank"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4"
          >
            Open Waiting Room Live TV Display &rarr;
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-3xl mx-auto relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
            {[
              { step: 1, title: 'Department' },
              { step: 2, title: 'Doctor' },
              { step: 3, title: 'Date & Slot' },
              { step: 4, title: 'Patient Info' },
              { step: 5, title: 'Token Slip' },
            ].map((s) => {
              const isPassed = currentStep > s.step;
              const isCurrent = currentStep === s.step;
              return (
                <div key={s.step} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                      isPassed
                        ? 'bg-teal-600 text-white'
                        : isCurrent
                        ? 'bg-teal-700 text-white ring-4 ring-teal-100 dark:ring-teal-900/50'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isPassed ? <CheckCircle className="w-5 h-5" /> : s.step}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium hidden sm:block ${
                      isCurrent
                        ? 'text-teal-600 dark:text-teal-400 font-bold'
                        : isPassed
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
            <div className="text-sm font-medium flex-1">{errorMsg}</div>
          </div>
        )}

        {/* STEP 1: Select Department */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Step 1: Select Medical Department</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Choose the specialized clinic or consult general medicine.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.length === 0 && !loading && (
                <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No departments found.</p>
                </div>
              )}

              {departments.map((dept) => {
                const docCount = doctors.filter(
                  (d) => d.departmentId === dept.id || d.departmentName === dept.name
                ).length;
                return (
                  <button
                    key={dept.id}
                    onClick={() => handleSelectDepartment(dept)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-md transition-all text-left flex items-start justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                        <HeartPulse className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {dept.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {dept.description || 'Specialized outpatient medical consultation'}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <User className="w-3.5 h-3.5" />
                        <span>{docCount} {docCount === 1 ? 'Doctor' : 'Doctors'} Available</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 group-hover:translate-x-1 transition-all shrink-0 mt-2" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Select Doctor */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline mb-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Departments
                </button>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Step 2: Choose Doctor in {selectedDept?.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Select a certified specialist for your consultation.
                </p>
              </div>
            </div>

            {filteredDoctors.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  No active doctors currently available in {selectedDept?.name}.
                </p>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-200"
                >
                  Choose Another Department
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDoctor(doc)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Photo or Initials */}
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                        {doc.photoUrl ? (
                          <img
                            src={doc.photoUrl}
                            alt={doc.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="font-bold text-lg text-teal-700 dark:text-teal-300">
                            {doc.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                            {doc.fullName}
                          </h3>
                        </div>
                        <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mt-0.5">
                          {doc.specialization}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          PMDC #{doc.pmdcNumber} {doc.qualifications ? `• ${doc.qualifications}` : ''}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            Room: {doc.roomNumber || 'Room 1'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Fee: PKR {doc.consultationFee || 1500}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-500" />
                        {doc.availability || 'Mon - Fri 09:00 - 14:00'}
                      </span>
                      <span className="font-semibold text-teal-600 dark:text-teal-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        Select Doctor &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Select Date & Available Time Slot */}
        {currentStep === 3 && selectedDoctor && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline mb-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Doctor Selection
                </button>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Step 3: Select Date & Consultation Slot
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Doctor: <strong className="text-teal-600 dark:text-teal-400">{selectedDoctor.fullName}</strong> ({selectedDoctor.specialization})
                </p>
              </div>
            </div>

            {/* Doctor Snapshot Header */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-bold text-teal-700 dark:text-teal-300">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{selectedDoctor.fullName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Room: {selectedDoctor.roomNumber || 'Consultation Room'} • Fee: PKR {selectedDoctor.consultationFee || 1500}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Appointment Date:
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Slots Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-500" />
                    Available Consultation Slots for {selectedDate}
                  </h4>
                  {slotMetadata && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {slotMetadata.message}
                      {slotMetadata.workingHours && ` • Hours: ${slotMetadata.workingHours}`}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fetchSlots(selectedDoctor.id, selectedDate)}
                  disabled={slotsLoading}
                  className="p-2 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Refresh slots"
                >
                  <RefreshCw className={`w-4 h-4 ${slotsLoading ? 'animate-spin text-teal-500' : ''}`} />
                </button>
              </div>

              {slotsLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-500" />
                  <p className="text-sm font-medium">Checking live schedule & slot availability...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium">No available consultation slots on this date.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Please pick another date (e.g. tomorrow or next weekday).
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                  {availableSlots.map((slot, idx) => {
                    const isSelected = selectedSlot?.time === slot.time;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => handleSelectSlot(slot)}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                          !slot.available
                            ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-300 dark:ring-teal-900 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-500 hover:bg-teal-50/30'
                        }`}
                      >
                        <span className="text-sm font-semibold">{slot.time}</span>
                        <span
                          className={`text-[10px] mt-0.5 ${
                            isSelected
                              ? 'text-teal-100'
                              : !slot.available
                              ? 'text-rose-500 font-medium'
                              : 'text-teal-600 dark:text-teal-400 font-medium'
                          }`}
                        >
                          {slot.available ? 'Available' : 'Booked'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Slot Legend */}
              <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 inline-block" />
                  Available Slot
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-teal-600 inline-block" />
                  Selected Slot
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-800 inline-block" />
                  Booked / Unavailable
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                Continue to Patient Info &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Patient Details Form */}
        {currentStep === 4 && (
          <form onSubmit={handleConfirmBooking} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline mb-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Slot Selection
                </button>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Step 4: Patient Information
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Enter patient details to register the appointment and generate your live queue token.
                </p>
              </div>
            </div>

            {/* Selected Booking Summary Card */}
            <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <span className="text-teal-700 dark:text-teal-300 font-semibold">Doctor:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200 font-bold">{selectedDoctor?.fullName}</span>
              </div>
              <div>
                <span className="text-teal-700 dark:text-teal-300 font-semibold">Date:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200 font-bold">{selectedDate}</span>
              </div>
              <div>
                <span className="text-teal-700 dark:text-teal-300 font-semibold">Slot:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200 font-bold">{selectedSlot?.time}</span>
              </div>
              <div>
                <span className="text-teal-700 dark:text-teal-300 font-semibold">Room:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200 font-bold">
                  {selectedDoctor?.roomNumber || 'Consultation Room'}
                </span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Patient Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Muhammad Ali"
                      value={patientData.patientName}
                      onChange={(e) =>
                        setPatientData({ ...patientData, patientName: e.target.value })
                      }
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
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
                      value={patientData.patientPhone}
                      onChange={(e) =>
                        setPatientData({ ...patientData, patientPhone: e.target.value })
                      }
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="e.g. patient@example.com"
                      value={patientData.patientEmail}
                      onChange={(e) =>
                        setPatientData({ ...patientData, patientEmail: e.target.value })
                      }
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Age
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="Age"
                      value={patientData.age}
                      onChange={(e) =>
                        setPatientData({ ...patientData, age: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Gender
                    </label>
                    <select
                      value={patientData.gender}
                      onChange={(e) =>
                        setPatientData({ ...patientData, gender: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Visit / Symptoms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Persistent fever, joint pain, routine health review"
                    value={patientData.reasonForVisit}
                    onChange={(e) =>
                      setPatientData({ ...patientData, reasonForVisit: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Special Medical Notes / Allergies (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Diabetic, allergic to penicillin, previous surgeries"
                    value={patientData.notes}
                    onChange={(e) =>
                      setPatientData({ ...patientData, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Token & Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Generate Live Token
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 5: Confirmation & Printable Token Slip */}
        {currentStep === 5 && confirmedBooking && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600 mx-auto mb-3 shadow-md">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                Appointment Confirmed & Token Generated!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-lg mx-auto">
                Your appointment has been registered in the clinic queue system. Please present your token slip or reference code upon arrival.
              </p>
            </div>

            {/* Printable Slip Container */}
            <div
              id="printable-slip"
              className="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-teal-500/40 shadow-2xl space-y-6 print:border-none print:shadow-none print:p-0"
            >
              {/* Slip Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">PHARMACARE CLINIC</h3>
                  <p className="text-xs text-slate-500">Outpatient Consultation & Queue Token</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-teal-600 dark:text-teal-400">
                    Booking Reference
                  </span>
                  <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    {confirmedBooking.appointment?.reference_number}
                  </p>
                </div>
              </div>

              {/* TOKEN NUMBER DISPLAY */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-center shadow-lg">
                <span className="text-xs uppercase font-extrabold tracking-widest text-teal-100">
                  YOUR DAILY QUEUE TOKEN
                </span>
                <div className="text-5xl sm:text-6xl font-black tracking-tight my-1">
                  {confirmedBooking.token?.token_display}
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-teal-100 font-medium">
                  <span>Room: {confirmedBooking.appointment?.room_number || 'Room 1'}</span>
                  <span>•</span>
                  <span>Priority: {confirmedBooking.token?.priority_level?.toUpperCase()}</span>
                </div>
              </div>

              {/* Consultation Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Doctor</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block mt-0.5">
                    {confirmedBooking.doctor?.full_name}
                  </span>
                  <span className="text-teal-600 dark:text-teal-400 font-medium">
                    {confirmedBooking.doctor?.specialization}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Date & Slot</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block mt-0.5">
                    {confirmedBooking.appointment?.appointment_date}
                  </span>
                  <span className="text-teal-600 dark:text-teal-400 font-medium">
                    {confirmedBooking.appointment?.appointment_time}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Patient Name</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block mt-0.5">
                    {confirmedBooking.appointment?.patient_name}
                  </span>
                  <span className="text-slate-500 font-medium">
                    {confirmedBooking.appointment?.patient_phone}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Consultation Fee</span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    PKR {confirmedBooking.appointment?.consultation_fee || 1500}
                  </span>
                  <span className="text-slate-500 font-medium">Payable at Reception Desk</span>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Important Patient Instructions:
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                  <li>Please arrive 15 minutes before your time slot ({confirmedBooking.appointment?.appointment_time}).</li>
                  <li>Check in at the reception desk to verify your token and room allocation.</li>
                  <li>Watch the waiting room screen or track token status live at /my-appointments.</li>
                </ul>
              </div>

              {/* Action Buttons (Hidden on Print) */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Print Appointment Slip
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Link
                    to="/my-appointments"
                    className="flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Track Status
                  </Link>
                  <button
                    type="button"
                    onClick={resetBooking}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-md transition-all"
                  >
                    Book Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
