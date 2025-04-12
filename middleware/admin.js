module.exports = function (req, res, next) {
    // Check if the user is an admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ msg: 'Admin access required' });
    }
  
    // If the user is an admin, proceed to the next middleware/route
    next();
  };
  