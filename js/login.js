// Customer login page: email + password, Google and Facebook (Supabase Auth).
// Customers get no extra database access: menu edits and bookings are limited
// to accounts in the admins table (see supabase/admin.sql).

const $ = (sel, root = document) => root.querySelector(sel);

const loading = $("#auth-loading");
const authView = $("#auth-view");
const resetView = $("#reset-view");
const accountView = $("#account-view");
const authForm = $("#auth-form");
const authMessage = $("#auth-message");
const submitBtn = $("#auth-submit");

// ?next=index.html#reservation sends the customer back there once signed in.
// Only pages on this site are allowed, so the link can't be abused to redirect elsewhere.
const nextPage = (() => {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return null;
  const url = new URL(next, window.location.href);
  return url.origin === window.location.origin ? url.href : null;
})();

// Where Google, Facebook and email links send the customer back to (this page, keeping ?next).
const returnUrl = () => {
  const url = new URL("login.html", window.location.href);
  if (nextPage) url.searchParams.set("next", nextPage.replace(window.location.origin + "/", ""));
  return url.href;
};

function showMessage(el, text, type = "") {
  el.textContent = text;
  el.className = "form-message " + type;
}

function showOnly(view) {
  loading.hidden = true;
  for (const v of [authView, resetView, accountView]) v.hidden = v !== view;
}

function signedIn(user) {
  if (nextPage) {
    // The home page shows a short "Welcome" note after this.
    try { sessionStorage.setItem("dhanvika-welcome", "1"); } catch {}
    window.location.replace(nextPage);
    return;
  }
  showAccount(user);
}

function showAccount(user) {
  $("#account-name").textContent = customerName(user) || user.email.split("@")[0];
  $("#account-email").textContent = user.email;
  const provider = user.app_metadata?.provider;
  $("#account-provider").textContent = provider && provider !== "email" ? `(via ${PROVIDER_NAMES[provider] || provider})` : "";
  showOnly(accountView);
}

// ---------- Mode: sign in / create account / forgot password ----------
const MODES = {
  signin: { title: "Sign in", submit: "Sign in", switchText: "New to Dhanvika?", switchBtn: "Create an account", next: "signup" },
  signup: { title: "Create your account", submit: "Create account", switchText: "Already have an account?", switchBtn: "Sign in", next: "signin" },
  forgot: { title: "Reset your password", submit: "Send reset link", switchText: "Remembered it?", switchBtn: "Back to sign in", next: "signin" },
};
let mode = "signin";

function setMode(next) {
  mode = next;
  const m = MODES[mode];
  const f = authForm.elements;
  $("#auth-title").textContent = m.title;
  submitBtn.textContent = m.submit;
  $("#switch-text").textContent = m.switchText;
  $("#switch-mode").textContent = m.switchBtn;
  $("#name-field").hidden = mode !== "signup";
  $("#password-field").hidden = mode === "forgot";
  $("#forgot-link").hidden = mode !== "signin";
  f.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  showMessage(authMessage, "");
}
$("#switch-mode").addEventListener("click", () => setMode(MODES[mode].next));
$("#forgot-link").addEventListener("click", () => setMode("forgot"));
if (new URLSearchParams(window.location.search).get("mode") === "signup") setMode("signup");

// ---------- Email + password ----------
const AUTH_ERRORS = {
  invalid_credentials: "Wrong email or password.",
  email_not_confirmed: "Please confirm your email first. Check your inbox for the link we sent.",
  user_already_exists: "An account with this email already exists. Try signing in.",
  weak_password: "Please choose a stronger password (at least 6 characters).",
  over_email_send_rate_limit: "Too many emails sent. Please wait a few minutes and try again.",
};
const friendlyError = (error) => AUTH_ERRORS[error.code] || error.message || "Something went wrong. Please try again.";

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = authForm.elements;
  const email = f.email.value.trim();
  const password = f.password.value;

  const required = mode === "forgot" ? [f.email] : [f.email, f.password];
  if (mode === "signup") required.unshift(f.full_name);
  let firstInvalid = null;
  for (const field of required) {
    const ok = field.value.trim() !== "" && field.checkValidity();
    field.setAttribute("aria-invalid", String(!ok));
    firstInvalid ||= ok ? null : field;
  }
  if (firstInvalid) {
    showMessage(authMessage, mode !== "forgot" && f.password.value && f.password.value.length < 6
      ? "Password must be at least 6 characters." : "Please check the highlighted fields.", "error");
    firstInvalid.focus();
    return;
  }

  submitBtn.disabled = true;
  showMessage(authMessage, "Please wait…");
  let result;
  if (mode === "signin") {
    result = await supabaseClient.auth.signInWithPassword({ email, password });
  } else if (mode === "signup") {
    result = await supabaseClient.auth.signUp({
      email, password,
      options: { data: { full_name: f.full_name.value.trim() }, emailRedirectTo: returnUrl() },
    });
  } else {
    result = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: new URL("login.html", window.location.href).href });
  }
  submitBtn.disabled = false;

  if (result.error) {
    showMessage(authMessage, friendlyError(result.error), "error");
    return;
  }
  if (mode === "forgot") {
    showMessage(authMessage, "If that email has an account, a reset link is on its way. Check your inbox.", "success");
  } else if (mode === "signup" && !result.data.session) {
    // Email confirmation is on: the account becomes active from the link in the email.
    showMessage(authMessage, "Almost done! We sent a confirmation link to " + email + ". Open it to activate your account.", "success");
    authForm.reset();
  }
  // A successful sign-in is handled by onAuthStateChange below.
});

// ---------- Google / Facebook ----------
setupSocialButtons(returnUrl, (text) => showMessage(authMessage, text, "error"));

// ---------- New password (from the reset email) ----------
$("#reset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const field = e.target.elements.password;
  const msg = $("#reset-message");
  if (field.value.length < 6) {
    field.setAttribute("aria-invalid", "true");
    showMessage(msg, "Password must be at least 6 characters.", "error");
    return;
  }
  const btn = $("button[type=submit]", e.target);
  btn.disabled = true;
  const { data, error } = await supabaseClient.auth.updateUser({ password: field.value });
  btn.disabled = false;
  if (error) {
    showMessage(msg, friendlyError(error), "error");
    return;
  }
  showAccount(data.user);
});

// ---------- Session ----------
$("#sign-out").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  setMode("signin");
  showOnly(authView);
});

if (!isConfigured) {
  loading.textContent = "Supabase is not configured. Add your keys in js/supabase.js.";
} else {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    // Defer: calling Supabase inside this callback can deadlock the auth client.
    setTimeout(() => {
      if (event === "PASSWORD_RECOVERY") showOnly(resetView);
      else if (event === "SIGNED_IN" && resetView.hidden && accountView.hidden) signedIn(session.user);
    });
  });
  supabaseClient.auth.getSession().then(({ data }) => {
    if (!resetView.hidden) return;
    if (data.session) signedIn(data.session.user);
    else showOnly(authView);
  });
}
