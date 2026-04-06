import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import adminRoutes from "./routes/adminRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import buyerRoutes from "./routes/buyerRoutes.js";
import exporterRoutes from "./routes/exporterRoutes.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimitMiddleware.js";
import matchRoutes from "./routes/matchRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import platformRoutes from "./routes/platformRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import rfqRoutes from "./routes/rfqRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: process.env.CLIENT_URL?.split(",") || "*"
  })
);
app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || "40mb",
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    }
  })
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/buyers", buyerRoutes);
app.use("/api/exporters", exporterRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/rfqs", rfqRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payment-methods", paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error?.type === "entity.too.large" || error?.status === 413) {
    res.status(413).json({
      message:
        "Uploaded files are too large. Keep each document under 8 MB, each image under 5 MB, and total new uploads under 22 MB."
    });
    return;
  }

  if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0] || "";
    const duplicateMessage =
      duplicateField === "userId"
        ? "A subscription record already exists for this account. Refresh the page and try again."
        : duplicateField === "email"
          ? "An account with this email already exists."
          : "This record already exists. Please refresh and try again.";

    res.status(409).json({
      message: duplicateMessage
    });
    return;
  }

  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json({
    message: error.message || "Something went wrong"
  });
});

export default app;
