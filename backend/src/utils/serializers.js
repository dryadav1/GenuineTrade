const serializeContactUser = (user) => {
  if (!user || user.email === undefined) {
    return null;
  }

  return {
    id: user._id,
    name: user.name || "",
    email: user.email,
    phone: user.phone,
    role: user.role,
    publicId: user.publicId || null,
    emailVerified: user.emailVerified ?? false
  };
};

export const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  role: user.role,
  email: user.email,
  company: user.company || "",
  country: user.country || "",
  phone: user.phone || "",
  iec: user.iec || "",
  gst: user.gst || "",
  hsnCode: user.hsnCode || "",
  productName: user.productName || "",
  productCategory: user.productCategory || "",
  importId: user.importId || "",
  requirement: user.requirement || "",
  documents: {
    iecFile: user.documents?.iecFile || "",
    gstFile: user.documents?.gstFile || "",
    productImages: user.documents?.productImages || []
  },
  profileCompleted: user.profileCompleted ?? false,
  status: user.status || "pending",
  badge: user.badge || "none",
  publicId: user.publicId || null,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  subscriptionPlan: user.subscriptionPlan || "free",
  planStartDate: user.planStartDate || null,
  planExpiry: user.planExpiry || null,
  accountStatus: user.accountStatus,
  adminAccessLevel: user.adminAccessLevel,
  notificationPreferences: user.notificationPreferences,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt
});

export const serializeVerificationDocument = (document) => ({
  id: document._id,
  documentType: document.documentType,
  label:
    {
      iec: "IEC Certificate",
      gst: "GST Certificate",
      bank_proof: "Bank Proof"
    }[document.documentType] || document.documentType,
  fileName: document.fileName,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
  version: document.version,
  status: document.status,
  reviewRemarks: document.reviewRemarks,
  reviewedAt: document.reviewedAt,
  reviewedBy: serializeContactUser(document.reviewedBy),
  validation: document.validation || {},
  createdAt: document.createdAt,
  downloadPath: `/exporters/documents/${document._id}/file`
});

export const serializeExporter = (exporter) => ({
  id: exporter._id,
  companyName: exporter.companyName,
  gstNumber: exporter.gstNumber,
  iecCode: exporter.iecCode,
  products: exporter.products,
  certifications: exporter.certifications || [],
  country: exporter.country,
  status: exporter.status,
  approvalState: exporter.approvalState,
  verificationStage: exporter.verificationStage,
  verificationChecklist: exporter.verificationChecklist,
  verificationNotes: exporter.verificationNotes,
  verificationHistory: exporter.verificationHistory || [],
  reviewedAt: exporter.reviewedAt,
  verifiedAt: exporter.verifiedAt,
  trustScore: exporter.trustScore,
  profileViews: exporter.profileViews || 0,
  discoveryScore: exporter.discoveryScore ?? null,
  discoveryReasons: exporter.discoveryReasons || [],
  isSaved: exporter.isSaved ?? false,
  kycSummary: exporter.kycSummary || null,
  verificationDocuments: (exporter.verificationDocuments || []).map(
    serializeVerificationDocument
  ),
  createdAt: exporter.createdAt,
  user: serializeContactUser(exporter.userId)
});

export const serializeBuyer = (buyer) => ({
  id: buyer._id,
  companyName: buyer.companyName,
  country: buyer.country,
  businessId: buyer.businessId,
  businessType: buyer.businessType || "",
  importProducts: buyer.importProducts || [],
  certifications: buyer.certifications || [],
  trustScore: buyer.trustScore ?? 0,
  kycStatus: buyer.kycStatus || "not_started",
  savedExporterCount: buyer.savedExporterIds?.length || 0,
  createdAt: buyer.createdAt,
  user: serializeContactUser(buyer.userId)
});

export const serializeRFQ = (rfq) => ({
  id: rfq._id,
  product: rfq.product,
  quantity: rfq.quantity,
  country: rfq.country,
  budget: rfq.budget,
  matchCount: rfq.matchCount || 0,
  topMatchScore: rfq.topMatchScore || 0,
  createdAt: rfq.createdAt,
  buyer: rfq.buyerId?.companyName ? serializeBuyer(rfq.buyerId) : null
});

