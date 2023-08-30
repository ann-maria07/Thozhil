// models/job.js

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobName: { type: String, required: true },
  jobDescription: { type: String, required: true },
  employerPassword: { type: String, required: true },
  location: { type: String, required: true },
  salary: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  jobType: { type: String, required: true },
  companyName: { type: String, required: true },
  vacancies: { type: String, required: true },
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
