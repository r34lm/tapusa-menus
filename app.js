import { isSupabaseConfigured } from "./src/lib/supabase.js";
import {
  getCurrentSession,
  requestPasswordReset,
  signIn,
  signOut,
  updatePassword,
} from "./src/services/auth.js";
import {
  getPublicMenu,
  listAdminRestaurants,
  loadOwnerWorkspace,
  setPublished,
  updateRestaurant as updateRestaurantRecord,
} from "./src/services/restaurants.js";
import {
  createCategory,
  createMenuItem,
  deleteCategory as deleteCategoryRecord,
  deleteMenuItem,
  reorderCategories,
  reorderMenuItems,
  setItemAvailability,
  updateCategory,
  updateMenuItem,
} from "./src/services/menu.js";
import { uploadRestaurantImage } from "./src/services/storage.js";
import {
  createRestaurantAccount,
  deleteRestaurantAccount,
  resetOwnerPassword,
  setRestaurantAccountStatus,
  updateRestaurantAccount,
} from "./src/services/admin.js";
import { slugify } from "./src/utils/slug.js";

const icons = {
  dashboard: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  menu: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  store: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 10h18M5 10v10h14V10M4 4h16l1 6H3l1-6Z"/><path d="M9 20v-6h6v6"/></svg>',
  eye: '<svg class="icon" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l3.5-.7L19 7.8a2 2 0 0 0-2.8-2.8L4.7 16.5 4 20Z"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>',
  more: '<svg class="icon" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  settings: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
  logout: '<svg class="icon" viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2M16 4.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 5.7V21"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  upload: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4"/></svg>',
  grip: '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/></svg>',
  up: '<svg class="icon" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg class="icon" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  close: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  link: '<svg class="icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  lock: '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  mail: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
};

const seed = {
  session: { loggedIn: false, role: "owner" },
  ownerName: "Maya Chen",
  restaurant: {
    id: "r1",
    name: "Ember & Oak",
    slug: "ember-and-oak",
    description: "Seasonal comfort food, wood-fired favorites, and thoughtful cocktails made with locally sourced ingredients.",
    phone: "(512) 555-0148",
    email: "hello@emberandoak.com",
    address: "214 West Monroe St, Austin, TX",
    logo: "",
    banner: "",
    published: true,
  },
  categories: [
    {
      id: "c1",
      name: "Small Plates",
      items: [
        { id: "i1", name: "Whipped Feta", description: "Charred grapes, pistachio, warm flatbread", price: 12, available: true, image: "", emoji: "🫓" },
        { id: "i2", name: "Crispy Calamari", description: "Calabrian chili, lemon aioli, parsley", price: 16, available: true, image: "", emoji: "🍋" },
        { id: "i3", name: "Roasted Beet Salad", description: "Goat cheese, citrus, toasted hazelnuts", price: 14, available: false, image: "", emoji: "🥗" },
      ],
    },
    {
      id: "c2",
      name: "From the Fire",
      items: [
        { id: "i4", name: "Oak-Grilled Chicken", description: "Herb jus, crispy potatoes, market greens", price: 26, available: true, image: "", emoji: "🍗" },
        { id: "i5", name: "Ember Burger", description: "Dry-aged beef, smoked cheddar, house pickles", price: 19, available: true, image: "", emoji: "🍔" },
        { id: "i6", name: "Cedar Plank Salmon", description: "Brown butter, wild rice, grilled lemon", price: 29, available: true, image: "", emoji: "🐟" },
      ],
    },
    {
      id: "c3",
      name: "Dessert",
      items: [
        { id: "i7", name: "Dark Chocolate Tart", description: "Sea salt, olive oil, vanilla cream", price: 11, available: true, image: "", emoji: "🍫" },
      ],
    },
  ],
  restaurants: [
    { id: "r1", name: "Ember & Oak", slug: "ember-and-oak", owner: "Maya Chen", email: "maya@emberandoak.com", status: "active", items: 7, joined: "Jul 18, 2026" },
    { id: "r2", name: "Casa Verde", slug: "casa-verde", owner: "Luis Rivera", email: "luis@casaverde.com", status: "active", items: 32, joined: "Jul 12, 2026" },
    { id: "r3", name: "North & Main", slug: "north-and-main", owner: "Ava Patel", email: "ava@northandmain.com", status: "active", items: 24, joined: "Jul 8, 2026" },
    { id: "r4", name: "Sora Ramen", slug: "sora-ramen", owner: "Ken Ito", email: "ken@soraramen.com", status: "disabled", items: 18, joined: "Jun 29, 2026" },
    { id: "r5", name: "The Daily Grind", slug: "the-daily-grind", owner: "Sam Brooks", email: "sam@dailygrind.com", status: "active", items: 15, joined: "Jun 21, 2026" },
  ],
};

let state = loadState();
let modal = null;
let searchTerm = "";
let currentUserId = null;

function loadState() {
  if (isSupabaseConfigured) return structuredClone(seed);
  try {
    const saved = JSON.parse(localStorage.getItem("tapmenu-prototype"));
    return saved ? { ...structuredClone(seed), ...saved } : structuredClone(seed);
  } catch {
    return JSON.parse(JSON.stringify(seed));
  }
}

function saveState() {
  if (isSupabaseConfigured) return;
  localStorage.setItem("tapmenu-prototype", JSON.stringify(state));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.querySelector("#toast-region").append(node);
  setTimeout(() => node.remove(), 2800);
}

function route() {
  if (applicationPath() === "set-password") return "set-password";
  if (publicPathSlug()) return "public";
  return location.hash.slice(1) || (state.session.loggedIn ? (state.session.role === "admin" ? "admin" : "dashboard") : "login");
}

function applicationPath() {
  const segment = location.pathname.replace(/^\/+|\/+$/g, "");
  if (!segment || segment.includes(".") || segment === "index.html") return "";
  return segment;
}

function publicPathSlug() {
  const segment = applicationPath();
  if (segment === "set-password") return "";
  return segment;
}

function navigate(path) {
  location.hash = path;
}

