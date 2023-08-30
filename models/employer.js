// models/employer.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const employerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  }
});

// Hash the password before saving it to the database
employerSchema.pre('save', async function (next) {
  const employer = this;

  if (employer.isModified('password') || employer.isNew) {
    try {
      const hashedPassword = await bcrypt.hash(employer.password, 10);
      employer.password = hashedPassword;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    return next();
  }
});

const Employer = mongoose.model('Employer', employerSchema);

module.exports = Employer;
