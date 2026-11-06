import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Builds the TLS/SSL configuration object in an environment-driven manner.
 * Strictly maintains rejectUnauthorized: true for certificate validation.
 */
function buildSslConfig() {
  const isSslRequested = process.env.DB_SSL === 'true';
  const caPath = process.env.DB_CA_PATH;

  // If neither SSL nor CA path is requested, connect via standard unencrypted connection (local MySQL)
  if (!isSslRequested && !caPath) {
    return {};
  }

  const sslOptions = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true, // Strictly enforce TLS certificate verification
  };

  if (caPath) {
    const resolvedPath = path.isAbsolute(caPath)
      ? caPath
      : path.resolve(process.cwd(), caPath);

    if (fs.existsSync(resolvedPath)) {
      sslOptions.ca = fs.readFileSync(resolvedPath);
    } else {
      console.warn(`[DATABASE WARNING] Configured DB_CA_PATH file not found at: ${resolvedPath}. Falling back to default trust store.`);
    }
  }

  return { ssl: sslOptions };
}

// Create connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pharmacare_db',
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS !== 'false',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0', 10),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true, // Preserve ISO date strings directly from SQL
  ...buildSslConfig(),
};

// Singleton pool instance
let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(poolConfig);
  }
  return pool;
}

/**
 * Resets the connection pool instance (useful during testing or configuration reload).
 */
export async function resetPool() {
  if (pool) {
    try {
      await pool.end();
    } catch (_) {}
    pool = null;
  }
}

/**
 * Health check: tests connectivity to the database server.
 * Returns { ok: true } if reachable, or { ok: false, error: message } if MySQL/TiDB is stopped.
 */
export async function checkDbHealth() {
  try {
    const currentPool = getPool();
    const [rows] = await currentPool.query('SELECT 1 AS alive');
    return {
      ok: true,
      database: poolConfig.database,
      host: poolConfig.host,
      port: poolConfig.port,
      ssl: Boolean(poolConfig.ssl),
      connected: true,
    };
  } catch (error) {
    return {
      ok: false,
      database: poolConfig.database,
      host: poolConfig.host,
      port: poolConfig.port,
      ssl: Boolean(poolConfig.ssl),
      connected: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Safe, parameterized query helper.
 * Uses currentPool.query() which supports all MySQL/TiDB constructs including LIMIT/OFFSET placeholders.
 * @param {string} sql - Parameterized SQL query
 * @param {Array} params - Array of parameters
 * @returns {Promise<Array>} - Query result rows
 */
export async function query(sql, params = []) {
  const currentPool = getPool();
  const [rows] = await currentPool.query(sql, params);
  return rows;
}

/**
 * Executes a callback inside a managed database transaction.
 * Automatically handles COMMIT on success and ROLLBACK on error.
 * @param {Function} callback - async (connection) => { ... }
 * @returns {Promise<any>}
 */
export async function withTransaction(callback) {
  const currentPool = getPool();
  const connection = await currentPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default {
  getPool,
  resetPool,
  checkDbHealth,
  query,
  withTransaction,
};
