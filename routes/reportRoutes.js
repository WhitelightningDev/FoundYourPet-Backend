const express = require("express");
const multer = require("multer");
const { body, param, query } = require("express-validator");

const reportController = require("../controllers/reportController");
const authenticate = require("../middleware/auth");

const router = express.Router();
const upload = multer();

router.get(
  "/public",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be an integer >= 1"),
    query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1..50"),
  ],
  reportController.listPublicReports
);

router.get("/admin", authenticate, reportController.listAdminReports);

router.post(
  "/public-pet",
  upload.single("photo"),
  [
    body("firstName").trim().notEmpty().withMessage("firstName is required"),
    body("lastName").trim().notEmpty().withMessage("lastName is required"),
    body("phoneNumber").trim().notEmpty().withMessage("phoneNumber is required"),
    body("petStatus").trim().isIn(["lost", "found"]).withMessage("petStatus must be lost or found"),
    body("location").trim().notEmpty().withMessage("location is required"),
    body("description").optional().isString(),
  ],
  reportController.createPublicPetReport
);

router.post(
  "/:reportId/comments",
  [
    param("reportId").isMongoId().withMessage("Invalid reportId"),
    body("name").optional().isString(),
    body("text").trim().notEmpty().isLength({ max: 500 }).withMessage("text is required (max 500)"),
  ],
  reportController.postComment
);

router.get(
  "/:reportId/comments",
  [
    param("reportId").isMongoId().withMessage("Invalid reportId"),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be an integer >= 1"),
    query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1..50"),
  ],
  reportController.listComments
);

router.post(
  "/:reportId/reactions",
  [
    param("reportId").isMongoId().withMessage("Invalid reportId"),
    body("reaction")
      .trim()
      .isIn(["like", "heart", "help", "seen", "helped"])
      .withMessage("Invalid reaction"),
    body("clientId").optional().isString().isLength({ min: 6, max: 128 }),
  ],
  reportController.reactToReport
);

router.post(
  "/:reportId/flag",
  [
    param("reportId").isMongoId().withMessage("Invalid reportId"),
    body("reason").trim().notEmpty().isLength({ max: 200 }).withMessage("reason is required (max 200)"),
    body("details").optional().isString().isLength({ max: 1000 }),
  ],
  reportController.flagReport
);

// Optional: admin moderation
router.post("/:reportId/hide", authenticate, [param("reportId").isMongoId()], async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
  const Report = require("../models/Report");
  const report = await Report.findByIdAndUpdate(req.params.reportId, { $set: { isHidden: true } }, { new: true });
  if (!report) return res.status(404).json({ message: "Report not found" });
  return res.json({ ok: true });
});

router.post("/:reportId/unhide", authenticate, [param("reportId").isMongoId()], async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
  const Report = require("../models/Report");
  const report = await Report.findByIdAndUpdate(req.params.reportId, { $set: { isHidden: false } }, { new: true });
  if (!report) return res.status(404).json({ message: "Report not found" });
  return res.json({ ok: true });
});

router.delete("/:reportId", authenticate, [param("reportId").isMongoId()], reportController.deleteReportAdmin);

module.exports = router;
