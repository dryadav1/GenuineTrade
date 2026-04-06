import crypto from "crypto";

const otpTtlSeconds = Number(process.env.PHONE_OTP_TTL_SECONDS || 300);

const normalizePhone = (value = "") => {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

const isValidPhoneNumber = (value = "") => /^\+\d{8,15}$/.test(normalizePhone(value));

const hashOtp = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const resolveSmsProvider = () => {
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) {
    return "twilio";
  }

  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
    return "msg91";
  }

  return "";
};

const sendTwilioSms = async ({ to, body }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: to,
    From: process.env.TWILIO_FROM_NUMBER,
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
    throw new Error(responseText || "Twilio delivery failed");
  }
};

const sendMsg91Sms = async ({ to, body }) => {
  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: process.env.MSG91_AUTH_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID,
      short_url: "0",
      recipients: [
        {
          mobiles: to.replace(/\D/g, ""),
          otp: body.match(/\b\d{6}\b/)?.[0] || "",
          message: body
        }
      ]
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || "MSG91 delivery failed");
  }
};

const deliverOtpSms = async ({ phone, otpCode }) => {
  const provider = resolveSmsProvider();
  const body = `Your GenuineTrade verification code is ${otpCode}. It expires in 5 minutes.`;

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMS provider is not configured.");
    }

    console.log(`[otp] Local SMS fallback for ${phone}. Code: ${otpCode}`);
    return {
      provider: "local_debug",
      debugCode: otpCode
    };
  }

  if (provider === "twilio") {
    await sendTwilioSms({ to: phone, body });
  } else {
    await sendMsg91Sms({ to: phone, body });
  }

  return {
    provider
  };
};

export const createPhoneOtpChallenge = async ({ user, phone }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!isValidPhoneNumber(normalizedPhone)) {
    const error = new Error("Enter a valid phone number before requesting OTP.");
    error.statusCode = 400;
    throw error;
  }

  const otpCode = createOtpCode();
  const otpExpiry = new Date(Date.now() + otpTtlSeconds * 1000);
  const delivery = await deliverOtpSms({
    phone: normalizedPhone,
    otpCode
  });

  user.phone = normalizedPhone;
  user.phoneVerified = false;
  user.otp = hashOtp(otpCode);
  user.otpExpiry = otpExpiry;
  await user.save();

  return {
    user,
    expiresInSeconds: otpTtlSeconds,
    ...delivery
  };
};

export const verifyPhoneOtpChallenge = async ({ user, code }) => {
  const normalizedCode = String(code || "").trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    const error = new Error("Enter the 6-digit OTP code.");
    error.statusCode = 400;
    throw error;
  }

  if (!user.otp || !user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
    user.otp = "";
    user.otpExpiry = null;
    await user.save();

    const error = new Error("OTP expired. Please request a new code.");
    error.statusCode = 400;
    throw error;
  }

  if (hashOtp(normalizedCode) !== user.otp) {
    const error = new Error("Invalid OTP. Please try again.");
    error.statusCode = 400;
    throw error;
  }

  user.phoneVerified = true;
  user.otp = "";
  user.otpExpiry = null;
  await user.save();

  return user;
};

export { isValidPhoneNumber, normalizePhone };
