const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const userModel = require('../models/userModel');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Get all users (managers only)
router.get('/', auth, roleCheck('manager'), async (req, res) => {
  try {
    const filters = {
      role: req.query.role,
      department_id: req.query.department_id ? parseInt(req.query.department_id) : undefined,
      is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
    };

    const users = await userModel.findAll(filters);

    return res.status(200).json({
      status: 'success',
      count: users.length,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        is_active: user.is_active,
        created_at: user.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving users'
    });
  }
});

// Get user by ID (managers or the user themselves)
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user is trying to access their own profile or is a manager
    if (req.user.id !== userId && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only view your own profile'
      });
    }

    const user = await userModel.findById(userId);
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
        is_active: user.is_active,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving user'
    });
  }
});

// Update user (managers for any user, or users updating their own profile)
router.put('/:id', auth, [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('role').optional().isIn(['manager', 'staff']).withMessage('Invalid role'),
  body('department_id').optional().isInt().withMessage('Department ID must be an integer'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
], async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user is trying to update their own profile or is a manager
    if (req.user.id !== userId && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only update your own profile'
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

    // Get existing user
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // If not manager, restrict updateable fields
    let updateData = {};
    if (req.user.role === 'manager') {
      // Managers can update all fields
      updateData = {
        name: req.body.name || existingUser.name,
        email: req.body.email || existingUser.email,
        role: req.body.role || existingUser.role,
        department_id: req.body.department_id !== undefined ? req.body.department_id : existingUser.department_id,
        is_active: req.body.is_active !== undefined ? req.body.is_active : existingUser.is_active
      };
    } else {
      // Staff can only update their name and email
      updateData = {
        name: req.body.name || existingUser.name,
        email: req.body.email || existingUser.email,
        role: existingUser.role,
        department_id: existingUser.department_id,
        is_active: existingUser.is_active
      };
    }

    // Check if email is being changed and if it already exists
    if (updateData.email !== existingUser.email) {
      const emailExists = await userModel.findByEmail(updateData.email);
      if (emailExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already in use by another account'
        });
      }
    }

    // Update user
    const updatedUser = await userModel.update(userId, updateData);

    // Log activity
    await activityLogModel.logActivity({
      user_id: req.user.id,
      action: 'UPDATE_USER',
      details: `Updated user: ${updatedUser.name} (ID: ${updatedUser.id})`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while updating user'
    });
  }
});

// Delete/Deactivate user (managers only)
router.delete('/:id', auth, roleCheck('manager'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Prevent deleting yourself
    if (req.user.id === userId) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot delete your own account'
      });
    }

    // Check if user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Soft delete (deactivate) the user
    const deleted = await userModel.delete(userId);

    if (!deleted) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete user'
      });
    }

    // Log activity
    await activityLogModel.logActivity({
      user_id: req.user.id,
      action: 'DELETE_USER',
      details: `Deactivated user: ${user.name} (ID: ${user.id})`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      status: 'success',
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while deleting user'
    });
  }
});

// Reset user password (managers only)
router.post('/reset-password/:id', auth, roleCheck('manager'), [
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        errors: errors.array() 
      });
    }

    // Check if user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update password
    await userModel.updatePassword(userId, newPassword);

    // Log activity
    await activityLogModel.logActivity({
      user_id: req.user.id,
      action: 'RESET_PASSWORD',
      details: `Reset password for user: ${user.name} (ID: ${user.id})`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while resetting password'
    });
  }
});

module.exports = router;