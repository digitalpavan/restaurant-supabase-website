// UI behaviour: navigation, menu rendering, gallery lightbox, reservation form.

const $ = (sel, root = document) => root.querySelector(sel);

// ---------- Navigation ----------
const navToggle = $(".nav-toggle");
const navLinks = $("#nav-links");

function setNav(open) {
  navLinks.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
}
navToggle.addEventListener("click", () => setNav(!navLinks.classList.contains("open")));
navLinks.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });

$("#year").textContent = new Date().getFullYear();

// ---------- Customer account ----------
// Signed-in customers see their name in the nav, footer and booking section,
// and get their name and phone filled into the booking form.
let customer = null;

function fillBookingDetails() {
  if (!customer) return;
  const f = $("#reservation-form").elements;
  const name = customerName(customer);
  const phone = customer.user_metadata?.phone;
  if (name && !f.name.value) f.name.value = name;
  if (phone && !f.phone.value) f.phone.value = phone;
}

function showWelcome(name) {
  let shown = false;
  try { shown = !sessionStorage.getItem("dhanvika-welcome"); sessionStorage.removeItem("dhanvika-welcome"); } catch {}
  if (shown) return;
  const toast = $("#welcome-toast");
  toast.textContent = `Welcome${name ? ", " + name.split(" ")[0] : ""}! You're signed in. Your details are filled in when you book.`;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 5000);
}

if (isConfigured) {
  supabaseClient.auth.getSession().then(({ data }) => {
    customer = data.session?.user || null;
    if (!customer) return;
    const name = customerName(customer);
    const first = name.split(" ")[0];
    $("#account-link").textContent = first ? "Hi, " + first : "My account";
    $("#footer-account").textContent = "My account";
    $("#footer-signup").hidden = true;

    const signOut = Object.assign(document.createElement("button"), { type: "button", className: "text-link", textContent: "Sign out" });
    signOut.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.reload();
    });
    $("#booking-account").replaceChildren(
      Object.assign(document.createElement("span"), { textContent: `Booking as ${name || customer.email}. ` }),
      Object.assign(document.createElement("a"), { href: "login.html", textContent: "My account" }),
      " · ", signOut);

    fillBookingDetails();
    showWelcome(name);
  });
}

// ---------- Motion ----------
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("in");
    revealObserver.unobserve(entry.target);
    if (entry.target.dataset.count) countUp(entry.target);
  }
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

function observeReveal(el, variant, delay = 0) {
  el.classList.add("reveal");
  if (variant) el.dataset.r = variant;
  el.style.setProperty("--d", delay + "s");
  revealObserver.observe(el);
}

// Every element on the page animates in when it scrolls into view, staggered per parent.
const REVEALS = [
  [".section-head > *", "up"],
  ["#diet-filters, #menu-filters", "up"],
  [".about-image", "left"],
  [".about-grid > div:last-child > .eyebrow, .about-grid > div:last-child > .section-title, .about-grid > div:last-child > p", "right"],
  [".chef", "right"],
  [".highlights li", "zoom"],
  [".gallery-item", "zoom"],
  ["#reservation-form > :not(.hp)", "up"],
  [".contact-grid > div:first-child > .eyebrow, .contact-grid > div:first-child > .section-title", "left"],
  [".contact-list li", "left"],
  [".map", "right"],
  [".footer-inner", "up"],
];
const staggerByParent = new Map();
for (const [selector, variant] of REVEALS) {
  document.querySelectorAll(selector).forEach((el) => {
    const n = staggerByParent.get(el.parentElement) ?? 0;
    staggerByParent.set(el.parentElement, n + 1);
    observeReveal(el, variant, Math.min(n, 8) * 0.09);
  });
}

function countUp(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  if (reduceMotion) return;
  const start = performance.now();
  const duration = 1500;
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}
document.querySelectorAll("[data-count]").forEach((el) => {
  if (reduceMotion) return;
  el.textContent = "0" + (el.dataset.suffix || "");
  revealObserver.observe(el);
});

// Rising embers in the hero
const embers = $(".embers");
if (embers && !reduceMotion) {
  embers.append(...Array.from({ length: 24 }, () => {
    const i = document.createElement("i");
    i.style.setProperty("--x", Math.random() * 100 + "%");
    i.style.setProperty("--s", 3 + Math.random() * 6 + "px");
    i.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
    i.style.setProperty("--t", 7 + Math.random() * 8 + "s");
    i.style.setProperty("--d", -Math.random() * 12 + "s");
    return i;
  }));
}

