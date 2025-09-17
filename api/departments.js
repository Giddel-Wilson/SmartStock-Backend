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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Access token required' })
  try { jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'Invalid token' }) }

  if (req.method === 'GET') {
    try {
      const result = await db.query('SELECT id, name, description, created_at, updated_at FROM departments ORDER BY name')
      return res.json({ departments: result.rows })
    } catch (err) {
      console.error('departments API error:', err)
      return res.status(500).json({ error: 'Failed to fetch departments' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
