

require('dotenv').config(); // load .env variables (PORT, MONGO_URI, etc.)

const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const express = require('express');
const morgan  = require('morgan');
const cors    = require('cors');

// ── v4 Authentication & Session imports ───────────────────────────
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const passport   = require('./config/passport');
const socketio   = require('socket.io');

// ── Database connection ───────────────────────────────────────────
const connectDB = require('./config/db');

// ── Application middleware ────────────────────────────────────────
const { requestTimer, apiKeyGuard, maintenanceMode } = require('./middleware/appMiddleware');
const { errorHandler }                               = require('./middleware/errorMiddleware');

// ── v3 Route modules (HTML-based, fully working) ──────────────────
const homeRoute         = require('./routes/home');
const destinationsRoute = require('./routes/destinations');
const packagesRoute     = require('./routes/packages');
const bookingsRoute     = require('./routes/bookings');
const aboutRoute        = require('./routes/about');
const contactRoute      = require('./routes/contact');
const apiRoute          = require('./routes/api');

// ── v4 Route modules (EJS + Auth + Chat + DB) ─────────────────────
const apiDbRoute  = require('./routes/apiDb');
const ssrRoute    = require('./routes/ssrRoutes');
const authRoute   = require('./routes/authRoutes');
const chatRoute   = require('./routes/chatRoutes');

// ── App & Server Setup ────────────────────────────────────────────
const app    = express();
const server = http.createServer(app); // MUST use http.Server (not app.listen) for Socket.io
const PORT   = process.env.PORT || 3000;


const io = socketio(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io); // make io accessible in routes via req.app.get('io')

// ── Connect to MongoDB ────────────────────────────────────────────
// Non-blocking: if MongoDB is unavailable, HTML routes still work.
connectDB();

// ── Load tours data from JSON (used by both old & new routes) ─────
let toursData = [];
try {
  const raw  = fs.readFileSync(path.join(__dirname, 'data', 'tours.json'), 'utf8');
  toursData  = JSON.parse(raw);
  console.log('[SERVER] Loaded ' + toursData.length + ' tours from tours.json');
} catch (err) {
  console.error('[SERVER] Could not load tours.json:', err.message);
}
app.locals.tours = toursData; // available in ALL routes via req.app.locals.tours

// ════════════════════════════════════════════════════════════════
// VIEW ENGINE — EJS (for v4 SSR routes)
// HTML views are served directly via fs.createReadStream (v3 style).
// EJS views live in views/ejs/ and are served via res.render().
// ════════════════════════════════════════════════════════════════
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ════════════════════════════════════════════════════════════════
// MIDDLEWARE STACK (ORDER MATTERS)
// ════════════════════════════════════════════════════════════════
app.use(morgan('dev'));                             // HTTP request logger
app.use(cors());                                    // Allow cross-origin requests
app.use(express.json());                            // Parse JSON body
app.use(express.urlencoded({ extended: true }));    // Parse form submissions
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use(maintenanceMode);                           // 503 if MAINTENANCE=true in .env
app.use(requestTimer);                              // Log slow requests


const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/india-trip-planner';

// Build session store — MongoStore persists sessions across restarts.
// Silently falls back if MongoDB is unavailable (dev mode).
const sessionStore = MongoStore.create({
  mongoUrl:   MONGO_URI,
  ttl:        60 * 60 * 24 * 7,
  touchAfter: 24 * 3600,
  autoRemove: 'disabled',  // disable auto-remove to avoid DB polling errors
});
sessionStore.on('error', (err) => {
  console.warn('[SESSION] MongoStore error (sessions not persisted):', err.message);
});

app.use(session({
  secret:            process.env.SESSION_SECRET || 'india-trip-session-secret-change-in-prod',
  resave:            false,           // don't re-save session if nothing changed
  saveUninitialized: false,           // don't save empty sessions (GDPR)
  store:             sessionStore,    // MongoStore or MemoryStore fallback
  cookie: {
    httpOnly: true,                  // JS cannot read cookie → blocks XSS
    secure:   process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge:   1000 * 60 * 60 * 24 * 7, // 7 days in milliseconds
    sameSite: 'lax',                 // CSRF protection
  },
}));


