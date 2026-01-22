const express = require("express");
const { body } = require("express-validator");

const notificationController = require("../controllers/notificationController");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.post(
  "/register",
  [
    body("token").trim().notEmpty().isLength({ min: 20 }).withMessage("token is required"),
    body("platform").optional().isString(),
    body("userAgent").optional().isString(),
  ],
  notificationController.registerToken
);

router.post(
  "/broadcast",
  authenticate,
  [body("title").optional().isString(), body("body").optional().isString(), body("data").optional().isObject()],
  notificationController.broadcast
);

module.exports = router;

