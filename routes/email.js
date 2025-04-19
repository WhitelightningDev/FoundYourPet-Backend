const express = require("express");
const router = express.Router();
const sendEmail = require("../services/mailService"); // adjust path accordingly

router.post("/send", async (req, res) => {
  const { to, subject, message } = req.body;

  try {
    await sendEmail(to, subject, message, `<p>${message}</p>`);
    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ success: false, message: "Email failed to send" });
  }
});

module.exports = router;
