import User from "../models/User.js";
import { ensureDefaultPlans } from "./planService.js";
import { ensureAllUserPublicIds, ensureUserPublicId } from "./publicIdService.js";

export const ensureAdminAccount = async () => {
  await ensureDefaultPlans();

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!adminEmail || !adminPassword) {
    console.warn("Admin bootstrap skipped. Set ADMIN_EMAIL and ADMIN_PASSWORD.");
    return;
  }

  const existingAdmin = await User.findOne({ email: adminEmail }).select(
    "+password"
  );

  if (!existingAdmin) {
    const adminUser = await User.create({
      name: process.env.ADMIN_NAME?.trim() || "GenuineTrade Admin",
      role: "admin",
      adminAccessLevel: "super_admin",
      email: adminEmail,
      password: adminPassword,
      phone: "",
      emailVerified: true,
      profileCompleted: true,
      status: "verified",
      badge: "trusted"
    });
    await ensureUserPublicId(adminUser);
    console.log("Admin account created");
    return;
  }

  existingAdmin.name = process.env.ADMIN_NAME?.trim() || "GenuineTrade Admin";
  existingAdmin.role = "admin";
  existingAdmin.adminAccessLevel = "super_admin";
  existingAdmin.emailVerified = true;
  existingAdmin.profileCompleted = true;
  existingAdmin.status = "verified";
  existingAdmin.badge = "trusted";
  const passwordMatches = await existingAdmin.comparePassword(adminPassword);

  if (!passwordMatches) {
    existingAdmin.password = adminPassword;
  }

  await existingAdmin.save();
  await ensureUserPublicId(existingAdmin);
  console.log("Admin account ready");
};

export const ensureUserDirectory = async () => {
  const updatedCount = await ensureAllUserPublicIds();

  if (updatedCount > 0) {
    console.log(`Backfilled public IDs for ${updatedCount} user(s)`);
  }
};
