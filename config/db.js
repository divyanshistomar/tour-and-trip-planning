// config/db.js
// ─────────────────────────────────────────────────────────────────
// MongoDB connection using Mongoose
//
// WHY MONGOOSE?
//   Mongoose is an ODM (Object Document Mapper) for MongoDB.
//   It provides:
//     - Schema definition  → enforce data shape
//     - Model methods      → User.findOne(), User.create(), etc.
//     - Middleware (hooks) → pre('save') for password hashing
//     - Validation         → required, minlength, unique
//
// FLOW:
//   connectDB() is called once at server startup (server.js).
//   Mongoose maintains a connection pool — reused for all queries.
//   If MongoDB is down, queries will fail with a descriptive error.
// ─────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/india-trip-planner';

  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log('[DB] MongoDB connected: ' + conn.connection.host);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    console.warn('[DB] Running without MongoDB — auth features will not work.');
    // Don't crash the server — old HTML routes still work without DB
  }
};

module.exports = connectDB;
