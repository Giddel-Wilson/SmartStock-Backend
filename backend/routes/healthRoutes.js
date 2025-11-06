const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbHealthy = await db.healthCheck();
    
    // Return status
    return res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? 'healthy' : 'degraded',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

module.exports = router;
