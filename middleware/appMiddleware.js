// middleware/appMiddleware.js
// ─────────────────────────────────────────────────────────────────
// Application-level middleware
//
// WHAT IS MIDDLEWARE?
//   Middleware functions run between the request coming in and the
//   route handler responding. They have access to req, res, and next().
//
//   app.use(myMiddleware)  → runs for EVERY request
//   router.use(myMiddleware) → runs for requests on that router
//
//   The order they are registered in server.js matters.
//   Always call next() unless you are sending a response.
// ─────────────────────────────────────────────────────────────────

// ── requestTimer ──────────────────────────────────────────────────
//
// Tracks how long each request takes and logs it.
// Sets X-Response-Time header on the response.
//
const requestTimer = (req, res, next) => {
  const start = Date.now();

  // 'finish' fires when the response has been sent to the client
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Only log slow requests (>500ms) in detail, others briefly
    if (ms > 500) {
      console.warn('[SLOW] ' + req.method + ' ' + req.originalUrl + ' took ' + ms + 'ms');
    }
  });

  res.setHeader('X-Response-Time', '0ms'); // placeholder; real value set after finish
  next();
};

// ── apiKeyGuard ───────────────────────────────────────────────────
//
// Protects /api/* routes with an optional API key.
// If API_KEY env var is set, all /api requests must include:
//   Header: x-api-key: <your-key>
//   or Query: ?apiKey=<your-key>
//
// If API_KEY is NOT set in .env, this middleware is a no-op (open API).
//
const apiKeyGuard = (req, res, next) => {
  const API_KEY = process.env.API_KEY;

  // If no API key configured → open access (good for development)
  if (!API_KEY) return next();

  const provided = req.headers['x-api-key'] || req.query.apiKey;

  if (!provided) {
    return res.status(401).json({
      success: false,
      error:   'API key required. Provide x-api-key header or ?apiKey= query param.',
    });
  }

  if (provided !== API_KEY) {
    return res.status(403).json({
      success: false,
      error:   'Invalid API key.',
    });
  }

  next();
};

// ── maintenanceMode ───────────────────────────────────────────────
//
// When MAINTENANCE=true in .env, block all requests with 503.
// Useful for deployments — flip the switch without changing code.
// Static assets are still served (so maintenance page can load CSS).
//
const maintenanceMode = (req, res, next) => {
  if (process.env.MAINTENANCE !== 'true') return next();

  // Allow static assets through (CSS, JS, images)
  if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/images')) {
    return next();
  }

  res.status(503).send(`
    <html>
      <head>
        <title>Maintenance | India Trip Planner</title>
        <link rel="stylesheet" href="/css/style.css">
      </head>
      <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem">
        <div>
          <h1 style="font-size:3rem">🛠️</h1>
          <h2>We'll be back soon!</h2>
          <p style="color:#666;margin-top:1rem">India Trip Planner is undergoing scheduled maintenance.<br>Please check back shortly.</p>
        </div>
      </body>
    </html>
  `);
};

module.exports = { requestTimer, apiKeyGuard, maintenanceMode };
