const express = require("express");
const { createRfq } = require("../controllers/rfqController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(createRfq));

module.exports = router;
