import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { emitToUser } from "../realtime/socketServer.js";
import { cacheService } from "./cacheService.js";
import { serializeNotification } from "../utils/serializers.js";

const EMAIL_PROVIDER_SENDGRID = "sendgrid";
const SMS_PROVIDER_TWILIO = "twilio";
const SMS_PROVIDER_MSG91 = "msg91";

const notificationTypePreferenceMap = {
  onboarding: "onboarding",
  verification: "verification",
  rfq: "rfq",
  match: "match",
  payment: "payment",
  transaction: "payment",
  subscription: "subscription",
  chat: "chat",
  otp: "otp",
  marketing: "marketing",
  system: "system"
};

const resolvePreferenceKey = (type) =>
  notificationTypePreferenceMap[type] || "system";

const getEmailProvider = () =>
  process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL
    ? EMAIL_PROVIDER_SENDGRID
    : "";

const getSmsProvider = () => {
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) {
    return SMS_PROVIDER_TWILIO;
  }

  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
    return SMS_PROVIDER_MSG91;
  }

  return "";
};

const buildDeliverySnapshot = (enabled, recipient) => ({
  enabled,
  status: enabled ? "pending" : "skipped",
  recipient,
  attemptedAt: null,
  deliveredAt: null,
  error: enabled ? "" : "Channel disabled"
});

const getChannelPreference = ({ user, channel, preferenceKey, fallbackEnabled }) => {
  const channelPreferences = user.notificationPreferences?.[channel] || {};

  if (channelPreferences.enabled === false) {
    return false;
  }

  if (channelPreferences[preferenceKey] === false) {
    return false;
  }

  if (channelPreferences.enabled === true && channelPreferences[preferenceKey] === true) {
    return true;
  }

  if (channelPreferences.enabled === true && channelPreferences[preferenceKey] === undefined) {
    return fallbackEnabled;
  }

  return fallbackEnabled;
};

const resolveChannelPlan = ({
  user,
  type,
  channels = {},
  bypassUserPreferences = false
}) => {
  const preferenceKey = resolvePreferenceKey(type);
  const explicitInApp = channels.inApp;
  const explicitEmail = channels.email;
  const explicitSms = channels.sms;

  const defaultPlan = {
    inApp: explicitInApp ?? true,
    email: explicitEmail ?? false,
    sms: explicitSms ?? false
  };

  if (bypassUserPreferences) {
    return defaultPlan;
  }

  return {
    inApp:
      explicitInApp ??
      getChannelPreference({
        user,
        channel: "inApp",
        preferenceKey,
        fallbackEnabled: true
      }),
    email:
      explicitEmail ??
      getChannelPreference({
        user,
        channel: "email",
        preferenceKey,
        fallbackEnabled: true
      }),
    sms:
      explicitSms ??
      getChannelPreference({
        user,
        channel: "sms",
        preferenceKey,
        fallbackEnabled: preferenceKey === "otp"
      })
  };
};

const sendSendGridEmail = async ({ to, subject, body }) => {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          subject
        }
      ],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL
      },
      content: [
        {
          type: "text/plain",
          value: body
        }
      ]
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || "SendGrid delivery failed");
  }
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

const deliverEmail = async ({ recipient, title, body }) => {
  const provider = getEmailProvider();

  if (!provider) {
    return {
      status: "skipped",
      error: "Email provider not configured"
    };
  }

  if (!recipient.email) {
    return {
      status: "skipped",
      error: "User email missing"
    };
  }

  if (provider === EMAIL_PROVIDER_SENDGRID) {
    await sendSendGridEmail({
      to: recipient.email,
      subject: title,
      body
    });
  }

  return {
    status: "sent",
    deliveredAt: new Date(),
    recipient: recipient.email,
    error: ""
  };
};

const deliverSms = async ({ recipient, title, body }) => {
  const provider = getSmsProvider();

  if (!provider) {
    return {
      status: "skipped",
      error: "SMS provider not configured"
    };
  }

  if (!recipient.phone) {
    return {
      status: "skipped",
      error: "User phone missing"
    };
  }

  const composedBody = `${title}: ${body}`.slice(0, 480);

  if (provider === SMS_PROVIDER_TWILIO) {
    await sendTwilioSms({
      to: recipient.phone,
      body: composedBody
    });
  } else {
    await sendMsg91Sms({
      to: recipient.phone,
      body: composedBody
    });
  }

  return {
    status: "sent",
    deliveredAt: new Date(),
    recipient: recipient.phone,
    error: ""
  };
};

export const getUnreadNotificationCount = (recipientId) =>
  Notification.countDocuments({
    recipientId,
    status: "unread"
  });

export const pushNotificationCount = async (recipientId) => {
  const unreadCount = await getUnreadNotificationCount(recipientId);
  emitToUser(recipientId.toString(), "notifications:count", { unreadCount });
  return unreadCount;
};

const updateDeliveryState = async (notificationId, channel, deliveryState) => {
  const attemptedAt = new Date();
  const update = {
    [`delivery.${channel}.status`]: deliveryState.status,
    [`delivery.${channel}.attemptedAt`]: attemptedAt,
    [`delivery.${channel}.recipient`]: deliveryState.recipient || "",
    [`delivery.${channel}.error`]: deliveryState.error || ""
  };

  if (deliveryState.deliveredAt) {
    update[`delivery.${channel}.deliveredAt`] = deliveryState.deliveredAt;
  }

  return Notification.findByIdAndUpdate(
    notificationId,
    {
      $set: update
    },
    { new: true }
  );
};

