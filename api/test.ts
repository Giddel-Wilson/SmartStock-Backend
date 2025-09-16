import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'SmartStock Backend API is working!',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/test - This test endpoint',
        '/api/auth/login - User authentication',
        '/api/products - Product management',
        '/api/users - User management',
        '/api/categories - Category management', 
        '/api/departments - Department management',
        '/api/inventory/summary - Inventory summary'
      ]
    })
  }

  return res.status(405).json({ 
    success: false, 
    error: 'Method not allowed' 
  })
}