// config/passport.js
// ═══════════════════════════════════════════════════════════════
// PASSPORT.JS — LOCAL STRATEGY CONFIGURATION
//
// WHAT IS PASSPORT.JS?
//   Passport is an authentication middleware for Node/Express.
//   It supports 500+ "strategies" (ways to authenticate):
//     - Local (username + password) ← what we use here
//     - Google OAuth
//     - Facebook OAuth
//     - JWT, GitHub, Twitter, etc.
//
// HOW THE LOCAL STRATEGY WORKS:
//   1. User submits login form (email + password)
//   2. Passport intercepts via passport.authenticate('local')
//   3. Our verify function below runs:
//      a. Find user by email in DB
//      b. Call user.comparePassword(plainPassword)
//      c. If match → done(null, user)  → req.user is set
//      d. If fail  → done(null, false, { message })
//   4. Passport calls serializeUser to store user id in SESSION
//   5. On subsequent requests, deserializeUser loads user from DB
//
// SERIALIZE vs DESERIALIZE:
//   serializeUser:   runs ONCE at login — saves user.id to session
//                    session store holds only: { userId: '64abc...' }
//   deserializeUser: runs on EVERY protected request — fetches full
//                    user doc from DB using the stored id, sets req.user
//
// SESSION FLOW:
//   Login → serializeUser → session cookie sent to browser
//   Next request → cookie sent back → deserializeUser → req.user populated
// ═══════════════════════════════════════════════════════════════

const passport      = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User          = require('../models/User');

// ── LOCAL STRATEGY SETUP ─────────────────────────────────────────
//
// usernameField: by default Passport looks for req.body.username
// We change it to 'email' to match our login form
//
passport.use(
  new LocalStrategy(
    { usernameField: 'email' },         // look at req.body.email
    async (email, password, done) => {
      // `done` is Passport's callback:
      //   done(error)              → server error (500)
      //   done(null, false, msg)   → auth failed (wrong credentials)
      //   done(null, user)         → auth success → req.user = user

      try {
        // Step 1: Find the user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
          // No account with this email — return generic message
          // SECURITY: Never say "wrong password" vs "user not found"
          // This prevents user enumeration attacks.
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Step 2: Compare submitted password with bcrypt hash
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Step 3: Auth success — pass user to serializeUser below
        return done(null, user);
      } catch (err) {
        return done(err); // unexpected DB error → 500
      }
    }
  )
);

// ── SERIALIZE USER ────────────────────────────────────────────────
//
// Called once after successful login.
// We store ONLY the user ID in the session (not the whole document).
// This keeps the session store lean.
//
// Session payload stored in MongoDB (via connect-mongo):
//   { userId: '64abcd...', cookie: { expires: ... } }
//
passport.serializeUser((user, done) => {
  done(null, user.id); // user.id = MongoDB _id as string
});

// ── DESERIALIZE USER ──────────────────────────────────────────────
//
// Called on EVERY request to a protected route (after session check).
// Fetches fresh user data from DB using the stored id.
// Sets req.user = full user document for use in route handlers.
//
// NOTE: .select('-password') removes password hash for safety,
// but our toJSON transform already strips it too (double protection).
//
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user); // user becomes req.user
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
