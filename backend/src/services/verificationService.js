import Exporter from "../models/Exporter.js";
import VerificationDocument from "../models/VerificationDocument.js";
import VerificationLog from "../models/VerificationLog.js";
import { createAuditLog } from "./auditService.js";
import {
  createNotification,
  notifyAdmins
} from "./notificationService.js";
import {
  resolveStoredFilePath,
  storeVerificationFile
} from "./fileStorageService.js";
import { createHttpError } from "../utils/httpErrors.js";
import { normalizeCountry } from "../utils/matchHelpers.js";

export const verificationDocumentLabels = {
  iec: "IEC Certificate",
  gst: "GST Certificate",
  bank_proof: "Bank Proof"
};

const requiredDocumentTypes = ["iec", "gst", "bank_proof"];

const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const iecRegex = /^[A-Z]{5}\d{4}[A-Z]$/;

const normalizeUpper = (value) => String(value || "").trim().toUpperCase();

const buildFieldValidation = ({ documentType, exporter }) => {
  if (documentType === "iec") {
    const fieldValue = normalizeUpper(exporter.iecCode);
    const formatValid = iecRegex.test(fieldValue);
    return {
      fieldValue,
      formatValid,
      status: formatValid ? "valid" : "invalid",
      issues: formatValid ? [] : ["IEC format must match PAN-style 10 character format"]
    };
  }

  if (documentType === "gst") {
    const fieldValue = normalizeUpper(exporter.gstNumber);
    const formatValid = gstRegex.test(fieldValue);
    return {
      fieldValue,
      formatValid,
      status: formatValid ? "valid" : "invalid",
      issues: formatValid ? [] : ["GST format is invalid"]
    };
  }

  return {
    fieldValue: "",
    formatValid: true,
    status: "not_applicable",
    issues: []
  };
};

const updateChecklistForDocument = ({ exporter, documentType, status, validation }) => {
  const isApproved = status === "approved";

  if (documentType === "iec") {
    exporter.verificationChecklist.iecDocumentUploaded = true;
    exporter.verificationChecklist.iecValidated = isApproved && validation.formatValid;
  }

  if (documentType === "gst") {
    exporter.verificationChecklist.gstDocumentUploaded = true;
    exporter.verificationChecklist.gstValidated = isApproved && validation.formatValid;
  }

  if (documentType === "bank_proof") {
    exporter.verificationChecklist.bankProofUploaded = true;
    exporter.verificationChecklist.bankValidated = isApproved;
  }
};

const serializeDocumentGroup = (documents) =>
  requiredDocumentTypes.reduce((accumulator, documentType) => {
    accumulator[documentType] = documents.find((document) => document.documentType === documentType) || null;
    return accumulator;
  }, {});

export const getLatestVerificationDocuments = async (exporterId) =>
  VerificationDocument.find({
    exporterId,
    isLatest: true
  })
    .sort({ documentType: 1, createdAt: -1 })
    .populate("reviewedBy", "email role");

export const buildKycSummary = ({ exporter, documents }) => {
  const latestDocuments = serializeDocumentGroup(documents);
  const validations = {
    iec: buildFieldValidation({
      documentType: "iec",
      exporter
    }),
    gst: buildFieldValidation({
      documentType: "gst",
      exporter
    })
  };
  const missingDocumentTypes = requiredDocumentTypes.filter(
    (documentType) => !latestDocuments[documentType]
  );
  const approvedDocumentTypes = requiredDocumentTypes.filter(
    (documentType) => latestDocuments[documentType]?.status === "approved"
  );

  return {
    requiredDocumentTypes,
    uploadedCount: requiredDocumentTypes.length - missingDocumentTypes.length,
    approvedCount: approvedDocumentTypes.length,
    missingDocumentTypes,
    readyForReview:
      missingDocumentTypes.length === 0 &&
      validations.iec.formatValid &&
      validations.gst.formatValid,
    validations,
    documentStatuses: requiredDocumentTypes.map((documentType) => ({
      documentType,
      label: verificationDocumentLabels[documentType],
      status: latestDocuments[documentType]?.status || "missing",
      version: latestDocuments[documentType]?.version || 0
    }))
  };
};

