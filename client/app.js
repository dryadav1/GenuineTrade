const API_BASE = "/api";
const TOKEN_KEY = "genuinetrade_token";

const appState = {
  user: null,
  plans: [],
};

function getPage() {
  return document.body.dataset.page || "";
}

function getToken() {
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function humanize(value = "") {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getInitials(name = "GT") {
  const segments = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!segments.length) {
    return "GT";
  }

  return segments.map((entry) => entry.charAt(0).toUpperCase()).join("");
}

async function apiFetch(path, options = {}, requiresAuth = false) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAuth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || "Request failed.";
    throw new Error(message);
  }

  return payload;
}

function showToast(message, tone = "success") {
  const toast = document.querySelector("[data-toast]");
  if (!toast) return;

  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.hidden = false;

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function setFeedback(node, message, tone = "success") {
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || "";
  node.dataset.tone = tone;
}

function initHeaderScroll() {
  const header = document.querySelector("[data-site-header]");
  if (!header) return;

  const sync = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  sync();
  window.addEventListener("scroll", sync, { passive: true });
}

function initProfileMenu() {
  const menu = document.querySelector("[data-profile-menu]");
  const trigger = document.querySelector("[data-profile-trigger]");

  if (!menu || !trigger) return;

  trigger.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (menu.contains(event.target)) return;
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });
}

function applyAuthUI() {
  const user = appState.user;

  document.querySelectorAll("[data-guest-only]").forEach((node) => {
    node.hidden = Boolean(user);
  });

  document.querySelectorAll("[data-auth-only]").forEach((node) => {
    node.hidden = !user;
  });

  document.querySelectorAll("[data-profile-initials]").forEach((node) => {
    node.textContent = getInitials(user?.name || "GT");
  });

  document.querySelectorAll("[data-dashboard-link]").forEach((node) => {
    node.setAttribute("href", user?.role === "admin" ? "admin.html" : "dashboard.html");
  });

  const profileMenu = document.querySelector("[data-profile-menu]");
  if (profileMenu) {
    profileMenu.hidden = !user;
  }
}

async function hydrateSession() {
  const token = getToken();
  if (!token) return;

  try {
    const payload = await apiFetch("/auth/me", {}, true);
    appState.user = payload.user;
  } catch (error) {
    appState.user = null;
    setToken("");
  }
}

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  return redirect || (appState.user?.role === "admin" ? "admin.html" : "dashboard.html");
}

function bindLogout() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => {
      setToken("");
      appState.user = null;
      window.location.href = "index.html";
    });
  });
}

async function handleLogin(form) {
  const feedback = document.querySelector("[data-login-feedback]");
  const formData = new FormData(form);

  try {
    setFeedback(feedback, "Signing in...", "info");
    const payload = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    setToken(payload.token);
    appState.user = payload.user;
    applyAuthUI();
    window.location.href = getRedirectTarget();
  } catch (error) {
    setFeedback(feedback, error.message, "error");
  }
}

async function handleSignup(form) {
  const feedback = document.querySelector("[data-signup-feedback]");
  const formData = new FormData(form);

  try {
    setFeedback(feedback, "Creating account...", "info");
    const payload = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    setToken(payload.token);
    appState.user = payload.user;
    applyAuthUI();
    showToast("Account created successfully.");
    window.location.href = "dashboard.html";
  } catch (error) {
    setFeedback(feedback, error.message, "error");
  }
}

function initLoginPage() {
  const loginForm = document.querySelector("[data-login-form]");
  const signupForm = document.querySelector("[data-signup-form]");

  document.querySelectorAll("[data-auth-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.authTarget;
      document.querySelectorAll("[data-auth-target]").forEach((node) => {
        node.classList.toggle("is-active", node === button);
      });
      loginForm?.classList.toggle("hidden", target !== "login");
      signupForm?.classList.toggle("hidden", target !== "signup");
    });
  });

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleLogin(loginForm);
  });

  signupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSignup(signupForm);
  });
}

