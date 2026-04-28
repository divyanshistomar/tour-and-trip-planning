// middleware/authMiddleware.js
// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
//
// COOKIES vs SESSIONS — Key Difference:
// ──────────────────────────────────────
// COOKIE:
//   - Small piece of data stored IN THE BROWSER (client-side)
//   - Sent automatically with every request to the same domain
//   - Can store data directly (dangerous if sensitive)
//   - Max size: ~4KB
//   - Example: JWT token stored in a cookie (stateless auth)
//
// SESSION:
//   - Session ID stored in the browser cookie
//   - Actual data stored on the SERVER (in memory, Redis, MongoDB)
//   - Browser only holds the session ID (not the data itself)
//   - More secure — attacker can't read data from cookie alone
//   - Example: express-session stores { userId, cart } in MongoDB
//
// HOW THEY WORK TOGETHER HERE:
//   1. User logs in → session created in MongoDB → session ID in cookie
//   2. Next request → browser sends cookie with session ID
//   3. Server reads session ID → fetches session from MongoDB
//   4. Session has userId → deserializeUser fetches req.user from DB
//
// JWT vs SESSION (Two strategies, both implemented):
// ──────────────────────────────────────────────────
// SESSION AUTH (Passport + express-session):
//   ✓ Server controls login state — can revoke instantly
//   ✓ No sensitive data in cookie
//   ✗ Requires server-side storage (DB/Redis)
//   ✗ Doesn't scale easily across multiple servers without shared store
//
// JWT AUTH (JSON Web Token):
//   ✓ Stateless — server doesn't store anything
//   ✓ Scales easily (any server can verify the token)
//   ✗ Can't revoke until expiry (unless you maintain a blacklist)
//   ✗ Token can be stolen if stored insecurely (localStorage)
//   Token format: header.payload.signature (base64 encoded)
//
// WE USE BOTH:
//   - Session for EJS (browser) routes (Passport handles it)
//   - JWT for API routes (mobile apps, Postman, third-party clients)
// ═══════════════════════════════════════════════════════════════

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── JWT SECRET ────────────────────────────────────────────────────
// In production this should be a long random string in .env
// e.g. JWT_SECRET=openssl rand -hex 64
const JWT_SECRET  = process.env.JWT_SECRET  || 'india-trip-jwt-secret-change-in-prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'; // token valid for 7 days

// ── Helper: Sign a JWT ────────────────────────────────────────────
//
// jwt.sign(payload, secret, options) creates a token with:
//   payload  = data embedded in the token (userId, role)
//   secret   = used to create the signature (proves server made it)
//   expiresIn = token auto-expires (prevents forever-valid tokens)
//
// Token structure: base64(header).base64(payload).HMAC_SHA256(signature)
//
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role }, // payload
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
};

// ── Middleware: requireLogin (Session-based) ──────────────────────
//
// Used to protect EJS/browser routes.
// Passport sets req.isAuthenticated() after a successful login.
// If not logged in → redirect to /auth/login with a flash message.
//
const requireLogin = (req, res, next) => {
  if (req.isAuthenticated()) {
    // req.user is available (set by Passport's deserializeUser)
    return next(); // allow the request through
  }

  // Store the attempted URL so we can redirect AFTER login
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
};

// ── Middleware: requireAdmin (Session-based) ──────────────────────
//
// Works after requireLogin — checks if the user has admin role.
// Role-based access control (RBAC).
//
const requireAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).render('ejs/error', {
    title:   'Access Denied',
    message: 'Admin access required.',
    activePage: '',
  });
};

// ── Middleware: verifyJWT (Token-based for API routes) ────────────
//
// Reads the JWT from the Authorization header:
//   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
//
// jwt.verify(token, secret):
//   ✓ Validates the signature (server-made = trustworthy)
//   ✓ Checks expiry (exp claim)
//   ✓ Returns the decoded payload
//   ✗ Throws if invalid/expired
//
const verifyJWT = async (req, res, next) => {
  try {
    // Extract token from "Bearer <token>" header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // get just the token part

    // Verify and decode — throws if expired or tampered
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch fresh user from DB (ensures account still exists/not banned)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = user; // attach user to request for route handler
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ── Middleware: optionalAuth ──────────────────────────────────────
//
// Used for routes that SHOW different content based on auth state
// but don't REQUIRE login. Example: homepage shows "Login" or "Hi, User".
//
const optionalAuth = (req, res, next) => {
  // req.isAuthenticated() is always available (returns false if not logged in)
  // Just let it through — route handler checks req.isAuthenticated() itself
  next();
};

module.exports = { signToken, requireLogin, requireAdmin, verifyJWT, optionalAuth };
