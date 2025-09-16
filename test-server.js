const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock auth middleware
const mockAuth = (req, res, next) => {
    req.user = { id: '550e8400-e29b-41d4-a716-446655440001', email: 'admin@smartstock.com' };
    next();
};

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

// Mock login endpoint  
app.post('/api/auth/login', (req, res) => {
    console.log('Login attempt:', req.body);
    res.json({
        success: true,
        token: 'mock-jwt-token-123',
        refreshToken: 'mock-refresh-token-123',
        user: { 
            id: '550e8400-e29b-41d4-a716-446655440001', 
            email: 'admin@smartstock.com',
            name: 'Admin User'
        }
    });
});

// Mock inventory update endpoint
app.post('/api/inventory/update', mockAuth, (req, res) => {
    console.log('📦 Inventory update request received:');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const { productId, changeType, quantityChanged, reason, referenceNumber } = req.body;
    
    // Validate required fields
    if (!productId) {
        console.log('❌ Missing productId');
        return res.status(400).json({ error: 'productId is required' });
    }
    if (!changeType) {
        console.log('❌ Missing changeType');
        return res.status(400).json({ error: 'changeType is required' });
    }
    if (quantityChanged === undefined || quantityChanged === null) {
        console.log('❌ Missing quantityChanged');
        return res.status(400).json({ error: 'quantityChanged is required' });
    }
    
    console.log('✅ Validation passed. Processing inventory update...');
    console.log(`Product: ${productId}`);
    console.log(`Change Type: ${changeType}`);
    console.log(`Quantity Changed: ${quantityChanged}`);
    console.log(`Reason: ${reason || 'N/A'}`);
    console.log(`Reference: ${referenceNumber || 'N/A'}`);
    
    // Mock successful response
    const response = {
        success: true,
        message: 'Inventory updated successfully',
        data: {
            id: 'mock-log-id-123',
            productId,
            changeType,
            quantityChanged,
            quantityBefore: 10,
            quantityAfter: 10 + quantityChanged,
            reason: reason || null,
            referenceNumber: referenceNumber || null,
            createdAt: new Date().toISOString(),
            user: req.user
        }
    };
    
    console.log('📤 Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl 
    });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 Mock SmartStock Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log('🔧 Ready to test inventory updates!');
});

module.exports = app;
