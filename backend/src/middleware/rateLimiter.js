import rateLimit from 'express-rate-limit';

// Global API rate limiter (protects against general DDoS / flooding)
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '5000' : '500'), 10),
  skip: (req) => process.env.NODE_ENV === 'development' && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

// Stricter rate limiter for sensitive authentication endpoints (prevents brute-force credential stuffing)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'development' ? '500' : '15'), 10),
  skip: (req) => process.env.NODE_ENV === 'development' && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many login attempts from this IP. Please wait 15 minutes before trying again.',
  },
});

// Dedicated rate limiter for public doctor medicine inquiry submissions
export const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.INQUIRY_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'development' ? '100' : '20'), 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many doctor inquiry requests from this IP. Please wait 15 minutes before submitting again.',
  },
});
