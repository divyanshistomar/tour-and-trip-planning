// routes/chatRoutes.js
// ═══════════════════════════════════════════════════════════════
// SOCKET.IO REAL-TIME CHAT ROUTES
//
// This file handles the HTTP route for the chat page.
// The actual Socket.io event handlers live in server.js
// (because Socket.io needs the `io` instance from there).
//
// WHAT IS SOCKET.IO?
//   Regular HTTP: client asks → server responds → connection closes.
//   WebSocket:    persistent two-way connection stays open.
//   Socket.io:    WebSocket with fallback to long-polling + extras:
//     - Rooms (group users together)
//     - Namespaces (separate channels on same server)
//     - Auto-reconnect
//     - Broadcast to all or specific sockets
//
// REAL-TIME USE CASES IN THIS APP:
//   1. Live group chat between travelers
//   2. Live tour booking notifications (admin dashboard)
//   3. Live user count (how many people are online)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const { requireLogin } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────
// GET /chat  — Protected chat room page
// ─────────────────────────────────────────────────────────────────
// requireLogin ensures only authenticated users can join the chat.
// req.user is set by Passport (session auth).
router.get('/', requireLogin, (req, res) => {
  res.render('ejs/chat', {
    title:    'Live Traveler Chat',
    user:     req.user,
    activePage: 'chat',
  });
});

module.exports = router;
