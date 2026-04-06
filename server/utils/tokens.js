const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return process.env.JWT_SECRET || "genuinetrade-dev-secret";
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id?.toString?.() || user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  generateToken,
  verifyToken,
};
