import {
  getApp,
  getApps,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const PUBLIC_API_ENDPOINTS = {
  countries: "https://restcountries.com/v3.1/all?fields=name,region,cca2",
  fx: "https://api.frankfurter.app/latest?from=USD&to=INR,EUR,AED",
};

export const ADMIN_EMAILS = ["admin@genuinetrade.com"];

export const DEMO_CREDENTIALS = {
  admin: {
    email: "admin@genuinetrade.com",
    password: "Admin123!",
  },
  buyer: {
    email: "buyer@northshoretrading.com",
    password: "Buyer123!",
  },
  exporter: {
    email: "spice@sunriseexports.com",
    password: "Exporter123!",
  },
};

const runtimeFirebaseConfig = window.GENUINETRADE_FIREBASE_CONFIG || DEFAULT_FIREBASE_CONFIG;
const firebaseConfigured = Object.values(runtimeFirebaseConfig).every(
  (value) => typeof value === "string" && value.trim() && !value.includes("YOUR_"),
);

let firebaseApp = null;
let auth = null;
let db = null;

if (firebaseConfigured) {
  firebaseApp = getApps().length ? getApp() : initializeApp(runtimeFirebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
}

export const APP_MODE = firebaseConfigured ? "firebase" : "demo";
export const APP_MODE_LABEL = APP_MODE === "firebase" ? "Firebase live mode" : "Demo mode";
export const FIREBASE_SETUP_HINT =
  "Add your Firebase web config inside firebase.js or set window.GENUINETRADE_FIREBASE_CONFIG before app.js loads.";

const DEMO_DB_KEY = "genuinetrade-demo-db-v3";
const DEMO_SESSION_KEY = "genuinetrade-demo-session-v3";
const DEFAULT_EXPORTER_STATUS = "pending";
const DEFAULT_BADGE = "New";
const BADGE_RANK = {
  New: 1,
  Verified: 2,
  Trusted: 3,
  Premium: 4,
};

function normalizeText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function splitCsv(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((entry) => String(entry).trim()).filter(Boolean)));
  }

  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function buildKeywords(value = "") {
  return Array.from(new Set(normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean)));
}

function extractNumericValue(value) {
  const match = String(value || "").replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function timestampToDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  return null;
}

