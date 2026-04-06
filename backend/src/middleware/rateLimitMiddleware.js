import rateLimit from "express-rate-limit";

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);

export const apiLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_MAX || 250),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again in a few minutes."
  }
});

export const authLimiter = rateLimit({
  windowMs,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please slow down and try again."
  }
});

export const otpSendLimiter = rateLimit({
  windowMs: Number(process.env.OTP_SEND_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.OTP_SEND_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many OTP send attempts. Please wait before requesting another code."
  }
});

export const otpVerifyLimiter = rateLimit({
  windowMs: Number(process.env.OTP_VERIFY_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.OTP_VERIFY_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many OTP verification attempts. Please wait before trying again."
  }
});
