const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sanitizeUser } = require("../utils/serializers");
const { generateToken } = require("../utils/tokens");

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function getAdminDefaults() {
  return {
    email: normalizeEmail(process.env.ADMIN_EMAIL || "admin@genuinetrade.com"),
    password: process.env.ADMIN_PASSWORD || "Admin123!",
    name: process.env.ADMIN_NAME || "GenuineTrade Admin",
  };
}

async function ensureAdminUser() {
  const adminDefaults = getAdminDefaults();
  const passwordHash = await bcrypt.hash(adminDefaults.password, 10);

  let admin = await User.findOne({ email: adminDefaults.email });

  if (!admin) {
    admin = await User.create({
      name: adminDefaults.name,
      email: adminDefaults.email,
      password: passwordHash,
      role: "admin",
    });
    return admin;
  }

  admin.name = adminDefaults.name;
  admin.role = "admin";
  admin.password = passwordHash;
  await admin.save();
  return admin;
}

async function signup(req, res) {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  if (String(password).trim().length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long." });
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 10),
    role: "user",
  });

  return res.status(201).json({
    token: generateToken(user),
    user: sanitizeUser(user),
  });
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const normalizedEmail = normalizeEmail(email);
  const adminDefaults = getAdminDefaults();

  if (normalizedEmail === adminDefaults.email && password === adminDefaults.password) {
    const admin = await ensureAdminUser();
    return res.json({
      token: generateToken(admin),
      user: sanitizeUser(admin),
    });
  }

  const user = await User.findOne({ email: normalizedEmail }).populate("currentPlan");

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  return res.json({
    token: generateToken(user),
    user: sanitizeUser(user),
  });
}

async function me(req, res) {
  const user = await User.findById(req.user.id).populate("currentPlan");

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  return res.json({ user: sanitizeUser(user) });
}

module.exports = {
  ensureAdminUser,
  login,
  me,
  signup,
};