export function formatDate(value) {
  const date = timestampToDate(value);

  if (!date) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isAdminEmail(email = "") {
  return ADMIN_EMAILS.includes(normalizeText(email));
}

export function isAdminUser(user) {
  return Boolean(user && (user.role === "admin" || user.isAdmin || isAdminEmail(user.email)));
}

function decorateUser(user) {
  if (!user) {
    return null;
  }

  const role = user.role || (isAdminEmail(user.email) ? "admin" : "buyer");

  return {
    ...user,
    role,
    isAdmin: role === "admin" || isAdminEmail(user.email),
  };
}

function calculateBaseTrustScore(exporter = {}) {
  let score = 0;

  if (String(exporter.iec || "").trim()) {
    score += 30;
  }

  if (String(exporter.gst || "").trim()) {
    score += 20;
  }

  if (String(exporter.website || "").trim()) {
    score += 10;
  }

  if (Number(exporter.completedDeals || 0) > 0) {
    score += 20;
  }

  score += Math.round((clamp(Number(exporter.responseRate || 0), 0, 100) / 100) * 20);
  return clamp(score, 0, 100);
}

function resolveBadge(score) {
  if (score <= 30) {
    return "New";
  }

  if (score <= 60) {
    return "Verified";
  }

  if (score <= 80) {
    return "Trusted";
  }

  return "Premium";
}

function withTrustState(exporter = {}) {
  const computedTrustScore = calculateBaseTrustScore(exporter);
  const manualTrustAdjustment = Number(exporter.manualTrustAdjustment || 0);
  const trustScore = clamp(
    exporter.trustScore != null ? Number(exporter.trustScore) : computedTrustScore + manualTrustAdjustment,
    0,
    100,
  );
  const badge = exporter.badge || resolveBadge(trustScore);

  return {
    ...exporter,
    computedTrustScore,
    manualTrustAdjustment,
    trustScore,
    badge,
    trustLabel: exporter.trustLabel || badge,
  };
}

function normalizeExporterRecord(id, data = {}) {
  const exporter = withTrustState({
    id,
    userId: data.userId || id,
    companyName: data.companyName || "Unnamed exporter",
    product: data.product || "Not set",
    country: data.country || "N/A",
    moq: data.moq || "",
    certifications: splitCsv(data.certifications),
    website: data.website || "",
    iec: data.iec || "",
    gst: data.gst || "",
    completedDeals: Number(data.completedDeals || 0),
    responseRate: clamp(Number(data.responseRate || 0), 0, 100),
    productDetails: data.productDetails || "",
    status: data.status || DEFAULT_EXPORTER_STATUS,
    trustScore: data.trustScore,
    badge: data.badge,
    trustLabel: data.trustLabel,
    manualTrustAdjustment: data.manualTrustAdjustment || 0,
    createdAt: data.createdAt || nowIso(),
    updatedAt: data.updatedAt || data.createdAt || nowIso(),
  });

  return {
    ...exporter,
    moqValue: extractNumericValue(exporter.moq),
    certificationsText: exporter.certifications.join(", "),
    productNormalized: normalizeText(exporter.product),
    productKeywords: buildKeywords(exporter.product),
  };
}

function normalizeBuyerRecord(id, data = {}) {
  return {
    id,
    userId: data.userId || id,
    companyName: data.companyName || "Unnamed buyer",
    country: data.country || "N/A",
    createdAt: data.createdAt || nowIso(),
    updatedAt: data.updatedAt || data.createdAt || nowIso(),
  };
}

function normalizeNotificationRecord(id, data = {}) {
  return {
    id,
    userId: data.userId || "",
    type: data.type || "system",
    title: data.title || "Notification",
    body: data.body || "",
    rfqId: data.rfqId || "",
    senderId: data.senderId || "",
    isRead: Boolean(data.isRead),
    createdAt: data.createdAt || nowIso(),
  };
}

function normalizeMessageRecord(id, data = {}) {
  return {
    id,
    conversationId: data.conversationId || "",
    participants: Array.isArray(data.participants) ? data.participants : [],
    senderId: data.senderId || "",
    receiverId: data.receiverId || "",
    text: data.text || "",
    rfqId: data.rfqId || "",
    createdAt: data.createdAt || nowIso(),
  };
}

function normalizeRfqRecord(id, data = {}) {
  const matchResults = Array.isArray(data.matchResults) ? data.matchResults : [];
  const matchIds = Array.isArray(data.matchIds) ? data.matchIds : matchResults.map((entry) => entry.exporterId);
  const requiredCertifications = splitCsv(data.requiredCertifications || []);

  return {
    id,
    buyerId: data.buyerId || "",
    buyerName: data.buyerName || "Buyer",
    buyerCompany: data.buyerCompany || "Unknown company",
    buyerCountry: data.buyerCountry || "N/A",
    product: data.product || "",
    quantity: data.quantity || "",
    quantityValue: extractNumericValue(data.quantity || ""),
    preferredCountry: data.preferredCountry || "",
    requiredCertifications,
    requiredCertificationsText: requiredCertifications.join(", "),
    notes: data.notes || "",
    status: data.status || "open",
    matchIds,
    matchResults,
    matchCount: data.matchCount ?? matchIds.length,
    createdAt: data.createdAt || nowIso(),
  };
}

function buildConversationId(userId, otherUserId) {
  return [userId, otherUserId].sort().join("__");
}

function calculateProductScore(rfqProduct, exporterProduct) {
  const rfqTerms = buildKeywords(rfqProduct);
  const exporterTerms = buildKeywords(exporterProduct);

  if (!rfqTerms.length || !exporterTerms.length) {
    return 0;
  }

  const overlap = rfqTerms.filter((term) => exporterTerms.includes(term)).length;

  if (normalizeText(exporterProduct).includes(normalizeText(rfqProduct)) || normalizeText(rfqProduct).includes(normalizeText(exporterProduct))) {
    return 50;
  }

  return Math.round((overlap / Math.max(rfqTerms.length, exporterTerms.length)) * 50);
}

function calculateMoqScore(rfqQuantity, exporterMoq) {
  const quantityValue = extractNumericValue(rfqQuantity);
  const moqValue = extractNumericValue(exporterMoq);

  if (quantityValue == null && moqValue == null) {
    return 10;
  }

  if (moqValue == null) {
    return 14;
  }

  if (quantityValue == null) {
    return 10;
  }

  return quantityValue >= moqValue ? 20 : 0;
}

function calculateCertificationScore(requiredCertifications, exporterCertifications) {
  const required = splitCsv(requiredCertifications);
  const available = splitCsv(exporterCertifications).map((entry) => normalizeText(entry));

  if (!required.length) {
    return 20;
  }

  const overlap = required.filter((entry) => available.includes(normalizeText(entry))).length;
  return Math.round((overlap / required.length) * 20);
}

function calculateTrustBonus(trustScore) {
  return Math.min(10, Math.round(Number(trustScore || 0) / 10));
}

function scoreExporterForRfq(rfq, exporter) {
  const productScore = calculateProductScore(rfq.product, exporter.product);
  const moqScore = calculateMoqScore(rfq.quantity, exporter.moq);
  const certificationScore = calculateCertificationScore(rfq.requiredCertifications, exporter.certifications);
  const trustBonus = calculateTrustBonus(exporter.trustScore);

  return {
    exporterId: exporter.id,
    productScore,
    moqScore,
    certificationScore,
    trustBonus,
    totalScore: productScore + moqScore + certificationScore + trustBonus,
  };
}

function sortMatches(matches) {
  return [...matches].sort((left, right) => right.totalScore - left.totalScore);
}

function matchesExporterSearchCriteria(exporter, criteria = {}) {
  const productTerm = normalizeText(criteria.product || criteria.query || "");
  const countryTerm = normalizeText(criteria.country || "");

  const productPass =
    !productTerm ||
    exporter.productNormalized.includes(productTerm) ||
    exporter.productKeywords.some((keyword) => keyword.includes(productTerm) || productTerm.includes(keyword));
  const countryPass = !countryTerm || normalizeText(exporter.country).includes(countryTerm);

  return productPass && countryPass;
}

function sortExporters(exporters) {
  return [...exporters].sort((left, right) => {
    const badgeDelta = (BADGE_RANK[right.badge] || 0) - (BADGE_RANK[left.badge] || 0);

    if (badgeDelta !== 0) {
      return badgeDelta;
    }

    const scoreDelta = (right.trustScore || 0) - (left.trustScore || 0);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return (left.companyName || "").localeCompare(right.companyName || "");
  });
}

function parseStoredValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStoredValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function seedDemoState() {
  const createdAt = nowIso();

  const state = {
    users: [
      {
        id: "admin-user",
        name: "GenuineTrade Admin",
        email: DEMO_CREDENTIALS.admin.email,
        password: DEMO_CREDENTIALS.admin.password,
        role: "admin",
        createdAt,
      },
      {
        id: "exporter-spice",
        name: "Aarav Mehta",
        email: DEMO_CREDENTIALS.exporter.email,
        password: DEMO_CREDENTIALS.exporter.password,
        role: "exporter",
        createdAt,
      },
      {
        id: "exporter-leather",
        name: "Naina Khanna",
        email: "leather@atlascraft.com",
        password: "Exporter123!",
        role: "exporter",
        createdAt,
      },
      {
        id: "exporter-garment",
        name: "Kabir Sethi",
        email: "garments@loombridge.in",
        password: "Exporter123!",
        role: "exporter",
        createdAt,
      },
      {
        id: "buyer-northshore",
        name: "Oliver Reed",
        email: DEMO_CREDENTIALS.buyer.email,
        password: DEMO_CREDENTIALS.buyer.password,
        role: "buyer",
        createdAt,
      },
      {
        id: "buyer-borealis",
        name: "Fatima Noor",
        email: "procurement@borealisretail.ae",
        password: "Buyer123!",
        role: "buyer",
        createdAt,
      },
    ],
    exporters: [
      normalizeExporterRecord("exporter-spice", {
        userId: "exporter-spice",
        companyName: "Sunrise Spices Export",
        product: "Organic turmeric powder and whole spices",
        country: "India",
        moq: "500 kg",
        certifications: ["FSSAI", "USDA Organic", "ISO 22000"],
        website: "https://sunrisespices.example.com",
        iec: "IEC-SUN-2031",
        gst: "27ABCDE1234F1Z5",
        completedDeals: 16,
        responseRate: 92,
        status: "approved",
        productDetails: "EU-compliant spices, private labeling, and container-scale fulfillment.",
        createdAt,
        updatedAt: createdAt,
      }),
      normalizeExporterRecord("exporter-leather", {
        userId: "exporter-leather",
        companyName: "Atlas Leather Works",
        product: "Leather bags and small accessories",
        country: "India",
        moq: "300 pcs",
        certifications: ["ISO 9001", "BSCI"],
        website: "https://atlasleather.example.com",
        iec: "IEC-ALT-7761",
        gst: "29ABCDE1234F1Z5",
        completedDeals: 8,
        responseRate: 78,
        status: "approved",
        productDetails: "Custom OEM runs for bags, wallets, and gifting catalogs.",
        createdAt,
        updatedAt: createdAt,
      }),
      normalizeExporterRecord("exporter-garment", {
        userId: "exporter-garment",
        companyName: "Loombridge Apparels",
        product: "Cotton garments and private label basics",
        country: "India",
        moq: "1000 pcs",
        certifications: ["SEDEX", "GOTS"],
        gst: "19ABCDE1234F1Z5",
        completedDeals: 0,
        responseRate: 45,
        status: "pending",
        productDetails: "Sampling-ready knitwear exporter awaiting approval.",
        createdAt,
        updatedAt: createdAt,
      }),
    ],
    buyers: [
      normalizeBuyerRecord("buyer-northshore", {
        userId: "buyer-northshore",
        companyName: "Northshore Trading LLC",
        country: "UAE",
        createdAt,
        updatedAt: createdAt,
      }),
      normalizeBuyerRecord("buyer-borealis", {
        userId: "buyer-borealis",
        companyName: "Borealis Retail Group",
        country: "UAE",
        createdAt,
        updatedAt: createdAt,
      }),
    ],
    rfqs: [],
    notifications: [],
    messages: [],
  };

  const seedRfq = normalizeRfqRecord("rfq_seed_1", {
    buyerId: "buyer-northshore",
    buyerName: "Oliver Reed",
    buyerCompany: "Northshore Trading LLC",
    buyerCountry: "UAE",
    product: "Turmeric powder",
    quantity: "1200 kg",
    preferredCountry: "India",
    requiredCertifications: ["USDA Organic"],
    notes: "Looking for export-grade powder with moisture and curcumin spec sheet.",
    status: "matched",
    createdAt,
  });
  const seedMatches = sortMatches(
    state.exporters
      .map((entry) => normalizeExporterRecord(entry.id, entry))
      .filter((entry) => entry.status === "approved")
      .map((entry) => scoreExporterForRfq(seedRfq, entry))
      .filter((entry) => entry.totalScore > 0),
  );

  state.rfqs.push(
    normalizeRfqRecord(seedRfq.id, {
      ...seedRfq,
      matchIds: seedMatches.map((entry) => entry.exporterId),
      matchResults: seedMatches,
      matchCount: seedMatches.length,
    }),
  );
  state.notifications.push(
    normalizeNotificationRecord("notice_seed_1", {
      userId: "exporter-spice",
      type: "rfq_match",
      title: "New RFQ matched",
      body: "Northshore Trading LLC is sourcing turmeric powder.",
      rfqId: "rfq_seed_1",
      senderId: "buyer-northshore",
      createdAt,
    }),
  );
  state.messages.push(
    normalizeMessageRecord("msg_seed_1", {
      conversationId: buildConversationId("buyer-northshore", "exporter-spice"),
      participants: ["buyer-northshore", "exporter-spice"],
      senderId: "buyer-northshore",
      receiverId: "exporter-spice",
      text: "Can you share your latest turmeric spec sheet and MOQ confirmation?",
      rfqId: "rfq_seed_1",
      createdAt,
    }),
  );

  writeStoredValue(DEMO_DB_KEY, state);
  writeStoredValue(DEMO_SESSION_KEY, null);
  return state;
}

function readDemoState() {
  return parseStoredValue(DEMO_DB_KEY, null) || seedDemoState();
}

function writeDemoState(state) {
  return writeStoredValue(DEMO_DB_KEY, state);
}

function readDemoSession() {
  return parseStoredValue(DEMO_SESSION_KEY, null);
}

function writeDemoSession(session) {
  return writeStoredValue(DEMO_SESSION_KEY, session);
}

function publicDemoUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...rest } = user;
  return decorateUser(rest);
}

