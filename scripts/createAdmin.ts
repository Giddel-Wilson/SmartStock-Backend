import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Department from '../src/models/Department';

// Load environment variables
dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('DATABASE_URL is not defined in .env file');
      process.exit(1);
    }

    await mongoose.connect(dbUrl);
    console.log('Connected to MongoDB');

    // Create or get Management department
    let managementDept = await Department.findOne({ name: 'Management' });
    if (!managementDept) {
      managementDept = await Department.create({
        name: 'Management',
        description: 'Management department for system administrators'
      });
      console.log('✅ Management department created');
    } else {
      console.log('Management department already exists');
    }

    // Admin user details
    const adminEmail = 'admin@smartstock.com';
    const adminPassword = 'Admin@123456'; // You should change this after first login
    const adminName = 'System Administrator';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email:', adminEmail);
      await mongoose.connection.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const adminUser = new User({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      departmentId: managementDept._id,
      isActive: true,
      phone: '+1234567890'
    });

    await adminUser.save();

    console.log('✅ Admin user created successfully!');
    console.log('==================================');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Department:', managementDept.name);
    console.log('==================================');
    console.log('⚠️  IMPORTANT: Change the password after first login!');

    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