export const hydrateExporterVerification = async (exporter) => {
  const documents = await getLatestVerificationDocuments(exporter._id);
  exporter.verificationDocuments = documents;
  exporter.kycSummary = buildKycSummary({
    exporter,
    documents
  });
  return exporter;
};

export const hydrateExportersVerification = async (exporters) => {
  const exporterIds = exporters.map((exporter) => exporter._id);
  const documents = await VerificationDocument.find({
    exporterId: {
      $in: exporterIds
    },
    isLatest: true
  })
    .sort({ createdAt: -1 })
    .populate("reviewedBy", "email role");

  const documentsByExporter = documents.reduce((map, document) => {
    const key = document.exporterId.toString();
    map[key] = map[key] || [];
    map[key].push(document);
    return map;
  }, {});

  exporters.forEach((exporter) => {
    const exporterDocuments = documentsByExporter[exporter._id.toString()] || [];
    exporter.verificationDocuments = exporterDocuments;
    exporter.kycSummary = buildKycSummary({
      exporter,
      documents: exporterDocuments
    });
  });

  return exporters;
};

export const uploadVerificationDocument = async ({
  user,
  exporter,
  documentType,
  fileName,
  mimeType,
  fileBase64
}) => {
  if (!requiredDocumentTypes.includes(documentType)) {
    throw createHttpError(400, "Document type must be iec, gst, or bank_proof");
  }

  const validation = buildFieldValidation({
    documentType,
    exporter
  });
  const storedFile = await storeVerificationFile({
    exporterId: exporter._id.toString(),
    documentType,
    fileName,
    mimeType,
    fileBase64
  });

  const currentLatest = await VerificationDocument.findOne({
    exporterId: exporter._id,
    documentType,
    isLatest: true
  });

  if (currentLatest) {
    currentLatest.isLatest = false;
    await currentLatest.save();
  }

  const document = await VerificationDocument.create({
    exporterId: exporter._id,
    userId: user._id,
    documentType,
    fileName: storedFile.fileName,
    storagePath: storedFile.storagePath,
    mimeType: storedFile.mimeType,
    sizeBytes: storedFile.sizeBytes,
    version: (currentLatest?.version || 0) + 1,
    isLatest: true,
    status: "uploaded",
    validation
  });

  updateChecklistForDocument({
    exporter,
    documentType,
    status: "uploaded",
    validation
  });

  if (exporter.verificationStage === "documents_requested") {
    exporter.verificationStage = "submitted";
  }

  exporter.verificationHistory.push({
    stage: exporter.verificationStage,
    note: `${verificationDocumentLabels[documentType]} uploaded`,
    updatedByEmail: user.email,
    updatedAt: new Date()
  });
  await exporter.save();

  await VerificationLog.create({
    exporterId: exporter._id,
    documentId: document._id,
    actorId: user._id,
    action: "document.uploaded",
    documentType,
    status: document.status,
    remarks: `${verificationDocumentLabels[documentType]} uploaded`,
    metadata: {
      version: document.version
    }
  });

  await createAuditLog({
    actorId: user._id,
    actorRole: user.role,
    action: "verification.document.uploaded",
    entityType: "VerificationDocument",
    entityId: document._id.toString(),
    metadata: {
      title: "Verification document uploaded",
      summary: `${exporter.companyName} uploaded ${verificationDocumentLabels[documentType]}.`,
      country: normalizeCountry(exporter.country),
      countryLabel: exporter.country,
      status: document.status,
      companyName: exporter.companyName,
      documentType
    }
  });

  await createNotification({
    recipientId: user._id,
    type: "verification",
    title: "Document uploaded successfully",
    body: `${verificationDocumentLabels[documentType]} is ready for review.`,
    actionUrl: "/profile",
    entityType: "VerificationDocument",
    entityId: document._id.toString()
  });

  return document;
};

