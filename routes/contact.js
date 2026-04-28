const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');

router.get('/', function (req, res) {
  var stream = fs.createReadStream(path.join(__dirname, '../views/html/contact.html'));
  stream.on('error', function () { res.status(500).send('<h1>Error loading Contact page</h1>'); });
  res.setHeader('Content-Type', 'text/html');
  stream.pipe(res);
});

router.post('/', function (req, res) {
  try {
    var name    = (req.body.name    || '').trim();
    var email   = (req.body.email   || '').trim();
    var subject = (req.body.subject || 'General Enquiry').trim();
    var message = (req.body.message || '').trim();

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
    }

    var logLine = '[' + new Date().toISOString() + '] ' + name + ' <' + email + '> | ' + subject + ' | ' + message + '\n';
    fs.appendFile(path.join(__dirname, '../data/enquiries.log'), logLine, function (err) {
      if (err) console.error('[CONTACT] Log write error:', err.message);
    });

    console.log('[CONTACT] Enquiry from', name);
    res.status(200).json({ success: true, message: 'Thank you! Your message has been received. We will get back to you shortly.' });
  } catch (err) {
    console.error('[CONTACT] Error:', err.message);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
