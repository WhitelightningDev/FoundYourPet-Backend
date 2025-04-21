// testEmail.js
require('dotenv').config(); // if you're using environment variables
const sendEmail = require('./services/mailService'); // adjust this path

const runTest = async () => {
  try {
    await sendEmail(
      'danielmommsen2@gmail.com',
      '🎉 Welcome Email Test',
      null, // Plain text is optional
      null  // Let it use the default HTML template
    );
    console.log('✅ Test email sent successfully!');
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
  }
};

runTest();
