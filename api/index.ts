import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  return res.status(200).json({
    success: true,
    message: 'SmartStock Backend API',
    version: '1.0.0',
    endpoints: {
      'GET /api/test': 'Test endpoint',
      'POST /api/auth/login': 'User login',
      'GET /api/products': 'List products',
      'POST /api/products': 'Create product',
      'GET /api/users': 'List users',
      'GET /api/categories': 'List categories',
      'GET /api/departments': 'List departments',
      'GET /api/inventory/summary': 'Inventory summary'
    },
    documentation: 'https://github.com/Giddel-Wilson/SmartStock-Backend',
    timestamp: new Date().toISOString()
  })
}