const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Get all activity logs (managers only)
router.get('/', auth, roleCheck('manager'), [
  query('user_id').optional().isInt().withMessage('User ID must be an integer'),
  query('action').optional().isString().withMessage('Action must be a string'),
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
      user_id: req.query.user_id ? parseInt(req.query.user_id) : undefined,
      action: req.query.action,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };
    
    // Get activity logs
    const logs = await activityLogModel.findAll(filters);
    
    return res.status(200).json({
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving activity logs'
    });
  }
});

// Get activity logs for the current user
router.get('/me', auth, [
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
    
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // Get activity logs for the current user
    const logs = await activityLogModel.findByUserId(req.user.id, limit);
    
    return res.status(200).json({
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving user activity logs'
    });
  }
});

// Get activity logs for a specific user (managers only)
router.get('/user/:userId', auth, roleCheck('manager'), [
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
    
    const userId = parseInt(req.params.userId);
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // Get activity logs for the specified user
    const logs = await activityLogModel.findByUserId(userId, limit);
    
    return res.status(200).json({
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving user activity logs'
    });
  }
});

// Get activity summary for analytics (managers only)
router.get('/summary', auth, roleCheck('manager'), [
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
    
    // Get activity summary
    const summary = await activityLogModel.getActionSummary(days);
    
    return res.status(200).json({
      status: 'success',
      period_days: days,
      count: summary.length,
      summary
    });
  } catch (error) {
    console.error('Error fetching activity summary:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving activity summary'
    });
  }
});

// Delete old activity logs (managers only)
router.delete('/cleanup', auth, roleCheck('manager'), [
  query('days_to_retain').isInt({ min: 30 }).withMessage('Days to retain must be at least 30')
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
    
    const daysToRetain = parseInt(req.query.days_to_retain || 90);
    
    // Delete old logs
    const result = await activityLogModel.deleteOldLogs(daysToRetain);
    
    // Log this activity
    await activityLogModel.logActivity({
      user_id: req.user.id,
      action: 'CLEANUP_ACTIVITY_LOGS',
      details: `Deleted activity logs older than ${daysToRetain} days`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    return res.status(200).json({
      status: 'success',
      message: `Activity logs older than ${daysToRetain} days have been deleted`,
      deleted_count: result ? result.deleted_count : 0
    });
  } catch (error) {
    console.error('Error cleaning up activity logs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while cleaning up activity logs'
    });
  }
});

// Get details of a specific activity log entry (managers only)
router.get('/:id', auth, roleCheck('manager'), async (req, res) => {
  try {
    const logId = parseInt(req.params.id);
    
    // Get activity log
    const log = await activityLogModel.findById(logId);
    
    if (!log) {
      return res.status(404).json({
        status: 'error',
        message: 'Activity log entry not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      log
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving activity log'
    });
  }
});

module.exports = router;