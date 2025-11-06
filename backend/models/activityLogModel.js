const db = require('../config/db');

const activityLogModel = {
  // Log user activity
  async logActivity(data) {
    const { user_id, action, details, ip_address, user_agent } = data;
    
    const query = `
      INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, action, details, created_at
    `;
    
    const values = [user_id, action, details, ip_address, user_agent];
    const result = await db.query(query, values);
    return result.rows[0];
  },
  
  // Get activity log by ID
  async findById(id) {
    const query = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0];
  },
  
  // Get activity logs by user ID
  async findByUserId(userId, limit = 100) {
    const query = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  },
  
  // Get all activity logs with filters
  async findAll(filters = {}) {
    let query = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1 = 1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    // Add filters if provided
    if (filters.user_id) {
      query += ` AND al.user_id = $${valueIndex++}`;
      values.push(filters.user_id);
    }
    
    if (filters.action) {
      query += ` AND al.action = $${valueIndex++}`;
      values.push(filters.action);
    }
    
    if (filters.start_date) {
      query += ` AND al.created_at >= $${valueIndex++}`;
      values.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND al.created_at <= $${valueIndex++}`;
      values.push(filters.end_date);
    }
    
    // Add pagination
    query += ' ORDER BY al.created_at DESC';
    
    if (filters.limit) {
      query += ` LIMIT $${valueIndex++}`;
      values.push(filters.limit);
    } else {
      query += ' LIMIT 100'; // Default limit
    }
    
    if (filters.offset) {
      query += ` OFFSET $${valueIndex++}`;
      values.push(filters.offset);
    }
    
    const result = await db.query(query, values);
    return result.rows;
  },
  
  // Get activity summary by action type (for analytics)
  async getActionSummary(days = 30) {
    const query = `
      SELECT 
        action,
        COUNT(*) as action_count,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence
      FROM 
        activity_logs
      WHERE 
        created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY 
        action
      ORDER BY 
        action_count DESC
    `;
    
    const result = await db.query(query);
    return result.rows;
  },
  
  // Delete old activity logs (data retention policy)
  async deleteOldLogs(daysToRetain = 90) {
    const query = `
      DELETE FROM activity_logs
      WHERE created_at < NOW() - INTERVAL '${daysToRetain} days'
      RETURNING COUNT(*) as deleted_count
    `;
    
    const result = await db.query(query);
    return result.rows[0];
  }
};

module.exports = activityLogModel;