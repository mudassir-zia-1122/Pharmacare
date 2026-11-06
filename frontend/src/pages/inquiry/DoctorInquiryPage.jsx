import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Pill, ShieldCheck,
  Building2, Mail, Phone, User, Clock, ArrowLeft, Copy, Check
} from 'lucide-react';
import { inquiryApi } from '../../api';

export function DoctorInquiryPage() {
  const [form, setForm] = useState({
    doctorName: '',
    clinicHospitalName: '',
    email: '',
    phone: '',
    manualNotes: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = (e) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setFileError('Only JPEG, PNG, WEBP, GIF images or PDF documents are permitted.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size exceeds 5MB limit. Please upload a smaller image.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.doctorName.trim() || !form.clinicHospitalName.trim() || !form.email.trim()) {
      setError('Please fill in doctor name, clinic/hospital name, and email.');
      return;
    }

    if (!selectedFile && !form.manualNotes.trim()) {
      setError('Please either upload a prescription photo or type the required medicine names in the notes field.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('doctorName', form.doctorName.trim());
      data.append('clinicHospitalName', form.clinicHospitalName.trim());
      data.append('email', form.email.trim());
      if (form.phone) data.append('phone', form.phone.trim());
      if (form.manualNotes) data.append('manualNotes', form.manualNotes.trim());
      if (selectedFile) data.append('prescription_image', selectedFile);

      const res = await inquiryApi.submitInquiry(data);
      const resultData = res?.data || res;
      setSubmittedResult(resultData);
    } catch (err) {
      setError(err.message || 'Failed to submit inquiry. Please try again or call our pharmacy helpline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyRefNo = () => {
    if (submittedResult?.referenceNo) {
      navigator.clipboard.writeText(submittedResult.referenceNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Navigation link back to staff login */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-green-600 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Pharmacy Staff Login
          </Link>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/50 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800">
            <ShieldCheck size={12} /> DRAP & FEFO Verified Clinical Service
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-8 text-white text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-3 shadow-inner">
              <Pill size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold">Check Medicine Availability</h1>
            <p className="text-green-100 text-xs mt-1 max-w-md mx-auto">
              Prescription photo & stock availability portal for registered doctors, clinics, and hospitals.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {/* SUCCESS STATE */}
            {submittedResult ? (
              <div className="text-center py-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 flex items-center justify-center mb-4">
                  <CheckCircle2 size={36} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Inquiry Submitted Successfully
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                  A confirmation email has been dispatched to <strong>{submittedResult.email}</strong>.
                </p>

                {/* Reference Number Box */}
                <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 w-full max-w-md">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Your Reference Number
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-mono font-bold text-green-700 dark:text-green-400">
                      {submittedResult.referenceNo}
                    </span>
                    <button
                      type="button"
                      onClick={copyRefNo}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      title="Copy Reference Number"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="mt-6 text-left p-4 rounded-xl bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-xs text-slate-700 dark:text-slate-300 w-full max-w-md space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Clock size={14} className="text-green-600 shrink-0 mt-0.5" />
                    <span>
                      Our clinical pharmacy staff is verifying active batch expiry dates and quantities (FEFO protocols).
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail size={14} className="text-green-600 shrink-0 mt-0.5" />
                    <span>
                      You will receive an official availability report by email with itemized stock statuses and pricing.
                    </span>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedResult(null);
                      setSelectedFile(null);
                      setFilePreview(null);
                      setForm({
                        doctorName: '',
                        clinicHospitalName: '',
                        email: '',
                        phone: '',
                        manualNotes: '',
                      });
                    }}
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                  >
                    Submit Another Inquiry
                  </button>
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Staff Login
                  </Link>
                </div>
              </div>
            ) : (
              /* FORM SUBMISSION STATE */
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Doctor Name & Clinic */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" /> Doctor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Ayesha Khan"
                      value={form.doctorName}
                      onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400" /> Clinic / Hospital Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Hospital, Lahore"
                      value={form.clinicHospitalName}
                      onChange={e => setForm(f => ({ ...f, clinicHospitalName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" /> Email for Stock Report <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. dr.khan@clinic.pk"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-400" /> Contact Number (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 0300-1234567"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                {/* Prescription Photo Upload */}
                <div className="flex flex-col gap-1 mt-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Upload size={13} className="text-slate-400" /> Upload Prescription / Medicine List Photo
                  </label>

                  {selectedFile ? (
                    <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {filePreview ? (
                          <img
                            src={filePreview}
                            alt="Prescription preview"
                            className="w-12 h-12 object-cover rounded-lg border border-slate-300 dark:border-slate-600 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                            <FileText size={20} className="text-slate-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-green-600 dark:hover:border-green-500 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                      <Upload size={24} className="text-slate-400 mb-1.5" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Click or tap to upload prescription picture
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        JPEG, PNG, WEBP, or PDF up to 5MB
                      </p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}

                  {fileError && <p className="text-xs text-red-500 mt-1">⚠ {fileError}</p>}
                </div>

                {/* Manual Notes / Medicine Names */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Manual Medicine Names / Instructions (Optional)</span>
                    <span className="text-[11px] text-slate-400">If picture is unclear</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. 1. Tab Augmentin 625mg (2 packs)&#10;2. Ventolin Inhaler (1 unit)&#10;3. Panadol 500mg"
                    value={form.manualNotes}
                    onChange={e => setForm(f => ({ ...f, manualNotes: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors resize-y"
                  />
                </div>

                {/* Clinical disclaimer */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong>Clinical Safety Note:</strong> All prescriptions are manually inspected by licensed clinical pharmacists. Medicines are matched against active non-expired batch inventory (FEFO standards). Unclear prescriptions require staff confirmation before dispensing.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-1 shadow-md shadow-green-600/20"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Verifying & Submitting Inquiry…</span>
                    </>
                  ) : (
                    <span>Submit Medicine Availability Check</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} PharmaCare Healthcare Systems • DRAP Compliance • Batch Expiry Controlled
        </p>
      </div>
    </div>
  );
}
