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

  // Auth
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Access token required' })
  const token = auth.split(' ')[1]
  try { jwt.verify(token, process.env.JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'Invalid token' }) }

  if (req.method === 'GET') {
    try {
      const result = await db.query(`
        SELECT p.id, p.name, p.sku, p.quantity_in_stock AS quantity, p.price AS unit_price, p.is_active, p.department_id, p.category_id,
               c.name as category_name, d.name as department_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN departments d ON p.department_id = d.id
        ORDER BY p.name
      `)
      return res.json({ products: result.rows })
    } catch (err) {
      console.error('products API error:', err)
      return res.status(500).json({ error: 'Failed to fetch products' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