function render() {
  const current = route();
  document.body.dataset.view = current;
  if (current === "set-password") return renderSetPassword();
  if (current === "public") return renderPublic();
  if (!state.session.loggedIn || current === "login") return renderLogin();
  renderApp(current);
}

function brand() {
  return '<a class="brand" href="#dashboard" aria-label="TapUSA Menus"><img class="brand-logo" src="/assets/tapusa-logo.svg" alt="TapUSA"><span class="brand-product">Menus</span></a>';
}

function renderLogin() {
  const role = state.session.role;
  document.querySelector("#app").innerHTML = `
    <main class="login-page">
      <section class="login-visual">
        ${brand()}
        <div class="login-quote">
          <div class="eyebrow">Menus made effortless</div>
          <h1>Your menu.<br><span>Beautifully simple.</span></h1>
          <p>Create, update, and publish a premium digital menu in minutes. No design skills required.</p>
        </div>
        <p style="color:var(--muted-2);font-size:11px;position:relative;z-index:1">A TapUSA product · menus.tapusa.online</p>
      </section>
      <section class="login-form-wrap">
        <form class="login-form" id="login-form">
          <div class="eyebrow">${role === "admin" ? "TapUSA administration" : "Restaurant portal"}</div>
          <h2>Welcome back</h2>
          <p>Sign in to manage ${role === "admin" ? "your restaurant network" : "your digital menu"}.</p>
          <div class="form-group">
            <label for="email">Email address</label>
            <input class="field" id="email" name="email" type="email" value="${isSupabaseConfigured ? "" : role === "admin" ? "admin@tapusa.com" : "owner@emberandoak.com"}" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input class="field" id="password" name="password" type="password" value="${isSupabaseConfigured ? "" : "prototype"}" autocomplete="current-password" required>
          </div>
          <div class="login-meta"><label><input type="checkbox" checked> Remember me</label><a href="#" data-action="reset-password">Forgot password?</a></div>
          <button class="btn primary" type="submit">${icons.lock} Sign in securely</button>
          <div class="demo-switch">
            ${isSupabaseConfigured ? "Portal view" : "Frontend demo"} · Switch to
            <button type="button" data-role="${role === "admin" ? "owner" : "admin"}">${role === "admin" ? "Restaurant Owner" : "Super Admin"}</button>
          </div>
        </form>
      </section>
    </main>`;
  bindCommon();
}

function renderSetPassword() {
  document.querySelector("#app").innerHTML = `
    <main class="login-page">
      <section class="login-visual">
        ${brand()}
        <div class="login-quote">
          <div class="eyebrow">Secure account setup</div>
          <h1>Create your<br><span>private password.</span></h1>
          <p>Choose a password for your TapUSA Menus account. TapUSA staff will never be able to view it.</p>
        </div>
        <p style="color:var(--muted-2);font-size:11px;position:relative;z-index:1">Protected by Supabase Auth</p>
      </section>
      <section class="login-form-wrap">
        <form class="login-form" id="set-password-form">
          <div class="eyebrow">Finish account setup</div>
          <h2>Choose a password</h2>
          <p>Use at least 10 characters. A passphrase is easiest to remember.</p>
          <div class="form-group">
            <label for="new-password">New password</label>
            <input class="field" id="new-password" name="password" type="password" minlength="10" autocomplete="new-password" required>
          </div>
          <div class="form-group">
            <label for="confirm-password">Confirm password</label>
            <input class="field" id="confirm-password" name="confirmation" type="password" minlength="10" autocomplete="new-password" required>
          </div>
          <button class="btn primary" type="submit">${icons.lock} Save password</button>
          <div class="demo-switch">Invite link expired? <a href="/#login" style="color:var(--accent)">Return to login</a> and request a new email.</div>
        </form>
      </section>
    </main>`;
  bindCommon();
}

function navItem(path, icon, label, badge = "") {
  return `<a class="nav-item ${route() === path ? "active" : ""}" href="#${path}">${icons[icon]}<span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}</a>`;
}

function sidebar() {
  const admin = state.session.role === "admin";
  return `
    <aside class="sidebar" id="sidebar">
      ${brand()}
      <div class="nav-label">${admin ? "Administration" : "Workspace"}</div>
      <nav class="nav-list">
        ${admin
          ? `${navItem("admin", "dashboard", "Overview")}${navItem("restaurants", "users", "Restaurants", state.restaurants.length)}`
          : `${navItem("dashboard", "dashboard", "Overview")}${navItem("menu", "menu", "Menu manager", state.categories.reduce((n, c) => n + c.items.length, 0))}${navItem("restaurant", "store", "Restaurant")}${navItem("public", "eye", "View live menu")}`}
      </nav>
      <div class="sidebar-bottom">
        ${admin ? "" : '<div class="support-card"><strong>Need a hand?</strong><span>TapUSA support is here to help with your menu.</span></div>'}
        <div class="profile">
          <div class="avatar">${admin ? '<img src="/assets/tapusa-mark.svg" alt="TapUSA">' : escapeHtml((state.ownerName || "Owner").split(" ").map((part) => part[0]).join("").slice(0, 2))}</div>
          <div class="profile-copy"><strong>${admin ? "TapUSA Admin" : escapeHtml(state.ownerName || "Restaurant Owner")}</strong><span>${admin ? "Super administrator" : state.restaurant.name}</span></div>
          <button class="btn ghost icon-only" data-action="logout" aria-label="Log out">${icons.logout}</button>
        </div>
      </div>
    </aside>`;
}

function topbar(title, primary = "") {
  return `
    <header class="topbar">
      <div class="inline-actions">
        <button class="btn ghost icon-only mobile-menu" data-action="mobile-menu" aria-label="Open menu">${icons.menu}</button>
        <span class="topbar-title">${escapeHtml(title)}</span>
      </div>
      <div class="topbar-actions">
        ${state.session.role === "owner" ? `<a class="btn" href="#public">${icons.eye} Preview</a><button class="btn primary" data-action="publish">${state.restaurant.published ? "Published" : "Publish menu"}</button>` : primary}
      </div>
    </header>`;
}