app.use(passport.initialize()); // bootstrap Passport
app.use(passport.session());    // link Passport to express-session

// ── TEMPLATE LOCALS MIDDLEWARE ────────────────────────────────────
// Makes currentUser and isLoggedIn available in ALL EJS templates
// without needing to pass them explicitly in every res.render() call.
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.isLoggedIn  = req.isAuthenticated ? req.isAuthenticated() : false;
  next();
});

// ── API KEY GUARD (for /api/* routes) ────────────────────────────
// Only activates if API_KEY is set in .env
app.use('/api', apiKeyGuard);



// ── v3 HTML routes (all fully working, unchanged) ─────────────────
app.use('/',             homeRoute);          // GET /           → views/html/index.html
app.use('/destinations', destinationsRoute);  // GET /destinations → views/html/destinations.html
app.use('/packages',     packagesRoute);      // GET /packages   → views/html/packages.html
app.use('/booking',      bookingsRoute);      // GET/POST /booking → views/html/booking.html
app.use('/about',        aboutRoute);         // GET /about      → views/html/about.html
app.use('/contact',      contactRoute);       // GET/POST /contact → views/html/contact.html
app.use('/api',          apiRoute);           // GET /api/tours, /api/tours/:id (JSON from file)

// ── v4 new routes ─────────────────────────────────────────────────
app.use('/api/db',  apiDbRoute);  // GET /api/db/status, /api/db/users (MongoDB)
app.use('/ssr',     ssrRoute);    // GET /ssr/packages, /ssr/tours, /ssr/tours/:id (EJS SSR)
app.use('/auth',    authRoute);   // GET/POST /auth/login, /signup, /logout, /profile
app.use('/chat',    chatRoute);   // GET /chat (Socket.io chat, protected)

// ── Info endpoint ─────────────────────────────────────────────────
app.get('/info', (req, res) => {
  res.json({
    project: 'India Trip Planner — Merged v3 + v4',
    v3_routes: {
      'GET  /':                  'Home page (HTML)',
      'GET  /destinations':      'Destinations page (HTML)',
      'GET  /packages':          'Packages page (HTML + client-side fetch)',
      'GET  /booking':           'Booking form (HTML)',
      'POST /booking':           'Submit booking → saved to data/bookings.json',
      'GET  /about':             'About page (HTML)',
      'GET  /contact':           'Contact page (HTML)',
      'GET  /api/tours':         'All tours (JSON from tours.json)',
      'GET  /api/tours/:id':     'Single tour (JSON)',
    },
    v4_routes: {
      'GET  /auth/login':        'Login form (EJS)',
      'POST /auth/login':        'Session login (Passport local)',
      'GET  /auth/signup':       'Signup form (EJS)',
      'POST /auth/signup':       'Create account + bcrypt hash',
      'GET  /auth/logout':       'Destroy session + clear cookie',
      'GET  /auth/profile':      'Protected profile page (EJS)',
      'POST /auth/api/login':    'JWT login → returns Bearer token',
      'GET  /auth/api/me':       'JWT-protected → user JSON',
      'GET  /ssr/packages':      'SSR packages (EJS)',
      'GET  /ssr/tours':         'SSR all tours with filter (EJS)',
      'GET  /ssr/tours/:id':     'SSR single tour detail (EJS)',
      'GET  /chat':              'Real-time chat (Socket.io, protected)',
      'GET  /api/db/status':     'MongoDB connection status',
      'GET  /api/db/users':      'All users (JWT protected)',
    },
  });
});

