const nodemailer = require("nodemailer");

// Transporter setup for Gmail (App Password required if 2FA is enabled)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

/**
 * Sends a marketing-style welcome email.
 * @param {string} to - Recipient's email.
 * @param {string} subject - Email subject.
 * @param {string} text - Optional plain text version.
 * @param {string} html - Optional custom HTML version.
 */
const sendEmail = async (to, subject = "Welcome to Found Your Pet!", text, html) => {
  const defaultText = `Hi there,

Thank you for registering with Found Your Pet! We're excited to help you keep your furry friends safe.

Best regards,
The Found Your Pet Team 🐾`;


  const defaultHtml = `
  <div style="background-color: #f5f5f5; padding: 40px 0; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

      <div style="padding: 30px;">
        <h2 style="color: #333;">Welcome to Found Your Pet! 🐶🐱</h2>
        <p>Hi there,</p>
        <p>Thank you for signing up with <strong>Found Your Pet</strong>. We're thrilled to have you join our community of pet lovers.</p>
        <p>With your new account, you can:</p>
        <ul style="padding-left: 20px; color: #444;">
          <li>Register your pets and create detailed profiles</li>
          <li>Order smart ID tags with QR codes</li>
          <li>Manage lost and found alerts with ease</li>
          <li>Access support and tag replacements with our monthly care package</li>
        </ul>
        <p style="margin: 20px 0;">👉 <a href="https://foundyourpet.vercel.app/login" style="color: #ffffff; background-color: #007bff; padding: 10px 20px; border-radius: 4px; text-decoration: none;">Login to your account</a></p>
        <p>We're here to support you and your pets every step of the way!</p>
        <p style="margin-top: 40px;">Warm regards,<br/><strong>The Found Your Pet Team 🐾</strong></p>
      </div>

      <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #888;">
        <p>By signing up, you agree to our 
          <a href="https://foundyourpet.co.za/terms" style="color: #888;">Terms & Conditions</a> and 
          <a href="https://foundyourpet.co.za/privacy" style="color: #888;">Privacy Policy</a>.
        </p>
        <p>© ${new Date().getFullYear()} Found Your Pet. All rights reserved.</p>
      </div>
    </div>
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