function renderApp(current) {
  let content;
  if (state.session.role === "admin") {
    content = current === "restaurants" ? adminRestaurants() : adminDashboard();
  } else if (current === "menu") {
    content = menuManager();
  } else if (current === "restaurant") {
    content = restaurantSettings();
  } else {
    content = ownerDashboard();
  }
  document.querySelector("#app").innerHTML = `<div class="app-shell">${sidebar()}<main class="main">${topbar(pageTitle(current))}${content}</main></div>${modal ? modalMarkup() : ""}`;
  bindCommon();
}

function pageTitle(current) {
  return ({ dashboard: "Overview", menu: "Menu manager", restaurant: "Restaurant settings", admin: "Admin overview", restaurants: "Restaurants" })[current] || "TapUSA Menus";
}

function ownerDashboard() {
  const itemCount = state.categories.reduce((n, category) => n + category.items.length, 0);
  const available = state.categories.reduce((n, category) => n + category.items.filter((item) => item.available).length, 0);
  const emptyCategories = state.categories.filter((category) => category.items.length === 0).length;
  const firstName = (state.ownerName || "there").split(" ")[0];
  const detailsComplete = Boolean(state.restaurant.name && state.restaurant.email && state.restaurant.address);
  const hasMenu = itemCount > 0;
  const hasBrand = Boolean(state.restaurant.logo || state.restaurant.banner);
  const setupSteps = [detailsComplete, hasMenu, hasBrand, state.restaurant.published];
  const completedSteps = setupSteps.filter(Boolean).length;
  const completion = Math.round((completedSteps / setupSteps.length) * 100);
  return `<div class="content">
    <div class="page-header">
      <div><div class="eyebrow">Restaurant overview</div><h1>Good afternoon, ${escapeHtml(firstName)}.</h1><p>Everything you need to keep ${escapeHtml(state.restaurant.name)} up to date.</p></div>
      <div class="page-actions"><button class="btn primary" data-modal="item">${icons.plus} Add menu item</button></div>
    </div>
    <div class="grid stats-grid">
      ${stat("menu", itemCount, "Menu items", `${available} available`)}
      ${stat("dashboard", state.categories.length, "Categories", emptyCategories ? `${emptyCategories} empty` : "All have items")}
      ${stat("check", available, "Available now", `${itemCount - available} unavailable`)}
      ${stat("eye", state.restaurant.published ? "Live" : "Draft", "Menu status", state.restaurant.published ? "Visible to customers" : "Not publicly visible")}
    </div>
    <div class="grid two-col">
      <section class="card">
        <div class="card-header"><div><h2>Getting started</h2><p>Finish these steps to make your menu shine.</p></div><span class="pill">${completedSteps} of 4</span></div>
        <div class="card-body">
          <div class="checklist">
            ${checkRow("Add restaurant details", detailsComplete ? "Your contact information is complete." : "Add an email and street address.", detailsComplete)}
            ${checkRow("Build your menu", `${itemCount} items across ${state.categories.length} categories.`, hasMenu)}
            ${checkRow("Customize your brand", hasBrand ? "Your restaurant artwork is ready." : "Upload a logo or banner.", hasBrand)}
            ${checkRow("Publish your menu", state.restaurant.published ? "Customers can view your menu." : "Publish when you are ready for customers.", state.restaurant.published)}
          </div>
          <div class="progress-wrap"><div class="progress-meta"><span>Setup completion</span><span>${completion}%</span></div><div class="progress"><span style="width:${completion}%"></span></div></div>
        </div>
      </section>
      <section class="card">
        <div class="card-header"><div><h2>Menu snapshot</h2><p>Live totals from your current menu.</p></div></div>
        <div class="card-body activity">
          ${activity("dashboard", `${state.categories.length} categories`, emptyCategories ? `${emptyCategories} still empty` : "Every category has items", "")}
          ${activity("menu", `${itemCount} total items`, `${available} available to customers`, "")}
          ${activity("eye", `${itemCount - available} hidden items`, itemCount === available ? "Nothing is currently hidden" : "Unavailable items stay off the public menu", "")}
          ${activity("store", state.restaurant.published ? "Menu is published" : "Menu is a draft", state.restaurant.published ? `Live at /${state.restaurant.slug}` : "Publish to make it public", "")}
        </div>
      </section>
    </div>
  </div>`;
}

