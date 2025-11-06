const db = require('../config/db');
const bcrypt = require('bcrypt');

const userModel = {
  // Create a new user
  async create(userData) {
    const { name, email, password, role, department_id } = userData;
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const query = `
      INSERT INTO users (name, email, password_hash, role, department_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, department_id, created_at
    `;
    
    const values = [name, email, passwordHash, role || 'staff', department_id];
    const result = await db.query(query, values);
    return result.rows[0];
  },
  
  // Find user by email
  async findByEmail(email) {
    const query = `
      SELECT u.*, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.email = $1
    `;
    const result = await db.query(query, [email]);
    return result.rows[0];
  },
  
  // Find user by ID
  async findById(id) {
    const query = `
      SELECT u.*, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },
  
  // Get all users (with optional filter by role or department)
  async findAll(filters = {}) {
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.is_active, 
             u.created_at, u.department_id, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1 = 1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    // Add filters if provided
    if (filters.role) {
      query += ` AND u.role = $${valueIndex++}`;
      values.push(filters.role);
    }
    
    if (filters.department_id) {
      query += ` AND u.department_id = $${valueIndex++}`;
      values.push(filters.department_id);
    }
    
    if (filters.is_active !== undefined) {
      query += ` AND u.is_active = $${valueIndex++}`;
      values.push(filters.is_active);
    }
    
    query += ' ORDER BY u.created_at DESC';
    
    const result = await db.query(query, values);
    return result.rows;
  },
  
  // Update user
  async update(id, userData) {
    const { name, email, role, department_id, is_active } = userData;
    
    let query = `
      UPDATE users
      SET name = $1, 
          email = $2, 
          role = $3, 
          department_id = $4,
          is_active = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, name, email, role, department_id, is_active, updated_at
    `;
    
    const values = [name, email, role, department_id, is_active, id];
    const result = await db.query(query, values);
    return result.rows[0];
  },
  
  // Update password
  async updatePassword(id, newPassword) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    const query = `
      UPDATE users
      SET password_hash = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
    `;
    
    const result = await db.query(query, [passwordHash, id]);
    return result.rows[0];
  },
  
  // Delete user (soft delete by setting is_active to false)
  async delete(id) {
    const query = `
      UPDATE users
      SET is_active = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  },
  
  // Verify password
  async verifyPassword(plainPassword, passwordHash) {
    return await bcrypt.compare(plainPassword, passwordHash);
  }
};

module.exports = userModel;