import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envFile of envCandidates) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    break;
  }
}

const app = express();

// Trust first reverse proxy hop (required on Render / Vercel / cloud load balancers for accurate req.ip & express-rate-limit)
app.set('trust proxy', 1);

// Block any direct unauthenticated access to private prescription files
app.use('/uploads/prescriptions', (req, res) => {
  return res.status(403).json({
    success: false,
    statusCode: 403,
    message: 'Direct public access to private prescription files is forbidden. Use authenticated API endpoints.',
  });
});

// Serve ONLY public doctor photographs statically (never serve private prescriptions publicly)
const doctorUploadsDir = fs.existsSync(path.resolve(__dirname, '../uploads/doctors'))
  ? path.resolve(__dirname, '../uploads/doctors')
  : path.resolve('uploads/doctors');
app.use('/uploads/doctors', express.static(doctorUploadsDir));

// Security HTTP headers with cross-origin resource policy support for authenticated prescription streams
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration (trimmed & normalized without trailing slashes)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, health checks, or Postman)
      if (!origin) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Global request rate limiting
app.use(globalLimiter);

// Request body parsers with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Mount versioned REST API
const apiPrefix = process.env.API_PREFIX || '/api/v1';
app.use(apiPrefix, apiRoutes);

// Root informational endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'PharmaCare Pharmacy Management API',
    version: '1.0.0',
    documentation: `${apiPrefix}/health`,
    status: 'online',
  });
});

// 404 Route Not Found handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
