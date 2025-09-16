import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
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
      console.log('JWT verification successful for inventory API')
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

    // Get summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_products,
        SUM(quantity_in_stock) as total_stock,
        COUNT(*) FILTER (WHERE quantity_in_stock <= minimum_stock_level AND minimum_stock_level > 0) as low_stock_count,
        COUNT(*) FILTER (WHERE quantity_in_stock = 0) as out_of_stock_count
      FROM products 
      WHERE is_active = true
    `

    const statsResult = await pool.query(statsQuery)
    const stats = statsResult.rows[0]

    // Get low stock products
    const lowStockQuery = `
      SELECT id, name, sku, quantity_in_stock, minimum_stock_level
      FROM products 
      WHERE is_active = true 
        AND quantity_in_stock <= minimum_stock_level 
        AND minimum_stock_level > 0
      ORDER BY (quantity_in_stock::float / minimum_stock_level) ASC
      LIMIT 5
    `

    const lowStockResult = await pool.query(lowStockQuery)
    const lowStockProducts = lowStockResult.rows

    // Get recent inventory movements (if inventory_logs table exists)
    let recentMovements = []
    try {
      const movementsQuery = `
        SELECT 
          il.*, 
          p.name as product_name,
          u.name as user_name
        FROM inventory_logs il
        JOIN products p ON il.product_id = p.id
        JOIN users u ON il.user_id = u.id
        ORDER BY il.created_at DESC
        LIMIT 10
      `
      const movementsResult = await pool.query(movementsQuery)
      recentMovements = movementsResult.rows
    } catch (movementError: any) {
      console.log('No recent movements available:', movementError.message)
    }

    await pool.end()

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalProducts: parseInt(stats.total_products),
          totalStock: parseInt(stats.total_stock) || 0,
          lowStockCount: parseInt(stats.low_stock_count),
          outOfStockCount: parseInt(stats.out_of_stock_count)
        },
        lowStockProducts,
        recentMovements
      }
    })

  } catch (error: any) {
    console.error('Inventory summary error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch inventory summary',
      message: error.message 
    })
  }
}