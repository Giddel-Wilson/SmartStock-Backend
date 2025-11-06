const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  let client;
  
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    
    // Check if the users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️ Database tables do not exist. Creating schema...');
      const schemaPath = path.join(__dirname, '../db/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
      console.log('✅ Schema created successfully!');
    } else {
      console.log('✅ Database tables already exist.');
    }
    
    // Check if admin user exists
    const userCheck = await client.query(`
      SELECT * FROM users WHERE email = 'admin@smartstock.com'
    `);
    
    if (userCheck.rows.length === 0) {
      console.log('⚠️ Admin user does not exist. Creating admin user...');
      
      // Check if departments table has at least one entry
      const deptCheck = await client.query(`SELECT * FROM departments LIMIT 1`);
      
      if (deptCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO departments (name, description) 
          VALUES ('Management', 'Management department for system administrators')
        `);
        console.log('✅ Created default department');
      }
      
      // Create a new admin user with a simple password
      const plainPassword = 'admin123';
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, department_id) 
        VALUES ('Admin User', 'admin@smartstock.com', $1, 'manager', 1)
      `, [passwordHash]);
      
      console.log('✅ Created admin user:');
      console.log('   Email: admin@smartstock.com');
      console.log('   Password: admin123');
    } else {
      console.log('✅ Admin user exists.');
      console.log('Resetting admin password to a known value...');
      
      // Update the admin password to ensure it's what we expect
      const plainPassword = 'admin123';
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      
      await client.query(`
        UPDATE users SET password_hash = $1 WHERE email = 'admin@smartstock.com'
      `, [passwordHash]);
      
      console.log('✅ Admin password reset to:');
      console.log('   Email: admin@smartstock.com');
      console.log('   Password: admin123');
    }
    
    console.log('✅ Database setup complete!');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

initDatabase();
