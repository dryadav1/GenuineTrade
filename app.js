import {
  APP_MODE,
  DEMO_CREDENTIALS,
  FIREBASE_SETUP_HINT,
  PUBLIC_API_ENDPOINTS,
  createRfq,
  formatDate,
  getAdminExporters,
  getAllRfqs,
  getBuyerProfile,
  getBuyerRfqs,
  getConversationMessages,
  getConversationThreads,
  getEnrichedMatchesForRfq,
  getExporterProfile,
  getExporterRfqs,
  getFeaturedExporters,
  getNotificationsForUser,
  getPlatformStats,
  getPrimaryWorkspacePath,
  isAdminUser,
  logInAccount,
  logOutAccount,
  markNotificationRead,
  saveExporterProfile,
  searchExporters,
  sendMessage,
  signUpAccount,
  updateExporterStatus,
  waitForSessionUser,
} from "./firebase.js";

const FALLBACK_COUNTRIES = [
  { name: "India", region: "Asia", code: "IN" },
  { name: "United Arab Emirates", region: "Asia", code: "AE" },
  { name: "Germany", region: "Europe", code: "DE" },
  { name: "United Kingdom", region: "Europe", code: "GB" },
  { name: "United States", region: "Americas", code: "US" },
  { name: "Singapore", region: "Asia", code: "SG" },
];

const FALLBACK_FX = {
  rates: { INR: 83.25, EUR: 0.92, AED: 3.67 },
  date: new Date().toISOString().slice(0, 10),
};

const appState = { currentUser: null, countries: FALLBACK_COUNTRIES, marketPulse: [] };
let adminExporterCache = [];
let adminRfqCache = [];

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  initYear();
  initNavigation();

  const referencePromise = Promise.all([loadCountryDirectory(), loadMarketPulse()]);
  appState.currentUser = await waitForSessionUser();
  syncAuthControls(appState.currentUser);
  renderModeBanners();
  await referencePromise;

  const page = document.body.dataset.page;

  if (page === "home") await initHomePage();
  if (page === "auth") await initAuthPage();
  if (page === "dashboard") await initDashboardPage();
  if (page === "exporter") await initExporterPage();
  if (page === "buyer") await initBuyerPage();
  if (page === "admin") await initAdminPage();
}

function initYear() {
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

function initNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  document.querySelectorAll(".site-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      nav?.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    });
  });
}

