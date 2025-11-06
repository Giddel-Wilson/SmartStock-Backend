const db = require('../config/db');
const stockAlertModel = require('./stockAlertModel');
const inventoryLogModel = require('./inventoryLogModel');

const productModel = {
  // Create a new product
  async create(data) {
    const { name, sku, description, category_id, quantity, unit_price, low_stock_threshold, created_by } = data;
    
    const query = `
      INSERT INTO products (
        name, sku, description, category_id, quantity, 
        unit_price, low_stock_threshold, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, sku, description, category_id, quantity, unit_price, low_stock_threshold, created_at
    `;
    
    const values = [
      name, 
      sku, 
      description, 
      category_id, 
      quantity || 0, 
      unit_price, 
      low_stock_threshold || 10, 
      created_by
    ];
    
    const result = await db.query(query, values);
    const product = result.rows[0];
    
    // Create inventory log for initial stock
    if (quantity && quantity > 0) {
      await inventoryLogModel.create({
        product_id: product.id,
        user_id: created_by,
        change_type: 'restock',
        quantity_changed: quantity,
        old_quantity: 0,
        new_quantity: quantity,
        notes: 'Initial stock'
      });
    }
    
    // Check if low stock threshold is reached
    await this.checkLowStockThreshold(product.id);
    
    return product;
  },
  
  // Get product by ID
  async findById(id) {
    const query = `
      SELECT p.*, 
             c.name as category_name,
             u.name as created_by_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0];
  },
  
  // Get product by SKU
  async findBySku(sku) {
    const query = `
      SELECT p.*, 
             c.name as category_name,
             u.name as created_by_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.sku = $1
    `;
    
    const result = await db.query(query, [sku]);
    return result.rows[0];
  },
  
  // Get all products (with optional filters)
  async findAll(filters = {}) {
    let query = `
      SELECT p.*, 
             c.name as category_name,
             u.name as created_by_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1 = 1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    // Add filters if provided
    if (filters.category_id) {
      query += ` AND p.category_id = $${valueIndex++}`;
      values.push(filters.category_id);
    }
    
    if (filters.low_stock === true) {
      query += ` AND p.quantity <= p.low_stock_threshold`;
    }
    
    if (filters.search) {
      query += ` AND (p.name ILIKE $${valueIndex} OR p.sku ILIKE $${valueIndex} OR p.description ILIKE $${valueIndex})`;
      values.push(`%${filters.search}%`);
      valueIndex++;
    }
    
    // Add order by
    if (filters.sort_by && ['name', 'quantity', 'unit_price', 'created_at'].includes(filters.sort_by)) {
      const direction = filters.sort_direction === 'desc' ? 'DESC' : 'ASC';
      query += ` ORDER BY p.${filters.sort_by} ${direction}`;
    } else {
      query += ' ORDER BY p.name ASC';
    }
    
    const result = await db.query(query, values);
    return result.rows;
  },
  
  // Update product details
  async update(id, data, userId) {
    const { name, sku, description, category_id, unit_price, low_stock_threshold } = data;
    
    const query = `
      UPDATE products
      SET name = $1, 
          sku = $2, 
          description = $3, 
          category_id = $4,
          unit_price = $5,
          low_stock_threshold = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING id, name, sku, description, category_id, quantity, unit_price, low_stock_threshold
    `;
    
    const values = [name, sku, description, category_id, unit_price, low_stock_threshold, id];
    const result = await db.query(query, values);
    
    if (result.rows.length > 0) {
      // Check if low stock threshold is reached with updated threshold
      await this.checkLowStockThreshold(id);
    }
    
    return result.rows[0];
  },
  
  // Update product quantity
  async updateQuantity(id, quantityChange, userId, changeType = 'edit', notes = '') {
    // Begin transaction
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current product
      const productQuery = 'SELECT * FROM products WHERE id = $1 FOR UPDATE';
      const productResult = await client.query(productQuery, [id]);
      
      if (productResult.rows.length === 0) {
        throw new Error('Product not found');
      }
      
      const product = productResult.rows[0];
      const oldQuantity = product.quantity;
      let newQuantity = oldQuantity + quantityChange;
      
      // Prevent negative stock (except for returns)
      if (newQuantity < 0 && changeType !== 'return') {
        throw new Error('Cannot reduce stock below zero');
      }
      
      // Update product quantity
      const updateQuery = `
        UPDATE products 
        SET quantity = $1, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [newQuantity, id]);
      const updatedProduct = updateResult.rows[0];
      
      // Create inventory log
      const inventoryLogQuery = `
        INSERT INTO inventory_logs 
        (product_id, user_id, change_type, quantity_changed, old_quantity, new_quantity, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const inventoryLogValues = [
        id,
        userId,
        changeType,
        quantityChange,
        oldQuantity,
        newQuantity,
        notes
      ];
      
      await client.query(inventoryLogQuery, inventoryLogValues);
      
      // Check low stock threshold
      if (newQuantity <= product.low_stock_threshold) {
        const alertQuery = `
          INSERT INTO stock_alerts (product_id, threshold_reached, alert_sent, created_at)
          VALUES ($1, true, false, CURRENT_TIMESTAMP)
          ON CONFLICT (product_id) DO NOTHING
        `;
        
        await client.query(alertQuery, [id]);
      } else {
        // Clear any existing alerts
        await client.query('DELETE FROM stock_alerts WHERE product_id = $1', [id]);
      }
      
      await client.query('COMMIT');
      return updatedProduct;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  
  // Check if product is below low stock threshold
  async checkLowStockThreshold(productId) {
    const query = `
      SELECT * FROM products WHERE id = $1
    `;
    
    const result = await db.query(query, [productId]);
    if (result.rows.length === 0) {
      return false;
    }
    
    const product = result.rows[0];
    if (product.quantity <= product.low_stock_threshold) {
      await stockAlertModel.createAlert(productId);
      return true;
    }
    
    return false;
  },
  
  // Delete product
  async delete(id) {
    // Check if product has inventory logs
    const checkQuery = `
      SELECT COUNT(*) FROM inventory_logs WHERE product_id = $1
    `;
    
    const checkResult = await db.query(checkQuery, [id]);
    
    // If product has inventory movements, perform soft delete by setting quantity to 0
    if (parseInt(checkResult.rows[0].count) > 0) {
      const query = `
        UPDATE products
        SET quantity = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await db.query(query, [id]);
      return { id: result.rows[0].id, softDelete: true };
    } else {
      // Hard delete if no inventory logs
      const query = `
        DELETE FROM products WHERE id = $1
        RETURNING id
      `;
      
      const result = await db.query(query, [id]);
      return { id: result.rows[0].id, softDelete: false };
    }
  },
  
  // Get low stock products
  async getLowStockProducts() {
    const query = `
      SELECT p.*, 
             c.name as category_name,
             u.name as created_by_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.quantity <= p.low_stock_threshold
      ORDER BY p.quantity ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }
};

module.exports = productModel;