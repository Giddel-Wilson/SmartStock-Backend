const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkOrCreateAdmin() {
  const client = await pool.connect();
  
  try {
    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does not exist! The schema has not been applied.');
      console.log('Please run the schema.sql file to create the database structure.');
      return;
    }
    
    // Check if admin user exists
    const result = await client.query('SELECT * FROM users WHERE email = $1', ['admin@smartstock.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ Default admin user not found! Creating it now...');
      
      // Check if departments table exists and has at least one department
      const deptCheck = await client.query('SELECT * FROM departments LIMIT 1');
      
      if (deptCheck.rows.length === 0) {
        // Create default department
        await client.query(`
          INSERT INTO departments (name, description) 
          VALUES ('Management', 'Management department for system administrators')
        `);
        console.log('✅ Created default department');
      }
      
      // Hash the password
      const passwordHash = await bcrypt.hash('admin123', 10);
      
      // Create default admin user
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, department_id) 
        VALUES ('Admin User', 'admin@smartstock.com', $1, 'manager', 1)
      `, [passwordHash]);
      
      console.log('✅ Created default admin user');
      console.log('Email: admin@smartstock.com');
      console.log('Password: admin123');
    } else {
      console.log('✅ Default admin user exists!');
      console.log('Email: admin@smartstock.com');
      console.log('Password: admin123');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkOrCreateAdmin();