function stat(icon, value, label, trend) {
  return `<div class="stat-card"><div class="stat-top"><span class="stat-icon">${icons[icon]}</span><span class="trend">${escapeHtml(trend)}</span></div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function checkRow(title, subtitle, done) {
  return `<div class="check-row ${done ? "" : "pending"}"><span class="check-dot">${done ? "✓" : "!"}</span><div><strong>${title}</strong><span>${subtitle}</span></div></div>`;
}

function activity(icon, title, subtitle, time) {
  return `<div class="activity-row"><span class="activity-icon">${icons[icon]}</span><div class="activity-copy"><strong>${title}</strong><span>${subtitle}</span></div><span class="activity-time">${time}</span></div>`;
}

function menuManager() {
  const total = state.categories.reduce((n, category) => n + category.items.length, 0);
  return `<div class="content">
    <div class="page-header">
      <div><div class="eyebrow">Menu content</div><h1>Menu manager</h1><p>${total} items across ${state.categories.length} categories. Changes save automatically.</p></div>
      <div class="page-actions"><button class="btn" data-modal="category">${icons.plus} Category</button><button class="btn primary" data-modal="item">${icons.plus} Add item</button></div>
    </div>
    <div class="section-stack">
      ${state.categories.map((category, index) => categoryCard(category, index)).join("") || '<div class="empty card"><strong>Your menu is empty</strong>Add a category to get started.</div>'}
    </div>
  </div>`;
}

function categoryCard(category, categoryIndex) {
  return `<section class="category-card">
    <div class="category-head">
      <span class="drag-handle">${icons.grip}</span>
      <div class="category-title"><h2>${escapeHtml(category.name)}</h2><span>${category.items.length} item${category.items.length === 1 ? "" : "s"}</span></div>
      <div class="row-actions">
        <button class="btn ghost icon-only small" data-move-category="${category.id}" data-direction="-1" ${categoryIndex === 0 ? "disabled" : ""} aria-label="Move up">${icons.up}</button>
        <button class="btn ghost icon-only small" data-move-category="${category.id}" data-direction="1" ${categoryIndex === state.categories.length - 1 ? "disabled" : ""} aria-label="Move down">${icons.down}</button>
        <button class="btn ghost icon-only small" data-modal="category" data-id="${category.id}" aria-label="Edit category">${icons.edit}</button>
        <button class="btn ghost danger icon-only small" data-delete-category="${category.id}" aria-label="Delete category">${icons.trash}</button>
      </div>
    </div>
    ${category.items.map((item, itemIndex) => menuItemRow(category, item, itemIndex)).join("") || '<div class="empty"><strong>No items yet</strong>Add the first item to this category.</div>'}
  </section>`;
}

function menuItemRow(category, item, index) {
  return `<div class="menu-item-row">
    <div class="item-thumb">${item.image ? `<img src="${item.image}" alt="">` : item.emoji || "🍽️"}</div>
    <div class="item-copy"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.description)}</span></div>
    <span class="price">${money(item.price)}</span>
    <span class="status ${item.available ? "" : "off"}">${item.available ? "Available" : "Hidden"}</span>
    <div class="item-actions">
      <button class="toggle ${item.available ? "on" : ""}" data-toggle-item="${item.id}" data-category="${category.id}" aria-label="Toggle availability"></button>
      <button class="btn ghost icon-only small" data-move-item="${item.id}" data-category="${category.id}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Move item up">${icons.up}</button>
      <button class="btn ghost icon-only small" data-modal="item" data-id="${item.id}" data-category="${category.id}" aria-label="Edit item">${icons.edit}</button>
      <button class="btn ghost danger icon-only small" data-delete-item="${item.id}" data-category="${category.id}" aria-label="Delete item">${icons.trash}</button>
    </div>
  </div>`;
}

function restaurantSettings() {
  const r = state.restaurant;
  return `<div class="content">
    <div class="page-header">
      <div><div class="eyebrow">Profile & branding</div><h1>Restaurant settings</h1><p>Keep your public profile accurate and on brand.</p></div>
      <div class="page-actions"><button class="btn primary" type="submit" form="restaurant-form">${icons.check} Save changes</button></div>
    </div>
    <form id="restaurant-form" class="card">
      <div class="card-header"><div><h2>Restaurant details</h2><p>This information appears on your public menu.</p></div></div>
      <div class="card-body form-grid">
        <div class="form-group"><label for="restaurant-name">Restaurant name</label><input class="field" id="restaurant-name" name="name" value="${escapeHtml(r.name)}" required></div>
        <div class="form-group"><label for="slug">Menu URL</label><div class="url-field"><span>menus.tapusa.online/</span><input class="field" id="slug" name="slug" value="${escapeHtml(r.slug)}" required></div><span class="field-help">Lowercase letters, numbers, and hyphens only.</span></div>
        <div class="form-group full"><label for="description">Description</label><textarea class="field" id="description" name="description">${escapeHtml(r.description)}</textarea></div>
        <div class="form-group"><label for="phone">Phone</label><input class="field" id="phone" name="phone" value="${escapeHtml(r.phone)}"></div>
        <div class="form-group"><label for="contact-email">Contact email</label><input class="field" id="contact-email" name="email" type="email" value="${escapeHtml(r.email)}"></div>
        <div class="form-group full"><label for="address">Address</label><input class="field" id="address" name="address" value="${escapeHtml(r.address)}"></div>
        <div class="form-group"><label>Restaurant logo</label><label class="upload-zone">${r.logo ? `<img src="${r.logo}" alt="Logo preview" style="max-width:80px;max-height:80px;border-radius:14px">` : `${icons.upload}<div><strong>Upload your logo</strong><span>PNG, JPG, or WebP</span></div>`}<input type="file" name="logo" accept="image/*" hidden></label></div>
        <div class="form-group"><label>Menu banner</label><label class="upload-zone">${r.banner ? `<img src="${r.banner}" alt="Banner preview" style="max-width:100%;max-height:90px;border-radius:10px">` : `${icons.upload}<div><strong>Upload a banner</strong><span>Recommended 1600 × 600</span></div>`}<input type="file" name="banner" accept="image/*" hidden></label></div>
      </div>
    </form>
  </div>`;
}

function adminDashboard() {
  const total = state.restaurants.length;
  const active = state.restaurants.filter((r) => r.status === "active").length;
  const items = state.restaurants.reduce((n, r) => n + r.items, 0);
  const disabled = total - active;
  const published = state.restaurants.filter((r) => r.published).length;
  const emptyMenus = state.restaurants.filter((r) => r.items === 0).length;
  const now = new Date();
  const newThisMonth = state.restaurants.filter((restaurant) => {
    if (!restaurant.createdAt) return false;
    const created = new Date(restaurant.createdAt);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;
  const healthIssues = Number(disabled > 0) + Number(emptyMenus > 0);
  return `<div class="content">
    <div class="page-header">
      <div><div class="eyebrow">TapUSA control center</div><h1>Platform overview</h1><p>Manage every restaurant and monitor the network from one place.</p></div>
      <div class="page-actions"><button class="btn primary" data-modal="restaurant-account">${icons.plus} Add restaurant</button></div>
    </div>
    <div class="grid stats-grid">
      ${stat("store", total, "Total restaurants", newThisMonth ? `${newThisMonth} this month` : "No new this month")}
      ${stat("check", active, "Active accounts", total ? `${Math.round((active / total) * 100)}% of total` : "No accounts yet")}
      ${stat("menu", items, "Menu items", "Across all menus")}
      ${stat("lock", disabled, "Disabled accounts", disabled ? "Needs attention" : "None disabled")}
    </div>
    <div class="grid two-col">
      <section class="card"><div class="card-header"><div><h2>Recently added</h2><p>Newest restaurant accounts.</p></div><a class="btn small" href="#restaurants">View all</a></div><div class="table-wrap">${restaurantTable(state.restaurants.slice(0, 4), false)}</div></section>
      <section class="card"><div class="card-header"><div><h2>Platform health</h2><p>Calculated from current restaurant data.</p></div><span class="pill ${healthIssues ? "disabled" : ""}">${healthIssues ? `${healthIssues} need attention` : "All clear"}</span></div><div class="card-body checklist">
        ${checkRow("Published menus", `${published} of ${total} restaurants are publicly visible.`, published === total)}
        ${checkRow("Account status", disabled ? `${disabled} account${disabled === 1 ? " is" : "s are"} disabled.` : "Every restaurant account is active.", disabled === 0)}
        ${checkRow("Menu content", emptyMenus ? `${emptyMenus} restaurant${emptyMenus === 1 ? " has" : "s have"} no menu items.` : "Every restaurant has menu content.", emptyMenus === 0)}
      </div></section>
    </div>
  </div>`;
}

function adminRestaurants() {
  const filtered = state.restaurants.filter((r) => `${r.name} ${r.owner} ${r.email}`.toLowerCase().includes(searchTerm.toLowerCase()));
  return `<div class="content">
    <div class="page-header">
      <div><div class="eyebrow">Account management</div><h1>Restaurants</h1><p>Create, edit, disable, and support restaurant owner accounts.</p></div>
      <div class="page-actions"><button class="btn primary" data-modal="restaurant-account">${icons.plus} Add restaurant</button></div>
    </div>
    <section class="card">
      <div class="card-header">
        <div class="search">${icons.search}<input class="field" id="restaurant-search" placeholder="Search restaurants..." value="${escapeHtml(searchTerm)}"></div>
        <span style="color:var(--muted);font-size:11px">${filtered.length} result${filtered.length === 1 ? "" : "s"}</span>
      </div>
      <div class="table-wrap">${restaurantTable(filtered, true)}</div>
    </section>
  </div>`;
}

function restaurantTable(restaurants, controls) {
  return `<table class="data-table"><thead><tr><th>Restaurant</th><th>Owner</th><th>Status</th><th>Items</th><th>Joined</th>${controls ? "<th>Actions</th>" : ""}</tr></thead><tbody>
    ${restaurants.map((r) => `<tr>
      <td><div class="restaurant-cell"><span class="restaurant-logo">${escapeHtml(r.name.split(" ").map((x) => x[0]).join("").slice(0, 2))}</span><div><strong>${escapeHtml(r.name)}</strong><span>/${escapeHtml(r.slug)}</span></div></div></td>
      <td><strong>${escapeHtml(r.owner)}</strong><br><span style="color:var(--muted);font-size:10px">${escapeHtml(r.email)}</span></td>
      <td><span class="pill ${r.status === "disabled" ? "disabled" : ""}">${r.status}</span></td>
      <td>${r.items}</td><td>${r.joined}</td>
      ${controls ? `<td><div class="row-actions"><button class="btn small" data-modal="restaurant-account" data-id="${r.id}">${icons.edit} Edit</button><button class="btn ghost icon-only small" data-reset="${r.id}" title="Reset password">${icons.lock}</button><button class="btn ghost icon-only small" data-toggle-account="${r.id}" title="${r.status === "active" ? "Disable" : "Enable"}">${r.status === "active" ? "⊘" : "✓"}</button><button class="btn ghost danger icon-only small" data-delete-account="${r.id}" title="Delete">${icons.trash}</button></div></td>` : ""}
    </tr>`).join("") || '<tr><td colspan="6" class="empty">No restaurants found.</td></tr>'}
  </tbody></table>`;
}

function renderPublic() {
  const r = state.restaurant;
  const categories = state.categories.map((c) => ({ ...c, items: c.items.filter((i) => i.available) })).filter((c) => c.items.length);
  document.querySelector("#app").innerHTML = `<main class="public-page">
    <div class="public-banner" ${r.banner ? `style="background-image:linear-gradient(90deg,rgba(7,12,20,.72),rgba(7,12,20,.18)),url('${r.banner}');background-size:cover;background-position:center"` : ""}>
      <div class="public-top">${brand()}<a class="btn" href="${state.session.loggedIn ? "#menu" : "#login"}">${state.session.loggedIn ? "Back to editor" : "Restaurant login"}</a></div>
    </div>
    <div class="public-container">
      <div class="public-restaurant-head">
        <div class="public-logo">${r.logo ? `<img src="${r.logo}" alt="${escapeHtml(r.name)} logo" style="width:100%;height:100%;object-fit:cover;border-radius:19px">` : escapeHtml(r.name.split(" ").map((x) => x[0]).join("").slice(0, 2))}</div>
        <div class="public-title"><h1>${escapeHtml(r.name)}</h1><p>${escapeHtml(r.address)}</p></div>
      </div>
      <p class="public-description">${escapeHtml(r.description)}</p>
      <nav class="category-tabs">${categories.map((c) => `<button class="category-tab" data-scroll="${c.id}">${escapeHtml(c.name)}</button>`).join("")}</nav>
      ${categories.map((c) => `<section class="public-section" id="section-${c.id}"><div class="public-section-head"><h2>${escapeHtml(c.name)}</h2><span>${c.items.length} item${c.items.length === 1 ? "" : "s"}</span></div><div class="public-items">${c.items.map(publicItem).join("")}</div></section>`).join("")}
      <div class="powered"><img src="/assets/tapusa-mark.svg" alt="">Powered by TapUSA Menus</div>
    </div>
  </main>`;
  document.querySelectorAll("[data-scroll]").forEach((node) => node.addEventListener("click", () => {
    document.querySelector(`#section-${node.dataset.scroll}`)?.scrollIntoView({ behavior: "smooth" });
  }));
}

