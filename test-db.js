const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function testDB() {
    try {
        console.log('Testing database connection...');
        const client = await pool.connect();
        console.log('✅ Database connection successful');
        
        const result = await client.query('SELECT NOW()');
        console.log('Current time from DB:', result.rows[0].now);
        
        client.release();
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
}

testDB();
