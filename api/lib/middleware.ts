import jwt from 'jsonwebtoken'
import { VercelRequest, VercelResponse } from '@vercel/node'

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string
    email: string
    role: string
    name: string
    departmentId?: string
    departmentName?: string
  }
}

export function authenticate(handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      // Handle CORS
      res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end()
      }

      const authHeader = req.headers.authorization
      if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' })
      }

      const token = authHeader.split(' ')[1]
      if (!token) {
        return res.status(401).json({ error: 'Invalid token format' })
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      req.user = decoded.user

      return handler(req, res)
    } catch (error) {
      console.error('Auth middleware error:', error)
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}

export function cors(handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }

    return handler(req, res)
  }
}