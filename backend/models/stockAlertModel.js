const db = require('../config/db');

const stockAlertModel = {
  // Create a new stock alert
  async createAlert(productId) {
    try {
      const query = `
        INSERT INTO stock_alerts (product_id, threshold_reached, alert_sent, created_at)
        VALUES ($1, true, false, CURRENT_TIMESTAMP)
        ON CONFLICT (product_id) DO NOTHING
        RETURNING *
      `;
      
      const result = await db.query(query, [productId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating stock alert:', error);
      throw error;
    }
  },
  
  // Get unsent alerts
  async getUnsentAlerts() {
    const query = `
      SELECT sa.*, 
             p.name as product_name, 
             p.sku as product_sku,
             p.quantity,
             p.low_stock_threshold
      FROM stock_alerts sa
      JOIN products p ON sa.product_id = p.id
      WHERE sa.alert_sent = false
      ORDER BY sa.created_at ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  },
  
  // Mark alert as sent
  async markAsSent(alertId) {
    const query = `
      UPDATE stock_alerts
      SET alert_sent = true, sent_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [alertId]);
    return result.rows[0];
  },
  
  // Get all alerts with filters
  async findAll(filters = {}) {
    let query = `
      SELECT sa.*, 
             p.name as product_name, 
             p.sku as product_sku,
             p.quantity,
             p.low_stock_threshold,
             c.name as category_name
      FROM stock_alerts sa
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1 = 1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    // Add filters if provided
    if (filters.product_id) {
      query += ` AND sa.product_id = $${valueIndex++}`;
      values.push(filters.product_id);
    }
    
    if (filters.alert_sent !== undefined) {
      query += ` AND sa.alert_sent = $${valueIndex++}`;
      values.push(filters.alert_sent);
    }
    
    if (filters.category_id) {
      query += ` AND p.category_id = $${valueIndex++}`;
      values.push(filters.category_id);
    }
    
    // Add order by and limit
    query += ' ORDER BY sa.created_at DESC';
    
    if (filters.limit) {
      query += ` LIMIT $${valueIndex++}`;
      values.push(filters.limit);
    }
    
    if (filters.offset) {
      query += ` OFFSET $${valueIndex++}`;
      values.push(filters.offset);
    }
    
    const result = await db.query(query, values);
    return result.rows;
  },
  
  // Delete alert
  async delete(id) {
    const query = `
      DELETE FROM stock_alerts
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  },
  
  // Clear alerts for a product
  async clearAlertsForProduct(productId) {
    const query = `
      DELETE FROM stock_alerts
      WHERE product_id = $1
      RETURNING id
    `;
    
    const result = await db.query(query, [productId]);
    return result.rowCount;
  }
};

module.exports = stockAlertModel;