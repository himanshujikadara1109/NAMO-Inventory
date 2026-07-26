/**
 * NAMO IMS — Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * POST /api/auth/refresh
 * GET  /api/auth/me
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const useragent = require('useragent');
const db       = require('../database/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET         = process.env.JWT_SECRET         || 'namo_ims_jwt_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'namo_ims_refresh_secret';
const JWT_EXPIRES_IN     = process.env.JWT_EXPIRES_IN     || '24h';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function issueTokens(user, companyId, deviceId) {
  const payload = {
    userId:    user.id,
    companyId,
    role:      user.role,
    name:      user.name,
    deviceId,
  };
  const accessToken  = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ userId: user.id, companyId, deviceId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ─── POST /register ───────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { companyName, adminName, email, password } = req.body;

    if (!companyName || !adminName || !email || !password) {
      return res.status(400).json({ error: 'All fields required: companyName, adminName, email, password' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Generate companyId from slug
    const slug      = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const companyId = `${slug}-${uuidv4().slice(0, 8)}`;

    // Ensure email not already used globally (check all companies is expensive, skip for now)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create company record
    const company = db.insert(companyId, 'companies', {
      name:  companyName,
      slug,
      email,
      companyId,
    });

    // Create admin user
    const user = db.insert(companyId, 'users', {
      name:         adminName,
      email:        email.toLowerCase().trim(),
      passwordHash,
      role:         'admin',
      companyId,
      active:       true,
    });

    // Default settings
    db.insert(companyId, 'settings', {
      companyId,
      companyName,
      currency:   'INR',
      currencySymbol: '₹',
      taxRate:    18,
      taxLabel:   'GST',
      address:    '',
      phone:      '',
      logo:       '',
    });

    const deviceId = uuidv4();
    const { accessToken, refreshToken } = issueTokens(user, companyId, deviceId);

    // Store session
    db.insert(companyId, 'sessions', {
      userId:       user.id,
      companyId,
      deviceId,
      refreshToken,
      userAgent:    req.headers['user-agent'] || '',
      ip:           req.ip,
      expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      accessToken,
      user: sanitizeUser(user),
      company,
    });
  } catch (err) {
    console.error('[Auth/register]', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, companyId } = req.body;

    if (!email || !password || !companyId) {
      return res.status(400).json({ error: 'email, password, and companyId are required' });
    }

    const user = db.findOne(companyId, 'users', { email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.active) return res.status(403).json({ error: 'Account disabled' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const deviceId = uuidv4();
    const { accessToken, refreshToken } = issueTokens(user, companyId, deviceId);

    // Store session
    db.insert(companyId, 'sessions', {
      userId:       user.id,
      companyId,
      deviceId,
      refreshToken,
      userAgent:    req.headers['user-agent'] || '',
      ip:           req.ip,
      expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('[Auth/login]', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /refresh ────────────────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    const payload = jwt.verify(token, JWT_REFRESH_SECRET);
    const { userId, companyId, deviceId } = payload;

    const session = db.findOne(companyId, 'sessions', { userId, deviceId });
    if (!session || session.refreshToken !== token) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = db.findById(companyId, 'users', userId);
    if (!user || !user.active) return res.status(401).json({ error: 'User not found' });

    const { accessToken, refreshToken: newRefreshToken } = issueTokens(user, companyId, deviceId);

    // Update session with new refresh token
    db.update(companyId, 'sessions', session.id, { refreshToken: newRefreshToken });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── POST /logout ─────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  try {
    const session = db.findOne(req.companyId, 'sessions', {
      userId:   req.user.id,
      deviceId: req.deviceId,
    });
    if (session) db.delete(req.companyId, 'sessions', session.id);

    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── GET /me ──────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.findById(req.companyId, 'users', req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const company = db.findOne(req.companyId, 'companies', { companyId: req.companyId });
  return res.json({ user: sanitizeUser(user), company });
});

module.exports = router;
