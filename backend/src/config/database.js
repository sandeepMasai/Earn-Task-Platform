const mongoose = require('mongoose');

module.exports = async function connectDB() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/earn-task-platform', {
    serverSelectionTimeoutMS: 10000,
  });
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('MongoDB must be a replica set (or Atlas) for atomic wallet operations');
  }
  console.log('MongoDB connected');
};
