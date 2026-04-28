// models/User.js
// ═══════════════════════════════════════════════════════════════
// MONGOOSE USER MODEL — with bcrypt password hashing
//
// WHY HASH PASSWORDS?
//   Storing plain-text passwords is a critical security flaw.
//   If the database is leaked, every user account is compromised.
//   bcrypt hashes the password into an unreadable digest like:
//     $2a$12$Kw1z... (60-char string)
//   Even bcrypt itself cannot reverse this back to plain text.
//   Verification is done by running bcrypt.compare(plain, hash).
//
// SALT ROUNDS (cost factor):
//   The "12" in bcrypt.hash(password, 12) is the cost factor.
//   Higher = slower = more secure. 12 is the production standard.
//   At cost 12, one hash takes ~300ms — too slow for brute force.
// ═══════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Schema ────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,            // one account per email
      lowercase: true,           // normalize to lowercase before save
      trim:      true,
    },
    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type:    String,
      enum:    ['user', 'admin'],
      default: 'user',           // new accounts are regular users
    },
  },
  { timestamps: true }           // adds createdAt and updatedAt automatically
);

// ── PRE-SAVE HOOK — Hash password before storing ──────────────────
//
// mongoose "pre" hooks run BEFORE the document is saved to MongoDB.
// We intercept the save, hash the password, then continue.
//
// WHY CHECK isModified('password')?
//   Without this check, every time a user updates their name/email,
//   the already-hashed password would be hashed AGAIN — making it
//   unverifiable. We only re-hash when the password field changed.
//
userSchema.pre('save', async function (next) {
  // `this` refers to the Mongoose document being saved
  if (!this.isModified('password')) return next(); // skip if password unchanged

  try {
    // bcrypt.hash(plainText, saltRounds) → returns hashed string
    // 12 salt rounds = ~300ms per hash (brute-force protection)
    this.password = await bcrypt.hash(this.password, 12);
    next(); // proceed with saving
  } catch (err) {
    next(err); // pass error to mongoose error handler
  }
});

// ── INSTANCE METHOD — Compare plain password with stored hash ─────
//
// Called during login: user.comparePassword(plainTextInput)
// bcrypt.compare() re-hashes the input with the SAME salt embedded
// in the stored hash, then compares. Returns true/false.
//
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── toJSON override — Remove password from API responses ──────────
//
// When we send user data in JSON (e.g. JWT payload, /api/me),
// we NEVER want to include the hashed password. This transform
// runs whenever .toJSON() or JSON.stringify() is called on a User doc.
//
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password; // strip password hash from JSON output
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
