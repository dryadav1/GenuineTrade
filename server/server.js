const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const Plan = require("./models/Plan");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const exporterRoutes = require("./routes/exporterRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const planRoutes = require("./routes/planRoutes");
const platformRoutes = require("./routes/platformRoutes");
const rfqRoutes = require("./routes/rfqRoutes");
const { ensureAdminUser } = require("./controllers/authController");

dotenv.config({
  path: path.join(__dirname, ".env"),
  override: true,
});

const app = express();
const clientRoot = path.join(__dirname, "..", "client");
const port = Number(process.env.PORT || 3000);
const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/genuine-trade";

const defaultPlans = [
  {
    name: "Starter",
    price: 1999,
    duration: "monthly",
    features: ["Verified exporter listing", "RFQ alerts", "Basic support"],
    isPopular: false,
  },
  {
    name: "Growth",
    price: 4999,
    duration: "monthly",
    features: ["Priority listing", "Buyer intent insights", "Faster verification"],
    isPopular: true,
  },
  {
    name: "Global",
    price: 49999,
    duration: "yearly",
    features: ["Annual savings", "Dedicated onboarding", "Premium support"],
    isPopular: false,
  },
];

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "genuinetrade-api" });
});

app.use("/api/platform", platformRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/exporter", exporterRoutes);
app.use("/api/rfq", rfqRoutes);
app.use("/api/plans", planRoutes);
app.use("/api", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use(express.static(clientRoot));

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(clientRoot, "index.html"));
});

app.get(["/login", "/login.html"], (req, res) => {
  res.sendFile(path.join(clientRoot, "login.html"));
});

app.get(["/dashboard", "/dashboard.html"], (req, res) => {
  res.sendFile(path.join(clientRoot, "dashboard.html"));
});

app.get(["/admin", "/admin.html"], (req, res) => {
  res.sendFile(path.join(clientRoot, "admin.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found." });
  }

  return res.sendFile(path.join(clientRoot, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.message || "Unexpected server error.",
  });
});

async function ensureDefaultPlans() {
  const existingCount = await Plan.countDocuments();

  if (existingCount > 0) {
    return;
  }

  await Plan.insertMany(defaultPlans);
}

async function startServer() {
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000),
  });

  await Promise.all([ensureAdminUser(), ensureDefaultPlans()]);

  app.listen(port, () => {
    console.log(`GenuineTrade API and client running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start GenuineTrade:", error.message);
  console.error("MongoDB URI in use:", mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@"));
  process.exit(1);
});
