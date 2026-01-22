const express = require("express");
const { body } = require("express-validator");

const analyticsController = require("../controllers/analyticsController");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.post(
  "/track",
  [
    body("sessionId").isString().isLength({ min: 6, max: 128 }),
    body("clientId").isString().isLength({ min: 6, max: 128 }),
    body("eventType").optional().isString(),
    body("path").optional().isString().isLength({ min: 1, max: 512 }),
    body("referrer").optional().isString().isLength({ max: 1024 }),
    body("userAgent").optional().isString().isLength({ max: 512 }),
  ],
  analyticsController.track
);

router.get("/admin/summary", authenticate, analyticsController.summary);

module.exports = router;