function publicItem(item) {
  return `<article class="public-item"><div class="public-item-copy"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><strong>${money(item.price)}</strong></div><div class="public-item-image">${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : item.emoji || "🍽️"}</div></article>`;
}

function modalMarkup() {
  if (modal.type === "category") {
    const category = state.categories.find((c) => c.id === modal.id);
    return modalShell(category ? "Edit category" : "New category", `<form id="category-form"><div class="form-group"><label for="category-name">Category name</label><input class="field" id="category-name" name="name" value="${category ? escapeHtml(category.name) : ""}" placeholder="e.g. Appetizers" required></div></form>`, "category-form", category ? "Save category" : "Create category");
  }
  if (modal.type === "item") {
    const found = findItem(modal.id);
    const item = found?.item;
    return modalShell(item ? "Edit menu item" : "Add menu item", `<form id="item-form"><div class="form-grid">
      <div class="form-group full"><label for="item-name">Item name</label><input class="field" id="item-name" name="name" value="${item ? escapeHtml(item.name) : ""}" required></div>
      <div class="form-group full"><label for="item-description">Description</label><textarea class="field" id="item-description" name="description">${item ? escapeHtml(item.description) : ""}</textarea></div>
      <div class="form-group"><label for="item-price">Price</label><input class="field" id="item-price" name="price" type="number" min="0" step=".01" value="${item ? item.price : ""}" required></div>
      <div class="form-group"><label for="item-category">Category</label><select class="field" id="item-category" name="category" required>${state.categories.map((c) => `<option value="${c.id}" ${(found?.category.id || modal.category) === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></div>
      <div class="form-group full"><label>Item image (optional)</label><label class="upload-zone">${item?.image ? `<img src="${item.image}" alt="" style="max-width:100%;max-height:100px;border-radius:10px">` : `${icons.upload}<div><strong>Upload an item photo</strong><span>PNG, JPG, or WebP</span></div>`}<input type="file" name="image" accept="image/*" hidden></label></div>
      <div class="form-group full"><label style="display:flex;align-items:center;gap:9px"><input type="checkbox" name="available" ${item?.available !== false ? "checked" : ""}> Available to customers</label></div>
    </div></form>`, "item-form", item ? "Save item" : "Add item");
  }
  if (modal.type === "restaurant-account") {
    const restaurant = state.restaurants.find((r) => r.id === modal.id);
    return modalShell(restaurant ? "Edit restaurant" : "Add restaurant", `<form id="account-form"><div class="form-grid">
      <div class="form-group full"><label>Restaurant name</label><input class="field" name="name" value="${restaurant ? escapeHtml(restaurant.name) : ""}" required></div>
      <div class="form-group"><label>Owner name</label><input class="field" name="owner" value="${restaurant ? escapeHtml(restaurant.owner) : ""}" required></div>
      <div class="form-group"><label>Owner email</label><input class="field" type="email" name="email" value="${restaurant ? escapeHtml(restaurant.email) : ""}" required></div>
      <div class="form-group full"><label>Menu URL</label><div class="url-field"><span>menus.tapusa.online/</span><input class="field" name="slug" value="${restaurant ? escapeHtml(restaurant.slug) : ""}" required></div></div>
      ${restaurant ? `<div class="form-group full"><label>Status</label><select class="field" name="status"><option value="active" ${restaurant.status === "active" ? "selected" : ""}>Active</option><option value="disabled" ${restaurant.status === "disabled" ? "selected" : ""}>Disabled</option></select></div>` : ""}
    </div></form>`, "account-form", restaurant ? "Save account" : "Create account");
  }
  return "";
}

function modalShell(title, body, formId, submitText) {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" onclick="event.stopPropagation()"><div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="btn ghost icon-only" data-action="close-modal">${icons.close}</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" type="submit" form="${formId}">${submitText}</button></div></section></div>`;
}

function findItem(id) {
  for (const category of state.categories) {
    const item = category.items.find((candidate) => candidate.id === id);
    if (item) return { category, item };
  }
}

function bindCommon() {
  document.querySelectorAll("[data-toast]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    toast(node.dataset.toast);
  }));
  const loginForm = document.querySelector("#login-form");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  document.querySelector("#set-password-form")?.addEventListener("submit", handleSetPassword);
  document.querySelectorAll("[data-role]").forEach((node) => node.addEventListener("click", () => {
    state.session.role = node.dataset.role;
    saveState();
    render();
  }));
  document.querySelectorAll("[data-action]").forEach((node) => node.addEventListener("click", handleAction));
  document.querySelectorAll("[data-modal]").forEach((node) => node.addEventListener("click", () => {
    modal = { type: node.dataset.modal, id: node.dataset.id, category: node.dataset.category };
    render();
  }));
  document.querySelectorAll("[data-toggle-item]").forEach((node) => node.addEventListener("click", () => toggleItem(node.dataset.category, node.dataset.toggleItem)));
  document.querySelectorAll("[data-delete-item]").forEach((node) => node.addEventListener("click", () => deleteItem(node.dataset.category, node.dataset.deleteItem)));
  document.querySelectorAll("[data-delete-category]").forEach((node) => node.addEventListener("click", () => deleteCategory(node.dataset.deleteCategory)));
  document.querySelectorAll("[data-move-category]").forEach((node) => node.addEventListener("click", () => moveCategory(node.dataset.moveCategory, Number(node.dataset.direction))));
  document.querySelectorAll("[data-move-item]").forEach((node) => node.addEventListener("click", () => moveItem(node.dataset.category, node.dataset.moveItem, Number(node.dataset.direction))));
  document.querySelectorAll("[data-reset]").forEach((node) => node.addEventListener("click", () => resetAccount(node.dataset.reset)));
  document.querySelectorAll("[data-toggle-account]").forEach((node) => node.addEventListener("click", () => toggleAccount(node.dataset.toggleAccount)));
  document.querySelectorAll("[data-delete-account]").forEach((node) => node.addEventListener("click", () => deleteAccount(node.dataset.deleteAccount)));
  document.querySelector("#restaurant-form")?.addEventListener("submit", saveRestaurant);
  document.querySelector("#category-form")?.addEventListener("submit", saveCategory);
  document.querySelector("#item-form")?.addEventListener("submit", saveItem);
  document.querySelector("#account-form")?.addEventListener("submit", saveAccount);
  document.querySelector("#restaurant-search")?.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    const position = event.target.selectionStart;
    render();
    const input = document.querySelector("#restaurant-search");
    input?.focus();
    input?.setSelectionRange(position, position);
  });
  document.querySelectorAll('input[type="file"]').forEach((input) => input.addEventListener("change", previewUpload));
}

