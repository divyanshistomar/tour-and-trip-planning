// routes/bookings.js
// GET  /booking              - serve booking form page
// POST /booking              - handle booking submission, save to file
// GET  /booking/confirmation/:id - show confirmation page
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');

var BOOKINGS_FILE = path.join(__dirname, '../data/bookings.json');

function readBookings() {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) return [];
    return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
  } catch (e) { return []; }
}

function saveBookings(list) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// GET /booking
router.get('/', function (req, res) {
  var stream = fs.createReadStream(path.join(__dirname, '../views/html/booking.html'));
  stream.on('error', function () { res.status(500).send('<h1>Error loading Booking page</h1>'); });
  res.setHeader('Content-Type', 'text/html');
  stream.pipe(res);
});

// GET /booking/confirmation/:id
router.get('/confirmation/:id', function (req, res) {
  var bookings = readBookings();
  var b = bookings.find(function (x) { return x.id === req.params.id; });
  if (!b) return res.status(404).send('<h2>Booking not found.</h2><a href="/booking">Go Back</a>');

  var html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Booking Confirmed | India Trip Planner</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
<nav class="nav">
  <a href="/" class="logo">India<span>TripPlanner</span></a>
  <ul class="nav-links" id="nav-links">
    <li><a href="/">Home</a></li>
    <li><a href="/destinations">Destinations</a></li>
    <li><a href="/packages">Packages</a></li>
    <li><a href="/booking">Book Now</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
  <button class="hamburger" onclick="toggleMenu()">&#9776;</button>
</nav>
<div class="confirm-page">
  <div class="confirm-card">
    <div class="confirm-icon">&#10003;</div>
    <h1>Booking Successful!</h1>
    <p class="confirm-sub">Your trip request has been submitted. Our team will contact you within 24 hours to confirm your booking.</p>
    <div class="confirm-table-wrap">
      <h3>Booking Summary</h3>
      <table class="confirm-table">
        <tr><td>Booking ID</td><td><strong>${b.id}</strong></td></tr>
        <tr><td>Tour Package</td><td>${b.tourName}</td></tr>
        <tr><td>Destination</td><td>${b.destination}</td></tr>
        <tr><td>Traveller Name</td><td>${b.name}</td></tr>
        <tr><td>Email</td><td>${b.email}</td></tr>
        <tr><td>Phone</td><td>${b.phone || 'Not provided'}</td></tr>
        <tr><td>Travel Date</td><td>${b.date}</td></tr>
        <tr><td>No. of Travellers</td><td>${b.travelers}</td></tr>
        <tr><td>Total Price</td><td><strong>&#8377;${Number(b.totalPrice).toLocaleString('en-IN')}</strong></td></tr>
        <tr><td>Status</td><td><span class="badge-confirmed">Confirmed</span></td></tr>
      </table>
    </div>
    <div class="confirm-actions">
      <a href="/" class="btn-primary">Back to Home</a>
      <a href="/packages" class="btn-outline">Browse More Packages</a>
    </div>
  </div>
</div>
<footer class="footer"><div class="footer-bottom"><p>&copy; 2025 India Trip Planner</p></div></footer>
<script src="/js/app.js"></script>
</body>
</html>`;
  res.status(200).send(html);
});

// POST /booking
router.post('/', function (req, res) {
  try {
    var tourId    = req.body.tourId;
    var name      = (req.body.name  || '').trim();
    var email     = (req.body.email || '').trim();
    var phone     = (req.body.phone || '').trim();
    var travelers = parseInt(req.body.travelers) || 1;
    var date      = req.body.date;

    if (!tourId || !name || !email || !date) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    var tour = req.app.locals.tours.find(function (t) { return t.id === parseInt(tourId); });
    if (!tour) return res.status(404).json({ success: false, message: 'Selected tour not found.' });

    var booking = {
      id:          'BK' + Date.now(),
      tourId:      tour.id,
      tourName:    tour.title,
      destination: tour.destination + ', ' + tour.state,
      name:        name,
      email:       email,
      phone:       phone,
      travelers:   travelers,
      date:        date,
      totalPrice:  tour.price * travelers,
      status:      'confirmed',
      createdAt:   new Date().toISOString()
    };

    var list = readBookings();
    list.push(booking);
    saveBookings(list);

    console.log('[BOOKING] Saved:', booking.id, 'for', booking.name);
    res.status(201).json({ success: true, message: 'Booking Successful! Your trip request has been submitted.', bookingId: booking.id });

  } catch (err) {
    console.error('[BOOKING] Error:', err.message);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
