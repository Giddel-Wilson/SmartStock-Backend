const path = require('path')
let db
try {
  db = require(path.join(__dirname, 'config', 'database'))
} catch (err) {
  // Fallback: create a temporary Pool using DATABASE_URL
  const { Pool } = require('pg')
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10
  })
  db = { query: (text, params) => pool.query(text, params), pool }
}
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const ALLOWED_ORIGINS = [
  'https://smart-stock-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
]

function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  // If credentials are used, do not set wildcard origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    // Fallback to wildcard for simple requests
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  // allow credentials when origin is specific
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
}

function sendSuccess(res, payload = {}, nestedData = null, status = 200) {
  // Normalize success response: top-level + nested data.data
  const top = Object.assign({}, payload)
  const nested = nestedData == null ? payload : nestedData
  const body = Object.assign({}, top, { data: { data: nested } })
  res.status(status).json(body)
}

function sendError(res, message = 'Server error', status = 500, details = null) {
  const body = { success: false, error: message }
  if (details) body.details = details
  res.status(status).json(body)
}

async function handleHealth(req, res) {
  return sendSuccess(res, { status: 'ok', message: 'SmartStock API (serverless) - health check', timestamp: new Date().toISOString() }, { status: 'ok' }, 200)
}

async function handleLogin(req, res) {
  // Be tolerant of different request shapes from various frontends
  let body = req.body || {}
  const contentType = (req.headers['content-type'] || req.headers['Content-Type'] || '').toLowerCase()
  // If body is a string, try JSON parse first
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch (e) { /* leave as string */ }
  }
  // If content-type is urlencoded (common when using qs.stringify), parse it
  if (typeof body === 'string' && contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const qs = require('querystring')
      body = qs.parse(body)
    } catch (e) {
      // ignore
    }
  }
  // If request is JSON but wrapped under req.body.data (some clients), we'll handle below
  console.warn('login request headers:', { 'content-type': contentType })
  // support: { email, password } or { data: { email, password } } or { payload: {...} }
  const email = body?.email || body?.data?.email || body?.payload?.email || body?.user?.email
  const password = body?.password || body?.data?.password || body?.payload?.password || body?.user?.password
  console.warn('login request payload preview:', (body && typeof body === 'object') ? Object.keys(body).slice(0,10) : typeof body)
  if (!email || !password) return sendError(res, 'Email and password required', 400)

  const result = await db.query(`
    SELECT u.*, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.email = $1
  `, [email])

  if (result.rows.length === 0) {
    // include safe hint for debugging (do not expose sensitive info)
    console.warn('login failed: user not found for email=', email)
    return sendError(res, 'Invalid credentials', 401)
  }

  const user = result.rows[0]
  if (!user.is_active) {
    console.warn('login failed: account deactivated for user=', user.id)
    return sendError(res, 'Account is deactivated', 401)
  }

  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) {
    console.warn('login failed: invalid password for user=', user.id)
    return sendError(res, 'Invalid credentials', 401)
  }

  const payload = { userId: user.id, email: user.email, role: user.role }
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' })
  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' })

  // Store refresh token hash (best-effort)
  try {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
    await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')`, [user.id, refreshTokenHash])
  } catch (err) {
    console.warn('Warning: failed to store refresh token hash', err && err.message)
  }

  return sendSuccess(res, {
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      phone: user.phone,
      last_login: user.last_login
    },
    accessToken,
    refreshToken
  }, { user: { id: user.id, name: user.name, email: user.email, role: user.role, department_id: user.department_id, department_name: user.department_name, phone: user.phone, last_login: user.last_login }, accessToken, refreshToken }, 200)
}

function verifyToken(req) {
  const auth = req.headers.authorization
  if (!auth) return null
  const token = auth.split(' ')[1]
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (err) {
    return null
  }
}

async function handleUsers(req, res) {
  // require auth
  const decoded = verifyToken(req)
  if (!decoded) return res.status(401).json({ error: 'Invalid token' })

  const result = await db.query('SELECT id, name, email, role, phone, department_id, is_active, last_login, created_at FROM users ORDER BY name')
  return sendSuccess(res, { users: result.rows }, { users: result.rows }, 200)
}

async function handleProducts(req, res) {
  const decoded = verifyToken(req)
  if (!decoded) return res.status(401).json({ error: 'Invalid token' })

  const result = await db.query(`
    SELECT p.id, p.name, p.sku, p.quantity_in_stock AS quantity, p.price AS unit_price, p.is_active, p.department_id, p.category_id,
           c.name as category_name, d.name as department_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN departments d ON p.department_id = d.id
    ORDER BY p.name
  `)
  return sendSuccess(res, { products: result.rows }, { products: result.rows }, 200)
}

async function handleCategories(req, res) {
  const decoded = verifyToken(req)
  if (!decoded) return res.status(401).json({ error: 'Invalid token' })

  const result = await db.query('SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name')
  return sendSuccess(res, { categories: result.rows }, { categories: result.rows }, 200)
}

async function handleDepartments(req, res) {
  const decoded = verifyToken(req)
  if (!decoded) return res.status(401).json({ error: 'Invalid token' })

  const result = await db.query('SELECT id, name, description, created_at, updated_at FROM departments ORDER BY name')
  return sendSuccess(res, { departments: result.rows }, { departments: result.rows }, 200)
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Determine path segments after /api/
  const url = req.url || ''
  // strip query
  const path = url.split('?')[0]
  const segments = path.replace(/^\/+/, '').split('/')
  // if first segment is 'api', drop it
  if (segments[0] === 'api') segments.shift()

  // route based on first segment
  const first = segments[0] || ''
  const second = segments[1] || ''

  try {
    if ((first === '' || first === 'health') && req.method === 'GET') {
      return handleHealth(req, res)
    }

    if (first === 'auth' && second === 'login' && req.method === 'POST') {
      return handleLogin(req, res)
    }

    if (first === 'users' && req.method === 'GET') {
      return handleUsers(req, res)
    }

    if (first === 'products' && req.method === 'GET') {
      return handleProducts(req, res)
    }

    if (first === 'categories' && req.method === 'GET') {
      return handleCategories(req, res)
    }

    if (first === 'departments' && req.method === 'GET') {
      return handleDepartments(req, res)
    }

    // Fallback: 404
    return res.status(404).json({ error: 'Not found' })
  } catch (err) {
    console.error('API catch-all error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
