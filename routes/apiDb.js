// routes/apiDb.js
// ─────────────────────────────────────────────────────────────────
// MongoDB-backed API routes (v4)
//
// These routes demonstrate reading/writing to MongoDB via Mongoose.
// The old /api routes still work from JSON files (routes/api.js).
//
// ROUTES:
//   GET  /api/db/users       → list all users (admin use, no passwords)
//   GET  /api/db/users/:id   → get single user by MongoDB _id
//   GET  /api/db/status      → database connection status
// ─────────────────────────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const User     = require('../models/User');
const { verifyJWT, requireAdmin } = require('../middleware/authMiddleware');

// ── GET /api/db/status — DB connection health check ───────────────
router.get('/status', (req, res) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.json({
    success:  true,
    database: states[mongoose.connection.readyState] || 'unknown',
    host:     mongoose.connection.host || 'N/A',
    name:     mongoose.connection.name || 'N/A',
  });
});

// ── GET /api/db/users — List all users (JWT protected) ───────────
//
// Returns user list without passwords.
// Protected by verifyJWT — caller must send: Authorization: Bearer <token>
//
router.get('/users', verifyJWT, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      count:   users.length,
      data:    users,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/db/users/:id — Get single user (JWT protected) ──────
router.get('/users/:id', verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    // Handle invalid MongoDB ObjectId
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid user ID format' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
