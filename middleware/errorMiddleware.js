// middleware/errorMiddleware.js
// ─────────────────────────────────────────────────────────────────
// Centralized error handling middleware
//
// HOW EXPRESS ERROR HANDLERS WORK:
//   A regular middleware has 3 params: (req, res, next)
//   An ERROR middleware has 4 params:  (err, req, res, next)
//   Express identifies error middleware by the 4th parameter.
//
//   To trigger an error handler, call: next(err)
//   Or throw inside an async route (requires express 5 or a try/catch).
//
//   Order matters: error handlers must be registered LAST (after all routes).
// ─────────────────────────────────────────────────────────────────

// ── errorHandler ──────────────────────────────────────────────────
//
// Catches all errors passed to next(err) from any route or middleware.
// Renders an EJS error page for browser requests,
// or returns JSON for API requests.
//
const errorHandler = (err, req, res, next) => {
  // Log the error with stack trace on server
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;

  // Detect if request expects JSON (API clients)
  const wantsJson = req.xhr
    || req.headers.accept?.includes('application/json')
    || req.path.startsWith('/api');

  if (wantsJson) {
    return res.status(statusCode).json({
      success: false,
      error:   err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  }

  // Render EJS error page for browser requests
  // If EJS isn't set up yet (early startup error), fall back to plain HTML
  try {
    res.status(statusCode).render('ejs/error', {
      title:      'Error ' + statusCode,
      message:    err.message || 'Something went wrong. Please try again.',
      activePage: '',
    });
  } catch (renderErr) {
    // Fallback if EJS render itself fails
    res.status(statusCode).send(
      '<h1>' + statusCode + ' – ' + (err.message || 'Internal Server Error') + '</h1>'
      + '<p><a href="/">Go Home</a></p>'
    );
  }
};

module.exports = { errorHandler };
