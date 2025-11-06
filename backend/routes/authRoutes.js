const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');

// Login route
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await userModel.findByEmail(email);
      
      // Check if user exists
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          status: 'error',
          message: 'Account is inactive. Please contact an administrator'
        });
      }

      // Verify password
      const isMatch = await userModel.verifyPassword(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Create JWT payload
      const payload = {
        id: user.id,
        role: user.role
      };

      // Sign JWT token
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // Log activity
      await activityLogModel.logActivity({
        user_id: user.id,
        action: 'LOGIN',
        details: 'User logged in',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      // Return token and user info
      return res.status(200).json({
        status: 'success',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department_id: user.department_id,
          department_name: user.department_name
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error during login'
      });
    }
  }
);

// Register route (only available to managers)
router.post(
  '/register',
  auth,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['manager', 'staff']).withMessage('Invalid role'),
    body('department_id').isInt().withMessage('Department ID must be an integer')
  ],
  async (req, res) => {
    try {
      // Check if requester is manager
      if (req.user.role !== 'manager') {
        return res.status(403).json({
          status: 'error',
          message: 'Only managers can register new users'
        });
      }

      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }

      const { name, email, password, role, department_id } = req.body;

      // Check if email already exists
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'User with this email already exists'
        });
      }

      // Create new user
      const newUser = await userModel.create({
        name,
        email,
        password,
        role,
        department_id
      });

      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'REGISTER_USER',
        details: `New user created: ${name} (${email}) with role ${role}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          department_id: newUser.department_id,
          created_at: newUser.created_at
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error during registration'
      });
    }
  }
);

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile retrieval error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving user profile'
    });
  }
});

// Change password route
router.post(
  '/change-password',
  auth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get user with password
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Verify current password
      const isMatch = await userModel.verifyPassword(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          status: 'error',
          message: 'Current password is incorrect'
        });
      }

      // Update password
      await userModel.updatePassword(userId, newPassword);

      // Log activity
      await activityLogModel.logActivity({
        user_id: userId,
        action: 'CHANGE_PASSWORD',
        details: 'User changed password',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return res.status(200).json({
        status: 'success',
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Password change error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while updating password'
      });
    }
  }
);

// Verify token is valid
router.get('/verify-token', auth, async (req, res) => {
  try {
    // If we get here, the auth middleware has already verified the token
    return res.status(200).json({
      status: 'success',
      valid: true
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      status: 'error',
      valid: false,
      message: 'Invalid token'
    });
  }
});

module.exports = router;