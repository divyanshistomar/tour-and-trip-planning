// routes/api.js - JSON API endpoints
// Demonstrates: Route Parameters, Query Strings, Response Methods (res.json)
const express = require('express');
const router  = express.Router();

// GET /api/tours  - list all tours, optional query filters
router.get('/tours', function (req, res) {
  var tours = req.app.locals.tours.slice();
  if (req.query.category) tours = tours.filter(function (t) { return t.category === req.query.category; });
  if (req.query.maxPrice) tours = tours.filter(function (t) { return t.price <= Number(req.query.maxPrice); });
  if (req.query.days)     tours = tours.filter(function (t) { return t.days  <= Number(req.query.days); });
  res.status(200).json({ success: true, count: tours.length, data: tours });
});

// GET /api/tours/:id  - single tour by route parameter
router.get('/tours/:id', function (req, res) {
  var tour = req.app.locals.tours.find(function (t) { return t.id === parseInt(req.params.id); });
  if (!tour) return res.status(404).json({ success: false, message: 'Tour not found' });
  res.status(200).json({ success: true, data: tour });
});

module.exports = router;
