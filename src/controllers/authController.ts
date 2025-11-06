import { Request, Response } from 'express';
import User from '../models/User';
import jwt, { SignOptions } from 'jsonwebtoken';
import { successResponse, errorResponse } from '../utils/response';
import bcrypt from 'bcryptjs';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body?.data?.data || req.body?.data || req.body;
    
    const user = await User.findOne({ email });
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

    // Define expiration times with proper typing for JWT
    const accessTokenExpiry = process.env.JWT_EXPIRES_IN || '1h';
    const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    const accessTokenOptions: SignOptions = { 
      expiresIn: accessTokenExpiry
    };
    const refreshTokenOptions: SignOptions = { 
      expiresIn: refreshTokenExpiry
    };
    
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      jwtSecret,
      accessTokenOptions
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      refreshTokenSecret,
      refreshTokenOptions
    );
    
    user.lastLogin = new Date();
    await user.save();
    
    return successResponse(res, {
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.departmentId || null,
        department_name: null, // Populate if needed
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