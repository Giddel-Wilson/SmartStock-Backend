const db = require('../config/db');

const departmentModel = {
  // Create a new department
  async create(data) {
    const { name, description } = data;
    
    const query = `
      INSERT INTO departments (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description, created_at
    `;
    
    const result = await db.query(query, [name, description]);
    return result.rows[0];
  },
  
  // Get department by ID
  async findById(id) {
    const query = `
      SELECT * FROM departments WHERE id = $1
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0];
  },
  
  // Get all departments
  async findAll() {
    const query = `
      SELECT d.*, 
             (SELECT COUNT(*) FROM users WHERE department_id = d.id) as user_count
      FROM departments d
      ORDER BY d.name ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  },
  
  // Update department
  async update(id, data) {
    const { name, description } = data;
    
    const query = `
      UPDATE departments
      SET name = $1, description = $2
      WHERE id = $3
      RETURNING id, name, description
    `;
    
    const result = await db.query(query, [name, description, id]);
    return result.rows[0];
  },
  
  // Delete department (only if no users are assigned to it)
  async delete(id) {
    // Check if department has users
    const checkQuery = `
      SELECT COUNT(*) FROM users WHERE department_id = $1
    `;
    
    const checkResult = await db.query(checkQuery, [id]);
    if (parseInt(checkResult.rows[0].count) > 0) {
      throw new Error('Cannot delete department with assigned users');
    }
    
    // Delete department
    const deleteQuery = `
      DELETE FROM departments WHERE id = $1
      RETURNING id
    `;
    
    const result = await db.query(deleteQuery, [id]);
    return result.rowCount > 0;
  }
};

module.exports = departmentModel;