function getEntityLabel(state, userId) {
  const user = state.users.find((entry) => entry.id === userId);
  const exporter = state.exporters.find((entry) => entry.userId === userId || entry.id === userId);
  const buyer = state.buyers.find((entry) => entry.userId === userId || entry.id === userId);

  return {
    user,
    companyName: exporter?.companyName || buyer?.companyName || user?.name || "Trade contact",
    role: user?.role || (exporter ? "exporter" : "buyer"),
  };
}

function buildMatchesForRfq(rfqSeed, exporters) {
  return sortMatches(
    exporters
      .filter((entry) => entry.status === "approved")
      .map((entry) => scoreExporterForRfq(rfqSeed, entry))
      .filter((entry) => entry.totalScore > 0),
  );
}

function hydrateMatches(state, matchResults) {
  return matchResults
    .map((result) => {
      const exporter = state.exporters
        .map((entry) => normalizeExporterRecord(entry.id, entry))
        .find((entry) => entry.id === result.exporterId);

      return exporter ? { ...exporter, matchScore: result.totalScore, matchBreakdown: result } : null;
    })
    .filter(Boolean);
}

function createMatchNotifications(state, rfqRecord, matchResults) {
  const notifications = matchResults.map((result) =>
    normalizeNotificationRecord(createId("notice"), {
      userId: result.exporterId,
      type: "rfq_match",
      title: "New RFQ matched",
      body: `${rfqRecord.buyerCompany} needs ${rfqRecord.product}. Match score ${result.totalScore}.`,
      rfqId: rfqRecord.id,
      senderId: rfqRecord.buyerId,
      createdAt: nowIso(),
    }),
  );

  notifications.forEach((notification) => {
    console.log("[GenuineTrade notification]", notification.title, notification.body);
  });

  state.notifications.unshift(...notifications);
}

async function demoCurrentUser() {
  const session = readDemoSession();

  if (!session?.userId) {
    return null;
  }

  const state = readDemoState();
  const user = state.users.find((entry) => entry.id === session.userId);
  return publicDemoUser(user);
}

