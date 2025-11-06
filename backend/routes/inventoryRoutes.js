const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const inventoryLogModel = require('../models/inventoryLogModel');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Get all inventory logs with filtering options
router.get('/', auth, [
  query('product_id').optional().isInt().withMessage('Product ID must be an integer'),
  query('user_id').optional().isInt().withMessage('User ID must be an integer'),
  query('change_type').optional().isIn(['restock', 'sale', 'edit', 'return']).withMessage('Invalid change type'),
  query('start_date').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('end_date').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        errors: errors.array() 
      });
    }
    
    // Parse filters from query params
    const filters = {
      product_id: req.query.product_id ? parseInt(req.query.product_id) : undefined,
      user_id: req.query.user_id ? parseInt(req.query.user_id) : undefined,
      change_type: req.query.change_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };
    
    // Get inventory logs
    const logs = await inventoryLogModel.findAll(filters);
    
    return res.status(200).json({
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching inventory logs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving inventory logs'
    });
  }
});

// Get inventory logs for a specific product
router.get('/product/:productId', auth, [
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        errors: errors.array() 
      });
    }
    
    const productId = parseInt(req.params.productId);
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // Get inventory logs for the product
    const logs = await inventoryLogModel.findByProductId(productId, limit);
    
    return res.status(200).json({
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching product inventory logs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving product inventory logs'
    });
  }
});

// Get product movement summary (for analytics)
router.get('/summary', auth, [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        errors: errors.array() 
      });
    }
    
    const days = req.query.days ? parseInt(req.query.days) : 30;
    
    // Get product movement summary
    const summary = await inventoryLogModel.getProductMovementSummary(days);
    
    return res.status(200).json({
      status: 'success',
      period_days: days,
      count: summary.length,
      summary
    });
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving inventory summary'
    });
  }
});

// Get details of a specific inventory log entry
router.get('/:id', auth, async (req, res) => {
  try {
    const logId = parseInt(req.params.id);
    
    // Get inventory log
    const log = await inventoryLogModel.findById(logId);
    
    if (!log) {
      return res.status(404).json({
        status: 'error',
        message: 'Inventory log entry not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      log
    });
  } catch (error) {
    console.error('Error fetching inventory log:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving inventory log'
    });
  }
});

module.exports = router;