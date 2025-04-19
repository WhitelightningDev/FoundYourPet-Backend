const nodemailer = require("nodemailer");

// Transporter setup for Gmail (make sure to use App Password if 2FA is enabled)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

/**
 * Sends an email using nodemailer.
 * @param {string} to - Recipient's email address.
 * @param {string} subject - Subject of the email.
 * @param {string} text - Plain text version of the message.
 * @param {string} html - HTML version of the message.
 */
const sendEmail = async (to, subject = "Welcome to Found Your Pet!", text, html) => {
  const defaultText = `Hi there,

Thank you for registering with Found Your Pet! We're excited to help you keep your furry friends safe.

Best regards,
The Found Your Pet Team 🐾`;

  const defaultHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome to Found Your Pet! 🐶🐱</h2>
      <p>Hi there,</p>
      <p>Thank you for signing up with <strong>Found Your Pet</strong>. We're thrilled to have you join our community of pet lovers.</p>
      <p>With your new account, you'll be able to:</p>
      <ul>
        <li>Register your pets and their profiles</li>
        <li>Order smart ID tags with QR codes</li>
        <li>Manage lost and found alerts</li>
        <li>Get support and tag replacements as part of our monthly care package</li>
      </ul>
      <p>We're here to support you and your pets every step of the way!</p>
      <p>Best regards,<br/>The Found Your Pet Team 🐾</p>
    </div>
  `;

  const mailOptions = {
    from: `"Found Your Pet" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: text || defaultText,
    html: html || defaultHtml,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
