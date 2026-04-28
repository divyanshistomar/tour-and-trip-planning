// routes/authRoutes.js
// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION ROUTES
//
// ROUTES IN THIS FILE:
//   GET  /auth/login    → render login form
//   POST /auth/login    → Passport local auth → set session → redirect
//   GET  /auth/signup   → render signup form
//   POST /auth/signup   → create user, hash password, login → redirect
//   GET  /auth/logout   → destroy session → redirect
//   GET  /auth/profile  → protected page (requireLogin middleware)
//   POST /auth/api/login  → JWT login (for API clients / Postman)
//   GET  /auth/api/me     → JWT-protected route (returns user JSON)
//
// SESSION vs JWT here:
//   Browser users → use session (Passport handles cookie automatically)
//   API clients   → use JWT (stateless, sent in Authorization header)
// ═══════════════════════════════════════════════════════════════

const express  = require('express');
const router   = express.Router();
const passport = require('passport');
const User     = require('../models/User');
const { signToken, requireLogin, verifyJWT } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────
// GET /auth/login  — Show login form
// ─────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  // If already logged in, redirect to profile
  if (req.isAuthenticated()) return res.redirect('/auth/profile');

  // req.session.flash is set by failed login attempts below
  res.render('ejs/auth/login', {
    title:    'Login',
    error:    req.session.flash?.error?.[0] || null,
    activePage: 'login',
  });
  // Clear flash after reading it (one-time message)
  delete req.session.flash;
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/login  — Process login form (Passport local strategy)
// ─────────────────────────────────────────────────────────────────
//
// passport.authenticate('local', options) does:
//   1. Reads req.body.email and req.body.password
//   2. Calls our LocalStrategy verify function (config/passport.js)
//   3. On success: calls req.logIn() → runs serializeUser → sets cookie
//   4. On failure: redirects to failureRedirect with flash message
//
// WHY SESSION REGENERATION MATTERS (Security):
//   After login, Express regenerates the session ID to prevent
//   Session Fixation attacks (attacker plants a known session ID,
//   then waits for victim to login to hijack it).
//
router.post('/login',
  passport.authenticate('local', {
    failureRedirect: '/auth/login',
    failureFlash:    true,         // enables req.flash() on failure
  }),
  (req, res) => {
    // ↑ This callback only runs on SUCCESS (Passport already set req.user)
    //
    // COOKIE created: session ID stored in browser as 'connect.sid'
    // SESSION data stored in MongoDB: { userId: req.user.id, ... }

    // Redirect to where they were trying to go, or /auth/profile
    const returnTo = req.session.returnTo || '/auth/profile';
    delete req.session.returnTo; // clean up
    res.redirect(returnTo);
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /auth/signup  — Show signup form
// ─────────────────────────────────────────────────────────────────
router.get('/signup', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/auth/profile');

  res.render('ejs/auth/signup', {
    title:    'Sign Up',
    error:    req.session.flash?.error?.[0] || null,
    activePage: 'signup',
  });
  delete req.session.flash;
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/signup  — Create new user account
// ─────────────────────────────────────────────────────────────────
//
// FLOW:
//   1. Validate input
//   2. Check email not already taken
//   3. new User({ ... }) → pre-save hook bcrypt-hashes the password
//   4. user.save() → stores hashed password in MongoDB
//   5. passport.login(user) → creates session → sets cookie
//   6. Redirect to profile
//
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // ── Input validation ──
    if (!name || !email || !password) {
      req.session.flash = { error: ['All fields are required'] };
      return res.redirect('/auth/signup');
    }

    if (password !== confirmPassword) {
      req.session.flash = { error: ['Passwords do not match'] };
      return res.redirect('/auth/signup');
    }

    if (password.length < 6) {
      req.session.flash = { error: ['Password must be at least 6 characters'] };
      return res.redirect('/auth/signup');
    }

    // ── Check for existing account ──
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      req.session.flash = { error: ['Email already in use'] };
      return res.redirect('/auth/signup');
    }

    // ── Create user (password hashed by pre-save hook in User model) ──
    const user = await User.create({ name, email, password });

    // ── Log the new user in immediately (creates session + cookie) ──
    req.login(user, (err) => {
      if (err) throw err;
      res.redirect('/auth/profile');
    });

  } catch (err) {
    console.error('[AUTH] Signup error:', err.message);
    req.session.flash = { error: ['Something went wrong. Please try again.'] };
    res.redirect('/auth/signup');
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/logout  — Destroy session
// ─────────────────────────────────────────────────────────────────
//
// req.logout() clears req.user and removes session from store.
// req.session.destroy() ensures the session cookie is invalidated.
//
// SECURITY: Always clear the session on logout to prevent
// session re-use if someone has the old cookie.
//
router.get('/logout', (req, res) => {
  req.logout((err) => {  // Passport 0.6+ requires a callback
    if (err) console.error('[AUTH] Logout error:', err);
    req.session.destroy(() => {
      // Clear the session cookie from the browser
      res.clearCookie('connect.sid');
      res.redirect('/auth/login');
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/profile  — Protected profile page
// ─────────────────────────────────────────────────────────────────
//
// requireLogin middleware runs first:
//   ✓ Authenticated → next() → reach this handler → render profile
//   ✗ Not authenticated → redirect to /auth/login
//
router.get('/profile', requireLogin, (req, res) => {
  res.render('ejs/auth/profile', {
    title:    'My Profile',
    user:     req.user,  // set by Passport's deserializeUser
    activePage: 'profile',
  });
});

// ═════════════════════════════════════════════════════════════════
// JWT API ROUTES  (for API clients: Postman, React frontend, etc.)
// ═════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// POST /auth/api/login  — JWT login (returns token in JSON)
// ─────────────────────────────────────────────────────────────────
//
// Client sends: { email, password }
// Server returns: { token: 'eyJ...' }
// Client stores token and sends it as: Authorization: Bearer <token>
//
router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user (re-add password field since toJSON strips it)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password using bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign a JWT with user info in the payload
    const token = signToken(user);

    // Return token — client stores this and sends in every future request
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/api/me  — JWT-protected: returns current user data
// ─────────────────────────────────────────────────────────────────
//
// verifyJWT middleware: reads Authorization header, verifies token,
// sets req.user. If token invalid → 401 response (no route reached).
//
router.get('/api/me', verifyJWT, (req, res) => {
  // req.user set by verifyJWT middleware
  res.json({ user: req.user });
});

module.exports = router;
