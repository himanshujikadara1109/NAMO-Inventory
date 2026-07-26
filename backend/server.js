/**
 * NAMO IMS — Express Server
 * Entry point: wires middleware, routes, WebSocket, and cron jobs.
 */

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const path       = require('path');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit  = require('express-rate-limit');
const { WebSocketServer } = require('ws');
const cron       = require('node-cron');
const fs         = require('fs');

const db         = require('./database/index');

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const dashboardRoutes     = require('./routes/dashboard');
const productRoutes       = require('./routes/products');
const orderRoutes         = require('./routes/orders');
const customerRoutes      = require('./routes/customers');
const userRoutes          = require('./routes/users');
const auditRoutes         = require('./routes/audit');
const notificationRoutes  = require('./routes/notifications');
const backupRoutes        = require('./routes/backups');
const settingsRoutes      = require('./routes/settings');
const chatRoutes          = require('./routes/chat');
const callRoutes          = require('./routes/calls');

const app  = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// ─── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
// Map companyId → Set of ws clients
const wsClients = new Map();

wss.on('connection', (ws, req) => {
  // Expect ?companyId=xxx on connect
  const url  = new URL(req.url, `http://localhost`);
  const cid  = url.searchParams.get('companyId');
  if (!cid) { ws.close(); return; }
  if (!wsClients.has(cid)) wsClients.set(cid, new Set());
  wsClients.get(cid).add(ws);

  ws.on('close', () => wsClients.get(cid)?.delete(ws));
  ws.on('error', () => wsClients.get(cid)?.delete(ws));
});

// Broadcast to all clients of a company
function broadcast(companyId, event, payload) {
  const clients = wsClients.get(companyId);
  if (!clients) return;
  const msg = JSON.stringify({ event, payload, ts: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

// Attach broadcast to app so routes can use it
app.set('broadcast', broadcast);

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: { error: 'Too many auth attempts, please try again later.' },
});

app.use(globalLimiter);

// ─── Static uploads ───────────────────────────────────────────────────────────
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, 'uploads'));
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/products',      productRoutes);
app.use('/api/orders',        orderRoutes);
app.use('/api/customers',     customerRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/backups',       backupRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/calls',         callRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ─── Cron: daily auto-backup at 2 AM ─────────────────────────────────────────
cron.schedule('0 2 * * *', () => {
  const companies = db.fileStore.listCompanies();
  for (const companyId of companies) {
    try {
      const backupDir = path.resolve(process.env.BACKUP_DIR || './backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const ts   = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = path.join(backupDir, `${companyId}_auto_${ts}.json`);
      const collections = ['orders', 'products', 'customers', 'users', 'settings'];
      const snapshot = {};
      for (const col of collections) {
        snapshot[col] = db.find(companyId, col);
      }
      fs.writeFileSync(dest, JSON.stringify(snapshot, null, 2));
      console.log(`[Cron] Auto-backup created: ${dest}`);
    } catch (e) {
      console.error('[Cron] Backup error for', companyId, e.message);
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀  NAMO IMS backend running on http://localhost:${PORT}`);
  console.log(`🔌  WebSocket ready`);
  console.log(`⏰  Auto-backup cron active (2 AM daily)\n`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[Shutdown] Received ${signal}, flushing DB...`);
  db.flushAll();
  server.close(() => {
    console.log('[Shutdown] Server closed. Goodbye!');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
