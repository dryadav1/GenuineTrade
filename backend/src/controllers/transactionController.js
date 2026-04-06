import Buyer from "../models/Buyer.js";
import Exporter from "../models/Exporter.js";
import Transaction from "../models/Transaction.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createHttpError } from "../utils/httpErrors.js";
import { createPaginationMeta, parsePagination } from "../utils/pagination.js";
import {
  serializePaymentIntent,
  serializeTransaction
} from "../utils/serializers.js";
import {
  confirmDelivery,
  createTradePaymentIntent,
  createTradeTransaction,
  disputeTransaction
} from "../services/transactionService.js";

const loadTransactionForUser = async (user, transactionId) => {
  if (user.role === "buyer") {
    const buyer = await Buyer.findOne({ userId: user._id });
    return Transaction.findOne({ _id: transactionId, buyerId: buyer?._id })
      .populate({
        path: "buyerId",
        populate: {
          path: "userId",
          select: "email phone role"
        }
      })
      .populate({
        path: "exporterId",
        populate: {
          path: "userId",
          select: "email phone role"
        }
      })
      .populate("rfqId");
  }

  const exporter = await Exporter.findOne({ userId: user._id });
  return Transaction.findOne({ _id: transactionId, exporterId: exporter?._id })
    .populate({
      path: "buyerId",
      populate: {
        path: "userId",
        select: "email phone role"
      }
    })
    .populate({
      path: "exporterId",
      populate: {
        path: "userId",
        select: "email phone role"
      }
    })
    .populate("rfqId");
};

export const createTransaction = asyncHandler(async (req, res) => {
  const { exporterId, rfqId, amount, currency, paymentMethod } = req.body;

  if (!exporterId || !amount || !currency) {
    throw createHttpError(400, "Exporter, amount, and currency are required");
  }

  const transaction = await createTradeTransaction({
    user: req.user,
    exporterId,
    rfqId,
    amount: Number(amount),
    currency,
    paymentMethod
  });

  res.status(201).json({
    message: "Transaction created",
    transaction: serializeTransaction(
      await Transaction.findById(transaction._id)
        .populate("buyerId")
        .populate("exporterId")
        .populate("rfqId")
    )
  });
});

export const createTransactionPaymentIntent = asyncHandler(async (req, res) => {
  const transaction = await loadTransactionForUser(req.user, req.params.transactionId);

  if (!transaction) {
    throw createHttpError(404, "Transaction not found");
  }

  const buyer = await Buyer.findById(transaction.buyerId._id);
  const paymentIntent = await createTradePaymentIntent({
    transaction,
    country: buyer.country
  });

  res.status(201).json({
    message: "Payment intent created",
    paymentIntent: serializePaymentIntent(paymentIntent),
    transaction: serializeTransaction(
      await Transaction.findById(transaction._id)
        .populate("buyerId")
        .populate("exporterId")
        .populate("rfqId")
    )
  });
});

export const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await loadTransactionForUser(req.user, req.params.transactionId);

  if (!transaction) {
    throw createHttpError(404, "Transaction not found");
  }

  res.json({
    transaction: serializeTransaction(transaction)
  });
});

export const getMyTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  if (req.user.role === "buyer") {
    const buyer = await Buyer.findOne({ userId: req.user._id });
    const [transactions, total] = await Promise.all([
      Transaction.find({ buyerId: buyer?._id })
        .populate("buyerId")
        .populate("exporterId")
        .populate("rfqId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments({ buyerId: buyer?._id })
    ]);

    res.json({
      items: transactions.map(serializeTransaction),
      pagination: createPaginationMeta({ page, limit, total })
    });
    return;
  }

  const exporter = await Exporter.findOne({ userId: req.user._id });
  const [transactions, total] = await Promise.all([
    Transaction.find({ exporterId: exporter?._id })
      .populate("buyerId")
      .populate("exporterId")
      .populate("rfqId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments({ exporterId: exporter?._id })
  ]);

  res.json({
    items: transactions.map(serializeTransaction),
    pagination: createPaginationMeta({ page, limit, total })
  });
});

export const confirmTransactionDelivery = asyncHandler(async (req, res) => {
  const transaction = await loadTransactionForUser(req.user, req.params.transactionId);

  if (!transaction) {
    throw createHttpError(404, "Transaction not found");
  }

  if (req.user.role !== "buyer") {
    throw createHttpError(403, "Only buyers can confirm delivery");
  }

  const updatedTransaction = await confirmDelivery({
    transaction,
    actor: req.user
  });

  res.json({
    message: "Transaction released",
    transaction: serializeTransaction(
      await Transaction.findById(updatedTransaction._id)
        .populate("buyerId")
        .populate("exporterId")
        .populate("rfqId")
    )
  });
});

export const disputeTradeTransaction = asyncHandler(async (req, res) => {
  const transaction = await loadTransactionForUser(req.user, req.params.transactionId);

  if (!transaction) {
    throw createHttpError(404, "Transaction not found");
  }

  const updatedTransaction = await disputeTransaction({
    transaction,
    actor: req.user,
    reason: req.body.reason
  });

  res.json({
    message: "Transaction disputed",
    transaction: serializeTransaction(
      await Transaction.findById(updatedTransaction._id)
        .populate("buyerId")
        .populate("exporterId")
        .populate("rfqId")
    )
  });
});
