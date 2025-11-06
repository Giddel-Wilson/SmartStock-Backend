const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const categoryModel = require('../models/categoryModel');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Get all categories
router.get('/', auth, async (req, res) => {
  try {
    const categories = await categoryModel.findAll();
    
    return res.status(200).json({
      status: 'success',
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving categories'
    });
  }
});

// Get category by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await categoryModel.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving category'
    });
  }
});

// Create category (managers or staff)
router.post('/', 
  auth, 
  [
    body('name').notEmpty().withMessage('Category name is required'),
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
      
      // Create category
      const newCategory = await categoryModel.create({
        name,
        description,
        created_by: req.user.id
      });
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'CREATE_CATEGORY',
        details: `Created new category: ${name}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(201).json({
        status: 'success',
        message: 'Category created successfully',
        category: newCategory
      });
    } catch (error) {
      console.error('Error creating category:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while creating category'
      });
    }
  }
);

// Update category (managers or staff)
router.put('/:id', 
  auth,
  [
    body('name').optional().notEmpty().withMessage('Category name cannot be empty'),
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
      
      const categoryId = parseInt(req.params.id);
      
      // Check if category exists
      const existingCategory = await categoryModel.findById(categoryId);
      if (!existingCategory) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found'
        });
      }
      
      const updateData = {
        name: req.body.name || existingCategory.name,
        description: req.body.description !== undefined ? req.body.description : existingCategory.description
      };
      
      // Update category
      const updatedCategory = await categoryModel.update(categoryId, updateData);
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'UPDATE_CATEGORY',
        details: `Updated category: ${updatedCategory.name} (ID: ${categoryId})`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(200).json({
        status: 'success',
        message: 'Category updated successfully',
        category: updatedCategory
      });
    } catch (error) {
      console.error('Error updating category:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while updating category'
      });
    }
  }
);

// Delete category (managers only)
router.delete('/:id', auth, roleCheck('manager'), async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    // Check if category exists
    const category = await categoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found'
      });
    }
    
    try {
      // Try to delete category (will fail if it has products)
      await categoryModel.delete(categoryId);
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'DELETE_CATEGORY',
        details: `Deleted category: ${category.name} (ID: ${categoryId})`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(200).json({
        status: 'success',
        message: 'Category deleted successfully'
      });
    } catch (error) {
      if (error.message.includes('Cannot delete category with assigned products')) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete category that has products assigned to it'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while deleting category'
    });
  }
});

module.exports = router;