// generateSecret.js
const crypto = require('crypto');

// Function to generate a secure random JWT secret
function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

// Generate and print the JWT secret
const jwtSecret = generateJWTSecret();
console.log('Your JWT Secret: ', jwtSecret);
