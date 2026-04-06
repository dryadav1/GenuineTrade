const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  listAdminExporters,
  listAdminPayments,
  listAdminRfqs,
  listAdminUsers,
} = require("../controllers/adminController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authMiddleware, roleMiddleware("admin"));
router.get("/exporters", asyncHandler(listAdminExporters));
router.get("/users", asyncHandler(listAdminUsers));
router.get("/rfqs", asyncHandler(listAdminRfqs));
router.get("/payments", asyncHandler(listAdminPayments));

module.exports = router;
