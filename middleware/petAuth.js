// petAuth.js (New middleware for Pet-related routes)
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('Authorization')?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify token and extract userId from the payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;  // Set userId for pet-related routes
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