export const createNotification = async ({
  recipientId,
  senderId = null,
  type = "system",
  priority = "normal",
  title,
  body,
  actionUrl = "",
  entityType = "",
  entityId = "",
  metadata = {},
  audience = "",
  isBroadcast = false,
  channels = {},
  bypassUserPreferences = false
}) => {
  const recipient = await User.findById(recipientId);

  if (!recipient || recipient.accountStatus === "blocked") {
    return null;
  }

  const channelPlan = resolveChannelPlan({
    user: recipient,
    type,
    channels,
    bypassUserPreferences
  });

  const delivery = {
    inApp: buildDeliverySnapshot(channelPlan.inApp, "dashboard"),
    email: buildDeliverySnapshot(channelPlan.email, recipient.email || ""),
    sms: buildDeliverySnapshot(channelPlan.sms, recipient.phone || "")
  };

  const notification = await Notification.create({
    recipientId,
    senderId,
    type,
    priority,
    title,
    body,
    actionUrl,
    entityType,
    entityId,
    metadata,
    audience,
    isBroadcast,
    delivery,
    status: channelPlan.inApp ? "unread" : "read",
    readAt: channelPlan.inApp ? null : new Date()
  });

  let hydratedNotification = notification;

  if (channelPlan.inApp) {
    emitToUser(recipientId.toString(), "notification:new", serializeNotification(notification));
    await pushNotificationCount(recipientId);
  }

  if (channelPlan.email) {
    try {
      hydratedNotification = await updateDeliveryState(
        notification._id,
        "email",
        await deliverEmail({
          recipient,
          title,
          body
        })
      );
    } catch (error) {
      hydratedNotification = await updateDeliveryState(notification._id, "email", {
        status: "failed",
        error: error.message
      });
    }
  }

  if (channelPlan.sms) {
    try {
      hydratedNotification = await updateDeliveryState(
        notification._id,
        "sms",
        await deliverSms({
          recipient,
          title,
          body
        })
      );
    } catch (error) {
      hydratedNotification = await updateDeliveryState(notification._id, "sms", {
        status: "failed",
        error: error.message
      });
    }
  }

  return hydratedNotification;
};

export const notifyAdmins = async (payload) => {
  const admins = await User.find({
    role: "admin",
    accountStatus: "active"
  }).select("_id");

  return Promise.all(
    admins.map((admin) =>
      createNotification({
        ...payload,
        recipientId: admin._id
      })
    )
  );
};

export const getNotificationSettings = async (user) => ({
  email: user.notificationPreferences?.email || {},
  sms: user.notificationPreferences?.sms || {},
  inApp: user.notificationPreferences?.inApp || {},
  phoneVerified: user.phoneVerified,
  providers: {
    email: getEmailProvider() || "not_configured",
    sms: getSmsProvider() || "not_configured"
  }
});

export const updateNotificationSettings = async (user, updates = {}) => {
  const nextPreferences = {
    email: {
      ...(user.notificationPreferences?.email || {}),
      ...(updates.email || {})
    },
    sms: {
      ...(user.notificationPreferences?.sms || {}),
      ...(updates.sms || {})
    },
    inApp: {
      ...(user.notificationPreferences?.inApp || {}),
      ...(updates.inApp || {})
    }
  };

  user.notificationPreferences = nextPreferences;
  await user.save();

  return getNotificationSettings(user);
};

const buildOtpCacheKey = (userId, purpose) => `otp:${purpose}:${userId}`;

export const sendOtpCode = async ({ user, purpose = "phone_verification" }) => {
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const cacheKey = buildOtpCacheKey(user._id, purpose);

  await cacheService.set(
    cacheKey,
    {
      code: otpCode,
      createdAt: new Date().toISOString()
    },
    300
  );

  await createNotification({
    recipientId: user._id,
    type: "otp",
    priority: "critical",
    title: "Your verification code",
    body: `Use ${otpCode} to verify your phone number. The code expires in 5 minutes.`,
    actionUrl: "/profile",
    entityType: "User",
    entityId: user._id.toString(),
    channels: {
      inApp: true,
      sms: true,
      email: false
    },
    bypassUserPreferences: true
  });

  return {
    expiresInSeconds: 300,
    sentTo: user.phone || "in-app"
  };
};

export const verifyOtpCode = async ({ user, code, purpose = "phone_verification" }) => {
  const cacheKey = buildOtpCacheKey(user._id, purpose);
  const record = await cacheService.get(cacheKey);

  if (!record || record.code !== String(code).trim()) {
    return false;
  }

  await cacheService.delete(cacheKey);
  user.phoneVerified = true;
  await user.save();
  return true;
};

export const sendBroadcastNotification = async ({
  actor,
  audience = "all",
  title,
  body,
  type = "system",
  priority = "high",
  actionUrl = "",
  channels = {}
}) => {
  const filters = {
    accountStatus: "active"
  };

  if (audience === "exporters") {
    filters.role = "exporter";
  } else if (audience === "buyers") {
    filters.role = "buyer";
  } else if (audience === "admins") {
    filters.role = "admin";
  }

  const recipients = await User.find(filters).select("_id");

  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        recipientId: recipient._id,
        senderId: actor?._id || null,
        type,
        priority,
        title,
        body,
        actionUrl,
        audience,
        isBroadcast: true,
        channels
      })
    )
  );

  return {
    audience,
    recipients: recipients.length
  };
};