// Scroll progress, sticky-header shadow and hero parallax
const progress = $(".scroll-progress");
const header = $(".site-header");
const heroBg = $(".hero-bg");
const heroContent = $(".hero-content");
let ticking = false;
function onScroll() {
  ticking = false;
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  header.classList.toggle("scrolled", y > 20);
  if (!reduceMotion && y < window.innerHeight * 1.2) {
    heroBg.style.translate = `0 ${y * 0.25}px`;
    heroContent.style.translate = `0 ${y * 0.12}px`;
  }
}
window.addEventListener("scroll", () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
onScroll();

// Highlight the nav link of the section in view
const navAnchors = [...navLinks.querySelectorAll('a[href^="#"]:not(.btn)')];
const sectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    navAnchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
  }
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("main section[id]").forEach((sec) => sectionObserver.observe(sec));

// ---------- Menu ----------
const menuGrid = $("#menu");
const menuFilters = $("#menu-filters");
const dietFilters = $("#diet-filters");
const menuStatus = $("#menu-status");
const menuNote = $("#menu-note");
let menuItems = [];
let activeCategory = "All";
let activeDiet = "All";

const CATEGORY_ORDER = ["Starters", "Main Course", "Biryani & Rice", "Breads", "Desserts"];
const DIETS = [["All", null], ["Veg", "veg"], ["Non-Veg", "nonveg"]];
const hasDiet = (item) => typeof item.is_veg === "boolean";
const dietOf = (item) => (item.is_veg ? "veg" : "nonveg");

function dietMark(diet) {
  const mark = document.createElement("span");
  mark.className = "diet-mark " + diet;
  return mark;
}

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

function renderMenu() {
  const diet = DIETS.find(([label]) => label === activeDiet)[1];
  const visible = menuItems.filter((i) =>
    (activeCategory === "All" || i.category === activeCategory) &&
    (!diet || dietOf(i) === diet));

  // Build with DOM APIs (textContent) so database content can never inject HTML.
  menuGrid.replaceChildren(...visible.map((item) => {
    const card = document.createElement("article");
    card.className = "menu-card";

    if (item.image_url) {
      const img = document.createElement("img");
      img.src = item.image_url;
      img.alt = item.name;
      img.loading = "lazy";
      card.append(img);
    } else {
      // Same size as a photo so the grid stays even until a real image is added.
      const ph = document.createElement("div");
      ph.className = "menu-card-placeholder";
      ph.setAttribute("aria-hidden", "true");
      ph.textContent = item.name.charAt(0);
      card.append(ph);
    }

    const body = document.createElement("div");
    body.className = "menu-card-body";

    if (item.is_featured) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Chef's pick";
      body.append(badge);
    }

    const top = document.createElement("div");
    top.className = "menu-card-top";
    const title = document.createElement("h3");
    if (hasDiet(item)) {
      const mark = dietMark(dietOf(item));
      mark.title = item.is_veg ? "Vegetarian" : "Non-vegetarian";
      title.append(mark);
    }
    title.append(item.name);
    const price = document.createElement("span");
    price.className = "price";
    price.textContent = money.format(item.price);
    top.append(title, price);
    body.append(top);

    if (item.description) {
      const desc = document.createElement("p");
      desc.textContent = item.description;
      body.append(desc);
    }

    card.append(body);
    return card;
  }));
  menuGrid.querySelectorAll(".menu-card").forEach((card, i) => observeReveal(card, "zoom", Math.min(i, 8) * 0.08));
}

function renderDietFilters() {
  // Only shown once the menu has the is_veg column (see supabase/menu-update.sql).
  dietFilters.hidden = !menuItems.some(hasDiet);
  dietFilters.replaceChildren(...DIETS.map(([label, diet]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn" + (label === activeDiet ? " active" : "");
    if (diet) btn.append(dietMark(diet));
    btn.append(label);
    btn.addEventListener("click", () => {
      activeDiet = label;
      renderDietFilters();
      renderMenu();
    });
    return btn;
  }));
}

function renderFilters() {
  const categories = ["All", ...new Set(menuItems.map((i) => i.category))];
  menuFilters.replaceChildren(...categories.map((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderFilters();
      renderMenu();
    });
    return btn;
  }));
}

