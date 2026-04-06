import express from "express";
import {
  confirmTransactionDelivery,
  createTransaction,
  createTransactionPaymentIntent,
  disputeTradeTransaction,
  getMyTransactions,
  getTransaction
} from "../controllers/transactionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("buyer", "exporter"));
router.get("/", getMyTransactions);
router.post("/", authorizeRoles("buyer"), createTransaction);
router.get("/:transactionId", getTransaction);
router.post(
  "/:transactionId/payment-intent",
  authorizeRoles("buyer"),
  createTransactionPaymentIntent
);
router.post(
  "/:transactionId/confirm-delivery",
  authorizeRoles("buyer"),
  confirmTransactionDelivery
);
router.post("/:transactionId/dispute", disputeTradeTransaction);

export default router;
