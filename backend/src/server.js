import http from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { checkDbHealth } from './config/db.js';
import { logger } from './utils/logger.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '5000', 10);
const server = http.createServer(app);

server.listen(PORT, async () => {
  logger.info(`=======================================================`);
  logger.info(` PharmaCare API Server running on port ${PORT}`);
  logger.info(` Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(` Health Check: http://localhost:${PORT}/api/v1/health`);
  logger.info(`=======================================================`);

  // Initial database health check
  const dbHealth = await checkDbHealth();
  if (dbHealth.ok) {
    logger.info(`[DATABASE] Connected to MySQL (${dbHealth.database}) on ${dbHealth.host}:${dbHealth.port}`);
  } else {
    logger.warn(`[DATABASE] MySQL server is currently offline or unreachable: ${dbHealth.error}`);
    logger.warn(`[DATABASE] To start MySQL, open XAMPP Control Panel and click Start next to MySQL.`);
  }
});

// Graceful shutdown handling
const shutdown = () => {
  logger.info('Shutting down server gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
