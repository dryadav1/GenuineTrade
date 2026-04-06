import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createHttpError } from "../utils/httpErrors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.resolve(__dirname, "../../uploads");
const chatRoot = path.resolve(uploadsRoot, "chat");

const maxFileSizeBytes = Number(process.env.CHAT_ATTACHMENT_MAX_SIZE_BYTES || 5 * 1024 * 1024);

const allowedMimeExtensions = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp"
};

const sanitizeSegment = (value) =>
  String(value || "file")
    .replace(/[^\w.\- ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120) || "file";

const getBase64Payload = (value) => {
  const rawValue = String(value || "");

  if (!rawValue) {
    throw createHttpError(400, "Attachment payload is required");
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

const getAttachmentType = (mimeType) => {
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return "file";
};

export const storeChatAttachment = async ({
  conversationId,
  userId,
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
    throw createHttpError(400, "Attachment payload is invalid");
  }

  if (buffer.length > maxFileSizeBytes) {
    throw createHttpError(400, "Attachment exceeds the 5 MB upload limit");
  }

  const folderPath = path.join(
    chatRoot,
    sanitizeSegment(conversationId || userId),
    sanitizeSegment(userId)
  );
  await fs.mkdir(folderPath, {
    recursive: true
  });

  const safeFileName = sanitizeSegment(fileName);
  const storageFileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${resolveExtension({
    fileName: safeFileName,
    mimeType
  })}`;
  const absolutePath = path.join(folderPath, storageFileName);
  await fs.writeFile(absolutePath, buffer);

  return {
    name: safeFileName,
    url: `/uploads/chat/${sanitizeSegment(conversationId || userId)}/${sanitizeSegment(userId)}/${storageFileName}`,
    type: getAttachmentType(mimeType),
    size: buffer.length,
    mimeType
  };
};
