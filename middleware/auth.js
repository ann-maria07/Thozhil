// middleware/auth.js
module.exports = (req, res, next) => {
    if (req.session && req.session.employeeId) {
      return next();
    } else {
      req.flash('error', 'You must be logged in to access this page.');
      res.redirect('/login');
    }
  };
  