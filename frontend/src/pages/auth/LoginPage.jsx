import { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Pill, Eye, EyeOff, AlertCircle, Database, Flame, Stethoscope, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { systemApi } from '../../api';

const isFirebaseTabEnabled = import.meta.env.VITE_ENABLE_FIREBASE_AUTH === 'true';

export function LoginPage() {
  const {
    login,
    loginWithFirebase,
    isAuthenticated,
    isFirebaseConfigured,
    isLoading: authLoading,
  } = useAuth();

  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('staff'); // 'staff' | 'firebase'
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [firebaseForm, setFirebaseForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [statusNotice, setStatusNotice] = useState({ type: 'loading', msg: 'Checking server connection...' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reactive navigation: whenever isAuthenticated becomes true, go to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check live system health on mount
  useEffect(() => {
    let isMounted = true;
    systemApi.checkSystemHealth().then((health) => {
      if (!isMounted) return;
      if (health.database?.connected) {
        setStatusNotice({ type: 'online', msg: 'Connected to live MySQL database' });
      } else if (health.status === 'degraded') {
        setStatusNotice({
          type: 'degraded',
          msg: 'API online, MySQL offline. Fallback demo mode available.',
        });
      } else {
        setStatusNotice({
          type: 'offline',
          msg: 'Backend server offline. Offline demo mode available.',
        });
      }
    }).catch(() => {
      if (isMounted) {
        setStatusNotice({
          type: 'offline',
          msg: 'Backend server offline. Offline demo mode available.',
        });
      }
    });
    return () => { isMounted = false; };
  }, []);

  // If already authenticated, redirect immediately
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // If auth session is still restoring from localStorage, show spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
          <p className="text-xs text-slate-500 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.identifier.trim() || !form.password.trim()) {
      setError('Please enter both username/email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(form.identifier.trim(), form.password);
      if (res && (res.success || res.mode)) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Staff login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFirebaseSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firebaseForm.email.trim() || !firebaseForm.password.trim()) {
      setError('Please enter both Firebase email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithFirebase(firebaseForm.email.trim(), firebaseForm.password);
      if (res && res.success) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Firebase login error:', err);
      setError(err.message || 'Firebase login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="bg-green-600 px-8 py-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-3">
              <Pill size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">PharmaCare</h1>
            <p className="text-green-100 text-xs mt-1">Pharmacy Management System</p>
          </div>

          {/* Mode Tabs (Firebase tab only displayed when explicitly enabled with server-side verification) */}
          {isFirebaseTabEnabled && isFirebaseConfigured && (
            <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => { setAuthMode('staff'); setError(''); }}
                className={`py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                  authMode === 'staff'
                    ? 'border-green-600 text-green-700 dark:text-green-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Database size={14} />
                Staff Account
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('firebase'); setError(''); }}
                className={`py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                  authMode === 'firebase'
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Flame size={14} />
                Firebase Auth
              </button>
            </div>
          )}

          {/* Form Container */}
          <div className="px-8 py-6">
            {/* System connectivity status pill */}
            <div className="flex flex-col gap-1.5 mb-4">
              {statusNotice && (
                <div
                  className={`p-2 rounded-lg text-xs flex items-center gap-2 border ${
                    statusNotice.type === 'online'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  <Database size={13} className="shrink-0" />
                  <span>{statusNotice.msg}</span>
                </div>
              )}

              {authMode === 'firebase' && isFirebaseConfigured && (
                <div className="p-2 rounded-lg text-xs flex items-center gap-2 border bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800">
                  <Flame size={13} className="shrink-0" />
                  <span>Firebase project: <strong>pharmacare-4ea64</strong></span>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: Staff / Database Login */}
            {authMode === 'staff' && (
              <form onSubmit={handleStaffSubmit} className="flex flex-col gap-3.5" noValidate>
                <div className="flex flex-col gap-1">
                  <label htmlFor="identifier" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Username or Email
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    value={form.identifier}
                    onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                    placeholder="Enter username or email"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Enter password"
                      className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors duration-150 flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    'Sign In with Staff Account'
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: Firebase Authentication Login */}
            {authMode === 'firebase' && (
              <form onSubmit={handleFirebaseSubmit} className="flex flex-col gap-3.5" noValidate>
                <div className="flex flex-col gap-1">
                  <label htmlFor="firebaseEmail" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Firebase Email Address
                  </label>
                  <input
                    id="firebaseEmail"
                    type="email"
                    autoComplete="email"
                    value={firebaseForm.email}
                    onChange={e => setFirebaseForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@pharmacare-4ea64.firebaseapp.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="firebasePassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Firebase Password
                  </label>
                  <div className="relative">
                    <input
                      id="firebasePassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={firebaseForm.password}
                      onChange={e => setFirebaseForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Enter Firebase password"
                      className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                  <p>
                    <strong>Note:</strong> Firebase authenticated accounts must have a matching staff email registered in the MySQL database to receive authorized permissions and roles.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold rounded-lg transition-colors duration-150 flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Authenticating with Firebase…
                    </>
                  ) : (
                    'Sign In with Firebase'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Doctor Availability Check Portal Link */}
        <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Stethoscope size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Doctor or Hospital Clinic?</p>
              <p className="text-[11px] text-slate-500">Check medicine availability & upload prescriptions</p>
            </div>
          </div>
          <Link
            to="/check-availability"
            className="text-xs font-semibold text-green-700 dark:text-green-400 hover:text-green-800 flex items-center gap-1.5 bg-green-50 dark:bg-green-950/40 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors"
          >
            Check Stock <ArrowRight size={13} />
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          &copy; {new Date().getFullYear()} PharmaCare v1.0 — Enterprise Architecture with Firebase & MySQL Auth
        </p>
      </div>
    </div>
  );
}
