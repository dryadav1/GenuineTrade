import express from "express";
import { getPublicPlatformContent } from "../controllers/platformController.js";

const router = express.Router();

router.get("/", getPublicPlatformContent);

export default router;
