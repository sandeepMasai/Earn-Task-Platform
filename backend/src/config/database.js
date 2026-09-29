const mongoose = require('mongoose');
const configurationError = message => Object.assign(new Error(message), { startupCategory: 'configuration error' });

module.exports = async function connectDB() {
  if (!process.env.JWT_SECRET) throw configurationError('JWT_SECRET must be configured');
  if (!process.env.MONGODB_URI) throw configurationError('MONGODB_URI must be configured');
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') {
      await mongoose.disconnect();
      throw configurationError('MongoDB must be a replica set (or Atlas) for atomic wallet operations');
    }
  } catch (error) {
    const category = error.startupCategory === 'configuration error' || ['MongoParseError', 'MongoInvalidArgumentError'].includes(error.name)
      ? 'configuration error' : 'database connection error';
    // Do not propagate driver messages, connection strings, or nested causes.
    throw Object.assign(new Error(category), { startupCategory: category });
  }
  require('./runtimeIdentity').logRuntimeIdentity(process.env, mongoose.connection.name);
};