// ── 404 Handler ───────────────────────────────────────────────────
// Catches any route that was not matched above.
app.use((req, res) => {
  // If request is to /ssr or /auth → use EJS 404 view
  if (req.originalUrl.startsWith('/ssr') || req.originalUrl.startsWith('/auth') || req.originalUrl.startsWith('/chat')) {
    return res.status(404).render('ejs/404', {
      title: '404 – Page Not Found',
      path:  req.originalUrl,
    });
  }

  // Otherwise stream the old HTML 404 page
  const stream = fs.createReadStream(path.join(__dirname, 'views', 'html', '404.html'));
  stream.on('error', () => res.status(404).send('<h1>404 – Page Not Found</h1>'));
  res.status(404);
  stream.pipe(res);
});

// ── Global Error Handler (MUST be last) ──────────────────────────
app.use(errorHandler);

// ════════════════════════════════════════════════════════════════
// SOCKET.IO — Real-Time Group Chat Event Handlers
// ════════════════════════════════════════════════════════════════

// In-memory map: socketId → { name, email }
// Note: resets on server restart — use Redis for production
const connectedUsers = new Map();

io.on('connection', (socket) => {
  // ── User joins ──────────────────────────────────────────────────
  socket.on('user:join', (userData) => {
    connectedUsers.set(socket.id, {
      name:  userData.name  || 'Anonymous',
      email: userData.email || '',
    });

    console.log('[SOCKET] ' + userData.name + ' joined (' + socket.id + ')');

    // Broadcast updated user list to ALL connected clients
    io.emit('users:update', {
      count: connectedUsers.size,
      users: Array.from(connectedUsers.values()).map((u) => u.name),
    });

    // Announce join to OTHERS (not the joining user)
    socket.broadcast.emit('chat:system', {
      text: userData.name + ' joined the chat 👋',
      time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    });
  });

  // ── Chat message ────────────────────────────────────────────────
  socket.on('chat:message', (data) => {
    const sender = connectedUsers.get(socket.id);
    if (!sender || !data.text?.trim()) return;

    const message = {
      text:     data.text.trim().substring(0, 500), // cap at 500 chars for safety
      sender:   sender.name,
      time:     new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
      }),
      socketId: socket.id,
    };

    console.log('[SOCKET] ' + sender.name + ': ' + message.text);
    io.emit('chat:message', message); // broadcast to ALL clients
  });

  // ── Typing indicators ───────────────────────────────────────────
  socket.on('chat:typing', () => {
    const sender = connectedUsers.get(socket.id);
    if (!sender) return;
    socket.broadcast.emit('chat:typing', { name: sender.name });
  });

  socket.on('chat:stopTyping', () => {
    socket.broadcast.emit('chat:stopTyping');
  });

  // ── Disconnect ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      console.log('[SOCKET] ' + user.name + ' disconnected');

      io.emit('users:update', {
        count: connectedUsers.size,
        users: Array.from(connectedUsers.values()).map((u) => u.name),
      });
      io.emit('chat:system', {
        text: user.name + ' left the chat',
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      });
    }
  });
});


server.listen(PORT, () => {
  console.log('');
  console.log('  ════════════════════════════════════════════════════');
  console.log('   INDIA TRIP PLANNER — Merged v3 + v4');
  console.log('   Open      : http://localhost:' + PORT);
  console.log('   Packages  : http://localhost:' + PORT + '/packages   (HTML/CSR)');
  console.log('   SSR Tours : http://localhost:' + PORT + '/ssr/tours  (EJS/SSR)');
  console.log('   Signup    : http://localhost:' + PORT + '/auth/signup');
  console.log('   Login     : http://localhost:' + PORT + '/auth/login');
  console.log('   Chat      : http://localhost:' + PORT + '/chat');
  console.log('   API       : http://localhost:' + PORT + '/api/tours');
  console.log('   Info      : http://localhost:' + PORT + '/info');
  console.log('  ════════════════════════════════════════════════════');
  console.log('');
});

module.exports = app;
