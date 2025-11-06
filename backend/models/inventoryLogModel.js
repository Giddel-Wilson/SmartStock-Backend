const db = require('../config/db');

const inventoryLogModel = {
  // Create a new inventory log entry
  async create(data) {
    const { 
      product_id, 
      user_id, 
      change_type, 
      quantity_changed, 
      old_quantity, 
      new_quantity, 
      notes 
    } = data;
    
    const query = `
      INSERT INTO inventory_logs (
        product_id, user_id, change_type, 
        quantity_changed, old_quantity, new_quantity, 
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      product_id,
      user_id,
      change_type,
      quantity_changed,
      old_quantity,
      new_quantity,
      notes
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  },
  
  // Get inventory log by ID
  async findById(id) {
    const query = `
      SELECT il.*,
             p.name as product_name,
             p.sku as product_sku,
             u.name as user_name
      FROM inventory_logs il
      LEFT JOIN products p ON il.product_id = p.id
      LEFT JOIN users u ON il.user_id = u.id
      WHERE il.id = $1
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0];
  },
  
  // Get inventory logs by product ID
  async findByProductId(productId, limit = 100) {
    const query = `
      SELECT il.*,
             p.name as product_name,
             p.sku as product_sku,
             u.name as user_name
      FROM inventory_logs il
      LEFT JOIN products p ON il.product_id = p.id
      LEFT JOIN users u ON il.user_id = u.id
      WHERE il.product_id = $1
      ORDER BY il.transaction_date DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [productId, limit]);
    return result.rows;
  },
  
  // Get all inventory logs with filters
  async findAll(filters = {}) {
    let query = `
      SELECT il.*,
             p.name as product_name,
             p.sku as product_sku,
             u.name as user_name
      FROM inventory_logs il
      LEFT JOIN products p ON il.product_id = p.id
      LEFT JOIN users u ON il.user_id = u.id
      WHERE 1 = 1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    // Add filters if provided
    if (filters.product_id) {
      query += ` AND il.product_id = $${valueIndex++}`;
      values.push(filters.product_id);
    }
    
    if (filters.user_id) {
      query += ` AND il.user_id = $${valueIndex++}`;
      values.push(filters.user_id);
    }
    
    if (filters.change_type) {
      query += ` AND il.change_type = $${valueIndex++}`;
      values.push(filters.change_type);
    }
    
    if (filters.start_date) {
      query += ` AND il.transaction_date >= $${valueIndex++}`;
      values.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND il.transaction_date <= $${valueIndex++}`;
      values.push(filters.end_date);
    }
    
    // Add pagination
    query += ' ORDER BY il.transaction_date DESC';
    
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
  
  // Get summary of inventory movements by product
  async getProductMovementSummary(days = 30) {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        SUM(CASE WHEN il.change_type = 'restock' THEN il.quantity_changed ELSE 0 END) as total_restocked,
        SUM(CASE WHEN il.change_type = 'sale' THEN ABS(il.quantity_changed) ELSE 0 END) as total_sold,
        COUNT(il.id) as total_transactions
      FROM 
        products p
      LEFT JOIN 
        inventory_logs il ON p.id = il.product_id
      WHERE 
        il.transaction_date >= NOW() - INTERVAL '${days} days'
      GROUP BY 
        p.id, p.name, p.sku
      ORDER BY 
        total_transactions DESC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }
};

module.exports = inventoryLogModel;