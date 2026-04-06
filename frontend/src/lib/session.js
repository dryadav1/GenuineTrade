const SESSION_KEY = "genuine-trade-session";

const canUseStorage = () => typeof window !== "undefined";

export const saveSession = (session) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const getSession = () => {
  if (!canUseStorage()) {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch (error) {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const clearSession = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
};

export const getDashboardPath = (user) => {
  const role = typeof user === "string" ? user : user?.role;

  if (role === "admin") {
    return "/admin";
  }

  if (typeof user !== "string" && !user?.profileCompleted && role !== "admin") {
    return "/complete-profile";
  }

  return "/dashboard";
};

export const getRoleLabel = (value) => {
  const role = typeof value === "string" ? value : value?.role;
  const adminAccessLevel =
    typeof value === "string" ? "" : value?.adminAccessLevel || "";

  if (role === "exporter") {
    return "Exporter";
  }

  if (role === "buyer") {
    return "Buyer";
  }

  if (role === "admin") {
    if (adminAccessLevel === "super_admin") {
      return "Super Admin";
    }

    if (adminAccessLevel === "sub_admin") {
      return "Sub Admin";
    }

    return "Admin";
  }

  return "User";
};

export const isProfilePending = (user) =>
  Boolean(user) && user.role !== "admin" && !user.profileCompleted;
