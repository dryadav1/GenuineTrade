import Buyer from "../models/Buyer.js";
import Exporter from "../models/Exporter.js";
import PaymentIntent from "../models/PaymentIntent.js";
import RFQ from "../models/RFQ.js";
import Transaction from "../models/Transaction.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { createAuditLog } from "./auditService.js";
import { createNotification } from "./notificationService.js";
import { resolvePaymentMethods } from "./paymentMethodService.js";
import {
  constructStripeWebhookEvent,
  createStripePaymentIntent
} from "./payments/stripeProvider.js";
import {
  createRazorpayOrder,
  validateRazorpayWebhookSignature
} from "./payments/razorpayProvider.js";
import { normalizeCurrency } from "../utils/currency.js";
import { createHttpError } from "../utils/httpErrors.js";

const defaultBaseCurrency = process.env.DEFAULT_BASE_CURRENCY || "USD";

const getBuyerByUserId = (userId) => Buyer.findOne({ userId });
const getExporterById = (exporterId) =>
  Exporter.findById(exporterId).populate("userId", "email phone role");

const notifyTransactionParties = async ({
  transaction,
  title,
  body,
  actionUrl = "/profile",
  priority = "high"
}) => {
  const [buyer, exporter] = await Promise.all([
    Buyer.findById(transaction.buyerId).populate("userId", "email phone role"),
    Exporter.findById(transaction.exporterId).populate("userId", "email phone role")
  ]);

  const recipients = [buyer?.userId?._id, exporter?.userId?._id].filter(Boolean);

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        recipientId,
        type: "payment",
        title,
        body,
        actionUrl,
        entityType: "Transaction",
        entityId: transaction._id.toString(),
        priority
      })
    )
  );
};

export const createTradeTransaction = async ({
  user,
  exporterId,
  rfqId,
  amount,
  currency,
  paymentMethod
}) => {
  const buyer = await getBuyerByUserId(user._id);

  if (!buyer) {
    throw createHttpError(404, "Buyer profile not found");
  }

  const exporter = await getExporterById(exporterId);

  if (!exporter || exporter.approvalState !== "approved") {
    throw createHttpError(404, "Approved exporter not found");
  }

  let rfq = null;
  if (rfqId) {
    rfq = await RFQ.findOne({ _id: rfqId, buyerId: buyer._id });
    if (!rfq) {
      throw createHttpError(404, "RFQ not found");
    }
  }

  const paymentRouting = resolvePaymentMethods(buyer.country);

  const transaction = await Transaction.create({
    buyerId: buyer._id,
    exporterId: exporter._id,
    rfqId: rfq?._id || null,
    amount,
    currency: normalizeCurrency(currency),
    baseAmount: amount,
    baseCurrency: defaultBaseCurrency,
    provider: paymentRouting.provider,
    paymentMethod,
    status: "pending",
    escrowStatus: "pending"
  });

  await createAuditLog({
    actorId: user._id,
    actorRole: user.role,
    action: "transaction.created",
    entityType: "Transaction",
    entityId: transaction._id.toString(),
    metadata: {
      title: "Secure trade started",
      summary: `${buyer.companyName} opened a secure trade with ${exporter.companyName}.`,
      country: buyer.normalizedCountry,
      countryLabel: buyer.country,
      product: rfq?.normalizedProduct || "",
      productLabel: rfq?.product || "",
      status: "pending",
      companyName: buyer.companyName,
      exporterId,
      rfqId,
      provider: paymentRouting.provider
    },
    notification: {
      type: "transaction",
      title: "New secure trade created",
      body: `${buyer.companyName} started a secure trade for ${rfq?.product || "a matched request"}.`,
      actionUrl: "/matches"
    }
  });

  await createNotification({
    recipientId: exporter.userId._id,
    type: "transaction",
    title: "Buyer started a secure trade",
    body: `${buyer.companyName} opened a new secure trade with your company.`,
    actionUrl: "/matches",
    entityType: "Transaction",
    entityId: transaction._id.toString(),
    metadata: {
      transactionId: transaction._id.toString()
    }
  });

  return transaction;
};

