const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const stockAlertModel = require('../models/stockAlertModel');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Get all stock alerts with filtering options
router.get('/', auth, [
  query('product_id').optional().isInt().withMessage('Product ID must be an integer'),
  query('alert_sent').optional().isBoolean().withMessage('alert_sent must be a boolean'),
  query('category_id').optional().isInt().withMessage('Category ID must be an integer'),
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
      alert_sent: req.query.alert_sent === 'true' ? true : req.query.alert_sent === 'false' ? false : undefined,
      category_id: req.query.category_id ? parseInt(req.query.category_id) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };
    
    // Get stock alerts
    const alerts = await stockAlertModel.findAll(filters);
    
    return res.status(200).json({
      status: 'success',
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving stock alerts'
    });
  }
});

// Get pending (unsent) stock alerts
router.get('/pending', auth, async (req, res) => {
  try {
    // Get unsent alerts
    const alerts = await stockAlertModel.getUnsentAlerts();
    
    return res.status(200).json({
      status: 'success',
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error fetching pending stock alerts:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving pending stock alerts'
    });
  }
});

// Mark alert as sent
router.put('/:id/mark-sent', auth, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    
    // Mark alert as sent
    const updatedAlert = await stockAlertModel.markAsSent(alertId);
    
    if (!updatedAlert) {
      return res.status(404).json({
        status: 'error',
        message: 'Alert not found'
      });
    }
    
    // Log activity
    await activityLogModel.logActivity({
      user_id: req.user.id,
      action: 'MARK_ALERT_SENT',
      details: `Marked stock alert as sent for product ID: ${updatedAlert.product_id}`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    return res.status(200).json({
      status: 'success',
      message: 'Alert marked as sent',
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Error marking alert as sent:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while marking alert as sent'
    });
  }
});

// Clear alerts for a product (after restock)
router.delete('/product/:productId', auth, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    // Clear alerts for the product
    const count = await stockAlertModel.clearAlertsForProduct(productId);
    
    if (count > 0) {
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'CLEAR_PRODUCT_ALERTS',
        details: `Cleared ${count} stock alerts for product ID: ${productId}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    }
    
    return res.status(200).json({
      status: 'success',
      message: `${count} alerts cleared for product`,
      count
    });
  } catch (error) {
    console.error('Error clearing product alerts:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while clearing product alerts'
    });
  }
});

// Delete a specific alert
router.delete('/:id', auth, roleCheck('manager'), async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    
    // Delete the alert
    const deleted = await stockAlertModel.delete(alertId);
    
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Alert not found'
      });
    }
    
    // Log activity
    await activityLogModel.logActivity({
      user_id: req.user.id,
      action: 'DELETE_ALERT',
      details: `Deleted stock alert ID: ${alertId}`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    return res.status(200).json({
      status: 'success',
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while deleting alert'
    });
  }
});

module.exports = router;