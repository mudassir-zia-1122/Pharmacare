import { useState } from 'react';
import {
  Building2,
  DollarSign,
  Receipt,
  Bell,
  Shield,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Lock
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import clsx from 'clsx';

const TABS = [
  { id: 'pharmacy', label: 'Pharmacy Info', icon: Building2 },
  { id: 'currency', label: 'Currency & Tax', icon: DollarSign },
  { id: 'receipt', label: 'Receipt', icon: Receipt },
  { id: 'alerts', label: 'Stock Alerts', icon: Bell },
  { id: 'password', label: 'Change Password', icon: KeyRound },
  { id: 'security', label: 'Security & Audit', icon: Shield },
];

const CURRENCIES = [
  { code: 'PKR', label: 'PKR — Pakistani Rupee (₨)', symbol: '₨', locale: 'ur-PK' },
  { code: 'USD', label: 'USD — US Dollar ($)', symbol: '$', locale: 'en-US' },
  { code: 'EUR', label: 'EUR — Euro (€)', symbol: '€', locale: 'en-DE' },
  { code: 'GBP', label: 'GBP — Pound Sterling (£)', symbol: '£', locale: 'en-GB' },
];

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pharmacy');
  const [saved, setSaved] = useState(false);

  // Change Password state
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCurrencyChange = (code) => {
    const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
    updateSettings({
      currencyCode: cur.code,
      currencySymbol: cur.symbol,
      currencyLocale: cur.locale,
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus(null);

    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword) {
      setPasswordStatus({ type: 'error', message: 'Current password is required.' });
      return;
    }

    if (newPassword.length < 10) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 10 characters long.' });
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setPasswordStatus({ type: 'error', message: 'New password must contain at least one uppercase letter (A-Z).' });
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setPasswordStatus({ type: 'error', message: 'New password must contain at least one lowercase letter (a-z).' });
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setPasswordStatus({ type: 'error', message: 'New password must contain at least one numeric digit (0-9).' });
      return;
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      setPasswordStatus({
        type: 'error',
        message: 'New password must contain at least one special character (!@#$%^&*...).',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Confirmation password does not match new password.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await authApi.changePassword(oldPassword, newPassword);
      setPasswordStatus({
        type: 'success',
        message: res.message || 'Password updated successfully! Please use your new password for your next login.',
      });
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.message ||
        'Failed to change password.';
      setPasswordStatus({ type: 'error', message: errMsg });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Settings"
        subtitle="Manage pharmacy configuration, operating currency, tax rules, alert thresholds and security credentials"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      {saved && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} /> Configuration successfully updated and saved to MySQL database.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Tab nav */}
        <nav className="lg:w-56 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPasswordStatus(null);
              }}
              className={clsx(
                'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors duration-150',
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )}
            >
              <tab.icon size={16} className="shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* ─── Pharmacy Info ─── */}
          {activeTab === 'pharmacy' && (
            <Card>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                Pharmacy Information
              </h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Pharmacy Name"
                  id="pharmaName"
                  value={settings.pharmacyName}
                  onChange={(e) => updateSettings({ pharmacyName: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  id="pharmaPhone"
                  value={settings.pharmacyPhone}
                  onChange={(e) => updateSettings({ pharmacyPhone: e.target.value })}
                />
                <Textarea
                  label="Address"
                  id="pharmaAddr"
                  value={settings.pharmacyAddress}
                  onChange={(e) => updateSettings({ pharmacyAddress: e.target.value })}
                  rows={2}
                />
                <Input
                  label="Email Address"
                  id="pharmaEmail"
                  value={settings.pharmacyEmail}
                  onChange={(e) => updateSettings({ pharmacyEmail: e.target.value })}
                />
                <Button className="self-start mt-2" leftIcon={<Save size={15} />} onClick={save}>
                  Save Information
                </Button>
              </div>
            </Card>
          )}

          {/* ─── Currency & Tax ─── */}
          {activeTab === 'currency' && (
            <Card>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                Operating Currency & Taxes
              </h2>
              <div className="flex flex-col gap-4">
                <Select
                  label="Active Currency"
                  id="currencySelect"
                  value={settings.currencyCode}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Default GST / Sales Tax Rate (%)"
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.taxRate}
                  onChange={(e) => updateSettings({ taxRate: Number(e.target.value) })}
                  hint="Standard tax applied to items without specific tax exemptions."
                />
                <Button className="self-start mt-2" leftIcon={<Save size={15} />} onClick={save}>
                  Save Currency & Tax
                </Button>
              </div>
            </Card>
          )}

          {/* ─── Receipt Settings ─── */}
          {activeTab === 'receipt' && (
            <Card>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                POS Receipt Header & Footer
              </h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Receipt Header Subtitle"
                  id="receiptHeader"
                  value={settings.receiptHeader}
                  onChange={(e) => updateSettings({ receiptHeader: e.target.value })}
                  hint="Printed directly under pharmacy name on customer thermal receipts."
                />
                <Textarea
                  label="Receipt Footer Notice"
                  id="receiptFooter"
                  value={settings.receiptFooter}
                  onChange={(e) => updateSettings({ receiptFooter: e.target.value })}
                  rows={3}
                  hint="Return policy, license number or instructions printed at the bottom of the receipt."
                />
                <Button className="self-start mt-2" leftIcon={<Save size={15} />} onClick={save}>
                  Save Receipt Settings
                </Button>
              </div>
            </Card>
          )}

          {/* ─── Stock Alerts ─── */}
          {activeTab === 'alerts' && (
            <Card>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                Stock Alert Thresholds
              </h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Near-Expiry Warning Threshold (days)"
                  id="nearExpiry"
                  type="number"
                  min="1"
                  value={settings.nearExpiryDays}
                  onChange={(e) => updateSettings({ nearExpiryDays: Number(e.target.value) })}
                  hint="Flag batches expiring within this many days on the dashboard and inventory views."
                />
                <Input
                  label="Default Low-Stock Level (units)"
                  id="lowStock"
                  type="number"
                  min="0"
                  value={settings.lowStockDefault}
                  onChange={(e) => updateSettings({ lowStockDefault: Number(e.target.value) })}
                  hint="Default reorder alert level for medicines that lack custom thresholds."
                />
                <Button className="self-start mt-2" leftIcon={<Save size={15} />} onClick={save}>
                  Save Alert Settings
                </Button>
              </div>
            </Card>
          )}

          {/* ─── Change Password ─── */}
          {activeTab === 'password' && (
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Lock size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Change Admin Password
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Update your administrator credentials safely. The current password is verified before applying the new bcrypt hash.
              </p>

              {passwordStatus && (
                <div
                  className={clsx(
                    'mb-5 p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5',
                    passwordStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  )}
                >
                  {passwordStatus.type === 'success' ? (
                    <CheckCircle2 size={16} className="shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0" />
                  )}
                  <span>{passwordStatus.message}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, oldPassword: e.target.value }))}
                      placeholder="Enter existing password"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pr-10 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                      placeholder="At least 10 chars with A-Z, a-z, 0-9, symbol"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pr-10 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Re-type new password"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Security Policy:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Minimum 10 characters long</li>
                    <li>At least one uppercase letter (A-Z) and lowercase letter (a-z)</li>
                    <li>At least one numeric digit (0-9) and special symbol (!@#$%...)</li>
                    <li>Encrypted with bcrypt (cost 12) with full audit trail</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full sm:w-auto"
                  leftIcon={<KeyRound size={15} />}
                >
                  {isChangingPassword ? 'Updating Password…' : 'Update Password'}
                </Button>
              </form>
            </Card>
          )}

          {/* ─── Security & Audit ─── */}
          {activeTab === 'security' && (
            <Card>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
                Security & Audit Enforcement
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Active server-side security policies protecting the remote TiDB database.
              </p>
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Password & Storage Standards
                  </h3>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Minimum 10 characters with strict complexity
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Hashed with bcrypt (cost factor 12)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Passwords are never logged or stored in plaintext
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Session & Transport Security
                  </h3>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Short-lived JWT bearer authentication
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Rate-limiting enforced on authentication endpoints
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Strict TLS 1.2+ certificate encryption on TiDB Cloud
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Comprehensive Audit Logging
                  </h3>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Credential changes logged to audit_logs
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Prescription dispensing and stock adjustments tracked
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