export const submitExporterKycForReview = async ({ user, exporter }) => {
  const documents = await getLatestVerificationDocuments(exporter._id);
  const summary = buildKycSummary({
    exporter,
    documents
  });

  if (!summary.readyForReview) {
    throw createHttpError(
      400,
      "Upload IEC, GST, and bank proof documents and fix format issues before submitting"
    );
  }

  exporter.approvalState = "pending";
  exporter.verificationStage = "under_review";
  exporter.verificationNotes = "KYC submitted for review";
  exporter.verificationHistory.push({
    stage: "under_review",
    note: "KYC submitted for admin review",
    updatedByEmail: user.email,
    updatedAt: new Date()
  });
  await exporter.save();

  await VerificationDocument.updateMany(
    {
      exporterId: exporter._id,
      isLatest: true,
      status: "uploaded"
    },
    {
      $set: {
        status: "under_review"
      }
    }
  );

  await VerificationLog.create({
    exporterId: exporter._id,
    actorId: user._id,
    action: "kyc.submitted",
    status: "under_review",
    remarks: "KYC submitted for review"
  });

  await notifyAdmins({
    type: "verification",
    title: "New KYC review requested",
    body: `${exporter.companyName} submitted verification documents for review.`,
    actionUrl: "/control-center"
  });

  return hydrateExporterVerification(exporter);
};

export const reviewVerificationDocument = async ({
  actor,
  documentId,
  status,
  remarks = ""
}) => {
  if (!["under_review", "approved", "rejected", "changes_requested"].includes(status)) {
    throw createHttpError(
      400,
      "Document status must be under_review, approved, rejected, or changes_requested"
    );
  }

  const document = await VerificationDocument.findById(documentId)
    .populate("userId", "email role")
    .populate("reviewedBy", "email role");

  if (!document) {
    throw createHttpError(404, "Verification document not found");
  }

  const exporter = await Exporter.findById(document.exporterId).populate(
    "userId",
    "email phone role"
  );

  if (!exporter) {
    throw createHttpError(404, "Exporter not found");
  }

  document.status = status;
  document.reviewRemarks = String(remarks || "").trim();
  document.reviewedBy = actor._id;
  document.reviewedAt = new Date();
  document.reviewHistory.push({
    status,
    remarks: document.reviewRemarks,
    reviewedBy: actor._id,
    reviewedAt: document.reviewedAt
  });
  await document.save();

  updateChecklistForDocument({
    exporter,
    documentType: document.documentType,
    status,
    validation: document.validation
  });

  if (status === "changes_requested" || status === "rejected") {
    exporter.verificationStage = "documents_requested";
    exporter.approvalState = "pending";
    exporter.verificationNotes = document.reviewRemarks;
  }

  exporter.reviewedAt = new Date();
  exporter.verificationHistory.push({
    stage: exporter.verificationStage,
    note: `${verificationDocumentLabels[document.documentType]} marked ${status}${document.reviewRemarks ? `: ${document.reviewRemarks}` : ""}`,
    updatedByEmail: actor.email,
    updatedAt: new Date()
  });
  await exporter.save();

  await VerificationLog.create({
    exporterId: exporter._id,
    documentId: document._id,
    actorId: actor._id,
    action: "document.reviewed",
    documentType: document.documentType,
    status,
    remarks: document.reviewRemarks
  });

  await createNotification({
    recipientId: exporter.userId._id,
    senderId: actor._id,
    type: "verification",
    title: "Verification document reviewed",
    body: `${verificationDocumentLabels[document.documentType]} is now ${status.replaceAll("_", " ")}.`,
    actionUrl: "/profile",
    entityType: "VerificationDocument",
    entityId: document._id.toString(),
    metadata: {
      documentType: document.documentType,
      status,
      remarks: document.reviewRemarks
    }
  });

  return {
    document,
    exporter: await hydrateExporterVerification(exporter)
  };
};

export const getVerificationDocumentForActor = async ({ actor, documentId }) => {
  const document = await VerificationDocument.findById(documentId);

  if (!document || !document.isLatest) {
    throw createHttpError(404, "Verification document not found");
  }

  const exporter = await Exporter.findById(document.exporterId);
  if (!exporter) {
    throw createHttpError(404, "Exporter not found");
  }

  if (
    actor.role !== "admin" &&
    exporter.userId.toString() !== actor._id.toString()
  ) {
    throw createHttpError(403, "You do not have access to this verification document");
  }

  return {
    document,
    absolutePath: resolveStoredFilePath(document.storagePath)
  };
};
