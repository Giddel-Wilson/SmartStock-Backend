import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Check authentication
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' })
  }

  try {
    const jwt = require('jsonwebtoken')
    const { Pool } = require('pg')

    // Verify token with better error handling
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('JWT verification successful for user:', decoded.user?.email)
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
    
    const user = decoded.user

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    if (req.method === 'GET') {
      const { limit = '50', offset = '0', search = '', category = '', department = '', status = 'all' } = req.query
      
      let whereConditions = []
      const queryParams = []
      let paramCount = 0

      if (search) {
        paramCount++
        whereConditions.push(`(p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`)
        queryParams.push(`%${search}%`)
      }

      if (category) {
        paramCount++
        whereConditions.push(`p.category_id = $${paramCount}`)
        queryParams.push(category)
      }

      if (department) {
        paramCount++
        whereConditions.push(`p.department_id = $${paramCount}`)
        queryParams.push(department)
      }

      if (status !== 'all') {
        paramCount++
        whereConditions.push(`p.is_active = $${paramCount}`)
        queryParams.push(status === 'active')
      }

      // Build WHERE clause
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
      
      // Add LIMIT and OFFSET parameters
      const limitParam = paramCount + 1
      const offsetParam = paramCount + 2
      queryParams.push(parseInt(limit as string))
      queryParams.push(parseInt(offset as string))

      const result = await pool.query(`
        SELECT 
          p.*,
          c.name as category_name,
          d.name as department_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN departments d ON p.department_id = d.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, queryParams)

      const countResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM products p
        ${whereClause}
      `, queryParams.slice(0, paramCount))

      await pool.end()

      return res.status(200).json({
        success: true,
        data: {
          products: result.rows,
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      })
    }

    await pool.end()
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('Products API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}