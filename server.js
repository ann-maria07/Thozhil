// server.js
const express = require('express');
const session = require('express-session');
const flash = require('express-flash');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Employee = require('./models/employee');
//const authMiddleware = require('./middleware/auth');
const Job = require('./models/job');
const app = express();
const path = require('path');

const employerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Add other fields as needed
});

const Employer = mongoose.model('Employer', employerSchema);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());

// authMiddleware definition (move it here)
const authMiddleware = (req, res, next) => {
  // Check if the employee object exists in the session
  if (!req.session.employee) {
    return res.redirect('/login');
  }
  next();
};

const employerAuthMiddleware = (req, res, next) => {
  // Check if the employer object exists in the session
  if (!req.session.employer) {
    return res.redirect('/login-employer');
  }
  next();
};

// Database connection
const MONGODB_URI = 'mongodb://localhost:27017/db';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB', err));

// Home Page
app.get('/', (req, res) => {
  res.render('home');
});

app.get('/login-options', (req, res) => {
  res.render('index');
});

app.get('/index', (req, res) => {
  res.render('index');
});

// Login Page
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const employee = await Employee.findOne({ email });

  req.session.employee = employee;

  if (!employee || !(await bcrypt.compare(password, employee.password))) {
    req.flash('error', 'Invalid email or password');
    return res.redirect('/login');
  }

  req.session.employeeId = employee._id;
  res.redirect('/dashboard');
});

// Signup Page
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
    const { name, email, password, location, education, areaOfInterest } = req.body;
  
    // Check if the email already exists in the database
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      req.flash('error', 'Email already in use. Please choose a different email address.');
      return res.redirect('/signup');
    }
  
    // Check if the password meets the minimum length requirement
    if (password.length < 8) {
      req.flash('error', 'Password must be at least 8 characters long');
      return res.redirect('/signup');
    }
  
    const hashedPassword = await bcrypt.hash(password, 10);
  
    const newEmployee = new Employee({
      name,
      email,
      password: hashedPassword,
      location,
      education,
      areaOfInterest,
    });
  
    await newEmployee.save();
    req.flash('success', 'Account created successfully. You can now log in.');
    res.redirect('/login');
  });
  app.post('/login-employer', async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log('Email:', email);
  
      // Find the employer with an exact email match (case-insensitive search)
      const employer = await Employer.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
      console.log('Employer:', employer);
  
      if (!employer || !(await bcrypt.compare(password, employer.password))) {
        req.flash('error', 'Invalid email or password');
        return res.redirect('/login-employer'); // Redirect back to the employer login page
      }
  
      req.session.employer = employer; // Set the employer data to the session
      req.session.employerId = employer._id; // Optionally, you can save the employer's ID to the session
  
      // Redirect to the employer dashboard (update the route as needed)
      res.redirect('/employer-dashboard');
    } catch (err) {
      console.error('Error during employer login:', err);
      req.flash('error', 'An unexpected error occurred. Please try again.');
      res.redirect('/login-employer'); // Redirect back to the employer login page
    }
  });
  
app.get('/login-employer', (req, res) => {
  // Check if employer is already logged in
  if (req.session.employer) {
    return res.redirect('/employer-dashboard');
  }
  // If not logged in, render the login-employer page
  res.render('login-employer');
});

  app.get('/employer-dashboard', employerAuthMiddleware, (req, res) => {
    // You can access the logged-in employee's information from req.session.employee
    const employer = req.session.employer;
  
    res.render('employer-dashboard', { employer });
  });
  

  app.get('/dashboard', authMiddleware, (req, res) => {
    // You can access the logged-in employee's information from req.session.employee
    const employee = req.session.employee;
  
    res.render('dashboard', { employee });
  });

  app.get('/see-my-jobs', authMiddleware, async (req, res) => {
    try {
      const employee = req.session.employee;
  
      // Create a regex pattern to match partial job names containing the area of interest
      const areaOfInterestRegex = new RegExp(employee.areaOfInterest, 'i'); // 'i' makes it case-insensitive
  
      // Perform a query to find all jobs that match both the employee's location and similar areaOfInterest
      const recommendedJobs = await Job.find({
        $and: [
          { location: employee.location },
          { jobName: { $regex: areaOfInterestRegex } }
        ]
      });
  
      res.render('see_my_jobs', { employee, recommendedJobs }); // Pass employee and recommendedJobs to the template
    } catch (err) {
      console.error('Error fetching recommended jobs:', err);
      req.flash('error', 'Error fetching recommended jobs');
      res.redirect('/dashboard');
    }
  });
  
  // Job Details Page
app.get('/job-details/:id', authMiddleware, async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/see-my-jobs');
    }
    res.render('job_details', { job });
  } catch (err) {
    console.error('Error fetching job details:', err);
    req.flash('error', 'Error fetching job details');
    res.redirect('/see-my-jobs');
  }
});

