import { Request, Response } from 'express';
import User from '../models/User';
import Department from '../models/Department';
import ActivityLog from '../models/ActivityLog';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '../utils/response';
import bcrypt from 'bcryptjs';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body?.data?.data || req.body?.data || req.body;
    
    const user = await User.findOne({ email }).populate('departmentId');
    if (!user || !user.isActive) {
      return errorResponse(res, 'Invalid credentials', 401);
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Ensure JWT secrets are available
    const jwtSecret = process.env.JWT_SECRET;
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    
    if (!jwtSecret || !refreshTokenSecret) {
      console.error('JWT secrets are not configured');
      return errorResponse(res, 'Server configuration error', 500);
    }

    // Define expiration times for JWT
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      refreshTokenSecret,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
    );
    
    user.lastLogin = new Date();
    await user.save();
    
    // Log login activity (non-blocking, don't fail if logging fails)
    try {
      await ActivityLog.create({
        userId: user._id,
        action: 'login',
        details: 'User logged in successfully',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
        userAgent: req.headers['user-agent'] || null
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Continue with login even if activity logging fails
    }
    
    // Get department info if exists
    let departmentName = null;
    if (user.departmentId) {
      const dept = await Department.findById(user.departmentId);
      departmentName = dept?.name || null;
    }
    
    return successResponse(res, {
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.departmentId?.toString() || null,
        department_name: departmentName,
        phone: user.phone || null,
        last_login: user.lastLogin || null
      },
      accessToken,
      refreshToken
    });
  } catch (err) {
    return errorResponse(res, 'Login failed', 500);
  }
};