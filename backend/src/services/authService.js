import crypto from "crypto";
import User from "../models/User.js";
import { createNotification } from "./notificationService.js";
import { ensureUserPublicId } from "./publicIdService.js";
import { cacheService } from "./cacheService.js";
import { createHttpError } from "../utils/httpErrors.js";

const emailVerificationTtlMinutes = Number(
  process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES || 24 * 60
);
const loginOtpTtlSeconds = Number(process.env.LOGIN_OTP_TTL_SECONDS || 300);
const loginOtpMaxAttempts = Number(process.env.LOGIN_OTP_MAX_ATTEMPTS || 3);

const loginOtpChannels = ["sms", "email", "whatsapp"];
const allowLocalOtpDebug = process.env.NODE_ENV !== "production";

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const createEmailVerificationToken = () => crypto.randomBytes(32).toString("hex");
const createLoginChallengeId = () => crypto.randomBytes(12).toString("hex");
const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const buildLoginChallengeCacheKey = (challengeId) => `auth:login:${challengeId}`;

const resolvePrimaryClientUrl = () =>
  process.env.FRONTEND_URL?.trim() ||
  process.env.CLIENT_URL?.split(",").map((value) => value.trim()).filter(Boolean)[0] ||
  "http://localhost:3000";

const formatDurationLabel = (minutes) => {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `${minutes} minutes`;
};

const formatOtpExpiryLabel = () => {
  const minutes = Math.max(1, Math.round(loginOtpTtlSeconds / 60));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
};

const normalizePhoneNumber = (value) =>
  String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

export const isValidE164PhoneNumber = (value) =>
  /^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(value));

export const normalizeE164PhoneNumber = (value) => normalizePhoneNumber(value);

const maskEmail = (email) => {
  const [localPart = "", domain = ""] = String(email || "").split("@");

  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
};

const maskPhone = (phone) => {
  const normalized = normalizePhoneNumber(phone);

  if (!normalized) {
    return "";
  }

  if (normalized.length <= 6) {
    return `${normalized.slice(0, 1)}***${normalized.slice(-2)}`;
  }

  return `${normalized.slice(0, 3)}***${normalized.slice(-3)}`;
};

const createVerificationUrl = (token, email) => {
  const clientUrl = resolvePrimaryClientUrl();
  const params = new URLSearchParams({
    token,
    email
  });

  return `${clientUrl}/verify-email?${params.toString()}`;
};

const assertOtpChannel = (channel) => {
  if (!loginOtpChannels.includes(channel)) {
    throw createHttpError(400, "Login channel must be sms, email, or whatsapp");
  }
};

const resolveOtpTarget = (user, channel) => {
  if (channel === "email") {
    return user.email;
  }

  return normalizePhoneNumber(user.phone);
};

const buildOtpBody = (otpCode) =>
  `Your GenuineTrade login code is ${otpCode}. It expires in ${formatOtpExpiryLabel()}.`;

const getRemainingChallengeTtlSeconds = (challengeRecord) => {
  const expiresAt = new Date(challengeRecord.expiresAt).getTime();
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
};

const getWhatsAppProviderReady = () =>
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_WHATSAPP_NUMBER;

