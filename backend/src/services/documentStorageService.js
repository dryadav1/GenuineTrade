import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "../../uploads/onboarding");

const extensionByMime = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
const allowedMimeTypes = new Set(Object.keys(extensionByMime));
const maxBytesByField = {
  iec: 8 * 1024 * 1024,
  gst: 8 * 1024 * 1024,
  "product-images": 5 * 1024 * 1024
};

const sanitizeSegment = (value) =>
  String(value || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:(.*?);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid file payload.");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
};

const resolveExtension = (fileName, mimeType) => {
  const fallback = extensionByMime[mimeType] || "";
  const incoming = path.extname(String(fileName || ""));
  return incoming || fallback || ".bin";
};

export const saveUploadedFile = async ({ userId, field, file }) => {
  if (!file?.dataUrl) {
    return "";
  }

  const { buffer, mimeType } = parseDataUrl(file.dataUrl);

  if (!allowedMimeTypes.has(mimeType)) {
    throw createHttpError("Unsupported document type. Use PDF, JPG, PNG, or WEBP.");
  }

  const maxBytes = maxBytesByField[field];
  if (maxBytes && buffer.length > maxBytes) {
    throw createHttpError(
      `Uploaded ${field.replace(/-/g, " ")} file exceeds the allowed size limit.`
    );
  }

  const extension = resolveExtension(file.name, mimeType);
  const folderPath = path.join(uploadsRoot, sanitizeSegment(userId), sanitizeSegment(field));
  const fileName = `${Date.now()}-${sanitizeSegment(path.basename(file.name || field, extension))}${extension}`;
  const absolutePath = path.join(folderPath, fileName);

  await fs.mkdir(folderPath, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return `/uploads/onboarding/${sanitizeSegment(userId)}/${sanitizeSegment(field)}/${fileName}`;
};

export const saveUploadedFiles = async ({ userId, field, files }) => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const results = [];
  for (const file of files) {
    const savedPath = await saveUploadedFile({ userId, field, file });
    if (savedPath) {
      results.push(savedPath);
    }
  }

  return results;
};
