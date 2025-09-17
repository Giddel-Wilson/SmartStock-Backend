const db = require('../../config/database')
const jwt = require('jsonwebtoken')

const ALLOWED_ORIGINS = [
  'https://smart-stock-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
]

function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Simple authentication: expect Bearer token
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Access token required' })
  const token = auth.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // Could validate user active status, but skip for speed
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  if (req.method === 'GET') {
    try {
      const result = await db.query(`SELECT id, name, email, role, phone, department_id, is_active, last_login, created_at FROM users ORDER BY name`)
      return res.json({ users: result.rows })
    } catch (err) {
      console.error('users API error:', err)
      return res.status(500).json({ error: 'Failed to fetch users' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
