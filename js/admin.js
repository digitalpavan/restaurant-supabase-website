// Admin page: owner login, menu editing and bookings.
// Access is enforced by the Row Level Security policies in supabase/admin.sql;
// this page only shows what the signed-in account is allowed to see.

const $ = (sel, root = document) => root.querySelector(sel);

const loginView = $("#login-view");
const dashboard = $("#dashboard");
const loading = $("#admin-loading");
const logoutBtn = $("#logout");
const adminEmail = $("#admin-email");

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

function showMessage(el, text, type = "") {
  el.textContent = text;
  el.className = "form-message " + type;
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function dietMark(isVeg) {
  return el("span", { className: "diet-mark " + (isVeg ? "veg" : "nonveg"), title: isVeg ? "Veg" : "Non-veg" });
}

// ---------- Session ----------
async function showView(session) {
  // Customers sign in through the same Supabase Auth (login.html); only admins get the dashboard.
  // A signed-in customer stays signed in on the website and just sees the owner login here.
  let isAdmin = false;
  if (session) {
    ({ data: isAdmin } = await supabaseClient.rpc("is_admin"));
    if (!isAdmin) {
      showMessage($("#login-message"), `${session.user.email} is a customer account. Please sign in with the owner account.`, "error");
    }
  }
  loading.hidden = true;
  const signedIn = Boolean(session) && isAdmin;
  loginView.hidden = signedIn;
  dashboard.hidden = !signedIn;
  logoutBtn.hidden = !signedIn;
  adminEmail.textContent = signedIn ? session.user.email : "";
  if (signedIn) {
    await Promise.all([loadDishes(), loadBookings(), loadCustomers()]);
  }
}

// Google / Facebook bring the owner back to this page; non-admin accounts are turned away above.
setupSocialButtons(() => new URL("admin.html", window.location.href).href,
  (text) => showMessage($("#login-message"), text, "error"));

if (!isConfigured) {
  loading.textContent = "Supabase is not configured. Add your keys in js/supabase.js.";
} else {
  supabaseClient.auth.getSession().then(({ data }) => showView(data.session));
  supabaseClient.auth.onAuthStateChange((event, session) => {
    // Deferred: awaiting Supabase calls inside this callback can deadlock the auth client.
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(() => showView(session));
  });
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const msg = $("#login-message");
  const btn = $("button[type=submit]", e.target);
  btn.disabled = true;
  showMessage(msg, "Signing in…");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: f.email.value.trim(),
    password: f.password.value,
  });
  btn.disabled = false;
  if (error) {
    showMessage(msg, "Wrong email or password.", "error");
  } else {
    showMessage(msg, "");
    e.target.reset();
  }
});

logoutBtn.addEventListener("click", () => supabaseClient.auth.signOut());

// ---------- Tabs ----------
document.querySelectorAll(".admin-tabs [data-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs [data-tab]").forEach((t) => {
      const active = t === tab;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
      $("#" + t.dataset.tab).hidden = !active;
    });
  });
});

// ---------- Menu ----------
const dishForm = $("#dish-form");
const dishRows = $("#dish-rows");
const menuMessage = $("#menu-message");
const dishSearch = $("#dish-search");
let dishes = [];
let editingId = null;

async function loadDishes() {
  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("category", { ascending: true })
    .order("price", { ascending: true });
  if (error) {
    console.error(error);
    showMessage(menuMessage, "Couldn't load the menu. Is this account an admin? (see supabase/admin.sql)", "error");
    return;
  }
  dishes = data;
  $("#categories").replaceChildren(...[...new Set(dishes.map((d) => d.category))].map((c) => el("option", { value: c })));
  renderDishes();
}

