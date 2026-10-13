// Supabase connection + data access.
// The anon key is designed to be public: access is restricted by the
// Row Level Security policies in supabase/schema.sql, not by hiding the key.
// Find both values in Supabase → Project Settings → API (use the publishable key, never the secret/service_role key).
const SUPABASE_URL = "https://bgpsvwddmjmptcqkemxl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PMF1KJe54lhg2d97OhGOfQ_Ua1VdA_2"; // publishable (public) key

const isConfigured =
  !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_KEY.startsWith("YOUR_");

const supabaseClient = isConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Shown only while Supabase is not configured, so the page can be previewed locally.
const SAMPLE_MENU = [
  { id: 1, name: "Paneer Tikka", category: "Starters", description: "Grilled cottage cheese with Indian spices", price: 220, image_url: "images/paneer-tikka.jpg", is_veg: true },
  { id: 2, name: "Veg Biryani", category: "Biryani & Rice", description: "Aromatic basmati rice with vegetables", price: 280, image_url: "images/veg-biryani.jpg", is_veg: true },
  { id: 3, name: "Butter Naan", category: "Breads", description: "Soft Indian bread with butter", price: 60, image_url: "images/butter-naan.jpg", is_veg: true },
  { id: 4, name: "Gulab Jamun", category: "Desserts", description: "Traditional Indian dessert", price: 120, image_url: "images/gulab-jamun.jpg", is_veg: true },
  { id: 5, name: "Chicken 65", category: "Starters", description: "Spicy deep-fried chicken with curry leaves and chilli", price: 220, image_url: null, is_veg: false },
  { id: 6, name: "Chicken Dum Biryani", category: "Biryani & Rice", description: "Hyderabadi dum biryani with tender chicken", price: 260, image_url: null, is_veg: false },
];

async function fetchMenuItems() {
  if (!isConfigured) {
    console.warn("Supabase is not configured (see js/supabase.js). Showing sample menu.");
    return { items: SAMPLE_MENU, sample: true };
  }
  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*") // includes is_veg once supabase/menu-update.sql has been run
    .eq("is_available", true)
    .order("id", { ascending: true });
  if (error) throw error;
  return { items: data, sample: false };
}

// ---------- Sign in with Google / Facebook (login.html and admin.html) ----------
// Which providers are switched on in Supabase → Authentication → Sign In / Providers.
let providersPromise;
function enabledProviders() {
  providersPromise ||= isConfigured
    ? fetch(SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: SUPABASE_KEY } })
        .then((r) => r.json()).then((s) => s.external || {}).catch(() => ({}))
    : Promise.resolve({});
  return providersPromise;
}

const PROVIDER_NAMES = { google: "Google", facebook: "Facebook", email: "Email" };

// Wires up every .social-btn[data-provider] on the page. returnTo() gives the
// address the provider sends the person back to; onError shows a message.
function setupSocialButtons(returnTo, onError) {
  document.querySelectorAll(".social-btn[data-provider]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const provider = btn.dataset.provider;
      btn.disabled = true;
      if (!(await enabledProviders())[provider]) {
        btn.disabled = false;
        onError(`${PROVIDER_NAMES[provider]} login is coming soon. Please use your email for now.`);
        return;
      }
      const { error } = await supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo: returnTo() } });
      // On success the browser leaves for Google / Facebook, so only errors land here.
      if (error) {
        btn.disabled = false;
        onError(error.message);
      }
    });
  });

  // Errors sent back by Google / Facebook (e.g. the person pressed Cancel).
  const params = new URLSearchParams(window.location.search);
  const returned = new URLSearchParams(window.location.hash.slice(1));
  const message = returned.get("error_description") || params.get("error_description");
  if (message) {
    onError(message.replace(/\+/g, " "));
    const next = params.get("next");
    history.replaceState(null, "", window.location.pathname + (next ? "?next=" + encodeURIComponent(next) : ""));
  }
}

// Customer's display name from email sign-up, Google or Facebook.
function customerName(user) {
  const m = user?.user_metadata || {};
  return m.full_name || m.name || "";
}

async function submitReservation(reservation) {
  if (!isConfigured) {
    console.warn("Supabase is not configured. Reservation was NOT saved:", reservation);
    return { saved: false };
  }
  // No .select() here: the public role may insert but not read reservations.
  const { error } = await supabaseClient.from("reservations").insert(reservation);
  if (error) throw error;
  return { saved: true };
}
