const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Extract the token from the Authorization header
  const token = req.header('Authorization')?.split(' ')[1];

  // If no token is provided, deny access
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify the token and decode it
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded data (userId and isAdmin) to the request object
    req.user = decoded;
    req.userId = decoded.userId;

    // Continue to the next middleware or route handler
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};
