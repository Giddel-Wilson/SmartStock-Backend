import { Pool } from 'pg'

// Database connection
let pool: Pool | null = null

export function getDatabase() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  }
  return pool
}

// Helper function to execute queries
export async function query(text: string, params: any[] = []) {
  const db = getDatabase()
  try {
    const result = await db.query(text, params)
    return result
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}