const sendWhatsAppMessage = async ({ to, body }) => {
  if (!getWhatsAppProviderReady()) {
    return {
      status: "skipped",
      error: "WhatsApp provider not configured"
    };
  }

  const target = normalizePhoneNumber(to);
  if (!target) {
    return {
      status: "skipped",
      error: "User phone missing"
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: target.startsWith("whatsapp:") ? target : `whatsapp:${target}`,
    From: process.env.TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:")
      ? process.env.TWILIO_WHATSAPP_NUMBER
      : `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    Body: body
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    const responseText = await response.text();
    return {
      status: "failed",
      error: responseText || "WhatsApp delivery failed"
    };
  }

  return {
    status: "sent",
    error: ""
  };
};

const assertNotificationDelivery = (notification, channel) => {
  const delivery = notification?.delivery?.[channel];

  if (!delivery || delivery.status !== "sent") {
    throw createHttpError(
      503,
      delivery?.error || `Unable to send login code over ${channel}`
    );
  }
};

const logLocalOtpDebug = ({ email, channel, reason, otpCode }) => {
  console.warn(
    `[auth] Local OTP fallback enabled for ${email} over ${channel}. Reason: ${reason}. Code: ${otpCode}`
  );
};

export const sendVerificationEmail = async (user) => {
  await ensureUserPublicId(user);

  const token = createEmailVerificationToken();
  user.emailVerificationTokenHash = hashValue(token);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + emailVerificationTtlMinutes * 60 * 1000
  );
  await user.save();

  const verificationUrl = createVerificationUrl(token, user.email);

  await createNotification({
    recipientId: user._id,
    type: "verification",
    priority: "critical",
    title: "Verify your GenuineTrade email",
    body: `Welcome to GenuineTrade. Verify ${user.email} for ${user.publicId} by opening ${verificationUrl}. This link expires in ${formatDurationLabel(emailVerificationTtlMinutes)}.`,
    actionUrl: "/verify-email",
    entityType: "User",
    entityId: user._id.toString(),
    channels: {
      inApp: true,
      email: true,
      sms: false
    },
    bypassUserPreferences: true
  });

  return {
    verificationUrl,
    expiresAt: user.emailVerificationExpiresAt
  };
};

export const sendWelcomeIdentityMessages = async (user) => {
  await ensureUserPublicId(user);

  const startLink = `${resolvePrimaryClientUrl()}/login`;
  const welcomeBody = `Welcome to GenuineTrade.\nUser ID: ${user.publicId}\nStart trading now: ${startLink}`;

  await createNotification({
    recipientId: user._id,
    type: "onboarding",
    priority: "high",
    title: "Welcome to GenuineTrade",
    body: welcomeBody,
    actionUrl: "/login",
    entityType: "User",
    entityId: user._id.toString(),
    channels: {
      inApp: true,
      email: true,
      sms: true
    },
    bypassUserPreferences: true
  });

  await sendWhatsAppMessage({
    to: user.phone,
    body: `Welcome to GenuineTrade\nUser ID: ${user.publicId}\nStart trading now: ${startLink}`
  });
};

export const verifyEmailToken = async (token) => {
  const tokenHash = hashValue(token);

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: {
      $gt: new Date()
    }
  }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

  if (!user) {
    return null;
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = "";
  user.emailVerificationExpiresAt = null;
  await ensureUserPublicId(user);
  await user.save();

  await createNotification({
    recipientId: user._id,
    type: "verification",
    priority: "high",
    title: "Email verified",
    body: `Your email is verified and ${user.publicId} is ready for OTP login.`,
    actionUrl: "/login",
    entityType: "User",
    entityId: user._id.toString(),
    channels: {
      inApp: true,
      email: false,
      sms: false
    },
    bypassUserPreferences: true
  });

  return user;
};

export const resendVerificationEmail = async (email) => {
  const user = await User.findOne({
    email: String(email || "").trim().toLowerCase()
  }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

  if (!user) {
    return null;
  }

  if (user.emailVerified) {
    return {
      alreadyVerified: true,
      user
    };
  }

  const delivery = await sendVerificationEmail(user);

  return {
    alreadyVerified: false,
    user,
    verificationUrl: delivery.verificationUrl
  };
};

export const requestLoginOtp = async ({ email, channel }) => {
  assertOtpChannel(channel);

  const user = await User.findOne({
    email: String(email || "").trim().toLowerCase()
  });

  if (!user) {
    throw createHttpError(404, "No account found for this email");
  }

  if (user.role === "admin") {
    throw createHttpError(403, "Admin accounts use password login");
  }

  if (!user.emailVerified) {
    throw createHttpError(403, "Verify your email before requesting a login code");
  }

  if (user.accountStatus === "blocked") {
    throw createHttpError(403, "This account has been blocked");
  }

  if (user.accountStatus === "suspended") {
    throw createHttpError(403, "This account has been suspended");
  }

  await ensureUserPublicId(user);

  const deliveryTarget = resolveOtpTarget(user, channel);
  if (!deliveryTarget) {
    throw createHttpError(400, "No delivery target is available for this channel");
  }

  const otpCode = createOtpCode();
  const challengeId = createLoginChallengeId();
  const expiresAt = new Date(Date.now() + loginOtpTtlSeconds * 1000);

  await cacheService.set(
    buildLoginChallengeCacheKey(challengeId),
    {
      userId: user._id.toString(),
      channel,
      codeHash: hashValue(otpCode),
      attemptsUsed: 0,
      expiresAt: expiresAt.toISOString()
    },
    loginOtpTtlSeconds
  );

  try {
    if (channel === "whatsapp") {
      const delivery = await sendWhatsAppMessage({
        to: deliveryTarget,
        body: buildOtpBody(otpCode)
      });

      if (delivery.status !== "sent") {
        throw createHttpError(503, delivery.error || "Unable to send login code over whatsapp");
      }
    } else {
      const notification = await createNotification({
        recipientId: user._id,
        type: "otp",
        priority: "critical",
        title: "Your GenuineTrade login code",
        body: buildOtpBody(otpCode),
        actionUrl: "/login",
        entityType: "User",
        entityId: user._id.toString(),
        channels: {
          inApp: false,
          email: channel === "email",
          sms: channel === "sms"
        },
        bypassUserPreferences: true
      });

      assertNotificationDelivery(notification, channel);
    }
  } catch (error) {
    if (!allowLocalOtpDebug) {
      await cacheService.delete(buildLoginChallengeCacheKey(challengeId));
      throw error;
    }

    logLocalOtpDebug({
      email: user.email,
      channel,
      reason: error.message,
      otpCode
    });

    return {
      challengeId,
      expiresInSeconds: loginOtpTtlSeconds,
      sentTo: channel === "email" ? maskEmail(user.email) : maskPhone(user.phone),
      channel,
      publicId: user.publicId,
      debugMode: true,
      debugCode: otpCode,
      debugReason: error.message
    };
  }

  return {
    challengeId,
    expiresInSeconds: loginOtpTtlSeconds,
    sentTo: channel === "email" ? maskEmail(user.email) : maskPhone(user.phone),
    channel,
    publicId: user.publicId,
    debugMode: false,
    debugCode: "",
    debugReason: ""
  };
};

export const verifyLoginOtp = async ({ challengeId, code }) => {
  const cacheKey = buildLoginChallengeCacheKey(challengeId);
  const challengeRecord = await cacheService.get(cacheKey);

  if (!challengeRecord) {
    throw createHttpError(400, "Login code is invalid or expired");
  }

  if (new Date(challengeRecord.expiresAt).getTime() <= Date.now()) {
    await cacheService.delete(cacheKey);
    throw createHttpError(400, "Login code is invalid or expired");
  }

  if (hashValue(String(code || "").trim()) !== challengeRecord.codeHash) {
    const nextAttemptsUsed = Number(challengeRecord.attemptsUsed || 0) + 1;
    const remainingAttempts = Math.max(loginOtpMaxAttempts - nextAttemptsUsed, 0);

    if (remainingAttempts <= 0) {
      await cacheService.delete(cacheKey);
      throw createHttpError(400, "Login code is invalid or expired");
    }

    await cacheService.set(
      cacheKey,
      {
        ...challengeRecord,
        attemptsUsed: nextAttemptsUsed
      },
      getRemainingChallengeTtlSeconds(challengeRecord)
    );

    throw createHttpError(
      400,
      `Invalid login code. ${remainingAttempts} attempts remaining`
    );
  }

  await cacheService.delete(cacheKey);

  const user = await User.findById(challengeRecord.userId);
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  if (!user.emailVerified) {
    throw createHttpError(403, "Verify your email before logging in");
  }

  if (user.accountStatus === "blocked") {
    throw createHttpError(403, "This account has been blocked");
  }

  if (user.accountStatus === "suspended") {
    throw createHttpError(403, "This account has been suspended");
  }

  await ensureUserPublicId(user);
  if (challengeRecord.channel === "sms" || challengeRecord.channel === "whatsapp") {
    user.phoneVerified = true;
  }
  user.lastLoginAt = new Date();
  await user.save();

  return user;
};
