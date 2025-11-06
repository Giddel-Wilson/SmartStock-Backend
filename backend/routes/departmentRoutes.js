const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const departmentModel = require('../models/departmentModel');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Get all departments
router.get('/', auth, async (req, res) => {
  try {
    const departments = await departmentModel.findAll();
    
    return res.status(200).json({
      status: 'success',
      count: departments.length,
      departments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving departments'
    });
  }
});

// Get department by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const departmentId = parseInt(req.params.id);
    const department = await departmentModel.findById(departmentId);
    
    if (!department) {
      return res.status(404).json({
        status: 'error',
        message: 'Department not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      department
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving department'
    });
  }
});

// Create department (managers only)
router.post('/', 
  auth, 
  roleCheck('manager'),
  [
    body('name').notEmpty().withMessage('Department name is required'),
    body('description').optional()
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }
      
      const { name, description } = req.body;
      
      // Create department
      const newDepartment = await departmentModel.create({
        name,
        description
      });
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'CREATE_DEPARTMENT',
        details: `Created new department: ${name}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(201).json({
        status: 'success',
        message: 'Department created successfully',
        department: newDepartment
      });
    } catch (error) {
      console.error('Error creating department:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while creating department'
      });
    }
  }
);

// Update department (managers only)
router.put('/:id', 
  auth, 
  roleCheck('manager'),
  [
    body('name').optional().notEmpty().withMessage('Department name cannot be empty'),
    body('description').optional()
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }
      
      const departmentId = parseInt(req.params.id);
      
      // Check if department exists
      const existingDepartment = await departmentModel.findById(departmentId);
      if (!existingDepartment) {
        return res.status(404).json({
          status: 'error',
          message: 'Department not found'
        });
      }
      
      const updateData = {
        name: req.body.name || existingDepartment.name,
        description: req.body.description !== undefined ? req.body.description : existingDepartment.description
      };
      
      // Update department
      const updatedDepartment = await departmentModel.update(departmentId, updateData);
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'UPDATE_DEPARTMENT',
        details: `Updated department: ${updatedDepartment.name} (ID: ${departmentId})`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(200).json({
        status: 'success',
        message: 'Department updated successfully',
        department: updatedDepartment
      });
    } catch (error) {
      console.error('Error updating department:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while updating department'
      });
    }
  }
);

// Delete department (managers only)
router.delete('/:id', auth, roleCheck('manager'), async (req, res) => {
  try {
    const departmentId = parseInt(req.params.id);
    
    // Check if department exists
    const department = await departmentModel.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        status: 'error',
        message: 'Department not found'
      });
    }
    
    try {
      // Try to delete department (will fail if it has users)
      await departmentModel.delete(departmentId);
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'DELETE_DEPARTMENT',
        details: `Deleted department: ${department.name} (ID: ${departmentId})`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(200).json({
        status: 'success',
        message: 'Department deleted successfully'
      });
    } catch (error) {
      if (error.message.includes('Cannot delete department with assigned users')) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete department that has users assigned to it'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting department:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while deleting department'
    });
  }
});

module.exports = router;