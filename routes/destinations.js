const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');

router.get('/', function (req, res) {
  var stream = fs.createReadStream(path.join(__dirname, '../views/html/destinations.html'));
  stream.on('error', function () { res.status(500).send('<h1>Error loading Destinations page</h1>'); });
  res.setHeader('Content-Type', 'text/html');
  stream.pipe(res);
});

module.exports = router;
