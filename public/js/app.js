// ============================================================
//  INDIA TRIP PLANNER - app.js  (Front-end JavaScript)
//  Handles: Navigation, Tour Cards, Modal, API calls,
//  Quick Booking form on Home page, Scroll animations
// ============================================================

// ----- NAVIGATION -----
function toggleMenu() {
  var links = document.getElementById('nav-links');
  if (links) links.classList.toggle('open');
}

// Close mobile menu on link click
document.addEventListener('DOMContentLoaded', function () {
  var navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(function (a) {
    a.addEventListener('click', function () {
      var links = document.getElementById('nav-links');
      if (links) links.classList.remove('open');
    });
  });
});

// ----- SCROLL ANIMATIONS -----
function checkAnimations() {
  var items = document.querySelectorAll('.anim');
  items.forEach(function (el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 60) {
      el.classList.add('in');
    }
  });
}
window.addEventListener('scroll', checkAnimations);
document.addEventListener('DOMContentLoaded', checkAnimations);

// ----- TOUR CARD HELPERS -----
function buildStars(rating) {
  var s = '';
  for (var i = 0; i < Math.round(rating); i++) s += '\u2605';
  return s;
}

function buildTourCard(t) {
  return '<div class="tour-card" onclick="openModal(' + t.id + ')">'
    + '<div class="card-img-wrap">'
    + '<img src="' + t.image + '" alt="' + t.title + '" loading="lazy" />'
    + '<span class="card-badge">' + t.category + '</span>'
    + '<span class="card-price">\u20B9' + t.price.toLocaleString('en-IN') + '</span>'
    + '</div>'
    + '<div class="card-body">'
    + '<div class="card-meta">'
    + '<span>\u{1F4C5} ' + t.days + ' days</span>'
    + '<span>\u{1F465} Max ' + t.groupSize + '</span>'
    + '<span>\u{1F3C3} ' + t.difficulty + '</span>'
    + '</div>'
    + '<h3 class="card-title">' + t.title + '</h3>'
    + '<p class="card-dest">\u{1F4CD} ' + t.destination + ', ' + t.state + '</p>'
    + '<div class="card-rating">'
    + '<span class="stars">' + buildStars(t.rating) + '</span>'
    + '<span>' + t.rating + ' (' + t.reviews + ' reviews)</span>'
    + '</div>'
    + '<span class="card-btn">View Details &rarr;</span>'
    + '</div></div>';
}

// ----- LOAD & RENDER TOURS (Home page) -----
var allToursHome = [];

async function loadHomeToursAndBooking() {
  var grid = document.getElementById('tours-grid');
  if (!grid) return;
  try {
    var res  = await fetch('/api/tours');
    var json = await res.json();
    allToursHome = json.data || [];
    renderHomeGrid(allToursHome);
    populateBookingSelect(allToursHome, 'bookTourId');
    var dateInput = document.getElementById('bookDate');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
  } catch (e) {
    if (grid) grid.innerHTML = '<p class="loading">Error loading tours. Please refresh.</p>';
  }
}

function renderHomeGrid(list) {
  var grid = document.getElementById('tours-grid');
  if (!grid) return;
  var show = list.slice(0, 6);
  if (!show.length) { grid.innerHTML = '<p class="loading">No tours found.</p>'; return; }
  grid.innerHTML = show.map(buildTourCard).join('');
}

