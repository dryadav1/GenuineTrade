function formatDateValue(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializePlan(plan) {
  if (!plan) {
    return null;
  }

  return {
    id: plan._id?.toString?.() || plan.id,
    name: plan.name,
    price: Number(plan.price || 0),
    duration: plan.duration,
    features: Array.isArray(plan.features) ? plan.features : [],
    isPopular: Boolean(plan.isPopular),
    createdAt: formatDateValue(plan.createdAt),
    updatedAt: formatDateValue(plan.updatedAt),
  };
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const currentPlan =
    user.currentPlan && typeof user.currentPlan === "object" && (user.currentPlan._id || user.currentPlan.id)
      ? serializePlan(user.currentPlan)
      : user.currentPlan
        ? { id: user.currentPlan.toString() }
        : null;

  return {
    id: user._id?.toString?.() || user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    currentPlan,
    planExpiry: formatDateValue(user.planExpiry),
    createdAt: formatDateValue(user.createdAt),
    updatedAt: formatDateValue(user.updatedAt),
  };
}

function serializeExporter(exporter) {
  if (!exporter) {
    return null;
  }

  return {
    id: exporter._id?.toString?.() || exporter.id,
    userId: exporter.userId?._id?.toString?.() || exporter.userId?.toString?.() || exporter.userId || null,
    name: exporter.name,
    companyName: exporter.companyName,
    product: exporter.product,
    country: exporter.country,
    contact: exporter.contact,
    status: exporter.status,
    createdAt: formatDateValue(exporter.createdAt),
    updatedAt: formatDateValue(exporter.updatedAt),
  };
}

function serializeRfq(rfq) {
  if (!rfq) {
    return null;
  }

  return {
    id: rfq._id?.toString?.() || rfq.id,
    userId: rfq.userId?._id?.toString?.() || rfq.userId?.toString?.() || rfq.userId || null,
    name: rfq.name,
    product: rfq.product,
    quantity: rfq.quantity,
    country: rfq.country,
    contact: rfq.contact,
    status: rfq.status,
    createdAt: formatDateValue(rfq.createdAt),
    updatedAt: formatDateValue(rfq.updatedAt),
  };
}

function serializePayment(payment) {
  if (!payment) {
    return null;
  }

  const plan =
    payment.planId && typeof payment.planId === "object" && (payment.planId._id || payment.planId.id)
      ? serializePlan(payment.planId)
      : payment.planId
        ? { id: payment.planId.toString() }
        : null;

  return {
    id: payment._id?.toString?.() || payment.id,
    userId: payment.userId?._id?.toString?.() || payment.userId?.toString?.() || payment.userId,
    planId: plan?.id || null,
    plan,
    orderId: payment.orderId,
    paymentId: payment.paymentId || "",
    amount: Number(payment.amount || 0),
    status: payment.status,
    createdAt: formatDateValue(payment.createdAt),
    updatedAt: formatDateValue(payment.updatedAt),
  };
}

module.exports = {
  sanitizeUser,
  serializeExporter,
  serializePlan,
  serializePayment,
  serializeRfq,
};
