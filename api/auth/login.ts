import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { Pool } = require('pg')
    const bcrypt = require('bcryptjs')
    const jwt = require('jsonwebtoken')

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user by email
    const userResult = await pool.query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const user = userResult.rows[0]

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Generate tokens
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        departmentId: user.department_id,
        departmentName: user.department_name,
      }
    }

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    })

    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    })

    // Log user activity
    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $4)',
        [user.id, 'login', 'user', user.id]
      )
    } catch (activityError) {
      console.error('Activity logging error:', activityError)
    }

    await pool.end()

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.department_id,
          departmentName: user.department_name,
          isActive: user.is_active
        },
        accessToken,
        refreshToken
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Login failed' })
  }
}