// Define the routes
app.get('/joblist', authMiddleware, async (req, res) => {
  try {
    let query = {};

    // Check if a search query is provided
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.jobName = searchRegex;
    }

    // Check if a location filter is applied
    if (req.query.location) {
      query.location = req.query.location;
    }

    // Check if a jobType filter is applied
    if (req.query.jobType) {
      query.jobType = req.query.jobType;
    }

    // Check if a salary filter is applied
    if (req.query.salary) {
      const minSalary = parseInt(req.query.salary);
      query.salary = { $gte: minSalary };
    }

    // Retrieve jobs based on all the specified filters together
    const jobs = await Job.find(query);
    res.render('see_all_jobs', { jobs });
  } catch (error) {
    console.error('Error retrieving jobs:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/jobs/:id/login.html',authMiddleware, (req, res) => {
  // Handle login.html logic here
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/job/:id',authMiddleware, async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).send('Job not found');
    }
    res.render('jobDetails', { job });
  } catch (error) {
    console.error('Error retrieving job details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/logout', authMiddleware, (req, res) => {
  // Clear any session data or authentication tokens
  // and perform any additional logout actions

  // For example, if you are using session-based authentication with express-session:
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Redirect the user to the login page after logout
    res.redirect('/login.html');
  });
});


// Route to render the signup-employer page
app.get('/signup-employer',  (req, res) => {
  res.render('signup-employer');
});

app.post('/signup-employer', async (req, res) => {
  const { name, email, password } = req.body;

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new instance of the Employer model with the hashed password
  const newEmployer = new Employer({
    name,
    email,
    password: hashedPassword,
  });

  // Save the new employer to the database using Promises
  newEmployer
    .save()
    .then(() => {
      // Employer successfully saved to the database
      // You can redirect the employer to a success page or the dashboard
      res.redirect('/login-employer'); // Replace '/employer/dashboard' with the actual route you want to redirect to
    })
    .catch((err) => {
      console.error('Error saving employer:', err);
      // You can handle the error here (e.g., display an error message to the user)
      res.redirect('/signup-employer'); // Redirect back to the signup page on error
    });
});

app.post('/post-job', async (req, res) => {
  try {

    // Retrieve the form data from the request body
    const fullName = req.body.fullName;
    const employerPassword = req.body.employerPassword;
    const email = req.body.email;
    const mobileNumber = req.body.mobileNumber;
    const jobType = req.body.jobType;
    const companyName = req.body.companyName;
    const location = req.body.location;
    const salary = req.body.salary;
    const jobDescription = req.body.jobDescription;
    const jobName = req.body.jobName;
    const vacancies = req.body.vacancies;

    // Create a job object with the form data
    const jobDetails = {
      fullName,
      employerPassword,
      email,
      mobileNumber,
      jobType,
      companyName,
      location,
      salary,
      jobDescription,
      jobName,
      vacancies
    };

    // Save the job details to the "jobs" collection
    await saveJobDetails(jobDetails);

    return res.send("<script>alert('Job posted successfully!'); window.location.href = '/employer-dashboard';</script>");
  } catch (error) {
    console.error('Error saving job details:', error);
    return res.status(500).send('Internal server error');
  }
});

async function saveJobDetails(jobDetails) {
  const job = new Job(jobDetails);
  await job.save();
}


app.get('/empupdate', (req, res) => {
  res.render('empupdate');
});

app.get('/jobs', (req, res) => {
  const email = req.query.email; // Get the employer's email from the query string

  let query = {}; // Default query to retrieve all jobs
  if (email) {
    query = { email }; // If email is provided, filter jobs by email
  }

  Job.find(query)
    .then((jobs) => {
      res.render('jobs', { jobs });
    })
    .catch((err) => {
      console.error('Error retrieving jobs', err);
      res.status(500).send('Error retrieving jobs');
    });
});

app.post('/jobs', (req, res) => {
  const email = req.body.email;
  const employerPassword = req.body.employerPassword;

  Job.find({ email, employerPassword }) // Add password to the query
    .then((jobs) => {
      res.render('jobs', { jobs });
    })
    .catch((err) => {
      console.error('Error retrieving jobs', err);
      res.status(500).send('Error retrieving jobs');
    });
});

app.get('/jobs/:id/edit', (req, res) => {
  const jobId = req.params.id;
  Job.findById(jobId)
    .then((job) => {
      res.render('edit-job', { job });
    })
    .catch((err) => {
      console.error('Error retrieving job', err);
      res.status(500).send('Error retrieving job');
    });
});

app.post('/jobs/:id/update', (req, res) => {
  const jobId = req.params.id;
  const { fullName,location,employerPassword, dateOfBirth, mobileNumber, jobType, companyName, salary, jobDescription, jobName, vacancies } = req.body;

  Job.findByIdAndUpdate(jobId, {
    fullName,
    location,
    dateOfBirth,
    employerPassword,
    mobileNumber,
    jobType,
    companyName,
    salary,
    jobDescription,
    jobName,
    vacancies
  })
    .then(() => {
      // Send a success response
      return res.send("<script>alert('Job Updated successfully!'); window.location.href = '/empupdate';</script>");
    })
    .catch((err) => {
      console.error('Error updating job', err);
      res.status(500).send('Error updating job');
    });
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