export const serializeMatch = (match) => ({
  id: match._id,
  rfqId: match.rfqId?._id || match.rfqId,
  buyerId: match.buyerId?._id || match.buyerId,
  exporterId: match.exporterId?._id || match.exporterId,
  productScore: match.productScore,
  countryScore: match.countryScore,
  trustScore: match.trustScore,
  totalScore: match.totalScore,
  reasons: match.reasons || [],
  exporterStatusSnapshot: match.exporterStatusSnapshot,
  trustBadgeSnapshot: match.trustBadgeSnapshot,
  assignmentSource: match.assignmentSource,
  leadStatus: match.leadStatus,
  assignedAt: match.assignedAt,
  lastStatusUpdatedAt: match.lastStatusUpdatedAt,
  createdAt: match.createdAt,
  buyer: match.buyerId?.companyName ? serializeBuyer(match.buyerId) : null,
  exporter: match.exporterId?.companyName ? serializeExporter(match.exporterId) : null,
  rfq: match.rfqId?.product ? serializeRFQ(match.rfqId) : null
});

export const serializeTransaction = (transaction) => ({
  id: transaction._id,
  amount: transaction.amount,
  currency: transaction.currency,
  baseAmount: transaction.baseAmount,
  baseCurrency: transaction.baseCurrency,
  provider: transaction.provider,
  paymentMethod: transaction.paymentMethod,
  providerReference: transaction.providerReference,
  providerOrderId: transaction.providerOrderId,
  providerPaymentId: transaction.providerPaymentId,
  status: transaction.status,
  escrowStatus: transaction.escrowStatus,
  shipmentMarkedAt: transaction.shipmentMarkedAt,
  paymentConfirmedAt: transaction.paymentConfirmedAt,
  releasedAt: transaction.releasedAt,
  disputedAt: transaction.disputedAt,
  disputeReason: transaction.disputeReason,
  refundStatus: transaction.refundStatus,
  refundedAt: transaction.refundedAt,
  refundReference: transaction.refundReference,
  refundReason: transaction.refundReason,
  createdAt: transaction.createdAt,
  buyer: transaction.buyerId?.companyName ? serializeBuyer(transaction.buyerId) : null,
  exporter: transaction.exporterId?.companyName
    ? serializeExporter(transaction.exporterId)
    : null,
  rfq: transaction.rfqId?.product ? serializeRFQ(transaction.rfqId) : null
});

export const serializePaymentIntent = (paymentIntent) => ({
  id: paymentIntent._id,
  provider: paymentIntent.provider,
  country: paymentIntent.country,
  amount: paymentIntent.amount,
  currency: paymentIntent.currency,
  supportedMethods: paymentIntent.supportedMethods,
  status: paymentIntent.status,
  clientSecret: paymentIntent.clientSecret,
  providerReference: paymentIntent.providerReference,
  providerOrderId: paymentIntent.providerOrderId,
  expiresAt: paymentIntent.expiresAt,
  createdAt: paymentIntent.createdAt
});

export const serializeNotification = (notification) => ({
  id: notification._id,
  senderId: notification.senderId?._id || notification.senderId || null,
  type: notification.type,
  priority: notification.priority,
  title: notification.title,
  body: notification.body,
  actionUrl: notification.actionUrl,
  entityType: notification.entityType,
  entityId: notification.entityId,
  metadata: notification.metadata || {},
  delivery: notification.delivery || {},
  audience: notification.audience || "",
  isBroadcast: notification.isBroadcast || false,
  status: notification.status,
  readAt: notification.readAt,
  createdAt: notification.createdAt
});

export const serializeActivityLog = (log) => ({
  id: log._id,
  action: log.action,
  actorRole: log.actorRole,
  entityType: log.entityType,
  entityId: log.entityId,
  title: log.metadata?.title || log.action,
  summary: log.metadata?.summary || "",
  country: log.metadata?.country || "",
  countryLabel: log.metadata?.countryLabel || "",
  product: log.metadata?.product || "",
  productLabel: log.metadata?.productLabel || "",
  status: log.metadata?.status || "",
  companyName: log.metadata?.companyName || "",
  metadata: log.metadata || {},
  createdAt: log.createdAt
});

