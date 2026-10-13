# Dhanvika: Restaurant Website

A static restaurant website (HTML, CSS, vanilla JS). The menu is loaded from
**Supabase**, reservations are saved to Supabase, and the site deploys to **Vercel**.

Pages (sections): Home, About, Menu, Gallery, Reservation, Contact (with Google Map).
Also `login.html` (customer login) and `admin.html` (owner panel).

## Project structure

```
restaurant-website/
├── index.html
├── css/style.css
├── js/
│   ├── script.js       # UI: nav, menu rendering, lightbox, reservation form
│   └── supabase.js     # Supabase client + data access (put your keys here)
├── images/             # Hero, dish and interior photos
├── supabase/schema.sql # Tables, security policies and seed menu
├── .gitignore
└── README.md
```

## 1. Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com) → **New project** (any name, e.g. `dhanvika`; choose a region near your customers and save the database password).
2. Open **SQL Editor → New query**, paste the contents of [supabase/schema.sql](supabase/schema.sql) and click **Run**. This creates:
   - `menu_items`: public read-only (hidden when `is_available` is false)
   - `reservations`: public insert-only (the public cannot read, edit or delete bookings)
   - sample menu data

   Then run [supabase/menu-update.sql](supabase/menu-update.sql) the same way to load the full menu (20 veg + 20 non-veg dishes, with the veg/non-veg flag).
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable key**.
4. Paste them into [js/supabase.js](js/supabase.js):

   ```js
   const SUPABASE_URL = "https://xxxx.supabase.co";
   const SUPABASE_KEY = "eyJ...";
   ```

   The anon key is meant to be public; Row Level Security (set up by the SQL above) controls what it can do. **Never put the `service_role` key in this project.**

### Owner login (admin page)
1. In Supabase go to **Authentication → Users → Add user → Create new user**, enter the owner's email and a password, tick **Auto Confirm User**, and create it.
2. Run [supabase/admin.sql](supabase/admin.sql) in the SQL Editor. It makes `digitalpavan61@gmail.com` an admin (edit the email at the bottom of the file for a different owner).
3. Open `/admin.html` on the site (or click **Owner login** in the footer) and sign in. There you can add, edit, hide and delete dishes and view or delete table bookings.

Only accounts listed in the `admins` table get access; the database rules enforce this, not the page.

### Customer login (login.html)
Customers sign in from **Login** in the top menu with email + password, Google or Facebook. Signed-in customers see their name in the menu and it is filled into the booking form. Customer accounts get no access to the menu editor or bookings.

- **Email + password** works out of the box. New accounts get a confirmation email first. In Supabase, **Authentication → URL Configuration → Site URL** must be the live site address (`https://restaurant-supabase-website-kappa.vercel.app`), with `https://restaurant-supabase-website-kappa.vercel.app/**` under **Redirect URLs**.
- Until Google or Facebook is switched on, their buttons show "coming soon" and point people to email.

Both use this **callback URL**: `https://bgpsvwddmjmptcqkemxl.supabase.co/auth/v1/callback`

**Google**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. `Dhanvika`).
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in app name `Dhanvika`, your email, and save. Then **Publish app**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**. Under **Authorized redirect URIs** paste the callback URL above. Click **Create** and copy the **Client ID** and **Client secret**.
4. In Supabase: **Authentication → Sign In / Providers → Google** → turn it on, paste the Client ID and secret, **Save**.

**Facebook**
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create app** → use case **Authenticate and request data from users with Facebook Login**.
2. In the app's **Facebook Login → Settings**, paste the callback URL above into **Valid OAuth Redirect URIs** and save. Make sure the **email** permission is added.
3. **App settings → Basic**: copy the **App ID** and **App secret**, and add a Privacy Policy URL (Facebook requires one). Switch the app to **Live**.
4. In Supabase: **Authentication → Sign In / Providers → Facebook** → turn it on, paste the App ID and secret, **Save**.

### Managing content
- **Menu:** edit rows in **Table Editor → menu_items**. Set `is_available` to false to hide an item; set `image_url` to a full image URL (or a path such as `images/paneer-tikka.jpg`). Prices are shown in rupees (₹); items appear in the order they were added (by `id`).
- **Reservations:** the booking form opens WhatsApp with the booking details, addressed to the restaurant's number (`WHATSAPP_NUMBER` in [js/script.js](js/script.js)); the guest presses send to book. A copy is also saved to **Table Editor → reservations** and shown on the admin page.

Until the keys are filled in, the site shows a small sample menu and a note saying so; the reservation form will not save anything.

## 2. Run locally

No build step. From this folder:

```bash
npx serve .
# or: python3 -m http.server 8000
```

then open the printed URL.

## 3. Deploy to Vercel

**Option A: Git (recommended)**
1. Push this folder to a GitHub repository.
2. At [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty (the site root is served as-is). Click **Deploy**.

**Option B: CLI**
```bash
npm i -g vercel
vercel        # preview deployment
vercel --prod # production deployment
```

Every push to the main branch redeploys automatically with Option A.

## Customising

- Name, address, phone, email, hours: edit [index.html](index.html) (hero hours and Contact section).
- Google Map: change the `q=` address in the `<iframe src>` in the Contact section.
- Colours and fonts: CSS variables at the top of [css/style.css](css/style.css).
- Photos in `images/` are stock images from [Unsplash](https://unsplash.com); replace them with your own food and venue photos before launch.
