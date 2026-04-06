const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { createPlan, deletePlan, listPlans, updatePlan } = require("../controllers/planController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(listPlans));
router.post("/", authMiddleware, roleMiddleware("admin"), asyncHandler(createPlan));
router.put("/:id", authMiddleware, roleMiddleware("admin"), asyncHandler(updatePlan));
router.delete("/:id", authMiddleware, roleMiddleware("admin"), asyncHandler(deletePlan));

module.exports = router;
