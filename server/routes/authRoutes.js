const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { login, me, signup } = require("../controllers/authController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.get("/me", authMiddleware, asyncHandler(me));

module.exports = router;