async function demoSignUpAccount(payload) {
  const state = readDemoState();
  const email = normalizeText(payload.email);
  const alreadyExists = state.users.some((user) => normalizeText(user.email) === email);

  if (alreadyExists) {
    throw new Error("An account with this email already exists.");
  }

  const userId = createId("user");
  const createdAt = nowIso();
  const userRecord = {
    id: userId,
    name: payload.name.trim(),
    email: payload.email.trim(),
    password: payload.password,
    role: payload.role,
    createdAt,
  };

  state.users.push(userRecord);

  if (payload.role === "exporter") {
    state.exporters.push(
      normalizeExporterRecord(userId, {
        userId,
        companyName: payload.companyName,
        product: payload.product,
        country: payload.country,
        moq: payload.moq || "",
        certifications: payload.certifications || [],
        website: payload.website || "",
        iec: payload.iec || "",
        gst: payload.gst || "",
        completedDeals: 0,
        responseRate: 0,
        productDetails: payload.productDetails || "",
        status: DEFAULT_EXPORTER_STATUS,
        createdAt,
        updatedAt: createdAt,
      }),
    );
  } else {
    state.buyers.push(
      normalizeBuyerRecord(userId, {
        userId,
        companyName: payload.companyName,
        country: payload.country,
        createdAt,
        updatedAt: createdAt,
      }),
    );
  }

  writeDemoState(state);
  writeDemoSession({ userId });

  let initialRfq = null;

  if (payload.role === "buyer" && payload.initialRfq?.product) {
    initialRfq = await demoCreateRfq({
      buyerId: userId,
      buyerName: payload.name,
      buyerCompany: payload.companyName,
      buyerCountry: payload.country,
      ...payload.initialRfq,
    });
  }

  return {
    user: publicDemoUser(userRecord),
    initialRfq,
  };
}

async function demoLogInAccount({ email, password }) {
  const state = readDemoState();
  const user = state.users.find((entry) => normalizeText(entry.email) === normalizeText(email));

  if (!user || user.password !== password) {
    throw new Error("Invalid email or password.");
  }

  writeDemoSession({ userId: user.id });
  return publicDemoUser(user);
}

async function demoLogOutAccount() {
  writeDemoSession(null);
  return true;
}

async function demoGetExporterProfile(userId) {
  const state = readDemoState();
  const exporter = state.exporters.find((entry) => entry.id === userId || entry.userId === userId);
  return exporter ? normalizeExporterRecord(exporter.id, exporter) : null;
}

async function demoSaveExporterProfile(userId, data) {
  const state = readDemoState();
  const exporterIndex = state.exporters.findIndex((entry) => entry.id === userId || entry.userId === userId);
  const existing = exporterIndex >= 0 ? state.exporters[exporterIndex] : {};

  const updated = normalizeExporterRecord(userId, {
    ...existing,
    userId,
    companyName: data.companyName || existing.companyName || "",
    product: data.product || existing.product || "",
    country: data.country || existing.country || "",
    moq: data.moq ?? existing.moq ?? "",
    certifications: data.certifications ?? existing.certifications ?? [],
    website: data.website ?? existing.website ?? "",
    iec: data.iec ?? existing.iec ?? "",
    gst: data.gst ?? existing.gst ?? "",
    completedDeals: data.completedDeals ?? existing.completedDeals ?? 0,
    responseRate: data.responseRate ?? existing.responseRate ?? 0,
    productDetails: data.productDetails ?? existing.productDetails ?? "",
    status: existing.status || DEFAULT_EXPORTER_STATUS,
    manualTrustAdjustment: existing.manualTrustAdjustment || 0,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
  });

  if (exporterIndex >= 0) {
    state.exporters[exporterIndex] = updated;
  } else {
    state.exporters.push(updated);
  }

  writeDemoState(state);
  return updated;
}

async function demoGetBuyerProfile(userId) {
  const state = readDemoState();
  const buyer = state.buyers.find((entry) => entry.id === userId || entry.userId === userId);
  return buyer ? normalizeBuyerRecord(buyer.id, buyer) : null;
}

async function demoSaveBuyerProfile(userId, data) {
  const state = readDemoState();
  const buyerIndex = state.buyers.findIndex((entry) => entry.id === userId || entry.userId === userId);
  const existing = buyerIndex >= 0 ? state.buyers[buyerIndex] : {};

  const updated = normalizeBuyerRecord(userId, {
    ...existing,
    userId,
    companyName: data.companyName || existing.companyName || "",
    country: data.country || existing.country || "",
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
  });

  if (buyerIndex >= 0) {
    state.buyers[buyerIndex] = updated;
  } else {
    state.buyers.push(updated);
  }

  writeDemoState(state);
  return updated;
}

async function demoSearchExporters(criteria = {}) {
  const searchCriteria = typeof criteria === "string" ? { product: criteria } : criteria;
  const state = readDemoState();
  const exporters = state.exporters
    .map((entry) => normalizeExporterRecord(entry.id, entry))
    .filter((entry) => entry.status === "approved")
    .filter((entry) => matchesExporterSearchCriteria(entry, searchCriteria));

  return sortExporters(exporters);
}

async function demoGetFeaturedExporters(limit = 3) {
  const exporters = await demoSearchExporters({});
  return exporters.slice(0, limit);
}

async function demoGetExportersByIds(ids) {
  const state = readDemoState();
  const exporterIds = new Set(ids || []);

  return state.exporters
    .map((entry) => normalizeExporterRecord(entry.id, entry))
    .filter((entry) => exporterIds.has(entry.id));
}

async function demoGetEnrichedMatchesForRfq(rfq) {
  const state = readDemoState();
  return hydrateMatches(state, normalizeRfqRecord(rfq.id, rfq).matchResults);
}

async function demoCreateRfq(data) {
  const state = readDemoState();
  const buyerProfile = state.buyers.find((entry) => entry.id === data.buyerId || entry.userId === data.buyerId);
  const buyerUser = state.users.find((entry) => entry.id === data.buyerId);
  const rfqSeed = normalizeRfqRecord(createId("rfq"), {
    buyerId: data.buyerId,
    buyerName: data.buyerName || buyerUser?.name || "Buyer",
    buyerCompany: data.buyerCompany || buyerProfile?.companyName || "Unknown company",
    buyerCountry: data.buyerCountry || buyerProfile?.country || "N/A",
    product: data.product,
    quantity: data.quantity,
    preferredCountry: data.preferredCountry || "",
    requiredCertifications: data.requiredCertifications || [],
    notes: data.notes || "",
    status: data.status || "open",
    createdAt: nowIso(),
  });
  const matchResults = buildMatchesForRfq(
    rfqSeed,
    state.exporters.map((entry) => normalizeExporterRecord(entry.id, entry)),
  );
  const rfqRecord = normalizeRfqRecord(rfqSeed.id, {
    ...rfqSeed,
    status: matchResults.length ? "matched" : rfqSeed.status,
    matchIds: matchResults.map((entry) => entry.exporterId),
    matchResults,
    matchCount: matchResults.length,
  });

  state.rfqs.unshift(rfqRecord);
  createMatchNotifications(state, rfqRecord, matchResults);
  writeDemoState(state);

  return {
    ...rfqRecord,
    matches: hydrateMatches(state, matchResults),
  };
}

