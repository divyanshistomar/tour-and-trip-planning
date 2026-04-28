// routes/ssrRoutes.js
// ═════════════════════════════════════════════════════════════════
// SERVER-SIDE RENDERING ROUTES  (EJS)
//
// These routes use  res.render()  instead of  res.sendFile() / res.json()
//
// ─────────────────────────────────────────────────────────────────
// res.render() vs res.sendFile() vs res.json()
// ─────────────────────────────────────────────────────────────────
//
//  res.sendFile('views/packages.html')
//    → sends a STATIC file as-is (no data injection, no logic)
//    → the HTML is fixed; JS on the client must fetch data separately
//    → this is what your EXISTING routes (home.js, packages.js, etc.) do
//
//  res.json({ tours })
//    → sends raw JSON data; browser JS must build the HTML from it
//    → this is what /api/tours does (CSR – Client-Side Rendering)
//
//  res.render('ejs/tours', { tours, title: 'Tours' })
//    → EJS fills in all <%= %> tags using the data object
//    → returns COMPLETE HTML; browser displays it immediately
//    → this is SSR – Server-Side Rendering
//
// ─────────────────────────────────────────────────────────────────
// DATA FLOW (SSR):
//   route handler runs → collects/filters data → calls res.render()
//   → EJS engine reads the .ejs file → substitutes all tags
//   → Express sends the finished HTML string as the response
// ─────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();

// ── Helper: get render timestamp (shows SSR is happening on server) ──
function renderTimestamp() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────
// GET /ssr/packages
// ─────────────────────────────────────────────────────────────────
// Renders the packages listing page (EJS) with:
//   - All tour data from app.locals.tours
//   - Pre-computed stats (totalTours, totalDestinations, minPrice)
//   - Featured tours (top-rated, filtered server-side)
//   - Category filter support via ?category= query param
//
// SSR vs CSR comparison:
//   CSR (existing /packages route):
//     → sends packages.html (empty shell)
//     → browser runs app.js which calls fetch('/api/tours')
//     → browser builds cards with JS
//   SSR (this route):
//     → reads tours[], filters if needed, computes stats
//     → res.render() injects everything into packages.ejs
//     → browser receives COMPLETE page with cards already built
// ─────────────────────────────────────────────────────────────────
router.get('/packages', (req, res) => {
  // req.app.locals.tours was loaded from tours.json in server.js at startup
  const allTours = req.app.locals.tours;

  // ── Query param: ?category=Adventure ──────────────────────────
  const selectedCategory = req.query.category || '';

  // Filter server-side — no client JS needed
  const tours = selectedCategory
    ? allTours.filter((t) => t.category === selectedCategory)
    : allTours;

  // ── Pre-compute stats (done on SERVER, not in browser) ────────
  const stats = {
    totalTours:        allTours.length,
    totalDestinations: [...new Set(allTours.map((t) => t.destination))].length,
    minPrice:          Math.min(...allTours.map((t) => t.price)),
  };

  // ── Featured: top-rated tours (pre-filtered, not done in JS) ──
  const featured = allTours
    .filter((t) => t.rating >= 4.8)
    .slice(0, 3);

  // ── Unique category list for filter tabs ──────────────────────
  const categories = [...new Set(allTours.map((t) => t.category))].sort();

  // ── res.render() — THIS IS WHERE SSR HAPPENS ─────────────────
  //    First argument:  template path relative to views directory
  //    Second argument: data object — every key becomes a variable in the template
  //
  //    Inside packages.ejs:
  //      <%= tours.length %>        uses the tours array we pass here
  //      <%= stats.totalTours %>    uses the stats object
  //      <%= renderTime %>          uses the string below
  res.render('ejs/packages', {
    title:            'Tour Packages',      // → used in <title> via head.ejs partial
    tours,                                  // → forEach loop in packages.ejs
    stats,                                  // → stats.totalTours, stats.minPrice, etc.
    featured,                               // → featured section
    categories,                             // → category tab links
    selectedCategory,                       // → highlights active tab
    renderTime:       renderTimestamp(),    // → shows SSR proof (server timestamp)
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /ssr/tours
// ─────────────────────────────────────────────────────────────────
// Full tour listing with server-side filtering by category and price.
// The filter form submits GET here (plain HTML form, no JS fetch needed).
// ─────────────────────────────────────────────────────────────────
router.get('/tours', (req, res) => {
  let tours = req.app.locals.tours.slice(); // copy so we don't mutate originals

  // ── Server-side filtering from query params ───────────────────
  const selectedCategory = req.query.category || '';
  const maxPrice         = req.query.maxPrice  ? Number(req.query.maxPrice) : null;

  if (selectedCategory) {
    tours = tours.filter((t) => t.category === selectedCategory);
  }
  if (maxPrice) {
    tours = tours.filter((t) => t.price <= maxPrice);
  }

  // Unique categories for the filter dropdown
  const categories = [
    ...new Set(req.app.locals.tours.map((t) => t.category)),
  ].sort();

  // Build page heading dynamically on server
  const pageHeading  = selectedCategory ? `${selectedCategory} Tours` : 'All Tours';
  const pageSubtitle = selectedCategory
    ? `Showing ${tours.length} ${selectedCategory.toLowerCase()} tour${tours.length !== 1 ? 's' : ''} in India`
    : `Explore all ${tours.length} tours across India — adventure, culture, beaches & more`;

  res.render('ejs/tours', {
    title:            pageHeading,
    tours,
    categories,
    selectedCategory,
    maxPrice,
    pageHeading,
    pageSubtitle,
    renderTime:       renderTimestamp(),
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /ssr/tours/:id
// ─────────────────────────────────────────────────────────────────
// Single tour detail page.
// Demonstrates: passing a SINGLE OBJECT (not array) to a template.
// ─────────────────────────────────────────────────────────────────
router.get('/tours/:id', (req, res) => {
  // Parse route parameter — req.params.id is always a string
  const tourId = parseInt(req.params.id, 10);
  const tour   = req.app.locals.tours.find((t) => t.id === tourId);

  if (!tour) {
    // Render EJS 404 template with data instead of sending plain HTML
    return res.status(404).render('ejs/404', {
      title: '404 – Tour Not Found',
      path:  req.originalUrl,
    });
  }

  // Pass a SINGLE tour object — template accesses tour.title, tour.price, etc.
  res.render('ejs/tourDetail', {
    title:      tour.title,           // → <title> in head partial
    tour,                             // → the whole object (tour.highlights, tour.includes, etc.)
    activePage: 'tours',
    renderTime: renderTimestamp(),
  });
});

module.exports = router;