function renderPricing() {
  const container = document.querySelector("[data-plan-grid]");
  if (!container) return;

  container.innerHTML = appState.plans
    .map(
      (plan) => `
        <article class="pricing-card ${plan.isPopular ? "is-popular" : ""}">
          ${plan.isPopular ? '<span class="pricing-badge">Most Popular</span>' : ""}
          <div class="pricing-head">
            <h3>${escapeHtml(plan.name)}</h3>
            <div>
              <strong>${escapeHtml(formatMoney(plan.price))}</strong>
              <span>/${escapeHtml(plan.duration)}</span>
            </div>
          </div>
          <ul class="pricing-list">
            ${(plan.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
          </ul>
          <button class="btn ${plan.isPopular ? "btn-primary" : "btn-secondary"}" type="button" data-subscribe-plan="${escapeHtml(plan.id)}">
            Subscribe
          </button>
        </article>
      `,
    )
    .join("");

  container.querySelectorAll("[data-subscribe-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      startSubscription(button.dataset.subscribePlan);
    });
  });
}

async function startSubscription(planId) {
  const feedback = document.querySelector("[data-plan-feedback]");

  if (!appState.user) {
    window.location.href = "login.html?redirect=dashboard.html";
    return;
  }

  try {
    setFeedback(feedback, "Preparing secure checkout...", "info");
    const payload = await apiFetch(
      "/create-order",
      {
        method: "POST",
        body: JSON.stringify({ planId }),
      },
      true,
    );

    if (!window.Razorpay) {
      throw new Error("Razorpay checkout script is unavailable.");
    }

    const checkout = new window.Razorpay({
      key: payload.keyId,
      amount: payload.order.amount,
      currency: payload.order.currency,
      name: "GenuineTrade",
      description: `${payload.plan.name} subscription`,
      order_id: payload.order.id,
      prefill: {
        name: appState.user.name,
        email: appState.user.email,
      },
      theme: {
        color: "#246bff",
      },
      handler: async (response) => {
        try {
          await apiFetch(
            "/verify-payment",
            {
              method: "POST",
              body: JSON.stringify({
                planId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            },
            true,
          );

          showToast("Subscription activated successfully.");
          window.location.href = "dashboard.html";
        } catch (error) {
          setFeedback(feedback, error.message, "error");
        }
      },
    });

    checkout.open();
    setFeedback(feedback, "", "success");
  } catch (error) {
    setFeedback(feedback, error.message, "error");
  }
}

async function initHomePage() {
  const [stats, plans] = await Promise.all([
    apiFetch("/platform/stats").catch(() => ({ exporterCount: 0, rfqCount: 0, paidCount: 0 })),
    apiFetch("/plans").catch(() => []),
  ]);

  appState.plans = plans;
  document.querySelector("[data-stat-exporters]").textContent = String(stats.exporterCount || 0);
  document.querySelector("[data-stat-rfqs]").textContent = String(stats.rfqCount || 0);
  document.querySelector("[data-stat-paid]").textContent = String(stats.paidCount || 0);
  renderPricing();

  const exporterForm = document.querySelector("[data-exporter-form]");
  const rfqForm = document.querySelector("[data-rfq-form]");

  exporterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = document.querySelector("[data-exporter-feedback]");
    const formData = new FormData(exporterForm);

    try {
      setFeedback(feedback, "Submitting exporter request...", "info");
      const payload = await apiFetch("/exporter", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          companyName: formData.get("companyName"),
          product: formData.get("product"),
          country: formData.get("country"),
          contact: formData.get("contact"),
        }),
      });

      exporterForm.reset();
      setFeedback(feedback, payload.message, "success");
      showToast("Exporter submission received.");
    } catch (error) {
      setFeedback(feedback, error.message, "error");
    }
  });

  rfqForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = document.querySelector("[data-rfq-feedback]");
    const formData = new FormData(rfqForm);

    try {
      setFeedback(feedback, "Submitting RFQ...", "info");
      const payload = await apiFetch("/rfq", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          product: formData.get("product"),
          quantity: formData.get("quantity"),
          country: formData.get("country"),
          contact: formData.get("contact"),
        }),
      });

      rfqForm.reset();
      setFeedback(feedback, payload.message, "success");
      showToast("RFQ submitted successfully.");
    } catch (error) {
      setFeedback(feedback, error.message, "error");
    }
  });
}

