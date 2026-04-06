import express from "express";
import { getPaymentMethods } from "../controllers/paymentController.js";

const router = express.Router();

router.get("/", getPaymentMethods);

export default router;
