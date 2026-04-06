import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateToken } from "../utils/generateToken.js";
import { serializeUser } from "../utils/serializers.js";

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password || !role) {
    res.status(400).json({ message: "Name, email, password, and role are required." });
    return;
  }

  if (!["exporter", "buyer"].includes(role)) {
    res.status(400).json({ message: "Role must be exporter or buyer." });
    return;
  }

  if (String(password).trim().length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters long." });
    return;
  }

  const existingUser = await User.findOne({ email: normalizeEmail(email) });
  if (existingUser) {
    res.status(409).json({ message: "An account with this email already exists." });
    return;
  }

  const user = await User.create({
    name: String(name).trim(),
    email: normalizeEmail(email),
    password: String(password),
    role,
    status: "pending",
    badge: "none",
    profileCompleted: false,
    accountStatus: "active"
  });

  res.status(201).json({
    message: "Account created successfully.",
    token: generateToken(user),
    user: serializeUser(user)
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }

  const user = await User.findOne({ email: normalizeEmail(email) }).select("+password");
  if (!user) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  if (user.accountStatus === "blocked") {
    res.status(403).json({ message: "This account has been blocked." });
    return;
  }

  if (user.accountStatus === "suspended") {
    res.status(403).json({ message: "This account has been suspended." });
    return;
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    message: "Login successful.",
    token: generateToken(user),
    user: serializeUser(user)
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    user: serializeUser(req.user)
  });
});
