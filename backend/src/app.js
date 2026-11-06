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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static uploads for prescriptions and doctor photos safely
const uploadsDir = fs.existsSync(path.resolve(__dirname, '../uploads'))
  ? path.resolve(__dirname, '../uploads')
  : path.resolve('uploads');
app.use('/uploads', express.static(uploadsDir));

// Security HTTP headers with cross-origin resource policy support for authenticated prescription streams
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
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