export const createTradePaymentIntent = async ({ transaction, country }) => {
  const paymentRouting = resolvePaymentMethods(country);

  let providerResponse;
  if (paymentRouting.provider === "razorpay") {
    providerResponse = await createRazorpayOrder({
      amount: transaction.amount,
      currency: transaction.currency,
      transactionId: transaction._id,
      supportedMethods: paymentRouting.supportedMethods
    });
  } else {
    providerResponse = await createStripePaymentIntent({
      amount: transaction.amount,
      currency: transaction.currency,
      transactionId: transaction._id,
      supportedMethods: paymentRouting.supportedMethods
    });
  }

  const paymentIntent = await PaymentIntent.create({
    transactionId: transaction._id,
    provider: providerResponse.provider,
    country,
    amount: transaction.amount,
    currency: transaction.currency,
    supportedMethods: providerResponse.supportedMethods,
    status: "created",
    clientSecret: providerResponse.clientSecret || "",
    providerReference: providerResponse.providerReference || "",
    providerOrderId: providerResponse.providerOrderId || "",
    rawResponse: providerResponse.rawResponse || {}
  });

  transaction.status = "payment_processing";
  transaction.providerReference = providerResponse.providerReference || "";
  transaction.providerOrderId = providerResponse.providerOrderId || "";
  transaction.providerPayload = providerResponse.rawResponse || {};
  await transaction.save();

  await createAuditLog({
    action: "transaction.payment_intent.created",
    entityType: "Transaction",
    entityId: transaction._id.toString(),
    metadata: {
      title: "Payment intent created",
      summary: `Payment routing locked to ${paymentIntent.provider} for transaction ${transaction._id}.`,
      status: "payment_processing",
      paymentIntentId: paymentIntent._id.toString(),
      provider: paymentIntent.provider
    }
  });

  return paymentIntent;
};

export const confirmDelivery = async ({ transaction, actor }) => {
  if (!["payment_processing", "in_escrow"].includes(transaction.status)) {
    throw createHttpError(400, "Transaction cannot be confirmed for delivery");
  }

  transaction.status = "released";
  transaction.escrowStatus = "released";
  transaction.releasedAt = new Date();
  await transaction.save();

  await createAuditLog({
    actorId: actor._id,
    actorRole: actor.role,
    action: "transaction.released",
    entityType: "Transaction",
    entityId: transaction._id.toString(),
    metadata: {
      title: "Escrow released",
      summary: `Funds were released for transaction ${transaction._id}.`,
      status: "released"
    }
  });

  const exporter = await Exporter.findById(transaction.exporterId).populate(
    "userId",
    "email phone role"
  );

  if (exporter?.userId?._id) {
    await createNotification({
      recipientId: exporter.userId._id,
      type: "transaction",
      title: "Funds released",
      body: "Buyer confirmed delivery and your escrow funds were released.",
      actionUrl: "/profile",
      entityType: "Transaction",
      entityId: transaction._id.toString(),
      metadata: {
        status: "released"
      }
    });
  }

  return transaction;
};

export const disputeTransaction = async ({ transaction, actor, reason }) => {
  transaction.status = "disputed";
  transaction.escrowStatus = "disputed";
  transaction.disputedAt = new Date();
  transaction.disputeReason = reason || "";
  await transaction.save();

  await createAuditLog({
    actorId: actor._id,
    actorRole: actor.role,
    action: "transaction.disputed",
    entityType: "Transaction",
    entityId: transaction._id.toString(),
    metadata: {
      title: "Transaction disputed",
      summary: `A dispute was opened for transaction ${transaction._id}.`,
      status: "disputed",
      reason: transaction.disputeReason
    },
    notification: {
      type: "transaction",
      title: "Transaction disputed",
      body: `A secure trade was marked as disputed for transaction ${transaction._id}.`,
      actionUrl: "/profile"
    }
  });

  const buyer = await Buyer.findById(transaction.buyerId).populate("userId", "email phone role");
  const exporter = await Exporter.findById(transaction.exporterId).populate(
    "userId",
    "email phone role"
  );

  const recipients = [buyer?.userId?._id, exporter?.userId?._id].filter(Boolean);
  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        recipientId,
        type: "transaction",
        title: "Trade moved to dispute",
        body: "A dispute has been opened and the escrow is now locked for review.",
        actionUrl: "/profile",
        entityType: "Transaction",
        entityId: transaction._id.toString(),
        metadata: {
          status: "disputed"
        }
      })
    )
  );

  return transaction;
};

