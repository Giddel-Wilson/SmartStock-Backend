/**
 * Role-based access control middleware
 * @param {string|string[]} roles - Allowed roles ('manager', 'staff', or array of roles)
 * @returns {function} Express middleware function
 */
const roleCheck = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // If roles is a string, convert to array
    const allowedRoles = typeof roles === 'string' ? [roles] : roles;
    
    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Insufficient permissions'
      });
    }
    
    next();
  };
};

/**
 * Department access middleware - ensures staff can only access their own department's data
 * Managers can access all departments
 */
const departmentCheck = () => {
  return (req, res, next) => {
    // Skip check for managers (they can access all departments)
    if (req.user.role === 'manager') {
      return next();
    }
    
    // For staff, ensure they can only access their department
    const requestedDeptId = parseInt(req.params.departmentId || req.body.department_id);
    
    if (requestedDeptId && requestedDeptId !== req.user.department_id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only access data from your own department'
      });
    }
    
    next();
  };
};

module.exports = {
  roleCheck,
  departmentCheck
};