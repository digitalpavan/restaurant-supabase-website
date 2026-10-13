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

// Where Google, Facebook and email links send the customer back to.
const RETURN_URL = new URL("login.html", window.location.href).href;

function showMessage(el, text, type = "") {
  el.textContent = text;
  el.className = "form-message " + type;
}

function displayName(user) {
  const m = user.user_metadata || {};
  return m.full_name || m.name || user.email.split("@")[0];
}

function showOnly(view) {
  loading.hidden = true;
  for (const v of [authView, resetView, accountView]) v.hidden = v !== view;
}

function showAccount(user) {
  $("#account-name").textContent = displayName(user);
  $("#account-email").textContent = user.email;
  const provider = user.app_metadata?.provider;
  $("#account-provider").textContent = provider && provider !== "email"
    ? `(via ${provider[0].toUpperCase() + provider.slice(1)})` : "";
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
      options: { data: { full_name: f.full_name.value.trim() }, emailRedirectTo: RETURN_URL },
    });
  } else {
    result = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: RETURN_URL });
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
// Which providers are switched on in Supabase → Authentication → Sign In / Providers.
const providersReady = isConfigured
  ? fetch(SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: SUPABASE_KEY } })
      .then((r) => r.json()).then((s) => s.external || {}).catch(() => ({}))
  : Promise.resolve({});

document.querySelectorAll(".social-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const provider = btn.dataset.provider;
    if (!(await providersReady)[provider]) {
      btn.disabled = false;
      showMessage(authMessage, `${btn.textContent.trim().replace("Continue with ", "")} login is coming soon. Please use your email for now.`, "error");
      return;
    }
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo: RETURN_URL },
    });
    // On success the browser leaves for Google / Facebook, so only errors land here.
    if (error) {
      btn.disabled = false;
      showMessage(authMessage, friendlyError(error), "error");
    }
  });
});

// Errors sent back by Google / Facebook (e.g. the customer pressed Cancel).
const returned = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
if (returned.get("error_description")) {
  showMessage(authMessage, returned.get("error_description").replace(/\+/g, " "), "error");
  history.replaceState(null, "", window.location.pathname);
}

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
      else if (event === "SIGNED_IN" && resetView.hidden) showAccount(session.user);
    });
  });
  supabaseClient.auth.getSession().then(({ data }) => {
    if (!resetView.hidden) return;
    if (data.session) showAccount(data.session.user);
    else showOnly(authView);
  });
}
