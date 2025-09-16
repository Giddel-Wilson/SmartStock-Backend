// SmartStock Backend API
// This is a serverless backend - API endpoints are available at /api/*

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SmartStock Backend API',
    documentation: {
      endpoints: [
        'GET /api/test - Test endpoint',
        'POST /api/auth/login - User authentication',
        'GET /api/products - List products',
        'POST /api/products - Create product',
        'PUT /api/products/:id - Update product',
        'DELETE /api/products/:id - Delete product',
        'GET /api/users - List users',
        'POST /api/users - Create user',
        'GET /api/categories - List categories',
        'GET /api/departments - List departments',
        'GET /api/inventory/summary - Inventory summary'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(3000);

module.exports = app;