function renderDishes() {
  const q = dishSearch.value.trim().toLowerCase();
  const visible = dishes.filter((d) => !q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  if (!visible.length) {
    dishRows.replaceChildren(el("tr", {}, el("td", { colSpan: 5, className: "empty", textContent: q ? "No dishes match your search." : "No dishes yet. Click “+ Add dish”." })));
    return;
  }
  dishRows.replaceChildren(...visible.map((d) => {
    const available = d.is_available !== false;

    const toggle = el("input", { type: "checkbox", checked: available });
    toggle.setAttribute("aria-label", `Show ${d.name} on website`);
    toggle.addEventListener("change", () => updateDish(d.id, { is_available: toggle.checked }, toggle));

    const editBtn = el("button", { type: "button", className: "link-btn", textContent: "Edit" });
    editBtn.addEventListener("click", () => openDishForm(d));
    const deleteBtn = el("button", { type: "button", className: "link-btn danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", () => deleteDish(d));

    const nameCell = el("td", {},
      el("span", { className: "dish-name" }, dietMark(d.is_veg !== false), d.name),
      d.description ? el("span", { className: "sub", textContent: d.description }) : "");

    return el("tr", { className: available ? "" : "hidden-dish" },
      nameCell,
      el("td", { textContent: d.category }),
      el("td", { className: "num", textContent: money.format(d.price) }),
      el("td", {}, el("label", { className: "switch" }, toggle, el("span"))),
      el("td", { className: "actions" }, editBtn, deleteBtn));
  }));
}
dishSearch.addEventListener("input", renderDishes);

function openDishForm(dish = null) {
  editingId = dish ? dish.id : null;
  const f = dishForm.elements;
  $("#dish-form-title").textContent = dish ? `Edit “${dish.name}”` : "Add dish";
  f.name.value = dish?.name ?? "";
  f.category.value = dish?.category ?? "";
  f.description.value = dish?.description ?? "";
  f.price.value = dish?.price ?? "";
  f.image_url.value = dish?.image_url ?? "";
  f.diet.value = dish && dish.is_veg === false ? "nonveg" : "veg";
  f.is_available.checked = dish ? dish.is_available !== false : true;
  showMessage($("#dish-message"), "");
  dishForm.hidden = false;
  dishForm.scrollIntoView({ behavior: "smooth", block: "start" });
  f.name.focus({ preventScroll: true });
}

function closeDishForm() {
  dishForm.hidden = true;
  dishForm.reset();
  editingId = null;
}

$("#add-dish").addEventListener("click", () => openDishForm());
$("#cancel-dish").addEventListener("click", closeDishForm);

dishForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = dishForm.elements;
  const msg = $("#dish-message");
  const dish = {
    name: f.name.value.trim(),
    category: f.category.value.trim(),
    description: f.description.value.trim() || null,
    price: Number(f.price.value),
    image_url: f.image_url.value.trim() || null,
    is_veg: f.diet.value === "veg",
    is_available: f.is_available.checked,
  };
  if (!dish.name || !dish.category || !(dish.price >= 0) || f.price.value === "") {
    showMessage(msg, "Please fill in name, category and price.", "error");
    return;
  }
  const btn = $("button[type=submit]", dishForm);
  btn.disabled = true;
  showMessage(msg, "Saving…");
  const query = editingId
    ? supabaseClient.from("menu_items").update(dish).eq("id", editingId)
    : supabaseClient.from("menu_items").insert(dish);
  const { error } = await query;
  btn.disabled = false;
  if (error) {
    console.error(error);
    showMessage(msg, "Couldn't save the dish. Please try again.", "error");
    return;
  }
  const saved = editingId ? "Dish updated." : "Dish added.";
  closeDishForm();
  showMessage(menuMessage, saved, "success");
  loadDishes();
});

async function updateDish(id, changes, control) {
  control.disabled = true;
  const { error } = await supabaseClient.from("menu_items").update(changes).eq("id", id);
  control.disabled = false;
  if (error) {
    console.error(error);
    showMessage(menuMessage, "Couldn't update the dish. Please try again.", "error");
    control.checked = !control.checked;
    return;
  }
  const dish = dishes.find((d) => d.id === id);
  Object.assign(dish, changes);
  showMessage(menuMessage, `${dish.name} is now ${dish.is_available ? "shown on" : "hidden from"} the website.`, "success");
  renderDishes();
}

async function deleteDish(dish) {
  if (!confirm(`Delete “${dish.name}” from the menu? This can't be undone.\n\nTip: to remove it only for today, switch off “On website” instead.`)) return;
  const { error } = await supabaseClient.from("menu_items").delete().eq("id", dish.id);
  if (error) {
    console.error(error);
    showMessage(menuMessage, "Couldn't delete the dish. Please try again.", "error");
    return;
  }
  dishes = dishes.filter((d) => d.id !== dish.id);
  showMessage(menuMessage, `${dish.name} deleted.`, "success");
  renderDishes();
}

// ---------- Bookings ----------
const bookingRows = $("#booking-rows");
const bookingsMessage = $("#bookings-message");

const localISODate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