async function demoGetBuyerRfqs(buyerId) {
  const state = readDemoState();

  return state.rfqs
    .filter((entry) => entry.buyerId === buyerId)
    .map((entry) => normalizeRfqRecord(entry.id, entry))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

async function demoGetExporterRfqs(exporterId) {
  const state = readDemoState();

  return state.rfqs
    .filter((entry) => Array.isArray(entry.matchIds) && entry.matchIds.includes(exporterId))
    .map((entry) => normalizeRfqRecord(entry.id, entry))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

async function demoGetPlatformStats() {
  const state = readDemoState();
  const exporters = state.exporters.map((entry) => normalizeExporterRecord(entry.id, entry));
  const approvedExporters = exporters.filter((entry) => entry.status === "approved");
  const countries = new Set(
    [...approvedExporters.map((entry) => entry.country), ...state.buyers.map((entry) => entry.country)].filter(Boolean),
  );

  return {
    approvedExporterCount: approvedExporters.length,
    activeRfqCount: state.rfqs.filter((entry) => entry.status !== "closed").length,
    countryCount: countries.size,
    premiumExporterCount: approvedExporters.filter((entry) => entry.badge === "Premium").length,
  };
}

async function demoGetAdminExporters() {
  const state = readDemoState();

  return state.exporters
    .map((entry) => {
      const exporter = normalizeExporterRecord(entry.id, entry);
      const user = state.users.find((record) => record.id === exporter.userId);

      return {
        ...exporter,
        contactName: user?.name || "Unknown contact",
        email: user?.email || "N/A",
      };
    })
    .sort((left, right) => (timestampToDate(right.updatedAt) || 0) - (timestampToDate(left.updatedAt) || 0));
}

async function demoUpdateExporterStatus(exporterId, changes) {
  const state = readDemoState();
  const exporterIndex = state.exporters.findIndex((entry) => entry.id === exporterId || entry.userId === exporterId);

  if (exporterIndex < 0) {
    throw new Error("Exporter not found.");
  }

  const current = normalizeExporterRecord(
    state.exporters[exporterIndex].id || exporterId,
    state.exporters[exporterIndex],
  );
  const baseTrustScore = calculateBaseTrustScore(current);
  const nextTrustScore =
    changes.trustScore != null ? Number(changes.trustScore) : current.trustScore + Number(changes.manualTrustAdjustment ?? 0);

  state.exporters[exporterIndex] = normalizeExporterRecord(current.id || exporterId, {
    ...current,
    status: changes.status || current.status || DEFAULT_EXPORTER_STATUS,
    manualTrustAdjustment:
      changes.trustScore != null
        ? clamp(Number(changes.trustScore) - baseTrustScore, -100, 100)
        : Number(changes.manualTrustAdjustment ?? current.manualTrustAdjustment ?? 0),
    trustScore: clamp(nextTrustScore, 0, 100),
    updatedAt: nowIso(),
  });

  writeDemoState(state);
  return normalizeExporterRecord(state.exporters[exporterIndex].id, state.exporters[exporterIndex]);
}

async function demoGetAllRfqs() {
  const state = readDemoState();

  return state.rfqs
    .map((entry) => normalizeRfqRecord(entry.id, entry))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

async function demoGetNotificationsForUser(userId) {
  const state = readDemoState();

  return state.notifications
    .filter((entry) => entry.userId === userId)
    .map((entry) => normalizeNotificationRecord(entry.id, entry))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

async function demoMarkNotificationRead(notificationId) {
  const state = readDemoState();
  const index = state.notifications.findIndex((entry) => entry.id === notificationId);

  if (index >= 0) {
    state.notifications[index] = normalizeNotificationRecord(notificationId, {
      ...state.notifications[index],
      isRead: true,
    });
    writeDemoState(state);
    return state.notifications[index];
  }

  return null;
}

async function demoSendMessage(payload) {
  const state = readDemoState();
  const message = normalizeMessageRecord(createId("msg"), {
    conversationId: buildConversationId(payload.senderId, payload.receiverId),
    participants: [payload.senderId, payload.receiverId].sort(),
    senderId: payload.senderId,
    receiverId: payload.receiverId,
    text: payload.text,
    rfqId: payload.rfqId || "",
    createdAt: nowIso(),
  });

  state.messages.push(message);
  state.notifications.unshift(
    normalizeNotificationRecord(createId("notice"), {
      userId: payload.receiverId,
      type: "message",
      title: "New message received",
      body: payload.text,
      rfqId: payload.rfqId || "",
      senderId: payload.senderId,
      createdAt: nowIso(),
    }),
  );

  writeDemoState(state);
  return message;
}

async function demoGetConversationMessages(userId, otherUserId) {
  const state = readDemoState();
  const conversationId = buildConversationId(userId, otherUserId);

  return state.messages
    .filter((entry) => entry.conversationId === conversationId)
    .map((entry) => normalizeMessageRecord(entry.id, entry))
    .sort((left, right) => (timestampToDate(left.createdAt) || 0) - (timestampToDate(right.createdAt) || 0));
}

async function demoGetConversationThreads(userId) {
  const state = readDemoState();
  const threads = new Map();

  state.messages
    .filter((entry) => entry.participants.includes(userId))
    .forEach((entry) => {
      const message = normalizeMessageRecord(entry.id, entry);
      const otherId = message.participants.find((participant) => participant !== userId);
      const current = threads.get(otherId);

      if (!current || (timestampToDate(message.createdAt) || 0) > (timestampToDate(current.lastMessageAt) || 0)) {
        const label = getEntityLabel(state, otherId);
        threads.set(otherId, {
          partnerId: otherId,
          partnerName: label.user?.name || label.companyName,
          partnerCompany: label.companyName,
          partnerRole: label.role,
          lastMessageText: message.text,
          lastMessageAt: message.createdAt,
        });
      }
    });

  return Array.from(threads.values()).sort(
    (left, right) => (timestampToDate(right.lastMessageAt) || 0) - (timestampToDate(left.lastMessageAt) || 0),
  );
}

function ensureFirebaseReady() {
  if (!firebaseConfigured || !auth || !db) {
    throw new Error(FIREBASE_SETUP_HINT);
  }
}

async function getLiveSessionFromAuthUser(firebaseUser) {
  ensureFirebaseReady();

  const userRef = doc(db, "users", firebaseUser.uid);
  let snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(
      userRef,
      {
        name: firebaseUser.displayName || "Trade Member",
        email: firebaseUser.email || "",
        role: isAdminEmail(firebaseUser.email || "") ? "admin" : "buyer",
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    snapshot = await getDoc(userRef);
  }

  const data = snapshot.data() || {};

  return decorateUser({
    id: firebaseUser.uid,
    name: data.name || firebaseUser.displayName || "Trade Member",
    email: data.email || firebaseUser.email || "",
    role: data.role || (isAdminEmail(firebaseUser.email || "") ? "admin" : "buyer"),
    createdAt: data.createdAt || nowIso(),
  });
}

async function getLiveUserDoc(userId) {
  ensureFirebaseReady();
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? snapshot.data() : null;
}

async function getLiveExporterDocs() {
  ensureFirebaseReady();
  const snapshot = await getDocs(collection(db, "exporters"));
  return snapshot.docs.map((entry) => normalizeExporterRecord(entry.id, entry.data()));
}

async function getLiveBuyerDocs() {
  ensureFirebaseReady();
  const snapshot = await getDocs(collection(db, "buyers"));
  return snapshot.docs.map((entry) => normalizeBuyerRecord(entry.id, entry.data()));
}

if (APP_MODE === "demo") {
  readDemoState();
}

export function getPrimaryWorkspacePath(user) {
  if (!user) {
    return "login.html?mode=login";
  }

  if (user.role === "exporter") {
    return "exporter.html";
  }

  if (user.role === "buyer") {
    return "buyer.html";
  }

  if (isAdminUser(user)) {
    return "admin.html";
  }

  return "dashboard.html";
}

export async function waitForSessionUser() {
  if (APP_MODE === "demo") {
    return demoCurrentUser();
  }

  ensureFirebaseReady();

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        unsubscribe();

        if (!firebaseUser) {
          resolve(null);
          return;
        }

        resolve(await getLiveSessionFromAuthUser(firebaseUser));
      },
      () => resolve(null),
    );
  });
}

export async function signUpAccount(payload) {
  if (APP_MODE === "demo") {
    return demoSignUpAccount(payload);
  }

  ensureFirebaseReady();

  const credential = await createUserWithEmailAndPassword(auth, payload.email.trim(), payload.password);

  if (payload.name) {
    await updateProfile(credential.user, { displayName: payload.name.trim() });
  }

  await setDoc(
    doc(db, "users", credential.user.uid),
    {
      name: payload.name.trim(),
      email: payload.email.trim(),
      role: payload.role,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (payload.role === "exporter") {
    await setDoc(
      doc(db, "exporters", credential.user.uid),
      {
        userId: credential.user.uid,
        companyName: payload.companyName,
        product: payload.product,
        country: payload.country,
        moq: payload.moq || "",
        certifications: splitCsv(payload.certifications || []),
        website: payload.website || "",
        iec: payload.iec || "",
        gst: payload.gst || "",
        completedDeals: 0,
        responseRate: 0,
        manualTrustAdjustment: 0,
        badge: DEFAULT_BADGE,
        trustScore: calculateBaseTrustScore(payload),
        productDetails: payload.productDetails || "",
        status: DEFAULT_EXPORTER_STATUS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } else {
    await setDoc(
      doc(db, "buyers", credential.user.uid),
      {
        userId: credential.user.uid,
        companyName: payload.companyName,
        country: payload.country,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  let initialRfq = null;

  if (payload.role === "buyer" && payload.initialRfq?.product) {
    initialRfq = await createRfq({
      buyerId: credential.user.uid,
      buyerName: payload.name,
      buyerCompany: payload.companyName,
      buyerCountry: payload.country,
      ...payload.initialRfq,
    });
  }

  return {
    user: await getLiveSessionFromAuthUser(credential.user),
    initialRfq,
  };
}

export async function logInAccount(credentials) {
  if (APP_MODE === "demo") {
    return demoLogInAccount(credentials);
  }

  ensureFirebaseReady();
  const credential = await signInWithEmailAndPassword(auth, credentials.email.trim(), credentials.password);
  return getLiveSessionFromAuthUser(credential.user);
}

export async function logOutAccount() {
  if (APP_MODE === "demo") {
    return demoLogOutAccount();
  }

  ensureFirebaseReady();
  await signOut(auth);
  return true;
}

export async function getExporterProfile(userId) {
  if (APP_MODE === "demo") {
    return demoGetExporterProfile(userId);
  }

  ensureFirebaseReady();
  const snapshot = await getDoc(doc(db, "exporters", userId));
  return snapshot.exists() ? normalizeExporterRecord(snapshot.id, snapshot.data()) : null;
}

export async function saveExporterProfile(userId, data) {
  if (APP_MODE === "demo") {
    return demoSaveExporterProfile(userId, data);
  }

  ensureFirebaseReady();
  const existing = await getExporterProfile(userId);

  const next = normalizeExporterRecord(userId, {
    ...existing,
    ...data,
    userId,
    updatedAt: nowIso(),
  });

  await setDoc(
    doc(db, "exporters", userId),
    {
      userId,
      companyName: next.companyName,
      product: next.product,
      country: next.country,
      moq: next.moq,
      certifications: next.certifications,
      website: next.website,
      iec: next.iec,
      gst: next.gst,
      completedDeals: next.completedDeals,
      responseRate: next.responseRate,
      productDetails: next.productDetails,
      manualTrustAdjustment: next.manualTrustAdjustment,
      trustScore: next.trustScore,
      badge: next.badge,
      trustLabel: next.badge,
      status: next.status || DEFAULT_EXPORTER_STATUS,
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return getExporterProfile(userId);
}

export async function getBuyerProfile(userId) {
  if (APP_MODE === "demo") {
    return demoGetBuyerProfile(userId);
  }

  ensureFirebaseReady();
  const snapshot = await getDoc(doc(db, "buyers", userId));
  return snapshot.exists() ? normalizeBuyerRecord(snapshot.id, snapshot.data()) : null;
}

export async function saveBuyerProfile(userId, data) {
  if (APP_MODE === "demo") {
    return demoSaveBuyerProfile(userId, data);
  }

  ensureFirebaseReady();
  const existing = await getBuyerProfile(userId);

  await setDoc(
    doc(db, "buyers", userId),
    {
      userId,
      companyName: data.companyName || existing?.companyName || "",
      country: data.country || existing?.country || "",
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return getBuyerProfile(userId);
}

export async function searchExporters(criteria = {}) {
  if (APP_MODE === "demo") {
    return demoSearchExporters(criteria);
  }

  ensureFirebaseReady();
  const searchCriteria = typeof criteria === "string" ? { product: criteria } : criteria;

  const snapshot = await getDocs(query(collection(db, "exporters"), where("status", "==", "approved")));
  const exporters = snapshot.docs
    .map((entry) => normalizeExporterRecord(entry.id, entry.data()))
    .filter((entry) => matchesExporterSearchCriteria(entry, searchCriteria));

  return sortExporters(exporters);
}

export async function getFeaturedExporters(limit = 3) {
  if (APP_MODE === "demo") {
    return demoGetFeaturedExporters(limit);
  }

  const exporters = await searchExporters({});
  return exporters.slice(0, limit);
}

export async function getExportersByIds(ids) {
  if (APP_MODE === "demo") {
    return demoGetExportersByIds(ids);
  }

  const exporters = await getLiveExporterDocs();
  const exporterIds = new Set(ids || []);
  return exporters.filter((entry) => exporterIds.has(entry.id));
}

export async function getEnrichedMatchesForRfq(rfq) {
  if (APP_MODE === "demo") {
    return demoGetEnrichedMatchesForRfq(rfq);
  }

  const normalized = normalizeRfqRecord(rfq.id, rfq);
  const exporters = await getExportersByIds(normalized.matchIds);

  return normalized.matchResults
    .map((result) => {
      const exporter = exporters.find((entry) => entry.id === result.exporterId);
      return exporter ? { ...exporter, matchScore: result.totalScore, matchBreakdown: result } : null;
    })
    .filter(Boolean);
}

export async function createRfq(data) {
  if (APP_MODE === "demo") {
    return demoCreateRfq(data);
  }

  ensureFirebaseReady();

  const buyerProfile = data.buyerId ? await getBuyerProfile(data.buyerId) : null;
  const buyerUser = data.buyerId ? await getLiveUserDoc(data.buyerId) : null;
  const exporters = await searchExporters({});
  const rfqSeed = normalizeRfqRecord(createId("rfq"), {
    buyerId: data.buyerId,
    buyerName: data.buyerName || buyerUser?.name || "Buyer",
    buyerCompany: data.buyerCompany || buyerProfile?.companyName || "Unknown company",
    buyerCountry: data.buyerCountry || buyerProfile?.country || "N/A",
    product: data.product,
    quantity: data.quantity,
    preferredCountry: data.preferredCountry || "",
    requiredCertifications: data.requiredCertifications || [],
    notes: data.notes || "",
    status: data.status || "open",
  });
  const matchResults = buildMatchesForRfq(rfqSeed, exporters);

  const rfqPayload = {
    buyerId: rfqSeed.buyerId,
    buyerName: rfqSeed.buyerName,
    buyerCompany: rfqSeed.buyerCompany,
    buyerCountry: rfqSeed.buyerCountry,
    product: rfqSeed.product,
    quantity: rfqSeed.quantity,
    preferredCountry: rfqSeed.preferredCountry,
    requiredCertifications: rfqSeed.requiredCertifications,
    notes: rfqSeed.notes,
    status: matchResults.length ? "matched" : rfqSeed.status,
    matchIds: matchResults.map((entry) => entry.exporterId),
    matchResults,
    matchCount: matchResults.length,
    createdAt: serverTimestamp(),
  };

  const reference = await addDoc(collection(db, "rfqs"), rfqPayload);
  await Promise.all(
    matchResults.map((result) =>
      addDoc(collection(db, "notifications"), {
        userId: result.exporterId,
        type: "rfq_match",
        title: "New RFQ matched",
        body: `${rfqSeed.buyerCompany} needs ${rfqSeed.product}. Match score ${result.totalScore}.`,
        rfqId: reference.id,
        senderId: rfqSeed.buyerId,
        isRead: false,
        createdAt: serverTimestamp(),
      }),
    ),
  );

  return {
    ...normalizeRfqRecord(reference.id, {
      ...rfqPayload,
      createdAt: nowIso(),
    }),
    matches: await getEnrichedMatchesForRfq({
      id: reference.id,
      ...rfqPayload,
      createdAt: nowIso(),
    }),
  };
}

export async function getBuyerRfqs(buyerId) {
  if (APP_MODE === "demo") {
    return demoGetBuyerRfqs(buyerId);
  }

  ensureFirebaseReady();

  const snapshot = await getDocs(query(collection(db, "rfqs"), where("buyerId", "==", buyerId)));

  return snapshot.docs
    .map((entry) => normalizeRfqRecord(entry.id, entry.data()))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

export async function getExporterRfqs(exporterId) {
  if (APP_MODE === "demo") {
    return demoGetExporterRfqs(exporterId);
  }

  ensureFirebaseReady();

  const snapshot = await getDocs(query(collection(db, "rfqs"), where("matchIds", "array-contains", exporterId)));

  return snapshot.docs
    .map((entry) => normalizeRfqRecord(entry.id, entry.data()))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

export async function getAllRfqs() {
  if (APP_MODE === "demo") {
    return demoGetAllRfqs();
  }

  ensureFirebaseReady();

  const snapshot = await getDocs(collection(db, "rfqs"));

  return snapshot.docs
    .map((entry) => normalizeRfqRecord(entry.id, entry.data()))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

export async function getPlatformStats() {
  if (APP_MODE === "demo") {
    return demoGetPlatformStats();
  }

  ensureFirebaseReady();

  const [exporters, buyers, rfqs] = await Promise.all([getLiveExporterDocs(), getLiveBuyerDocs(), getAllRfqs()]);
  const approvedExporters = exporters.filter((entry) => entry.status === "approved");
  const countries = new Set(
    [...approvedExporters.map((entry) => entry.country), ...buyers.map((entry) => entry.country)].filter(Boolean),
  );

  return {
    approvedExporterCount: approvedExporters.length,
    activeRfqCount: rfqs.filter((entry) => entry.status !== "closed").length,
    countryCount: countries.size,
    premiumExporterCount: approvedExporters.filter((entry) => entry.badge === "Premium").length,
  };
}

export async function getAdminExporters() {
  if (APP_MODE === "demo") {
    return demoGetAdminExporters();
  }

  ensureFirebaseReady();

  const [exporters, usersSnapshot] = await Promise.all([getLiveExporterDocs(), getDocs(collection(db, "users"))]);

  const usersById = new Map(usersSnapshot.docs.map((entry) => [entry.id, entry.data()]));

  return exporters
    .map((exporter) => {
      const user = usersById.get(exporter.userId) || {};

      return {
        ...exporter,
        contactName: user.name || "Unknown contact",
        email: user.email || "N/A",
      };
    })
    .sort((left, right) => (timestampToDate(right.updatedAt) || 0) - (timestampToDate(left.updatedAt) || 0));
}

export async function updateExporterStatus(exporterId, changes) {
  if (APP_MODE === "demo") {
    return demoUpdateExporterStatus(exporterId, changes);
  }

  ensureFirebaseReady();

  const existing = await getExporterProfile(exporterId);
  const baseTrustScore = calculateBaseTrustScore(existing || {});
  const nextTrustScore =
    changes.trustScore != null ? Number(changes.trustScore) : (existing?.trustScore || 0) + Number(changes.manualTrustAdjustment ?? 0);
  const nextManualAdjustment =
    changes.trustScore != null
      ? clamp(Number(changes.trustScore) - baseTrustScore, -100, 100)
      : Number(changes.manualTrustAdjustment ?? existing?.manualTrustAdjustment ?? 0);
  const nextBadge = resolveBadge(clamp(nextTrustScore, 0, 100));

  await updateDoc(doc(db, "exporters", exporterId), {
    status: changes.status || existing?.status || DEFAULT_EXPORTER_STATUS,
    manualTrustAdjustment: nextManualAdjustment,
    trustScore: clamp(nextTrustScore, 0, 100),
    badge: nextBadge,
    trustLabel: nextBadge,
    updatedAt: serverTimestamp(),
  });

  return getExporterProfile(exporterId);
}

export async function getNotificationsForUser(userId) {
  if (APP_MODE === "demo") {
    return demoGetNotificationsForUser(userId);
  }

  ensureFirebaseReady();

  const snapshot = await getDocs(query(collection(db, "notifications"), where("userId", "==", userId)));

  return snapshot.docs
    .map((entry) => normalizeNotificationRecord(entry.id, entry.data()))
    .sort((left, right) => (timestampToDate(right.createdAt) || 0) - (timestampToDate(left.createdAt) || 0));
}

export async function markNotificationRead(notificationId) {
  if (APP_MODE === "demo") {
    return demoMarkNotificationRead(notificationId);
  }

  ensureFirebaseReady();

  await updateDoc(doc(db, "notifications", notificationId), {
    isRead: true,
  });

  const snapshot = await getDoc(doc(db, "notifications", notificationId));
  return snapshot.exists() ? normalizeNotificationRecord(snapshot.id, snapshot.data()) : null;
}

export async function sendMessage(payload) {
  if (APP_MODE === "demo") {
    return demoSendMessage(payload);
  }

  ensureFirebaseReady();

  const conversationId = buildConversationId(payload.senderId, payload.receiverId);
  const participants = [payload.senderId, payload.receiverId].sort();
  const reference = await addDoc(collection(db, "messages"), {
    conversationId,
    participants,
    senderId: payload.senderId,
    receiverId: payload.receiverId,
    text: payload.text,
    rfqId: payload.rfqId || "",
    createdAt: serverTimestamp(),
  });

  await addDoc(collection(db, "notifications"), {
    userId: payload.receiverId,
    type: "message",
    title: "New message received",
    body: payload.text,
    rfqId: payload.rfqId || "",
    senderId: payload.senderId,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  return normalizeMessageRecord(reference.id, {
    conversationId,
    participants,
    senderId: payload.senderId,
    receiverId: payload.receiverId,
    text: payload.text,
    rfqId: payload.rfqId || "",
    createdAt: nowIso(),
  });
}

export async function getConversationMessages(userId, otherUserId) {
  if (APP_MODE === "demo") {
    return demoGetConversationMessages(userId, otherUserId);
  }

  ensureFirebaseReady();

  const conversationId = buildConversationId(userId, otherUserId);
  const snapshot = await getDocs(query(collection(db, "messages"), where("conversationId", "==", conversationId)));

  return snapshot.docs
    .map((entry) => normalizeMessageRecord(entry.id, entry.data()))
    .sort((left, right) => (timestampToDate(left.createdAt) || 0) - (timestampToDate(right.createdAt) || 0));
}

export async function getConversationThreads(userId) {
  if (APP_MODE === "demo") {
    return demoGetConversationThreads(userId);
  }

  ensureFirebaseReady();

  const [messagesSnapshot, usersSnapshot, exporters, buyers] = await Promise.all([
    getDocs(query(collection(db, "messages"), where("participants", "array-contains", userId))),
    getDocs(collection(db, "users")),
    getLiveExporterDocs(),
    getLiveBuyerDocs(),
  ]);
  const usersById = new Map(usersSnapshot.docs.map((entry) => [entry.id, entry.data()]));
  const exportersById = new Map(exporters.map((entry) => [entry.userId || entry.id, entry]));
  const buyersById = new Map(buyers.map((entry) => [entry.userId || entry.id, entry]));
  const threads = new Map();

  messagesSnapshot.docs.forEach((entry) => {
    const message = normalizeMessageRecord(entry.id, entry.data());
    const otherId = message.participants.find((participant) => participant !== userId);

    if (!otherId) {
      return;
    }

    const current = threads.get(otherId);

    if (!current || (timestampToDate(message.createdAt) || 0) > (timestampToDate(current.lastMessageAt) || 0)) {
      const userRecord = usersById.get(otherId) || {};
      const exporter = exportersById.get(otherId);
      const buyer = buyersById.get(otherId);

      threads.set(otherId, {
        partnerId: otherId,
        partnerName: userRecord.name || exporter?.companyName || buyer?.companyName || "Trade contact",
        partnerCompany: exporter?.companyName || buyer?.companyName || userRecord.name || "Trade contact",
        partnerRole: userRecord.role || (exporter ? "exporter" : buyer ? "buyer" : "member"),
        lastMessageText: message.text,
        lastMessageAt: message.createdAt,
      });
    }
  });

  return Array.from(threads.values()).sort(
    (left, right) => (timestampToDate(right.lastMessageAt) || 0) - (timestampToDate(left.lastMessageAt) || 0),
  );
}