async function loadMenu() {
  try {
    const { items, sample } = await fetchMenuItems();
    // Menu-card order: course, then veg before non-veg, then price. Unknown categories go last.
    const rank = (c) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? CATEGORY_ORDER.length : i; };
    menuItems = [...items].sort((a, b) =>
      rank(a.category) - rank(b.category) ||
      a.category.localeCompare(b.category) ||
      (b.is_veg === true) - (a.is_veg === true) ||
      a.price - b.price);
    if (!items.length) {
      menuStatus.textContent = "Our menu is being updated. Please check back soon.";
      return;
    }
    menuStatus.hidden = true;
    renderDietFilters();
    renderFilters();
    renderMenu();
    if (sample) {
      menuNote.hidden = false;
      menuNote.textContent = "Showing sample items. Connect Supabase in js/supabase.js to load the live menu.";
    }
  } catch (err) {
    console.error("Failed to load menu:", err);
    menuStatus.classList.add("error");
    menuStatus.textContent = "Sorry, we couldn't load the menu right now. Please try again later.";
  }
}
loadMenu();

// ---------- Gallery lightbox ----------
const lightbox = $("#lightbox");
const lightboxImg = $("img", lightbox);

function closeLightbox() { lightbox.hidden = true; lightboxImg.src = ""; }
document.querySelectorAll(".gallery-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const thumb = $("img", btn);
    lightboxImg.src = btn.dataset.full;
    lightboxImg.alt = thumb.alt;
    lightbox.hidden = false;
  });
});
lightbox.addEventListener("click", (e) => { if (e.target !== lightboxImg) closeLightbox(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lightbox.hidden) closeLightbox(); });

// ---------- Reservation form ----------
const form = $("#reservation-form");
const formMessage = $("#form-message");
const WHATSAPP_NUMBER = "919490996614"; // country code + number, no "+" or spaces

const localISODate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
form.elements.date.min = localISODate(new Date());

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = "form-message " + type;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = form.elements;

  // Bots fill the hidden field; pretend success and drop it.
  if (f.website.value) { showMessage("Thank you!", "success"); return; }

  let firstInvalid = null;
  for (const field of [f.name, f.phone, f.date, f.time, f.guests]) {
    const ok = field.value.trim() !== "" && field.checkValidity();
    field.setAttribute("aria-invalid", String(!ok));
    if (!ok && !firstInvalid) firstInvalid = field;
  }
  if (f.date.value && f.date.value < f.date.min) {
    f.date.setAttribute("aria-invalid", "true");
    firstInvalid ||= f.date;
  }
  if (firstInvalid) {
    showMessage("Please check the highlighted fields.", "error");
    firstInvalid.focus();
    return;
  }

  const booking = {
    customer_name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    reservation_date: f.date.value,
    reservation_time: f.time.value,
    guests: Number(f.guests.value),
    message: f.notes.value.trim() || null,
  };

  // Bookings are sent to the restaurant on WhatsApp. Open it straight away
  // (before any await) so the browser doesn't treat it as a pop-up.
  const url = whatsappBookingUrl(booking);
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  else window.location.href = url;

  formMessage.className = "form-message success";
  formMessage.replaceChildren(
    "WhatsApp is opening with your booking. Press send there to confirm. Not opened? ",
    Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener", textContent: "Tap here" }),
  );
  form.reset();

  // Remember a signed-in customer's phone so the next booking is quicker.
  if (customer && customer.user_metadata?.phone !== booking.phone) {
    customer.user_metadata = { ...customer.user_metadata, phone: booking.phone };
    supabaseClient.auth.updateUser({ data: { phone: booking.phone } })
      .catch((err) => console.error("Saving phone failed:", err));
  }
  fillBookingDetails();

  // Keep a copy for the owner's admin page; WhatsApp is the booking itself.
  submitReservation(booking).catch((err) => console.error("Saving booking copy failed:", err));
});

function whatsappBookingUrl(b) {
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .format(new Date(b.reservation_date + "T00:00"));
  const lines = [
    "Hello Dhanvika, I'd like to book a table.",
    "",
    `Name: ${b.customer_name}`,
    `Phone: ${b.phone}`,
    `Date: ${date}`,
    `Time: ${b.reservation_time}`,
    `Guests: ${b.guests}`,
  ];
  if (b.message) lines.push(`Special requests: ${b.message}`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}