// ----- SEARCH (Home page) -----
function searchTours() {
  var dest   = (document.getElementById('sDest')   ? document.getElementById('sDest').value.toLowerCase()   : '');
  var cat    = (document.getElementById('sCat')    ? document.getElementById('sCat').value                   : '');
  var budget = (document.getElementById('sBudget') ? document.getElementById('sBudget').value                : '');
  var days   = (document.getElementById('sDays')   ? document.getElementById('sDays').value                  : '');

  var filtered = allToursHome.filter(function (t) {
    return (!dest   || t.destination.toLowerCase().includes(dest) || t.state.toLowerCase().includes(dest))
        && (!cat    || t.category === cat)
        && (!budget || t.price <= Number(budget))
        && (!days   || t.days  <= Number(days));
  });

  renderHomeGrid(filtered);
  var section = document.getElementById('tours-grid');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

// ----- FILTER BY CATEGORY (Home page) -----
function filterByCategory(cat) {
  var filtered = allToursHome.filter(function (t) { return t.category === cat; });
  renderHomeGrid(filtered);
  var section = document.querySelector('.tours-section');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

// ----- POPULATE BOOKING SELECT -----
function populateBookingSelect(tours, selectId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  tours.forEach(function (t) {
    var opt   = document.createElement('option');
    opt.value = t.id;
    opt.text  = t.title + ' \u2014 \u20B9' + t.price.toLocaleString('en-IN') + ' (' + t.days + ' days)';
    sel.appendChild(opt);
  });
}

// ----- QUICK BOOKING (Home page) -----
async function submitQuickBooking() {
  var tourId    = document.getElementById('bookTourId')    ? document.getElementById('bookTourId').value    : '';
  var name      = document.getElementById('bookName')      ? document.getElementById('bookName').value.trim()      : '';
  var email     = document.getElementById('bookEmail')     ? document.getElementById('bookEmail').value.trim()     : '';
  var phone     = document.getElementById('bookPhone')     ? document.getElementById('bookPhone').value.trim()     : '';
  var travelers = document.getElementById('bookTravelers') ? document.getElementById('bookTravelers').value : 1;
  var date      = document.getElementById('bookDate')      ? document.getElementById('bookDate').value      : '';
  var msg       = document.getElementById('booking-msg');

  msg.className = '';

  if (!tourId || !name || !email || !date) {
    msg.className   = 'error';
    msg.textContent = 'Please fill in all required fields: Tour Package, Name, Email and Date.';
    return;
  }

  var btn = document.querySelector('.booking-form .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  try {
    var res  = await fetch('/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId: tourId, name: name, email: email, phone: phone, travelers: travelers, date: date })
    });
    var json = await res.json();
    if (json.success) {
      window.location.href = '/booking/confirmation/' + json.bookingId;
    } else {
      msg.className   = 'error';
      msg.textContent = json.message || 'Something went wrong.';
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
    }
  } catch (e) {
    msg.className   = 'error';
    msg.textContent = 'Network error. Please try again.';
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
  }
}

// ----- MODAL -----
async function openModal(tourId) {
  var overlay = document.getElementById('modal');
  var content = document.getElementById('modal-content');
  if (!overlay || !content) return;
  content.innerHTML = '<p style="padding:2rem;text-align:center;color:var(--muted);">Loading...</p>';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    var res  = await fetch('/api/tours/' + tourId);
    var json = await res.json();
    if (!json.success) { content.innerHTML = '<p style="padding:2rem;color:var(--muted);">Tour not found.</p>'; return; }
    var t = json.data;

    var highlightsHtml = t.highlights.map(function(h){ return '<li>' + h + '</li>'; }).join('');
    var attractHtml    = t.attractions.map(function(a){ return '<li>' + a + '</li>'; }).join('');
    var includesHtml   = t.includes.map(function(i){ return '<li>' + i + '</li>'; }).join('');

    content.innerHTML = ''
      + '<img class="modal-img" src="' + t.image + '" alt="' + t.destination + '" />'
      + '<span class="modal-badge">' + t.category + '</span>'
      + '<h2 class="modal-title">' + t.title + '</h2>'
      + '<p class="modal-dest">\u{1F4CD} ' + t.destination + ', ' + t.state + '</p>'
      + '<div class="modal-stats">'
      + '<div class="modal-stat"><span class="val">\u20B9' + t.price.toLocaleString('en-IN') + '</span><span class="lbl">Per Person</span></div>'
      + '<div class="modal-stat"><span class="val">' + t.days + ' Days</span><span class="lbl">Duration</span></div>'
      + '<div class="modal-stat"><span class="val">' + t.rating + '\u2605</span><span class="lbl">Rating</span></div>'
      + '<div class="modal-stat"><span class="val">' + t.groupSize + '</span><span class="lbl">Max Group</span></div>'
      + '<div class="modal-stat"><span class="val">' + t.difficulty + '</span><span class="lbl">Difficulty</span></div>'
      + '</div>'
      + '<p class="modal-desc">' + t.description + '</p>'
      + '<div class="modal-section"><h4>Best Time to Visit</h4><p>' + t.bestTime + '</p></div>'
      + '<div class="modal-section"><h4>Travel Highlights</h4><ul>' + highlightsHtml + '</ul></div>'
      + '<div class="modal-section"><h4>Popular Attractions</h4><ul>' + attractHtml + '</ul></div>'
      + '<div class="modal-section"><h4>Package Includes</h4><ul>' + includesHtml + '</ul></div>'
      + '<a class="modal-book" href="/booking?tour=' + t.id + '">Book This Tour &rarr;</a>';
  } catch (e) {
    content.innerHTML = '<p style="padding:2rem;color:var(--muted);">Error loading tour details.</p>';
  }
}

function closeModal(event) {
  if (event && event.target !== document.getElementById('modal')) return;
  var overlay = document.getElementById('modal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var overlay = document.getElementById('modal');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ----- INIT -----
document.addEventListener('DOMContentLoaded', function () {
  loadHomeToursAndBooking();
});