async function loadCountryDirectory() {
  try {
    const countries = await fetchJson(PUBLIC_API_ENDPOINTS.countries);
    appState.countries = (Array.isArray(countries) ? countries : [])
      .map((entry) => ({
        name: entry?.name?.common || "",
        region: entry?.region || "Global",
        code: entry?.cca2 || "",
      }))
      .filter((entry) => entry.name)
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch (error) {
    appState.countries = FALLBACK_COUNTRIES;
  }

  if (appState.marketPulse.length >= 4) {
    appState.marketPulse[3] = {
      ...appState.marketPulse[3],
      value: `${appState.countries.length}+`,
    };
  }

  populateCountrySelects();
}

async function loadMarketPulse() {
  try {
    const response = await fetchJson(PUBLIC_API_ENDPOINTS.fx);
    const payload = response?.rates ? response : FALLBACK_FX;

    appState.marketPulse = [
      { label: "USD / INR", value: formatFx(payload.rates?.INR, "INR"), meta: `Updated ${payload.date}` },
      { label: "USD / EUR", value: formatFx(payload.rates?.EUR, "EUR"), meta: `Updated ${payload.date}` },
      { label: "USD / AED", value: formatFx(payload.rates?.AED, "AED"), meta: `Updated ${payload.date}` },
      { label: "Country directory", value: `${appState.countries.length}+`, meta: "Live public APIs" },
    ];
  } catch (error) {
    appState.marketPulse = [
      { label: "USD / INR", value: formatFx(FALLBACK_FX.rates.INR, "INR"), meta: "Fallback pulse" },
      { label: "USD / EUR", value: formatFx(FALLBACK_FX.rates.EUR, "EUR"), meta: "Fallback pulse" },
      { label: "USD / AED", value: formatFx(FALLBACK_FX.rates.AED, "AED"), meta: "Fallback pulse" },
      { label: "Country directory", value: `${appState.countries.length}+`, meta: "Fallback countries" },
    ];
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function populateCountrySelects() {
  document.querySelectorAll("[data-country-select]").forEach((select) => {
    const previous = select.dataset.selectedValue || select.value || "";
    const includeAny = select.dataset.includeAny === "true";
    const firstLabel = includeAny
      ? select.dataset.anyLabel || "Any country"
      : select.dataset.placeholder || "Select country";
    const items = [{ value: "", label: firstLabel }].concat(
      appState.countries.map((entry) => ({ value: entry.name, label: entry.name })),
    );

    select.innerHTML = items
      .map((item) => `<option value="${escapeAttribute(item.value)}">${escapeHtml(item.label)}</option>`)
      .join("");
    select.value = previous && items.some((item) => item.value === previous) ? previous : "";
  });
}

function syncAuthControls(user) {
  document.querySelectorAll("[data-auth-only]").forEach((node) => {
    node.hidden = !user;
  });
  document.querySelectorAll("[data-guest-only]").forEach((node) => {
    node.hidden = Boolean(user);
  });
  document.querySelectorAll("[data-admin-only]").forEach((node) => {
    node.hidden = !isAdminUser(user);
  });
  document.querySelectorAll("[data-exporter-only]").forEach((node) => {
    node.hidden = user?.role !== "exporter";
  });
  document.querySelectorAll("[data-buyer-only]").forEach((node) => {
    node.hidden = user?.role !== "buyer";
  });
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.hidden = !user;
    if (!button.dataset.bound) {
      button.dataset.bound = "true";
      button.addEventListener("click", handleLogout);
    }
  });
}

async function handleLogout() {
  await logOutAccount();
  window.location.href = "index.html";
}

function renderModeBanners() {
  const message = APP_MODE === "demo" ? `Demo mode is active. ${FIREBASE_SETUP_HINT}` : "";

  document.querySelectorAll("[data-mode-banner]").forEach((banner) => {
    banner.hidden = !message;
    if (message) {
      banner.dataset.tone = "info";
      banner.textContent = message;
    }
  });

  const note = document.querySelector("[data-demo-note]");
  if (note && APP_MODE === "demo") {
    note.hidden = false;
    note.textContent =
      `Demo admin: ${DEMO_CREDENTIALS.admin.email} / ${DEMO_CREDENTIALS.admin.password}. ` +
      `Demo buyer: ${DEMO_CREDENTIALS.buyer.email} / ${DEMO_CREDENTIALS.buyer.password}. ` +
      `Demo exporter: ${DEMO_CREDENTIALS.exporter.email} / ${DEMO_CREDENTIALS.exporter.password}.`;
  }
}

async function requireUser(options = {}) {
  if (!appState.currentUser) {
    appState.currentUser = await waitForSessionUser();
    syncAuthControls(appState.currentUser);
  }
  if (!appState.currentUser) {
    window.location.href = "login.html?mode=login";
    return null;
  }
  if (options.adminOnly && !isAdminUser(appState.currentUser)) {
    window.location.href = "dashboard.html";
    return null;
  }
  if (options.role && appState.currentUser.role !== options.role) {
    window.location.href = getPrimaryWorkspacePath(appState.currentUser);
    return null;
  }
  return appState.currentUser;
}

function normalizeText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function humanize(value = "") {
  return String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function formatFx(value, code) {
  const amount = safeNumber(value, 0);
  if (code === "INR") return `INR ${amount.toFixed(2)}`;
  if (code === "EUR") return `EUR ${amount.toFixed(2)}`;
  if (code === "AED") return `${amount.toFixed(2)} AED`;
  return amount.toFixed(2);
}

function badgeClass(value = "") {
  const normalized = normalizeText(value);
  if (normalized === "premium") return "badge-premium";
  if (normalized === "trusted") return "badge-trusted";
  if (["verified", "approved", "open", "matched"].includes(normalized)) return "badge-verified";
  if (["new", "pending"].includes(normalized)) return "badge-pending";
  if (["rejected", "closed"].includes(normalized)) return "badge-rejected";
  return "badge-neutral-soft";
}

function renderBadge(value) {
  return `<span class="status-badge ${badgeClass(value)}">${escapeHtml(humanize(value))}</span>`;
}

function setStatus(note, message, tone = "success") {
  if (!note) return;
  note.hidden = false;
  note.dataset.tone = tone;
  note.textContent = message;
}

function clearStatus(note) {
  if (!note) return;
  note.hidden = true;
  note.textContent = "";
  delete note.dataset.tone;
}

function renderEmptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderStats(container, stats) {
  if (!container) return;
  container.innerHTML = stats
    .map(
      (item) => `
        <article class="stat-card">
          <span class="stat-label">${escapeHtml(item.label)}</span>
          <span class="stat-value">${escapeHtml(String(item.value))}</span>
          <span class="stat-meta">${escapeHtml(item.meta)}</span>
        </article>
      `,
    )
    .join("");
}

function renderInfoRows(container, rows) {
  if (!container) return;
  container.innerHTML = rows
    .map(
      (row) => `
        <div class="info-row">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(row.value)}</span>
        </div>
      `,
    )
    .join("");
}

function renderMarketPulseCards(container, limit = 4) {
  if (!container) return;
  container.innerHTML = appState.marketPulse
    .slice(0, limit)
    .map(
      (entry) => `
        <article class="pulse-card">
          <span class="pulse-label">${escapeHtml(entry.label)}</span>
          <strong class="pulse-value">${escapeHtml(entry.value)}</strong>
          <span class="pulse-meta">${escapeHtml(entry.meta)}</span>
        </article>
      `,
    )
    .join("");
}

function renderCountryDirectory(container) {
  if (!container) return;
  const highlightCodes = ["IN", "AE", "US", "DE", "GB", "SG"];
  const chosen = highlightCodes.map((code) => appState.countries.find((entry) => entry.code === code)).filter(Boolean);
  const countries = chosen.length ? chosen : appState.countries.slice(0, 6);

  container.innerHTML = countries
    .map(
      (entry) => `
        <article class="directory-card">
          <span class="directory-code">${escapeHtml(entry.code || "--")}</span>
          <strong>${escapeHtml(entry.name)}</strong>
          <span>${escapeHtml(entry.region || "Global")}</span>
        </article>
      `,
    )
    .join("");
}

function createChatButton(partnerId, meta = {}, label = "Open Chat") {
  return `
    <button
      class="btn btn-secondary btn-small"
      type="button"
      data-open-chat="${escapeAttribute(partnerId)}"
      data-chat-name="${escapeAttribute(meta.partnerName || meta.name || "")}"
      data-chat-company="${escapeAttribute(meta.partnerCompany || meta.companyName || "")}"
      data-chat-role="${escapeAttribute(meta.partnerRole || meta.role || "")}"
      data-rfq-id="${escapeAttribute(meta.rfqId || "")}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderScoreBreakdown(breakdown) {
  if (!breakdown) return "";
  return `
    <div class="score-grid">
      <span class="score-chip">Product ${escapeHtml(String(breakdown.productScore || 0))}</span>
      <span class="score-chip">MOQ ${escapeHtml(String(breakdown.moqScore || 0))}</span>
      <span class="score-chip">Certs ${escapeHtml(String(breakdown.certificationScore || 0))}</span>
      <span class="score-chip">Trust ${escapeHtml(String(breakdown.trustBonus || 0))}</span>
    </div>
  `;
}

function renderExporterCard(exporter, options = {}) {
  const certs = exporter.certificationsText || splitCsv(exporter.certifications || []).join(", ") || "No certifications added";
  const breakdown = options.matchBreakdown || exporter.matchBreakdown;
  const actions = options.actions || [];

  return `
    <article class="list-card">
      <div class="list-card-header">
        <div>
          <h3>${escapeHtml(exporter.companyName)}</h3>
          <p>${escapeHtml(exporter.product || "No product listed")}</p>
        </div>
        ${renderBadge(exporter.badge || exporter.trustLabel || "New")}
      </div>
      <div class="list-card-meta">
        <span>${escapeHtml(exporter.country || "N/A")}</span>
        <span>MOQ: ${escapeHtml(exporter.moq || "Not shared")}</span>
        <span>Trust: ${escapeHtml(String(exporter.trustScore || 0))}</span>
      </div>
      <p>${escapeHtml(exporter.productDetails || "Approved exporter profile ready for buyer conversations.")}</p>
      <div class="chip-row"><span class="detail-chip">${escapeHtml(certs)}</span></div>
      ${breakdown ? `<div class="list-card-section"><strong>Match score ${escapeHtml(String(breakdown.totalScore || exporter.matchScore || 0))}</strong>${renderScoreBreakdown(breakdown)}</div>` : ""}
      ${actions.length ? `<div class="list-card-actions">${actions.join("")}</div>` : ""}
    </article>
  `;
}

function renderRfqCard(rfq, options = {}) {
  const viewer = options.viewer || "buyer";
  const ownMatch =
    options.currentUserId && Array.isArray(rfq.matchResults)
      ? rfq.matchResults.find((entry) => entry.exporterId === options.currentUserId)
      : null;
  const actions = [];

  if (viewer === "exporter" && rfq.buyerId) {
    actions.push(
      createChatButton(
        rfq.buyerId,
        {
          partnerName: rfq.buyerName || rfq.buyerCompany,
          partnerCompany: rfq.buyerCompany,
          partnerRole: "buyer",
          rfqId: rfq.id,
        },
        "Message Buyer",
      ),
    );
  }

  return `
    <article class="list-card">
      <div class="list-card-header">
        <div>
          <h3>${escapeHtml(rfq.product || "Untitled RFQ")}</h3>
          <p>${escapeHtml(viewer === "exporter" ? rfq.buyerCompany || "Buyer request" : rfq.buyerCompany || "Your RFQ")}</p>
        </div>
        ${renderBadge(rfq.status || "open")}
      </div>
      <div class="list-card-meta">
        <span>Quantity: ${escapeHtml(rfq.quantity || "Not specified")}</span>
        <span>Preferred country: ${escapeHtml(rfq.preferredCountry || "Any")}</span>
        <span>Matches: ${escapeHtml(String(rfq.matchCount || 0))}</span>
        <span>${escapeHtml(formatDate(rfq.createdAt))}</span>
      </div>
      <p>${escapeHtml(rfq.notes || "No additional notes provided.")}</p>
      ${rfq.requiredCertificationsText ? `<div class="chip-row"><span class="detail-chip">Required certs: ${escapeHtml(rfq.requiredCertificationsText)}</span></div>` : ""}
      ${ownMatch ? `<div class="list-card-section"><strong>Your score ${escapeHtml(String(ownMatch.totalScore || 0))}</strong>${renderScoreBreakdown(ownMatch)}</div>` : ""}
      ${actions.length ? `<div class="list-card-actions">${actions.join("")}</div>` : ""}
    </article>
  `;
}

function renderNotificationCard(notification, meta = {}) {
  const actions = [];
  if (!notification.isRead) {
    actions.push(
      `<button class="btn btn-secondary btn-small" type="button" data-notification-read="${escapeAttribute(notification.id)}">Mark Read</button>`,
    );
  }
  if (notification.senderId) {
    actions.push(
      createChatButton(
        notification.senderId,
        {
          partnerName: meta.partnerName,
          partnerCompany: meta.partnerCompany,
          partnerRole: meta.partnerRole,
          rfqId: notification.rfqId || "",
        },
        "Reply",
      ),
    );
  }

  return `
    <article class="list-card">
      <div class="list-card-header">
        <div>
          <h3>${escapeHtml(notification.title || "Notification")}</h3>
          <p>${escapeHtml(notification.body || "")}</p>
        </div>
        ${renderBadge(notification.isRead ? "read" : "new")}
      </div>
      <div class="list-card-meta">
        <span>${escapeHtml(humanize(notification.type || "system"))}</span>
        <span>${escapeHtml(formatDate(notification.createdAt))}</span>
      </div>
      ${actions.length ? `<div class="list-card-actions">${actions.join("")}</div>` : ""}
    </article>
  `;
}

function renderThreadCard(thread, activePartnerId) {
  return `
    <button
      class="thread-card${thread.partnerId === activePartnerId ? " is-active" : ""}"
      type="button"
      data-thread-open="${escapeAttribute(thread.partnerId)}"
      data-chat-name="${escapeAttribute(thread.partnerName || "")}"
      data-chat-company="${escapeAttribute(thread.partnerCompany || "")}"
      data-chat-role="${escapeAttribute(thread.partnerRole || "")}"
    >
      <strong>${escapeHtml(thread.partnerCompany || thread.partnerName || "Trade contact")}</strong>
      <span>${escapeHtml(thread.partnerRole ? humanize(thread.partnerRole) : "Conversation")}</span>
      <p>${escapeHtml(thread.lastMessageText || "No messages yet")}</p>
    </button>
  `;
}

function renderChatMessage(message, currentUserId) {
  const isOwn = message.senderId === currentUserId;
  return `
    <article class="chat-message${isOwn ? " is-own" : ""}">
      <div class="chat-bubble">
        <p>${escapeHtml(message.text || "")}</p>
        <span>${escapeHtml(formatDate(message.createdAt))}</span>
      </div>
    </article>
  `;
}

function buildNotificationMetaDirectory(entries = [], userRole = "") {
  const map = new Map();
  entries.forEach((entry) => {
    if (!entry) return;
    if (userRole === "buyer") {
      map.set(entry.id, { partnerName: entry.companyName, partnerCompany: entry.companyName, partnerRole: "exporter" });
    } else if (userRole === "exporter") {
      map.set(entry.buyerId, { partnerName: entry.buyerName || entry.buyerCompany, partnerCompany: entry.buyerCompany, partnerRole: "buyer" });
    }
  });
  return map;
}

function buildPartnerMetaFromNotification(notification, directory = new Map()) {
  return directory.get(notification.senderId) || { partnerName: "Trade contact", partnerCompany: "Trade contact", partnerRole: "member" };
}

function getMatchCountTotal(rfqs) {
  return rfqs.reduce((sum, entry) => sum + safeNumber(entry.matchCount, 0), 0);
}

function computeAverageExporterMatchScore(rfqs, exporterId) {
  const scores = rfqs
    .map((entry) => (Array.isArray(entry.matchResults) ? entry.matchResults.find((result) => result.exporterId === exporterId) : null))
    .filter(Boolean)
    .map((entry) => safeNumber(entry.totalScore, 0));
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function getBuyerCountrySpread(matches) {
  return new Set(matches.map((entry) => entry.country).filter(Boolean)).size;
}

function renderList(container, markup, emptyMessage) {
  if (!container) return;
  container.innerHTML = markup || renderEmptyState(emptyMessage);
}

function buildHomeSignupPayload(formData, role) {
  if (role === "exporter") {
    return {
      role,
      name: String(formData.get("name") || ""),
      companyName: String(formData.get("companyName") || ""),
      product: String(formData.get("product") || ""),
      country: String(formData.get("country") || ""),
      moq: String(formData.get("moq") || ""),
      certifications: splitCsv(formData.get("certifications")),
      website: String(formData.get("website") || ""),
      iec: String(formData.get("iec") || ""),
      gst: String(formData.get("gst") || ""),
      productDetails: String(formData.get("productDetails") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    };
  }

  const product = String(formData.get("product") || "");
  return {
    role,
    name: String(formData.get("name") || ""),
    companyName: String(formData.get("companyName") || ""),
    product,
    country: String(formData.get("country") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    initialRfq: {
      product,
      quantity: String(formData.get("quantity") || ""),
      preferredCountry: String(formData.get("preferredCountry") || ""),
      requiredCertifications: splitCsv(formData.get("requiredCertifications")),
      notes: String(formData.get("notes") || ""),
      status: "open",
    },
  };
}

async function initHomePage() {
  const [stats, featured] = await Promise.all([getPlatformStats(), getFeaturedExporters(3)]);
  document.querySelectorAll("[data-stat-exporters]").forEach((node) => {
    node.textContent = String(stats.approvedExporterCount);
  });
  document.querySelectorAll("[data-stat-rfqs]").forEach((node) => {
    node.textContent = String(stats.activeRfqCount);
  });
  document.querySelectorAll("[data-stat-countries]").forEach((node) => {
    node.textContent = String(stats.countryCount);
  });

  renderMarketPulseCards(document.querySelector("[data-hero-market-pulse]"), 3);
  renderMarketPulseCards(document.querySelector("[data-market-pulse-cards]"), 4);
  renderCountryDirectory(document.querySelector("[data-country-directory]"));
  renderList(
    document.querySelector("[data-featured-exporters]"),
    featured.map((entry) => renderExporterCard(entry)).join(""),
    "No approved exporters are live yet.",
  );

  document.querySelectorAll("[data-signup-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const note = form.querySelector(".form-note");
      clearStatus(note);

      if (appState.currentUser) {
        setStatus(note, "You are already logged in. Open your dashboard to continue.", "info");
        return;
      }

      try {
        const payload = buildHomeSignupPayload(new FormData(form), form.dataset.signupForm);
        const result = await signUpAccount(payload);
        appState.currentUser = result.user;
        syncAuthControls(appState.currentUser);
        setStatus(
          note,
          payload.role === "buyer" && result.initialRfq
            ? `Account created. ${result.initialRfq.matchCount} exporters matched your first RFQ.`
            : "Account created successfully. Redirecting to your dashboard.",
        );
        form.reset();
        populateCountrySelects();
        window.setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 900);
      } catch (error) {
        setStatus(note, error.message || "Unable to create account right now.", "error");
      }
    });
  });
}

async function initAuthPage() {
  if (appState.currentUser) {
    window.location.href = "dashboard.html";
    return;
  }

  renderMarketPulseCards(document.querySelector("[data-auth-market-pulse]"), 3);

  const url = new URL(window.location.href);
  const initialMode = url.searchParams.get("mode") === "signup" ? "signup" : "login";
  const loginForm = document.querySelector('[data-auth-form="login"]');
  const signupForm = document.querySelector('[data-auth-form="signup"]');
  const roleSelect = signupForm?.querySelector('[name="role"]');

  function setAuthMode(mode) {
    document.querySelectorAll("[data-auth-target]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.authTarget === mode);
    });
    loginForm?.classList.toggle("hidden", mode !== "login");
    signupForm?.classList.toggle("hidden", mode !== "signup");
  }

  function syncRolePanels() {
    const role = roleSelect?.value || "exporter";
    document.querySelectorAll("[data-signup-role-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.signupRolePanel !== role);
    });
    const exporterProduct = signupForm?.querySelector('[name="product"]');
    const buyerProduct = signupForm?.querySelector('[name="buyerProduct"]');
    const buyerQuantity = signupForm?.querySelector('[name="quantity"]');
    if (exporterProduct) exporterProduct.required = role === "exporter";
    if (buyerProduct) buyerProduct.required = role === "buyer";
    if (buyerQuantity) buyerQuantity.required = role === "buyer";
  }

  document.querySelectorAll("[data-auth-target]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authTarget));
  });
  document.querySelectorAll("[data-auth-switch]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authSwitch));
  });
  roleSelect?.addEventListener("change", syncRolePanels);
  setAuthMode(initialMode);
  syncRolePanels();

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = loginForm.querySelector(".form-note");
    clearStatus(note);

    try {
      appState.currentUser = await logInAccount({
        email: String(new FormData(loginForm).get("email") || ""),
        password: String(new FormData(loginForm).get("password") || ""),
      });
      syncAuthControls(appState.currentUser);
      setStatus(note, "Login successful. Redirecting to your dashboard.");
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);
    } catch (error) {
      setStatus(note, error.message || "Unable to login right now.", "error");
    }
  });

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = signupForm.querySelector(".form-note");
    clearStatus(note);

    try {
      const formData = new FormData(signupForm);
      const role = String(formData.get("role") || "exporter");
      const primaryProduct = role === "exporter" ? String(formData.get("product") || "") : String(formData.get("buyerProduct") || "");
      const payload = {
        role,
        name: String(formData.get("name") || ""),
        companyName: String(formData.get("companyName") || ""),
        product: primaryProduct,
        country: String(formData.get("country") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      };

      if (role === "exporter") {
        Object.assign(payload, {
          moq: String(formData.get("moq") || ""),
          certifications: splitCsv(formData.get("certifications")),
          website: String(formData.get("website") || ""),
          iec: String(formData.get("iec") || ""),
          gst: String(formData.get("gst") || ""),
          productDetails: String(formData.get("productDetails") || ""),
        });
      } else {
        payload.initialRfq = {
          product: primaryProduct,
          quantity: String(formData.get("quantity") || ""),
          preferredCountry: String(formData.get("preferredCountry") || ""),
          requiredCertifications: splitCsv(formData.get("requiredCertifications")),
          notes: String(formData.get("notes") || ""),
          status: "open",
        };
      }

      const result = await signUpAccount(payload);
      appState.currentUser = result.user;
      syncAuthControls(appState.currentUser);
      setStatus(note, "Account created successfully. Redirecting to your dashboard.");
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    } catch (error) {
      setStatus(note, error.message || "Unable to create account right now.", "error");
    }
  });
}

function bindNotificationRead(container, onRefresh) {
  if (!container || container.dataset.bound) return;
  container.dataset.bound = "true";
  container.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-notification-read]");
    if (!button) return;
    button.disabled = true;
    try {
      await markNotificationRead(button.dataset.notificationRead);
      await onRefresh();
    } catch (error) {
      button.disabled = false;
    }
  });
}

function createChatWorkspace(config) {
  const { user, threadsContainer, messagesContainer, titleNode, subtitleNode, form, triggerContainers = [], resolvePartnerMeta = () => null } = config;
  const chatState = { threads: [], activePartnerId: "", activeMeta: null };

  function renderThreads() {
    const list = [...chatState.threads];
    if (chatState.activePartnerId && !list.some((entry) => entry.partnerId === chatState.activePartnerId)) {
      list.unshift({
        partnerId: chatState.activePartnerId,
        partnerName: chatState.activeMeta?.partnerName || "Trade contact",
        partnerCompany: chatState.activeMeta?.partnerCompany || "Trade contact",
        partnerRole: chatState.activeMeta?.partnerRole || "member",
        lastMessageText: "No messages yet",
      });
    }
    renderList(
      threadsContainer,
      list.map((entry) => renderThreadCard(entry, chatState.activePartnerId)).join(""),
      "No conversations yet. Open a buyer or exporter profile to start messaging.",
    );
  }

  function renderMessages(messages) {
    renderList(
      messagesContainer,
      messages.map((entry) => renderChatMessage(entry, user.id)).join(""),
      "No messages yet. Send the first note to start the conversation.",
    );
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function openConversation(partnerId, meta = {}) {
    if (!partnerId) return;
    const fallback = resolvePartnerMeta(partnerId) || {};
    chatState.activePartnerId = partnerId;
    chatState.activeMeta = {
      partnerId,
      partnerName: meta.partnerName || fallback.partnerName || fallback.partnerCompany || "Trade contact",
      partnerCompany: meta.partnerCompany || fallback.partnerCompany || fallback.partnerName || "Trade contact",
      partnerRole: meta.partnerRole || fallback.partnerRole || "member",
      rfqId: meta.rfqId || fallback.rfqId || "",
    };
    titleNode.textContent = chatState.activeMeta.partnerCompany || chatState.activeMeta.partnerName;
    subtitleNode.textContent = `${humanize(chatState.activeMeta.partnerRole)} conversation`;
    form.receiverId.value = partnerId;
    form.rfqId.value = chatState.activeMeta.rfqId || "";
    renderMessages(await getConversationMessages(user.id, partnerId));
    renderThreads();
  }

  async function refreshThreads(preferredPartnerId = "") {
    chatState.threads = await getConversationThreads(user.id);
    renderThreads();
    if (preferredPartnerId) {
      await openConversation(preferredPartnerId, chatState.threads.find((entry) => entry.partnerId === preferredPartnerId) || resolvePartnerMeta(preferredPartnerId) || {});
      return;
    }
    if (chatState.activePartnerId) {
      await openConversation(chatState.activePartnerId, chatState.activeMeta || {});
      return;
    }
    if (chatState.threads[0]) {
      await openConversation(chatState.threads[0].partnerId, chatState.threads[0]);
      return;
    }
    renderMessages([]);
  }

  if (threadsContainer && !threadsContainer.dataset.bound) {
    threadsContainer.dataset.bound = "true";
    threadsContainer.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-thread-open]");
      if (!button) return;
      await openConversation(button.dataset.threadOpen, {
        partnerName: button.dataset.chatName,
        partnerCompany: button.dataset.chatCompany,
        partnerRole: button.dataset.chatRole,
      });
    });
  }

  triggerContainers.forEach((container) => {
    if (!container || container.dataset.chatBound) return;
    container.dataset.chatBound = "true";
    container.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-open-chat]");
      if (!button) return;
      await openConversation(button.dataset.openChat, {
        partnerName: button.dataset.chatName,
        partnerCompany: button.dataset.chatCompany,
        partnerRole: button.dataset.chatRole,
        rfqId: button.dataset.rfqId,
      });
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const receiverId = String(form.receiverId.value || "");
    const text = String(form.text.value || "").trim();
    if (!receiverId || !text) return;
    await sendMessage({ senderId: user.id, receiverId, text, rfqId: String(form.rfqId.value || "") });
    form.text.value = "";
    await refreshThreads(receiverId);
  });

  return { refreshThreads, openConversation };
}

async function initDashboardPage() {
  const user = await requireUser();
  if (!user) return;

  document.querySelector("[data-user-name]").textContent = user.name || "Trade Member";
  document.querySelector("[data-role-badge-slot]").innerHTML = renderBadge(user.role);

  const primaryAction = document.querySelector("[data-primary-action]");
  primaryAction.href = getPrimaryWorkspacePath(user);
  primaryAction.textContent = user.role === "exporter" ? "Open Exporter Workspace" : user.role === "buyer" ? "Open Buyer Workspace" : "Open Admin Panel";

  const notifications = isAdminUser(user) ? [] : await getNotificationsForUser(user.id);
  const notificationsContainer = document.querySelector("[data-dashboard-notifications]");
  const activityContainer = document.querySelector("[data-activity-list]");
  const profileContainer = document.querySelector("[data-profile-snapshot]");
  const summaryNode = document.querySelector("[data-dashboard-summary]");

  renderMarketPulseCards(document.querySelector("[data-dashboard-market-pulse]"), 4);
  bindNotificationRead(notificationsContainer, async () => {
    renderList(
      notificationsContainer,
      (await getNotificationsForUser(user.id)).map((entry) => renderNotificationCard(entry)).join(""),
      "No new platform alerts right now.",
    );
  });

  if (user.role === "exporter") {
    const [profile, rfqs] = await Promise.all([getExporterProfile(user.id), getExporterRfqs(user.id)]);
    const exporter = profile || { companyName: user.name || "Exporter account", product: "No product added yet", country: "N/A", badge: "New", status: "pending", trustScore: 0, responseRate: 0, updatedAt: new Date().toISOString() };
    summaryNode.textContent = "Track your G-Check badge, exporter readiness, inbound RFQ volume, and recent buyer activity.";
    document.querySelector("[data-status-badge-slot]").innerHTML = renderBadge(exporter.badge || exporter.status);
    renderStats(document.querySelector("[data-dashboard-stats]"), [
      { label: "Trust Score", value: exporter.trustScore || 0, meta: `Badge ${exporter.badge || "New"}` },
      { label: "Matched RFQs", value: rfqs.length, meta: "Qualified buyer demand routed to your profile" },
      { label: "Avg Match", value: computeAverageExporterMatchScore(rfqs, user.id), meta: "Average score across inbound RFQs" },
      { label: "Response Rate", value: `${safeNumber(exporter.responseRate, 0)}%`, meta: "A G-Check input" },
    ]);
    renderInfoRows(profileContainer, [
      { label: "Company", value: exporter.companyName },
      { label: "Primary Product", value: exporter.product || "Not added" },
      { label: "Country", value: exporter.country || "N/A" },
      { label: "Last Update", value: formatDate(exporter.updatedAt) },
    ]);
    renderList(
      activityContainer,
      rfqs.slice(0, 3).map((entry) => renderRfqCard(entry, { viewer: "exporter", currentUserId: user.id })).join(""),
      "No buyer RFQs have matched your exporter profile yet.",
    );
  } else if (user.role === "buyer") {
    const [profile, rfqs] = await Promise.all([getBuyerProfile(user.id), getBuyerRfqs(user.id)]);
    const buyer = profile || { companyName: user.name || "Buyer account", country: "N/A", updatedAt: new Date().toISOString() };
    const latestMatches = rfqs[0] ? await getEnrichedMatchesForRfq(rfqs[0]) : [];
    summaryNode.textContent = "Monitor sourcing requests, exporter matches, and the next conversations that matter.";
    document.querySelector("[data-status-badge-slot]").innerHTML = renderBadge("matched");
    renderStats(document.querySelector("[data-dashboard-stats]"), [
      { label: "Active RFQs", value: rfqs.length, meta: "All sourcing requests created from your workspace" },
      { label: "Matched Exporters", value: getMatchCountTotal(rfqs), meta: "Ranked across every RFQ" },
      { label: "Country Spread", value: getBuyerCountrySpread(latestMatches), meta: "Across your latest RFQ matches" },
      { label: "Latest Need", value: rfqs[0]?.product || "None yet", meta: "Create a new RFQ to refresh results" },
    ]);
    renderInfoRows(profileContainer, [
      { label: "Buyer Company", value: buyer.companyName },
      { label: "Country", value: buyer.country || "N/A" },
      { label: "Latest RFQ", value: rfqs[0]?.product || "No RFQ submitted yet" },
      { label: "Last Update", value: formatDate(buyer.updatedAt) },
    ]);
    renderList(
      activityContainer,
      rfqs.slice(0, 3).map((entry) => renderRfqCard(entry, { viewer: "buyer" })).join(""),
      "No RFQs sent yet. Open the buyer workspace to submit your first request.",
    );
  } else {
    const [exporters, rfqs] = await Promise.all([getAdminExporters(), getAllRfqs()]);
    const approved = exporters.filter((entry) => entry.status === "approved");
    const pending = exporters.filter((entry) => entry.status === "pending");
    const premium = exporters.filter((entry) => entry.badge === "Premium");
    summaryNode.textContent = "Use the admin panel to moderate exporter quality, trust score distribution, and RFQ visibility.";
    document.querySelector("[data-status-badge-slot]").innerHTML = renderBadge("admin");
    renderStats(document.querySelector("[data-dashboard-stats]"), [
      { label: "Exporters", value: exporters.length, meta: "Profiles across the marketplace" },
      { label: "Approved", value: approved.length, meta: "Visible in buyer search" },
      { label: "Pending", value: pending.length, meta: "Waiting for moderation" },
      { label: "Premium", value: premium.length, meta: "Highest trust band" },
    ]);
    renderInfoRows(profileContainer, [
      { label: "Admin Email", value: user.email || "Not available" },
      { label: "Approved Exporters", value: String(approved.length) },
      { label: "Pending Exporters", value: String(pending.length) },
      { label: "Active RFQs", value: String(rfqs.filter((entry) => entry.status !== "closed").length) },
    ]);
    renderList(
      activityContainer,
      exporters.slice(0, 3).map((entry) => renderExporterCard(entry)).join(""),
      "No exporter records are available yet.",
    );
  }

  renderList(
    notificationsContainer,
    notifications.map((entry) => renderNotificationCard(entry)).join(""),
    isAdminUser(user) ? "Admin users do not have role-specific notifications yet." : "No new platform alerts right now.",
  );
}

async function initExporterPage() {
  const user = await requireUser({ role: "exporter" });
  if (!user) return;

  const statsContainer = document.querySelector("[data-exporter-stats]");
  const metricsContainer = document.querySelector("[data-exporter-metrics]");
  const rfqContainer = document.querySelector("[data-exporter-rfqs]");
  const notificationsContainer = document.querySelector("[data-exporter-notifications]");
  const form = document.querySelector("[data-exporter-profile-form]");
  const note = form.querySelector(".form-note");

  let exporter = null;
  let rfqs = [];
  let notifications = [];

  const chat = createChatWorkspace({
    user,
    threadsContainer: document.querySelector("[data-chat-threads]"),
    messagesContainer: document.querySelector("[data-chat-messages]"),
    titleNode: document.querySelector("[data-chat-title]"),
    subtitleNode: document.querySelector("[data-chat-subtitle]"),
    form: document.querySelector("[data-chat-form]"),
    triggerContainers: [rfqContainer, notificationsContainer],
    resolvePartnerMeta(partnerId) {
      const rfq = rfqs.find((entry) => entry.buyerId === partnerId);
      return rfq
        ? {
            partnerName: rfq.buyerName || rfq.buyerCompany,
            partnerCompany: rfq.buyerCompany,
            partnerRole: "buyer",
            rfqId: rfq.id,
          }
        : null;
    },
  });

  async function refreshExporterPage() {
    [exporter, rfqs, notifications] = await Promise.all([
      getExporterProfile(user.id),
      getExporterRfqs(user.id),
      getNotificationsForUser(user.id),
    ]);

    const current = exporter || {
      companyName: user.name || "Exporter account",
      product: "",
      country: "",
      badge: "New",
      status: "pending",
      trustScore: 0,
      completedDeals: 0,
      responseRate: 0,
      certificationsText: "",
      moq: "",
      website: "",
      iec: "",
      gst: "",
      productDetails: "",
      updatedAt: new Date().toISOString(),
    };

    document.querySelector("[data-exporter-company]").textContent = current.companyName || user.name || "Exporter Profile";
    document.querySelector("[data-exporter-summary]").textContent =
      current.product && current.country
        ? `${current.product} from ${current.country}. Keep your profile complete to improve buyer confidence and match quality.`
        : "Complete your company and compliance details so buyers and admins can assess your export readiness.";
    document.querySelector("[data-exporter-status-slot]").innerHTML = renderBadge(current.status || "pending");
    document.querySelector("[data-exporter-badge-slot]").innerHTML = renderBadge(current.badge || "New");

    renderStats(statsContainer, [
      { label: "Trust Score", value: current.trustScore || 0, meta: `Badge ${current.badge || "New"}` },
      { label: "Matched RFQs", value: rfqs.length, meta: "Buyer requests aligned to your profile" },
      { label: "Avg Match", value: computeAverageExporterMatchScore(rfqs, user.id), meta: "Average score across inbound RFQs" },
      { label: "Response Rate", value: `${safeNumber(current.responseRate, 0)}%`, meta: "Impacts G-Check trust" },
    ]);

    renderInfoRows(metricsContainer, [
      { label: "Account Owner", value: user.name || "Trade member" },
      { label: "G-Check Badge", value: `${current.badge || "New"} (${current.trustScore || 0})` },
      { label: "Approval Status", value: humanize(current.status || "pending") },
      { label: "Completed Deals", value: String(current.completedDeals || 0) },
      { label: "IEC", value: current.iec || "Not added" },
      { label: "GST", value: current.gst || "Not added" },
      { label: "Website", value: current.website || "Not added" },
      { label: "Last Updated", value: formatDate(current.updatedAt) },
    ]);

    renderList(
      rfqContainer,
      rfqs.map((entry) => renderRfqCard(entry, { viewer: "exporter", currentUserId: user.id })).join(""),
      "No buyer RFQs are matched to your exporter profile yet.",
    );

    const notificationMeta = buildNotificationMetaDirectory(rfqs, "exporter");
    renderList(
      notificationsContainer,
      notifications.map((entry) => renderNotificationCard(entry, buildPartnerMetaFromNotification(entry, notificationMeta))).join(""),
      "No new exporter notifications right now.",
    );

    form.companyName.value = current.companyName || "";
    form.country.dataset.selectedValue = current.country || "";
    populateCountrySelects();
    form.country.value = current.country || "";
    form.product.value = current.product || "";
    form.moq.value = current.moq || "";
    form.certifications.value = current.certificationsText || "";
    form.website.value = current.website || "";
    form.iec.value = current.iec || "";
    form.gst.value = current.gst || "";
    form.completedDeals.value = String(current.completedDeals || 0);
    form.responseRate.value = String(current.responseRate || 0);
    form.productDetails.value = current.productDetails || "";

    await chat.refreshThreads();
  }

  bindNotificationRead(notificationsContainer, async () => {
    notifications = await getNotificationsForUser(user.id);
    const notificationMeta = buildNotificationMetaDirectory(rfqs, "exporter");
    renderList(
      notificationsContainer,
      notifications.map((entry) => renderNotificationCard(entry, buildPartnerMetaFromNotification(entry, notificationMeta))).join(""),
      "No new exporter notifications right now.",
    );
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus(note);
    try {
      const formData = new FormData(form);
      await saveExporterProfile(user.id, {
        companyName: String(formData.get("companyName") || ""),
        country: String(formData.get("country") || ""),
        product: String(formData.get("product") || ""),
        moq: String(formData.get("moq") || ""),
        certifications: splitCsv(formData.get("certifications")),
        website: String(formData.get("website") || ""),
        iec: String(formData.get("iec") || ""),
        gst: String(formData.get("gst") || ""),
        completedDeals: safeNumber(formData.get("completedDeals"), 0),
        responseRate: safeNumber(formData.get("responseRate"), 0),
        productDetails: String(formData.get("productDetails") || ""),
      });
      await refreshExporterPage();
      setStatus(note, "Exporter profile saved successfully.");
    } catch (error) {
      setStatus(note, error.message || "Unable to save your exporter profile.", "error");
    }
  });

  await refreshExporterPage();
}

async function initBuyerPage() {
  const user = await requireUser({ role: "buyer" });
  if (!user) return;

  const statsContainer = document.querySelector("[data-buyer-stats]");
  const searchResultsContainer = document.querySelector("[data-search-results]");
  const matchesContainer = document.querySelector("[data-rfq-matches]");
  const rfqHistoryContainer = document.querySelector("[data-buyer-rfqs]");
  const notificationsContainer = document.querySelector("[data-buyer-notifications]");
  const rfqForm = document.querySelector("[data-rfq-form]");
  const rfqNote = rfqForm.querySelector(".form-note");

  let buyer = null;
  let rfqs = [];
  let notifications = [];
  let searchResults = [];
  let latestMatches = [];

  const chat = createChatWorkspace({
    user,
    threadsContainer: document.querySelector("[data-chat-threads]"),
    messagesContainer: document.querySelector("[data-chat-messages]"),
    titleNode: document.querySelector("[data-chat-title]"),
    subtitleNode: document.querySelector("[data-chat-subtitle]"),
    form: document.querySelector("[data-chat-form]"),
    triggerContainers: [searchResultsContainer, matchesContainer, notificationsContainer],
    resolvePartnerMeta(partnerId) {
      const exporterMatch = [...searchResults, ...latestMatches].find((entry) => entry.id === partnerId);
      return exporterMatch
        ? { partnerName: exporterMatch.companyName, partnerCompany: exporterMatch.companyName, partnerRole: "exporter" }
        : null;
    },
  });

  async function renderSearch(criteria = {}) {
    searchResults = await searchExporters(criteria);
    renderList(
      searchResultsContainer,
      searchResults
        .map((entry) =>
          renderExporterCard(entry, {
            actions: [createChatButton(entry.id, { partnerName: entry.companyName, partnerCompany: entry.companyName, partnerRole: "exporter" }, "Message Exporter")],
          }),
        )
        .join(""),
      criteria.product || criteria.country ? "No approved exporters matched that search." : "No approved exporters are live yet.",
    );
  }

  async function refreshBuyerPage() {
    [buyer, rfqs, notifications] = await Promise.all([
      getBuyerProfile(user.id),
      getBuyerRfqs(user.id),
      getNotificationsForUser(user.id),
    ]);

    const current = buyer || { companyName: user.name || "Buyer account", country: "N/A", updatedAt: new Date().toISOString() };
    latestMatches = rfqs[0] ? await getEnrichedMatchesForRfq(rfqs[0]) : [];

    document.querySelector("[data-buyer-company]").textContent = current.companyName;
    document.querySelector("[data-buyer-summary]").textContent = `${current.companyName} can search approved exporters, submit RFQs, and talk directly with matched suppliers.`;
    document.querySelector("[data-buyer-role-slot]").innerHTML = renderBadge("buyer");
    document.querySelector("[data-buyer-country-slot]").innerHTML = renderBadge(current.country || "N/A");

    renderStats(statsContainer, [
      { label: "Active RFQs", value: rfqs.length, meta: "Structured buyer requests in the system" },
      { label: "Matched Exporters", value: getMatchCountTotal(rfqs), meta: "Across all RFQs" },
      { label: "Latest Match Count", value: latestMatches.length, meta: "For your most recent RFQ" },
      { label: "Country Spread", value: getBuyerCountrySpread(latestMatches), meta: "Unique exporter countries in current top matches" },
    ]);

    renderList(
      matchesContainer,
      latestMatches
        .map((entry) =>
          renderExporterCard(entry, {
            matchBreakdown: entry.matchBreakdown,
            actions: [
              createChatButton(
                entry.id,
                { partnerName: entry.companyName, partnerCompany: entry.companyName, partnerRole: "exporter", rfqId: rfqs[0]?.id || "" },
                "Message Exporter",
              ),
            ],
          }),
        )
        .join(""),
      "Submit an RFQ to see ranked exporter matches here.",
    );

    renderList(
      rfqHistoryContainer,
      rfqs.map((entry) => renderRfqCard(entry, { viewer: "buyer" })).join(""),
      "No RFQs submitted yet. Create your first sourcing request.",
    );

    const notificationMeta = buildNotificationMetaDirectory([...searchResults, ...latestMatches], "buyer");
    renderList(
      notificationsContainer,
      notifications.map((entry) => renderNotificationCard(entry, buildPartnerMetaFromNotification(entry, notificationMeta))).join(""),
      "No new buyer notifications right now.",
    );

    renderMarketPulseCards(document.querySelector("[data-buyer-market-pulse]"), 4);
    await chat.refreshThreads();
  }

  bindNotificationRead(notificationsContainer, async () => {
    notifications = await getNotificationsForUser(user.id);
    const notificationMeta = buildNotificationMetaDirectory([...searchResults, ...latestMatches], "buyer");
    renderList(
      notificationsContainer,
      notifications.map((entry) => renderNotificationCard(entry, buildPartnerMetaFromNotification(entry, notificationMeta))).join(""),
      "No new buyer notifications right now.",
    );
  });

  document.querySelector("[data-search-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await renderSearch({ product: String(formData.get("query") || ""), country: String(formData.get("country") || "") });
  });

  rfqForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus(rfqNote);
    try {
      const formData = new FormData(rfqForm);
      const rfq = await createRfq({
        buyerId: user.id,
        buyerName: user.name,
        buyerCompany: buyer?.companyName || user.name,
        buyerCountry: buyer?.country || "",
        product: String(formData.get("product") || ""),
        quantity: String(formData.get("quantity") || ""),
        preferredCountry: String(formData.get("preferredCountry") || ""),
        requiredCertifications: splitCsv(formData.get("requiredCertifications")),
        notes: String(formData.get("notes") || ""),
        status: "open",
      });
      setStatus(rfqNote, `RFQ submitted successfully. ${rfq.matchCount || 0} exporters matched.`);
      rfqForm.reset();
      populateCountrySelects();
      await refreshBuyerPage();
    } catch (error) {
      setStatus(rfqNote, error.message || "Unable to submit RFQ right now.", "error");
    }
  });

  await renderSearch({});
  await refreshBuyerPage();
}

async function initAdminPage() {
  const user = await requireUser({ adminOnly: true });
  if (!user) return;

  const statsContainer = document.querySelector("[data-admin-stats]");
  const exportersBody = document.querySelector("[data-admin-exporters]");
  const rfqsBody = document.querySelector("[data-admin-rfqs]");

  function renderAdminExporters(exporters) {
    exportersBody.innerHTML = exporters.length
      ? exporters
          .map(
            (entry) => `
              <tr>
                <td>
                  <strong>${escapeHtml(entry.companyName)}</strong>
                  <div class="table-subtext">${escapeHtml(entry.moq || "MOQ not shared")}</div>
                </td>
                <td>${escapeHtml(entry.product || "Not added")}</td>
                <td>${escapeHtml(entry.country || "N/A")}</td>
                <td>
                  <strong>${escapeHtml(entry.contactName || "Unknown")}</strong>
                  <div class="table-subtext">${escapeHtml(entry.email || "N/A")}</div>
                </td>
                <td>
                  <select name="status" data-admin-status="${escapeAttribute(entry.id)}">
                    ${["pending", "approved", "rejected"]
                      .map(
                        (status) =>
                          `<option value="${status}"${status === entry.status ? " selected" : ""}>${escapeHtml(humanize(status))}</option>`,
                      )
                      .join("")}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value="${escapeAttribute(String(entry.trustScore || 0))}"
                    data-admin-trust="${escapeAttribute(entry.id)}"
                  />
                </td>
                <td>${renderBadge(entry.badge || "New")}</td>
                <td>
                  <button class="btn btn-primary btn-small" type="button" data-admin-save="${escapeAttribute(entry.id)}">
                    Save
                  </button>
                </td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="8">${renderEmptyState("No exporter applications found.")}</td></tr>`;
  }

  function renderAdminRfqs(rfqs) {
    rfqsBody.innerHTML = rfqs.length
      ? rfqs
          .map(
            (entry) => `
              <tr>
                <td>
                  <strong>${escapeHtml(entry.buyerCompany || "Buyer")}</strong>
                  <div class="table-subtext">${escapeHtml(entry.buyerCountry || "N/A")}</div>
                </td>
                <td>${escapeHtml(entry.product || "Untitled RFQ")}</td>
                <td>${escapeHtml(entry.quantity || "Not specified")}</td>
                <td>${escapeHtml(entry.preferredCountry || "Any")}</td>
                <td>${renderBadge(entry.status || "open")}</td>
                <td>${escapeHtml(String(entry.matchCount || 0))}</td>
                <td>${escapeHtml(formatDate(entry.createdAt))}</td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="7">${renderEmptyState("No RFQs are available yet.")}</td></tr>`;
  }

  async function refreshAdminData() {
    [adminExporterCache, adminRfqCache] = await Promise.all([getAdminExporters(), getAllRfqs()]);
    const approved = adminExporterCache.filter((entry) => entry.status === "approved");
    const pending = adminExporterCache.filter((entry) => entry.status === "pending");
    const premium = adminExporterCache.filter((entry) => entry.badge === "Premium");

    renderStats(statsContainer, [
      { label: "Exporters", value: adminExporterCache.length, meta: "All supplier applications in the platform" },
      { label: "Approved", value: approved.length, meta: "Visible in buyer search results" },
      { label: "Pending", value: pending.length, meta: "Waiting for moderation decision" },
      { label: "Premium", value: premium.length, meta: "Highest trust segment" },
    ]);

    renderAdminExporters(adminExporterCache);
    renderAdminRfqs(adminRfqCache);
  }

  document.querySelector("[data-admin-filter-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = normalizeText(String(new FormData(event.currentTarget).get("query") || ""));
    if (!query) {
      renderAdminExporters(adminExporterCache);
      return;
    }

    renderAdminExporters(
      adminExporterCache.filter((entry) =>
        [entry.companyName, entry.product, entry.country, entry.email, entry.contactName]
          .map((value) => normalizeText(value))
          .some((value) => value.includes(query)),
      ),
    );
  });

  exportersBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-admin-save]");
    if (!button) return;

    const exporterId = button.dataset.adminSave;
    const statusInput = document.querySelector(`[data-admin-status="${CSS.escape(exporterId)}"]`);
    const trustInput = document.querySelector(`[data-admin-trust="${CSS.escape(exporterId)}"]`);

    button.disabled = true;
    button.textContent = "Saving...";

    try {
      await updateExporterStatus(exporterId, {
        status: statusInput.value,
        trustScore: safeNumber(trustInput.value, 0),
      });
      await refreshAdminData();
    } finally {
      button.disabled = false;
      button.textContent = "Save";
    }
  });

  await refreshAdminData();
}
