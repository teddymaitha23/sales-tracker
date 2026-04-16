// server.js — Express entry point
// Initialises the database BEFORE starting the HTTP server.

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const { initDB } = require('./database/db');

const salesRoutes     = require('./routes/sales');
const analyticsRoutes = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'https://YOUR-APP.vercel.app',  // hardcode as backup
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status:'ok', service:'Sales Tracker API', version:'1.0.0', time: new Date().toISOString() });
});

app.use('/sales',     salesRoutes);
app.use('/analytics', analyticsRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success:false, message:`${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`\n🚀  Sales Tracker API  →  http://localhost:${PORT}`);
      console.log(`🩺  Health check       →  http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
})();

module.exports = app;
