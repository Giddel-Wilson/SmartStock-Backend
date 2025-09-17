const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
})

pool.on('connect', () => {
  console.log('🔗 api/config: Connected to Neon PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client (api/config):', err)
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}
