const express = require("express");
const { createExporter } = require("../controllers/exporterController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(createExporter));

module.exports = router;