const recordWebhookEvent = async ({
  provider,
  providerEventId,
  eventType,
  signature,
  payload
}) =>
  WebhookEvent.findOneAndUpdate(
    {
      provider,
      providerEventId
    },
    {
      provider,
      providerEventId,
      eventType,
      signature,
      payload,
      processingStatus: "received"
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

export const handleStripeWebhook = async ({ payloadBuffer, signature }) => {
  const event = constructStripeWebhookEvent(payloadBuffer, signature);
  const webhookEvent = await recordWebhookEvent({
    provider: "stripe",
    providerEventId: event.id,
    eventType: event.type,
    signature,
    payload: event
  });

  const transactionId = event.data?.object?.metadata?.transactionId;
  if (!transactionId) {
    webhookEvent.processingStatus = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw createHttpError(404, "Transaction not found for webhook");
  }

  if (event.type === "payment_intent.succeeded") {
    transaction.status = "in_escrow";
    transaction.escrowStatus = "held";
    transaction.paymentConfirmedAt = new Date();
    transaction.providerPaymentId = event.data.object.id;
    await transaction.save();

    await createAuditLog({
      action: "transaction.escrow.held",
      entityType: "Transaction",
      entityId: transaction._id.toString(),
      metadata: {
        title: "Funds moved to escrow",
        summary: `Stripe payment succeeded and funds are now held in escrow-style state.`,
        status: "in_escrow",
        provider: "stripe"
      }
    });

    await notifyTransactionParties({
      transaction,
      title: "Payment moved to escrow",
      body: "Payment succeeded and funds are now held in escrow-style protection."
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    transaction.status = "failed";
    transaction.escrowStatus = "pending";
    await transaction.save();

    await createAuditLog({
      action: "transaction.payment.failed",
      entityType: "Transaction",
      entityId: transaction._id.toString(),
      metadata: {
        title: "Payment failed",
        summary: "Stripe reported a failed payment attempt for this secure trade.",
        status: "failed",
        provider: "stripe"
      }
    });

    await notifyTransactionParties({
      transaction,
      title: "Payment failed",
      body: "A payment attempt failed for this secure trade. Retry payment to continue.",
      priority: "critical"
    });
  }

  webhookEvent.processingStatus = "processed";
  webhookEvent.processedAt = new Date();
  await webhookEvent.save();

  return webhookEvent;
};

export const handleRazorpayWebhook = async ({ rawBody, signature, payload }) => {
  const signatureValid = validateRazorpayWebhookSignature(rawBody, signature);

  if (!signatureValid) {
    throw createHttpError(400, "Invalid Razorpay webhook signature");
  }

  const providerEventId =
    payload.payload?.payment?.entity?.id ||
    payload.payload?.order?.entity?.id ||
    `${payload.event}-${Date.now()}`;

  const webhookEvent = await recordWebhookEvent({
    provider: "razorpay",
    providerEventId,
    eventType: payload.event,
    signature,
    payload
  });

  const orderId = payload.payload?.order?.entity?.id;
  if (!orderId) {
    webhookEvent.processingStatus = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  const transaction = await Transaction.findOne({ providerOrderId: orderId });
  if (!transaction) {
    throw createHttpError(404, "Transaction not found for Razorpay webhook");
  }

  if (payload.event === "payment.captured") {
    transaction.status = "in_escrow";
    transaction.escrowStatus = "held";
    transaction.paymentConfirmedAt = new Date();
    transaction.providerPaymentId = payload.payload.payment.entity.id;
    await transaction.save();

    await createAuditLog({
      action: "transaction.escrow.held",
      entityType: "Transaction",
      entityId: transaction._id.toString(),
      metadata: {
        title: "Funds moved to escrow",
        summary: `Razorpay payment was captured and funds are now held in escrow-style state.`,
        status: "in_escrow",
        provider: "razorpay"
      }
    });

    await notifyTransactionParties({
      transaction,
      title: "Payment moved to escrow",
      body: "Payment was captured and funds are now held in escrow-style protection."
    });
  }

  if (payload.event === "payment.failed") {
    transaction.status = "failed";
    transaction.escrowStatus = "pending";
    await transaction.save();

    await createAuditLog({
      action: "transaction.payment.failed",
      entityType: "Transaction",
      entityId: transaction._id.toString(),
      metadata: {
        title: "Payment failed",
        summary: "Razorpay reported a failed payment attempt for this secure trade.",
        status: "failed",
        provider: "razorpay"
      }
    });

    await notifyTransactionParties({
      transaction,
      title: "Payment failed",
      body: "A payment attempt failed for this secure trade. Retry payment to continue.",
      priority: "critical"
    });
  }

  webhookEvent.processingStatus = "processed";
  webhookEvent.processedAt = new Date();
  await webhookEvent.save();

  return webhookEvent;
};