async function hydrateAuthenticatedState() {
  const auth = await getCurrentSession();
  if (!auth) {
    currentUserId = null;
    state.session = { loggedIn: false, role: state.session.role || "owner" };
    return null;
  }

  currentUserId = auth.user.id;
  const role = auth.profile.role === "super_admin" ? "admin" : "owner";
  state.session = { loggedIn: true, role };
  state.ownerName = auth.profile.full_name || auth.profile.email;

  if (role === "admin") {
    state.restaurants = await listAdminRestaurants();
  } else {
    const workspace = await loadOwnerWorkspace(currentUserId);
    if (!workspace) throw new Error("No restaurant is assigned to this owner account.");
    state.restaurant = workspace.restaurant;
    state.categories = workspace.categories;
  }
  return role;
}

async function refreshWorkspace() {
  if (!isSupabaseConfigured || !currentUserId) return;
  const workspace = await loadOwnerWorkspace(currentUserId);
  if (!workspace) throw new Error("No restaurant is assigned to this owner account.");
  state.restaurant = workspace.restaurant;
  state.categories = workspace.categories;
}

async function refreshAdminRestaurants() {
  if (!isSupabaseConfigured) return;
  state.restaurants = await listAdminRestaurants();
}

function reportError(error) {
  console.error(error);
  toast(error?.message || "Something went wrong. Please try again.");
}

