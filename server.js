const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const WebSocket = require('ws');
const http = require('http');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const reportRoutes = require('./routes/reports');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

// Import database
const db = require('./config/database');

const app = express();
const server = http.createServer(app);

// WebSocket setup for real-time notifications
const wss = new WebSocket.Server({ server });

// Store WebSocket connections
global.wsConnections = new Map();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection established');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth' && data.userId) {
                global.wsConnections.set(data.userId, ws);
                console.log(`User ${data.userId} connected via WebSocket`);
            }
        } catch (error) {
            console.error('WebSocket message parsing error:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        // Remove from connections map
        for (const [userId, connection] of global.wsConnections.entries()) {
            if (connection === ws) {
                global.wsConnections.delete(userId);
                console.log(`User ${userId} disconnected from WebSocket`);
                break;
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Middleware
app.use(helmet());
        app.use(cors({
                origin: 'https://smart-stock-frontend.vercel.app',
                credentials: true
        }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Explicitly handle preflight requests
app.options('*', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', 'https://smart-stock-frontend.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
});

// Rate limiting
app.use(rateLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'SmartStock API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl 
    });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

// Start server
server.listen(PORT, HOST, () => {
    console.log(`🚀 SmartStock Server running on port ${PORT}`);
    console.log(`🌐 Server accessible on:`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://0.0.0.0:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 WebSocket server ready for real-time updates`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        db.end();
        process.exit(0);
    });
});

module.exports = app;