export const serializeMessage = (message, currentUser = null) => ({
  id: message._id,
  conversationId: message.conversationId?._id || message.conversationId || null,
  threadId: message.threadId,
  body: message.body,
  attachments: message.attachments || [],
  createdAt: message.createdAt,
  sender: serializeContactUser(message.senderId),
  rfqId: message.rfqId?._id || message.rfqId || null,
  transactionId: message.transactionId?._id || message.transactionId || null,
  buyer: message.buyerId?.companyName ? serializeBuyer(message.buyerId) : null,
  exporter: message.exporterId?.companyName ? serializeExporter(message.exporterId) : null,
  isMine:
    currentUser !== null &&
    message.senderId?._id?.toString() === currentUser._id?.toString(),
  readBy: (message.readBy || []).map((readerId) => readerId.toString())
});

export const serializeConversation = (
  conversation,
  currentUser,
  { onlineUserIds = new Set() } = {}
) => {
  const currentUserId = currentUser?._id?.toString();
  const buyerUserId = conversation?.buyerId?.userId?._id?.toString();
  const exporterUserId = conversation?.exporterId?.userId?._id?.toString();
  const currentUserIsBuyer = Boolean(currentUserId && buyerUserId === currentUserId);
  const counterpartProfile = currentUserIsBuyer
    ? conversation?.exporterId
    : conversation?.buyerId;
  const counterpartUser = counterpartProfile?.userId || null;
  const counterpartUserId = counterpartUser?._id?.toString() || "";
  const participantState = (conversation?.participantStates || []).find(
    (state) => state.userId?.toString() === currentUserId
  );

  return {
    id: conversation._id,
    conversationId: conversation._id,
    conversationKey: conversation.conversationKey,
    participants: (conversation.participants || []).map((participantId) =>
      participantId.toString()
    ),
    unreadCount: participantState?.unreadCount || 0,
    lastReadAt: participantState?.lastReadAt || null,
    updatedAt: conversation.updatedAt,
    lastMessage: {
      text: conversation.lastMessage || "",
      createdAt: conversation.lastMessageAt || conversation.updatedAt,
      senderId:
        conversation.lastMessageSenderId?._id || conversation.lastMessageSenderId || null
    },
    counterpart: counterpartProfile
      ? {
          id: counterpartProfile._id,
          companyName: counterpartProfile.companyName || "",
          name: counterpartUser?.name || "",
          email: counterpartUser?.email || "",
          phone: counterpartUser?.phone || "",
          role: counterpartUser?.role || "",
          publicId: counterpartUser?.publicId || null,
          userId: counterpartUser?._id || null,
          isOnline: Boolean(
            counterpartUserId && onlineUserIds.has(counterpartUserId)
          )
        }
      : null,
    rfq: conversation.rfqId?.product ? serializeRFQ(conversation.rfqId) : null,
    transaction: conversation.transactionId?.amount
      ? serializeTransaction(conversation.transactionId)
      : null
  };
};

export const serializeMessageThread = (thread, currentUser) => {
  if (thread.conversationKey) {
    const conversation = serializeConversation(thread, currentUser);

    return {
      id: conversation.conversationKey,
      threadId: conversation.conversationKey,
      unreadCount: conversation.unreadCount,
      lastMessage: {
        body: conversation.lastMessage.text,
        createdAt: conversation.lastMessage.createdAt
      },
      counterpart: {
        id: conversation.counterpart?.id || null,
        companyName: conversation.counterpart?.companyName || "",
        user: conversation.counterpart
      },
      rfq: conversation.rfq,
      transaction: conversation.transaction
    };
  }

  const lastMessage = serializeMessage(thread.lastMessage, currentUser);
  const counterpart =
    currentUser.role === "buyer" ? lastMessage.exporter : lastMessage.buyer;

  return {
    id: thread.threadId,
    threadId: thread.threadId,
    unreadCount: thread.unreadCount || 0,
    lastMessage,
    counterpart,
    rfq: thread.lastMessage?.rfqId?.product ? serializeRFQ(thread.lastMessage.rfqId) : null,
    transaction: thread.lastMessage?.transactionId?.amount
      ? serializeTransaction(thread.lastMessage.transactionId)
      : null
  };
};
