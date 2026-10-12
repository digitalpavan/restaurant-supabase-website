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
