export const logger = {
  info: (msg, meta = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? sanitize(meta) : '');
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? sanitize(meta) : '');
  },
  error: (msg, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? sanitize(meta) : '');
  },
};

function sanitize(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const cleaned = { ...obj };
  const sensitiveKeys = ['password', 'password_hash', 'token', 'authorization', 'secret'];
  for (const key of Object.keys(cleaned)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      cleaned[key] = '***REDACTED***';
    } else if (typeof cleaned[key] === 'object') {
      cleaned[key] = sanitize(cleaned[key]);
    }
  }
  return cleaned;
}

export default logger;
