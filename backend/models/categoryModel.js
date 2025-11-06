const db = require('../config/db');

const categoryModel = {
  // Create a new category
  async create(data) {
    const { name, description, created_by } = data;
    
    const query = `
      INSERT INTO categories (name, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, created_at
    `;
    
    const result = await db.query(query, [name, description, created_by]);
    return result.rows[0];
  },
  
  // Find category by ID
  async findById(id) {
    const query = `
      SELECT c.*, u.name as created_by_name
      FROM categories c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0];
  },
  
  // Get all categories
  async findAll() {
    const query = `
      SELECT c.*, 
             u.name as created_by_name,
             (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count
      FROM categories c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.name ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  },
  
  // Update category
  async update(id, data) {
    const { name, description } = data;
    
    const query = `
      UPDATE categories
      SET name = $1, description = $2
      WHERE id = $3
      RETURNING id, name, description
    `;
    
    const result = await db.query(query, [name, description, id]);
    return result.rows[0];
  },
  
  // Delete category (only if no products are assigned to it)
  async delete(id) {
    // Check if category has products
    const checkQuery = `
      SELECT COUNT(*) FROM products WHERE category_id = $1
    `;
    
    const checkResult = await db.query(checkQuery, [id]);
    if (parseInt(checkResult.rows[0].count) > 0) {
      throw new Error('Cannot delete category with assigned products');
    }
    
    // Delete category
    const deleteQuery = `
      DELETE FROM categories WHERE id = $1
      RETURNING id
    `;
    
    const result = await db.query(deleteQuery, [id]);
    return result.rowCount > 0;
  }
};

module.exports = categoryModel;