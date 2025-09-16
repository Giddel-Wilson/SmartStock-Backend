import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { Pool } = require('pg')

    // Check environment variables (without exposing sensitive values)
    const envCheck = {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING', 
      REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ? 'SET' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV || 'undefined'
    }

    // Test database connection
    let dbStatus = 'UNKNOWN'
    let dbError = null
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      })
      
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
      await pool.end()
      dbStatus = 'CONNECTED'
    } catch (error: any) {
      dbStatus = 'ERROR'
      dbError = error.message
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: {
        status: dbStatus,
        error: dbError
      }
    })

  } catch (error: any) {
    console.error('Debug API error:', error)
    return res.status(500).json({ 
      error: 'Debug check failed',
      message: error.message 
    })
  }
}