async function initDashboardPage() {
  if (!appState.user) {
    window.location.href = "login.html?redirect=dashboard.html";
    return;
  }

  document.querySelector("[data-dashboard-name]").textContent = appState.user.name || "Trade user";
  document.querySelector("[data-dashboard-email]").textContent = appState.user.email || "";
  document.querySelector("[data-dashboard-role]").textContent = humanize(appState.user.role || "user");
  document.querySelector("[data-admin-shortcut]")?.classList.toggle("hidden", appState.user.role !== "admin");

  document.querySelector("[data-plan-name]").textContent = appState.user.currentPlan?.name || "No active plan";
  document.querySelector("[data-plan-status]").textContent = appState.user.currentPlan ? "Active" : "Inactive";
  document.querySelector("[data-plan-expiry]").textContent = formatDate(appState.user.planExpiry);

  if (appState.user.currentPlan) {
    document.querySelector("[data-plan-copy]").textContent = `${appState.user.currentPlan.name} is active on your account.`;
  }

  try {
    const payments = await apiFetch("/payments/me", {}, true);
    document.querySelector("[data-payment-count]").textContent = String(payments.length);
    document.querySelector("[data-payment-table]").innerHTML = payments.length
      ? payments
          .map(
            (payment) => `
              <tr>
                <td>${escapeHtml(payment.plan?.name || "Plan")}</td>
                <td>${escapeHtml(formatMoney(payment.amount))}</td>
                <td><span class="status-pill">${escapeHtml(humanize(payment.status))}</span></td>
                <td>${escapeHtml(payment.orderId)}</td>
                <td>${escapeHtml(formatDate(payment.createdAt))}</td>
              </tr>
            `,
          )
          .join("")
      : '<tr><td colspan="5">No payments yet.</td></tr>';
  } catch (error) {
    document.querySelector("[data-payment-table]").innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderAdminPlans(plans) {
  const table = document.querySelector("[data-admin-plans]");
  if (!table) return;

  table.innerHTML = plans.length
    ? plans
        .map(
          (plan) => `
            <tr>
              <td>${escapeHtml(plan.name)}</td>
              <td>${escapeHtml(formatMoney(plan.price))}</td>
              <td>${escapeHtml(humanize(plan.duration))}</td>
              <td>${plan.isPopular ? "Yes" : "No"}</td>
              <td>
                <div class="table-actions">
                  <button class="table-link" type="button" data-edit-plan="${escapeHtml(plan.id)}">Edit</button>
                  <button class="table-link danger" type="button" data-delete-plan="${escapeHtml(plan.id)}">Delete</button>
                </div>
              </td>
            </tr>
          `,
        )
        .join("")
    : '<tr><td colspan="5">No plans available.</td></tr>';
}

function renderAdminRows(selector, rows, columns) {
  const table = document.querySelector(selector);
  if (!table) return;

  table.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              ${columns.map((column) => `<td>${escapeHtml(column(row))}</td>`).join("")}
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="${columns.length}">No records found.</td></tr>`;
}

async function loadAdminData() {
  const [plans, exporters, users, rfqs, payments] = await Promise.all([
    apiFetch("/plans"),
    apiFetch("/admin/exporters", {}, true),
    apiFetch("/admin/users", {}, true),
    apiFetch("/admin/rfqs", {}, true),
    apiFetch("/admin/payments", {}, true),
  ]);

  appState.plans = plans;
  renderAdminPlans(plans);
  renderAdminRows("[data-admin-exporters]", exporters, [
    (row) => row.name,
    (row) => row.companyName,
    (row) => row.product,
    (row) => row.country,
    (row) => row.contact,
  ]);
  renderAdminRows("[data-admin-users]", users, [
    (row) => row.name,
    (row) => row.email,
    (row) => humanize(row.role),
    (row) => row.currentPlan?.name || "No plan",
    (row) => formatDate(row.planExpiry),
  ]);
  renderAdminRows("[data-admin-rfqs]", rfqs, [
    (row) => row.name,
    (row) => row.product,
    (row) => row.quantity,
    (row) => row.country,
    (row) => row.contact,
  ]);
  renderAdminRows("[data-admin-payments]", payments, [
    (row) => row.plan?.name || "Plan",
    (row) => formatMoney(row.amount),
    (row) => humanize(row.status),
    (row) => row.orderId,
    (row) => row.paymentId || "Pending",
  ]);
}

function fillPlanForm(planId) {
  const form = document.querySelector("[data-plan-form]");
  const plan = appState.plans.find((entry) => entry.id === planId);
  if (!form || !plan) return;

  form.elements.namedItem("planId").value = plan.id;
  form.elements.namedItem("name").value = plan.name;
  form.elements.namedItem("price").value = plan.price;
  form.elements.namedItem("duration").value = plan.duration;
  form.elements.namedItem("features").value = (plan.features || []).join("\n");
  form.elements.namedItem("isPopular").checked = Boolean(plan.isPopular);
}

function resetPlanForm() {
  const form = document.querySelector("[data-plan-form]");
  if (!form) return;
  form.reset();
  form.elements.namedItem("planId").value = "";
}

async function initAdminPage() {
  if (!appState.user) {
    window.location.href = "login.html?redirect=admin.html";
    return;
  }

  if (appState.user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.querySelector("[data-plan-form]");
  const feedback = document.querySelector("[data-plan-form-feedback]");
  const planTable = document.querySelector("[data-admin-plans]");

  await loadAdminData();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const planId = String(formData.get("planId") || "");
    const body = {
      name: formData.get("name"),
      price: Number(formData.get("price") || 0),
      duration: formData.get("duration"),
      features: String(formData.get("features") || ""),
      isPopular: formData.get("isPopular") === "on",
    };

    try {
      setFeedback(feedback, "Saving plan...", "info");
      if (planId) {
        await apiFetch(
          `/plans/${planId}`,
          {
            method: "PUT",
            body: JSON.stringify(body),
          },
          true,
        );
      } else {
        await apiFetch(
          "/plans",
          {
            method: "POST",
            body: JSON.stringify(body),
          },
          true,
        );
      }

      resetPlanForm();
      setFeedback(feedback, "Plan saved.", "success");
      await loadAdminData();
    } catch (error) {
      setFeedback(feedback, error.message, "error");
    }
  });

  document.querySelector("[data-plan-reset]")?.addEventListener("click", () => {
    resetPlanForm();
    setFeedback(feedback, "", "success");
  });

  planTable?.addEventListener("click", async (event) => {
    const editId = event.target.closest("[data-edit-plan]")?.dataset.editPlan;
    const deleteId = event.target.closest("[data-delete-plan]")?.dataset.deletePlan;

    if (editId) {
      fillPlanForm(editId);
      return;
    }

    if (deleteId) {
      try {
        await apiFetch(
          `/plans/${deleteId}`,
          {
            method: "DELETE",
          },
          true,
        );
        showToast("Plan deleted.");
        await loadAdminData();
      } catch (error) {
        showToast(error.message, "error");
      }
    }
  });
}

async function initApp() {
  initHeaderScroll();
  initProfileMenu();
  bindLogout();
  await hydrateSession();
  applyAuthUI();

  const page = getPage();
  if (page === "home") {
    await initHomePage();
    return;
  }

  if (page === "login") {
    initLoginPage();
    return;
  }

  if (page === "dashboard") {
    await initDashboardPage();
    return;
  }

  if (page === "admin") {
    await initAdminPage();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initApp().catch((error) => {
    showToast(error.message || "Something went wrong.", "error");
  });
});
