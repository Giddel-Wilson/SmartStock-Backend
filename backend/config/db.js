const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Get configuration from environment variables
const {
  DB_MAX_CONNECTIONS,
  DB_IDLE_TIMEOUT,
  DB_CONNECTION_TIMEOUT,
  NODE_ENV
} = process.env;

// Create a more robust connection pool with configurable settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(DB_MAX_CONNECTIONS) || 10, 
  idleTimeoutMillis: parseInt(DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(DB_CONNECTION_TIMEOUT) || 5000,
  statement_timeout: 30000, // 30 seconds timeout for queries
  query_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Connection event handlers
pool.on('connect', (client) => {
  console.log('New database connection established');
});

pool.on('error', (err, client) => {
  console.error('Unexpected database pool error:', err.message);
  // Don't crash the server on connection errors
});

pool.on('remove', (client) => {
  console.log('Database connection removed from pool');
});

// Function to healthcheck the database and reconnect if needed
const healthCheck = async () => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT 1 as health_check');
    return result.rows[0].health_check === 1;
  } catch (err) {
    console.error('Database health check failed:', err.message);
    return false;
  } finally {
    if (client) client.release();
  }
};

// Run a query with automatic reconnection
const query = async (text, params, retries = 3, delay = 1000) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result;
  } catch (err) {
    console.error(`Database query error (${retries} retries left):`, err.message);
    
    if (retries > 0 && !isTransientError(err)) {
      console.log(`Retrying query in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return query(text, params, retries - 1, delay * 2); // Exponential backoff
    } else {
      throw err;
    }
  } finally {
    if (client) client.release();
  }
};

// Helper to identify transient errors that are worth retrying
function isTransientError(err) {
  // These error codes indicate non-transient errors like constraint violations
  const nonTransientCodes = ['23505', '23503', '23502', '42P01', '42703'];
  return !nonTransientCodes.includes(err.code);
}

// Export the query function and connection pool
module.exports = {
  query,
  pool,
  healthCheck
};