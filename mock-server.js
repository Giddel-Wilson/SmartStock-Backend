const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
    req.user = { id: '123', email: 'admin@smartstock.com' };
    next();
};

// Mock inventory update endpoint
app.post('/api/inventory/update', mockAuth, (req, res) => {
    console.log('Received inventory update request:', req.body);
    
    const { productId, changeType, quantityChanged, reason, referenceNumber } = req.body;
    
    // Validate required fields
    if (!productId) {
        return res.status(400).json({ error: 'productId is required' });
    }
    if (!changeType) {
        return res.status(400).json({ error: 'changeType is required' });
    }
    if (quantityChanged === undefined || quantityChanged === null) {
        return res.status(400).json({ error: 'quantityChanged is required' });
    }
    
    console.log('✅ All required fields present:', {
        productId,
        changeType, 
        quantityChanged,
        reason,
        referenceNumber
    });
    
    // Mock successful response
    res.json({
        success: true,
        message: 'Inventory updated successfully',
        data: {
            productId,
            changeType,
            quantityChanged,
            newQuantity: 100, // Mock new quantity
            reason,
            referenceNumber
        }
    });
});

// Mock login endpoint
app.post('/api/auth/login', (req, res) => {
    res.json({
        success: true,
        token: 'mock-jwt-token',
        user: { id: '123', email: 'admin@smartstock.com' }
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Mock server running on port ${PORT}`);
    console.log('Ready to test inventory updates!');
});