async function loadBookings() {
  showMessage(bookingsMessage, "");
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("*")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });
  if (error) {
    console.error(error);
    showMessage(bookingsMessage, "Couldn't load bookings.", "error");
    return;
  }
  const today = localISODate(new Date());
  // Upcoming first (soonest at the top), then past bookings (most recent first).
  const upcoming = data.filter((b) => b.reservation_date >= today);
  const past = data.filter((b) => b.reservation_date < today).reverse();
  $("#bookings-count").textContent = upcoming.length ? `(${upcoming.length})` : "";

  if (!data.length) {
    bookingRows.replaceChildren(el("tr", {}, el("td", { colSpan: 7, className: "empty", textContent: "No bookings yet." })));
    return;
  }
  bookingRows.replaceChildren(...[...upcoming, ...past].map((b) => {
    const deleteBtn = el("button", { type: "button", className: "link-btn danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", () => deleteBooking(b));
    const date = b.reservation_date ? dateFmt.format(new Date(b.reservation_date + "T00:00")) : "";
    return el("tr", { className: b.reservation_date < today ? "past" : "" },
      el("td", { textContent: date }),
      el("td", { textContent: (b.reservation_time || "").slice(0, 5) }),
      el("td", { textContent: b.customer_name }),
      el("td", {}, el("a", { href: "tel:" + b.phone.replace(/[^\d+]/g, ""), textContent: b.phone })),
      el("td", { className: "num", textContent: b.guests ?? "" }),
      el("td", { textContent: b.message || "" }),
      el("td", { className: "actions" }, deleteBtn));
  }));
}
$("#refresh-bookings").addEventListener("click", loadBookings);

// ---------- Customers ----------
const customerRows = $("#customer-rows");
const customersMessage = $("#customers-message");
const customerSearch = $("#customer-search");
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
let customers = [];

async function loadCustomers() {
  showMessage(customersMessage, "");
  // admin_list_customers() is in supabase/customers.sql and only answers admins.
  const { data, error } = await supabaseClient.rpc("admin_list_customers");
  if (error) {
    console.error(error);
    showMessage(customersMessage, "Couldn't load customers. Has supabase/customers.sql been run?", "error");
    return;
  }
  customers = data;
  $("#customers-count").textContent = customers.length ? `(${customers.length})` : "";
  const by = (p) => customers.filter((c) => c.provider === p).length;
  $("#customer-stats").replaceChildren(...["google", "facebook", "email"].map((p) =>
    el("span", { className: "provider-tag " + p, textContent: `${PROVIDER_NAMES[p]}: ${by(p)}` })));
  renderCustomers();
}

function renderCustomers() {
  const q = customerSearch.value.trim().toLowerCase();
  const visible = customers.filter((c) => !q ||
    [c.full_name, c.email, c.phone].some((v) => v && v.toLowerCase().includes(q)));
  if (!visible.length) {
    customerRows.replaceChildren(el("tr", {}, el("td", { colSpan: 6, className: "empty",
      textContent: q ? "No customers match your search." : "No customer accounts yet. They appear here when people sign up on the website." })));
    return;
  }
  customerRows.replaceChildren(...visible.map((c) => el("tr", {},
    el("td", {}, el("span", { className: "dish-name", textContent: c.full_name || "—" }),
      c.confirmed ? "" : el("span", { className: "sub", textContent: "Email not confirmed yet" })),
    el("td", {}, el("a", { href: "mailto:" + c.email, textContent: c.email })),
    el("td", {}, c.phone ? el("a", { href: "tel:" + c.phone.replace(/[^\d+]/g, ""), textContent: c.phone }) : ""),
    el("td", {}, el("span", { className: "provider-tag " + c.provider, textContent: PROVIDER_NAMES[c.provider] || c.provider })),
    el("td", { textContent: shortDate.format(new Date(c.created_at)) }),
    el("td", { textContent: c.last_sign_in_at ? shortDate.format(new Date(c.last_sign_in_at)) : "—" }))));
}
customerSearch.addEventListener("input", renderCustomers);
$("#refresh-customers").addEventListener("click", loadCustomers);

async function deleteBooking(b) {
  if (!confirm(`Delete the booking for ${b.customer_name}? This can't be undone.`)) return;
  const { error } = await supabaseClient.from("reservations").delete().eq("id", b.id);
  if (error) {
    console.error(error);
    showMessage(bookingsMessage, "Couldn't delete the booking.", "error");
    return;
  }
  loadBookings();
}
