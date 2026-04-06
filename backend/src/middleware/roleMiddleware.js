export const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    next();
  };

export const authorizeAdminLevels =
  (...levels) =>
  (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    if (!levels.length || levels.includes(req.user.adminAccessLevel)) {
      next();
      return;
    }

    res.status(403).json({ message: "Insufficient admin permissions" });
  };
