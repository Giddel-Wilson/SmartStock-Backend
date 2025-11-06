const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Import database configuration
const db = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const activityRoutes = require('./routes/activityRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Initialize Express app
const app = express();

// Robust database connection with retry
const connectWithRetry = async (maxAttempts = 5, initialDelay = 3000) => {
  let attempts = 0;
  let delay = initialDelay;
  
  const tryConnect = async () => {
    attempts++;
    try {
      // Test the connection
      await db.healthCheck();
      console.log('Database connected successfully');
      
      // Set up a periodic health check
      setInterval(async () => {
        const isHealthy = await db.healthCheck();
        if (!isHealthy) {
          console.log('Database connection lost, attempting to reconnect...');
          tryConnect();
        }
      }, 30000); // Check every 30 seconds
      
      return true;
    } catch (err) {
      console.error(`Database connection attempt ${attempts} failed:`, err.message);
      
      if (attempts < maxAttempts) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 30000); // Exponential backoff with max 30 seconds
        return tryConnect();
      } else {
        console.error('Maximum connection attempts reached. Server will continue but database functionality may be limited.');
        return false;
      }
    }
  };
  
  return tryConnect();
};

// Connect to the database
connectWithRetry().then(() => {
  // Middleware
  app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for development
  }));
  
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }));
  
  app.use(express.json({ limit: '10mb' })); // Increased limit for larger payloads
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging middleware
  if (process.env.NODE_ENV === 'production') {
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    const accessLogStream = fs.createWriteStream(
      path.join(logsDir, 'access.log'),
      { flags: 'a' }
    );

    app.use(morgan('combined', { stream: accessLogStream }));
  } else {
    app.use(morgan('dev'));
  }

  // Add request timeout middleware
  app.use((req, res, next) => {
    // Set a longer timeout (30 seconds) for all requests
    req.setTimeout(30000);
    next();
  });

  // Register routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/health', healthRoutes);

  // Root API check
  app.get('/api', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'SmartStock API is running',
      version: '1.0.0'
    });
  });

  // Health check route
  app.get('/api/status', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'SmartStock API is running' });
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/build')));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
    });
  }

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    
    // Special handling for database connection errors
    if (err.code && (
      err.code === 'ECONNREFUSED' || 
      err.code === '57P01' || 
      err.code === '08006' ||
      err.code === '08001' ||
      err.message.includes('Connection terminated unexpectedly')
    )) {
      console.log('Database connection error detected, trying to reconnect...');
      connectWithRetry(3, 1000); // Try reconnecting with fewer attempts
      return res.status(503).json({
        status: 'error',
        message: 'Database service temporarily unavailable. Please try again shortly.'
      });
    }
    
    // JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid JSON in request body'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: err.message || 'An unexpected error occurred'
    });
  });
  
  // Start server
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
  
  // Handle server errors gracefully
  server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
      process.exit(1);
    }
  });
  
  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
  
}).catch(err => {
  console.error('Failed to start server:', err);
});

// Export app for testing
module.exports = { app };