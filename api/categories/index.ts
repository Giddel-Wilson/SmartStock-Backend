import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { Pool } = require('pg')
    const jwt = require('jsonwebtoken')

    // Verify authentication
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('JWT verification successful for categories API')
    } catch (jwtError: any) {
      console.error('JWT verification failed:', jwtError.message)
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' })
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' })
      } else {
        return res.status(401).json({ error: 'Token verification failed' })
      }
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    if (req.method === 'GET') {
      // Get all categories
      const result = await pool.query(
        'SELECT * FROM categories ORDER BY name ASC'
      )

      await pool.end()

      return res.status(200).json({
        success: true,
        data: {
          categories: result.rows,
          count: result.rows.length
        }
      })
    }

    // For now, only support GET
    await pool.end()
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error: any) {
    console.error('Categories API error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch categories',
      message: error.message 
    })
  }
}