async function handleLogin(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    if (isSupabaseConfigured) {
      await signIn(data.get("email").trim(), data.get("password"));
      const role = await hydrateAuthenticatedState();
      navigate(role === "admin" ? "admin" : "dashboard");
    } else {
      state.session.loggedIn = true;
      saveState();
      navigate(state.session.role === "admin" ? "admin" : "dashboard");
    }
  } catch (error) {
    reportError(error);
  }
}

async function handleSetPassword(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const password = data.get("password");
  const confirmation = data.get("confirmation");
  if (password !== confirmation) {
    toast("Passwords do not match.");
    return;
  }

  try {
    if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
    await updatePassword(password);
    const role = await hydrateAuthenticatedState();
    history.replaceState({}, "", role === "admin" ? "/#admin" : "/#dashboard");
    render();
    toast("Password saved successfully.");
  } catch (error) {
    reportError(error);
  }
}

async function handleAction(event) {
  event.preventDefault();
  const action = event.currentTarget.dataset.action;
  if (action === "logout") {
    try {
      if (isSupabaseConfigured) await signOut();
      currentUserId = null;
      state.session.loggedIn = false;
      saveState();
      navigate("login");
    } catch (error) {
      reportError(error);
    }
  } else if (action === "mobile-menu") {
    document.querySelector("#sidebar")?.classList.toggle("open");
  } else if (action === "close-modal") {
    modal = null;
    render();
  } else if (action === "publish") {
    const published = !state.restaurant.published;
    try {
      if (isSupabaseConfigured) {
        state.restaurant = await setPublished(state.restaurant.id, published);
      } else {
        state.restaurant.published = published;
        saveState();
      }
      render();
      toast(published ? "Menu published successfully" : "Menu moved to draft");
    } catch (error) {
      reportError(error);
    }
  } else if (action === "reset-password") {
    const email = document.querySelector("#email")?.value.trim();
    if (!email) return toast("Enter your email address first.");
    try {
      if (isSupabaseConfigured) await requestPasswordReset(email);
      toast("Password reset email sent");
    } catch (error) {
      reportError(error);
    }
  }
}

async function saveCategory(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const category = state.categories.find((c) => c.id === modal.id);
  const name = data.get("name").trim();
  try {
    if (isSupabaseConfigured) {
      if (category) await updateCategory(category.id, name);
      else await createCategory(state.restaurant.id, name);
      await refreshWorkspace();
    } else {
      if (category) category.name = name;
      else state.categories.push({ id: uid("c"), name, items: [] });
      saveState();
    }
    modal = null;
    render();
    toast(category ? "Category updated" : "Category created");
  } catch (error) {
    reportError(error);
  }
}

async function saveItem(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const found = findItem(modal.id);
  const targetCategory = state.categories.find((c) => c.id === data.get("category"));
  try {
    let image = found?.item.image || "";
    if (data.get("image")?.size) {
      image = isSupabaseConfigured
        ? await uploadRestaurantImage(state.restaurant.id, "items", data.get("image"))
        : await fileToDataUrl(data.get("image"));
    }
    const itemData = {
      id: found?.item.id || uid("i"),
      name: data.get("name").trim(),
      description: data.get("description").trim(),
      price: Number(data.get("price")),
      available: data.get("available") === "on",
      image,
      emoji: found?.item.emoji || "🍽️",
    };

    if (isSupabaseConfigured) {
      if (found) {
        await updateMenuItem(
          found.item.id,
          found.category.id,
          targetCategory.id,
          itemData,
        );
      } else {
        await createMenuItem(targetCategory.id, itemData);
      }
      await refreshWorkspace();
    } else {
      if (found) found.category.items = found.category.items.filter((item) => item.id !== found.item.id);
      targetCategory.items.push(itemData);
      saveState();
    }
    modal = null;
    render();
    toast(found ? "Menu item updated" : "Menu item added");
  } catch (error) {
    reportError(error);
  }
}

async function saveRestaurant(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const changes = {
    name: data.get("name").trim(),
    slug: slugify(data.get("slug")),
    description: data.get("description").trim(),
    phone: data.get("phone").trim(),
    email: data.get("email").trim(),
    address: data.get("address").trim(),
  };
  try {
    if (data.get("logo")?.size) {
      changes.logo = isSupabaseConfigured
        ? await uploadRestaurantImage(state.restaurant.id, "logo", data.get("logo"))
        : await fileToDataUrl(data.get("logo"));
    }
    if (data.get("banner")?.size) {
      changes.banner = isSupabaseConfigured
        ? await uploadRestaurantImage(state.restaurant.id, "banner", data.get("banner"))
        : await fileToDataUrl(data.get("banner"));
    }

    if (isSupabaseConfigured) {
      state.restaurant = await updateRestaurantRecord(state.restaurant.id, changes);
    } else {
      Object.assign(state.restaurant, changes);
      saveState();
    }
    render();
    toast("Restaurant details saved");
  } catch (error) {
    reportError(error);
  }
}

