const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Access denied. No token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and is active
    const user = await userModel.findById(decoded.id);
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token or user no longer active'
      });
    }
    
    // Attach user to request object
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token'
    });
  }
};

module.exports = auth;