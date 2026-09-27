const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/earn-task-platform');
    console.log('✅ Connected to MongoDB');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@earntask.com';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || adminPassword.length < 12) throw new Error('Set ADMIN_PASSWORD to at least 12 characters');

    // Check if admin exists
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      // Update existing user to admin
      admin.role = 'admin';
      admin.password = adminPassword; // Will be hashed by pre-save hook
      await admin.save();
      console.log('✅ Admin user updated:', adminEmail);
    } else {
      // Create new admin
      admin = await User.create({
        email: adminEmail,
        password: adminPassword,
        name: 'Admin User',
        username: 'admin',
        role: 'admin',
      });
      console.log('✅ Admin user created:', adminEmail);
    }

    console.log('📝 Admin credentials:');
    console.log('   Email:', adminEmail);

    console.log('   Role:', admin.role);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', { code: error.code || error.name });
    process.exit(1);
  }
};

createAdmin();

