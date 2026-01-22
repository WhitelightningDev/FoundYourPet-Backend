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
  "/webpush/subscribe",
  [
    body("subscription").notEmpty().withMessage("subscription is required"),
    body("subscription.endpoint").isString().notEmpty(),
    body("subscription.keys.p256dh").isString().notEmpty(),
    body("subscription.keys.auth").isString().notEmpty(),
    body("platform").optional().isString(),
    body("userAgent").optional().isString(),
  ],
  notificationController.subscribeWebPush
);

router.get("/webpush/public-key", notificationController.getWebPushPublicKey);

router.post(
  "/webpush/unsubscribe",
  [body("endpoint").isString().notEmpty().withMessage("endpoint is required")],
  notificationController.unsubscribeWebPush
);

router.post(
  "/unregister",
  [body("token").isString().notEmpty().withMessage("token is required")],
  notificationController.unregisterToken
);

router.post(
  "/broadcast",
  authenticate,
  [body("title").optional().isString(), body("body").optional().isString(), body("data").optional().isObject()],
  notificationController.broadcast
);

module.exports = router;
