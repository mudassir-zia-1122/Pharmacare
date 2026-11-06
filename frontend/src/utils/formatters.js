// ─── Currency & formatting helpers ───────────────────────────────────────────

/**
 * Format a number as currency.
 * Currency symbol and locale come from settings (configurable in Phase 3+).
 * Default: PKR, Pakistani locale.
 */
export function formatCurrency(amount, currencyCode = 'PKR', locale = 'ur-PK') {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a date string to a readable format */
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—';
  const defaults = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat('en-PK', { ...defaults, ...options }).format(new Date(dateStr));
}

/** Format a datetime string */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr));
}

/** Calculate days until expiry */
export function daysUntilExpiry(expiryDateStr) {
  if (!expiryDateStr) return null;
  const today = new Date();
  const expiry = new Date(expiryDateStr);
  const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return diff;
}

/** Return expiry status label and colour class */
export function getExpiryStatus(expiryDateStr) {
  const days = daysUntilExpiry(expiryDateStr);
  if (days === null) return { label: 'Unknown', cls: 'status-inactive' };
  if (days <= 0)  return { label: 'Expired',    cls: 'status-expired'  };
  if (days <= 30) return { label: `${days}d left`, cls: 'status-expired'  };
  if (days <= 90) return { label: `${days}d left`, cls: 'status-low-stock'};
  return { label: formatDate(expiryDateStr), cls: 'status-active' };
}

/** Truncate a string to n characters */
export function truncate(str, n = 30) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/** Convert a number to a compact string (e.g. 1284600 → 1.28M) */
export function compactNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}
