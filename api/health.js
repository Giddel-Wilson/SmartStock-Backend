const ALLOWED_ORIGINS = [
  'https://smart-stock-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
]

module.exports = async (req, res) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') return res.status(200).end()

  return res.status(200).json({ status: 'ok', message: 'SmartStock API (serverless) - health check', timestamp: new Date().toISOString() })
}
