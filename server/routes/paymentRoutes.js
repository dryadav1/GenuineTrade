const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { createOrder, listMyPayments, verifyPayment } = require("../controllers/paymentController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/create-order", authMiddleware, asyncHandler(createOrder));
router.post("/verify-payment", authMiddleware, asyncHandler(verifyPayment));
router.get("/payments/me", authMiddleware, asyncHandler(listMyPayments));

module.exports = router;