async function saveAccount(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const existing = state.restaurants.find((r) => r.id === modal.id);
  const account = {
    id: existing?.id,
    ownerId: existing?.ownerId,
    name: data.get("name").trim(),
    owner: data.get("owner").trim(),
    email: data.get("email").trim(),
    slug: slugify(data.get("slug")),
    status: data.get("status") || "active",
  };
  try {
    if (isSupabaseConfigured) {
      if (existing) {
        await updateRestaurantAccount(account);
        if (existing.status !== account.status) {
          await setRestaurantAccountStatus(existing.id, account.status);
        }
      } else {
        await createRestaurantAccount(account);
      }
      await refreshAdminRestaurants();
    } else if (existing) {
      Object.assign(existing, account);
      saveState();
    } else {
      state.restaurants.unshift({ ...account, id: uid("r"), status: "active", items: 0, joined: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date()) });
      saveState();
    }
    modal = null;
    render();
    toast(existing ? "Restaurant account updated" : "Restaurant account created");
  } catch (error) {
    reportError(error);
  }
}

async function toggleItem(categoryId, itemId) {
  const item = state.categories.find((c) => c.id === categoryId)?.items.find((i) => i.id === itemId);
  const available = !item.available;
  try {
    if (isSupabaseConfigured) await setItemAvailability(item.id, available);
    item.available = available;
    saveState();
    render();
    toast(`${item.name} is now ${item.available ? "available" : "hidden"}`);
  } catch (error) {
    reportError(error);
  }
}

async function deleteItem(categoryId, itemId) {
  const category = state.categories.find((c) => c.id === categoryId);
  const item = category.items.find((i) => i.id === itemId);
  if (!confirm(`Delete "${item.name}"?`)) return;
  try {
    if (isSupabaseConfigured) await deleteMenuItem(itemId);
    category.items = category.items.filter((i) => i.id !== itemId);
    saveState();
    render();
    toast("Menu item deleted");
  } catch (error) {
    reportError(error);
  }
}

async function deleteCategory(categoryId) {
  const category = state.categories.find((c) => c.id === categoryId);
  if (!confirm(`Delete "${category.name}" and its ${category.items.length} items?`)) return;
  try {
    if (isSupabaseConfigured) await deleteCategoryRecord(categoryId);
    state.categories = state.categories.filter((c) => c.id !== categoryId);
    saveState();
    render();
    toast("Category deleted");
  } catch (error) {
    reportError(error);
  }
}

async function moveCategory(id, direction) {
  const index = state.categories.findIndex((c) => c.id === id);
  const target = index + direction;
  if (target < 0 || target >= state.categories.length) return;
  [state.categories[index], state.categories[target]] = [state.categories[target], state.categories[index]];
  try {
    if (isSupabaseConfigured) {
      await reorderCategories(state.restaurant.id, state.categories.map((category) => category.id));
    } else {
      saveState();
    }
    render();
  } catch (error) {
    [state.categories[index], state.categories[target]] = [state.categories[target], state.categories[index]];
    reportError(error);
  }
}

async function moveItem(categoryId, id, direction) {
  const items = state.categories.find((c) => c.id === categoryId).items;
  const index = items.findIndex((i) => i.id === id);
  const target = index + direction;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  try {
    if (isSupabaseConfigured) {
      await reorderMenuItems(categoryId, items.map((item) => item.id));
    } else {
      saveState();
    }
    render();
  } catch (error) {
    [items[index], items[target]] = [items[target], items[index]];
    reportError(error);
  }
}

async function resetAccount(id) {
  const restaurant = state.restaurants.find((r) => r.id === id);
  try {
    if (isSupabaseConfigured) await resetOwnerPassword(restaurant.email);
    toast(`Password reset email sent to ${restaurant.email}`);
  } catch (error) {
    reportError(error);
  }
}

async function toggleAccount(id) {
  const restaurant = state.restaurants.find((r) => r.id === id);
  const status = restaurant.status === "active" ? "disabled" : "active";
  try {
    if (isSupabaseConfigured) await setRestaurantAccountStatus(id, status);
    restaurant.status = status;
    saveState();
    render();
    toast(`${restaurant.name} ${restaurant.status === "active" ? "enabled" : "disabled"}`);
  } catch (error) {
    reportError(error);
  }
}

async function deleteAccount(id) {
  const restaurant = state.restaurants.find((r) => r.id === id);
  if (!confirm(`Permanently delete ${restaurant.name}?`)) return;
  try {
    if (isSupabaseConfigured) {
      await deleteRestaurantAccount(id, restaurant.ownerId);
    }
    state.restaurants = state.restaurants.filter((r) => r.id !== id);
    saveState();
    render();
    toast("Restaurant account deleted");
  } catch (error) {
    reportError(error);
  }
}

function previewUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const zone = event.target.closest(".upload-zone");
    zone.querySelector("img")?.remove();
    const image = document.createElement("img");
    image.src = reader.result;
    image.alt = "Upload preview";
    image.style.cssText = "max-width:100%;max-height:100px;border-radius:10px";
    zone.prepend(image);
  };
  reader.readAsDataURL(file);
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

window.addEventListener("hashchange", () => {
  modal = null;
  render();
});

async function initialize() {
  if (!isSupabaseConfigured) {
    render();
    return;
  }

  try {
    await hydrateAuthenticatedState();
    const slug = publicPathSlug();
    if (slug) {
      const workspace = await getPublicMenu(slug);
      if (workspace) {
        state.restaurant = workspace.restaurant;
        state.categories = workspace.categories;
      } else {
        state.restaurant = {
          ...seed.restaurant,
          name: "Menu unavailable",
          slug,
          description: "This menu does not exist or is not currently published.",
          address: "",
          logo: "",
          banner: "",
        };
        state.categories = [];
      }
    }
  } catch (error) {
    console.error("Backend initialization failed", error);
    state.session.loggedIn = false;
    toast(error?.message || "Unable to connect to the backend.");
  }
  render();
}

initialize();
