import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createHttpError } from "../utils/httpErrors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.resolve(__dirname, "../../uploads");
const verificationRoot = path.resolve(uploadsRoot, "verification");

const maxFileSizeBytes = Number(process.env.KYC_DOCUMENT_MAX_SIZE_BYTES || 5 * 1024 * 1024);

const allowedMimeExtensions = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp"
};

const sanitizeFileName = (fileName) =>
  String(fileName || "document")
    .replace(/[^\w.\- ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120) || "document";

const getBase64Payload = (value) => {
  const rawValue = String(value || "");

  if (!rawValue) {
    throw createHttpError(400, "Document payload is required");
  }

  if (rawValue.startsWith("data:")) {
    const parts = rawValue.split(",");
    return parts[1] || "";
  }

  return rawValue;
};

const resolveExtension = ({ fileName, mimeType }) => {
  const fromMimeType = allowedMimeExtensions[mimeType];
  if (fromMimeType) {
    return fromMimeType;
  }

  const parsed = path.extname(fileName || "");
  return parsed || ".bin";
};

export const ensureVerificationStorageRoot = async () => {
  await fs.mkdir(verificationRoot, {
    recursive: true
  });
};

export const storeVerificationFile = async ({
  exporterId,
  documentType,
  fileName,
  mimeType,
  fileBase64
}) => {
  if (!allowedMimeExtensions[mimeType]) {
    throw createHttpError(400, "Only PDF, PNG, JPG, and WEBP files are allowed");
  }

  const payload = getBase64Payload(fileBase64);
  const buffer = Buffer.from(payload, "base64");

  if (!buffer.length) {
    throw createHttpError(400, "Document payload is invalid");
  }

  if (buffer.length > maxFileSizeBytes) {
    throw createHttpError(400, "Document exceeds the 5 MB upload limit");
  }

  await ensureVerificationStorageRoot();

  const safeFileName = sanitizeFileName(fileName);
  const relativeDirectory = path.join(
    String(exporterId),
    documentType
  );
  const directory = path.join(verificationRoot, relativeDirectory);
  await fs.mkdir(directory, {
    recursive: true
  });

  const storageFileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${resolveExtension({
    fileName: safeFileName,
    mimeType
  })}`;
  const storagePath = path.join(directory, storageFileName);
  await fs.writeFile(storagePath, buffer);

  return {
    fileName: safeFileName,
    mimeType,
    sizeBytes: buffer.length,
    storagePath: path.relative(uploadsRoot, storagePath).replace(/\\/g, "/")
  };
};

export const resolveStoredFilePath = (relativePath) => {
  const absolutePath = path.resolve(uploadsRoot, relativePath);

  if (!absolutePath.startsWith(uploadsRoot)) {
    throw createHttpError(400, "Invalid file path");
  }

  return absolutePath;
};
