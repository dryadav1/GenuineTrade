const express = require("express");
const { getPlatformStats } = require("../controllers/platformController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/stats", asyncHandler(getPlatformStats));

module.exports = router;
