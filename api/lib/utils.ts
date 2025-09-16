import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { VercelResponse } from '@vercel/node'

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(password, salt)
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// JWT utilities
export function generateTokens(user: any) {
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

  const jwtSecret = process.env.JWT_SECRET
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET
  
  if (!jwtSecret || !refreshSecret) {
    throw new Error('JWT secrets are not configured')
  }

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: '24h'
  })
  
  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: '30d'
  })

  return { accessToken, refreshToken }
}

// Response utilities
export function sendSuccess(res: VercelResponse, data: any, message: string = 'Success', statusCode: number = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  })
}

export function sendError(res: VercelResponse, message: string, statusCode: number = 400, error?: any) {
  const response: any = {
    success: false,
    error: message
  }
  
  if (process.env.NODE_ENV === 'development' && error) {
    response.details = error
  }
  
  return res.status(statusCode).json(response)
}

// Validation utility
export function validateRequest(data: any, schema: any) {
  const { error, value } = schema.validate(data, { abortEarly: false })
  if (error) {
    const errorMessages = error.details.map((detail: any) => detail.message)
    throw new Error(`Validation failed: ${errorMessages.join(', ')}`)
  }
  return value
}