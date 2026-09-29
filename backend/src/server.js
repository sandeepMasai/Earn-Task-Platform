const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV !== 'test') dotenv.config({ path: path.join(__dirname, '../.env') });

try {
  require('./config/production').validateProduction();
} catch (error) {
  if (require.main !== module) throw error;
  console.error('Backend startup failed: configuration error');
  process.exit(1);
}

// Import routes
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const walletRoutes = require('./routes/walletRoutes');
const postRoutes = require('./routes/postRoutes');
const referralRoutes = require('./routes/referralRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminTaskRoutes = require('./routes/adminTaskRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const storyRoutes = require('./routes/storyRoutes');
const followRoutes = require('./routes/followRoutes');

const app = express();
app.disable('x-powered-by');
// Render terminates TLS at one trusted reverse proxy. Never trust arbitrary hops.
app.set('trust proxy', process.env.RENDER === 'true' ? 1 : false);
app.use(require('./middleware/security').helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.locals.shuttingDown = false;
app.get('/health', (req, res) => res.json({ status: 'ok' }));
const readiness = async (req, res) => {
  try {
    if (app.locals.shuttingDown || mongoose.connection.readyState !== 1) throw new Error('Not ready');
    await mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 2000 });
    res.json({ status: 'ready', database: 'connected' });
  } catch { res.status(503).json({ status: 'not_ready', database: 'disconnected' }); }
};
app.get('/ready', readiness);


// Middleware
app.use(cors({
  origin: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean), // Native apps do not require browser CORS
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests


app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Log all requests
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') console.log(`${req.method} ${req.path}`);
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads')));

app.use('/api', require('./middleware/validateRequest').validateQuery);
const { rateLimit } = require('./middleware/security');
app.use(['/api/auth/login', '/api/auth/signup', '/api/auth/refresh'], rateLimit({ prefix: 'auth', limit: 30, windowMs: 60000 }));
app.use('/api', rateLimit({ prefix: 'api', limit: 600, windowMs: 60000 }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/tasks', adminTaskRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/media', require('./routes/mediaRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable', database: connected ? 'connected' : 'disconnected' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: 'File exceeds the configured upload size limit' });
  if (err.name === 'MulterError') return res.status(400).json({ success: false, error: err.message });
  return require('./utils/errorResponse')(res, err);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

module.exports = app;

if (require.main === module) {
  const connectDB = require('./config/database');
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  let startupCategory = 'database connection error';
  connectDB().then(async () => {
    startupCategory = 'index initialization error';
    // Finish declared indexes before accepting traffic; never drop existing indexes.
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    startupCategory = 'HTTP initialization error';
    const server = app.listen(PORT, HOST);
    server.requestTimeout = 120000;
    server.headersTimeout = 15000;
    server.on('shutdown', () => { app.locals.shuttingDown = true; });
    require('./utils/lifecycle').installShutdown(server);
  }).catch((error) => {
    const category = error.startupCategory === 'configuration error' ? 'configuration error' : startupCategory;
    console.error(`Backend startup failed: ${category}`);
    mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
