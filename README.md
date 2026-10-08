# Viustay website

The Viustay site: a guided find-a-home flow, all-homes browsing, listing pages, viewing bookings, "List your property" for owners, and a manager dashboard with login.

- **Listings** come from a Google Sheet.
- **Bookings, requests and landlord submissions** are saved in Supabase (a free database).
- **Hosting** is free on GitHub Pages.

It runs right away in **demo mode** (sample listings, nothing saved) until you add your settings in `js/config.js`.

---

## Pages

| Page | What it does |
|---|---|
| `index.html` | Step 1: area, bedrooms, budget |
| `must-haves.html` | Step 2: must-haves with a live match count |
| `matches.html` | Step 3: filtered homes, pick up to 3 |
| `book.html` | Step 4: day, time, name, WhatsApp, which saves to `viewings` |
| `homes.html` | All homes with filters |
| `home.html?id=VS-001` | One listing, with a shareable link |
| `request.html` | "No match yet, we'll find one", which saves to `home_requests` |
| `owners.html` | Page for owners and managers |
| `list-property.html` | 3-step listing form, which saves to `property_submissions` |
| `dashboard.html` | Manager login and dashboard |
| `privacy.html` | Draft privacy notice (fill in the [BRACKETS]) |

---

## Setup (about 30 minutes, once)

### 1. GitHub: put the site online
1. Create a free account at github.com.
2. Click **New repository** and name it `viustay-website`. Set it to **Public** (free GitHub Pages needs a public repo). Click **Create**.
3. Click **uploading an existing file**, then drag in **everything inside** this folder (not the folder itself). Click **Commit changes**.
4. Go to **Settings → Pages**. Under "Branch", pick `main` and `/ (root)`, then **Save**.
5. After about a minute your site is live at `https://YOUR-USERNAME.github.io/viustay-website/`.

### 2. Google Sheet: your listings
1. Create a Google Sheet. Make row 1 exactly these column names (copy from `data/sample-listings.csv`):
   `id, status, type, bedrooms, rent, area, road, building_code, bathrooms, floor, furnished, amenities, available_from, deposit, notes, photos`
2. Fill in one row per vacant unit:
   - `id` must be unique, e.g. VS-001.
   - `status` = `available` to show the unit, anything else hides it.
   - `bedrooms`: a number (0 for a studio or bedsitter).
   - `rent`: a number.
   - `amenities`: separated by `;`, e.g. `Water 24/7;Security guard;Parking`.
   - `building_code`: matches the building in Supabase, e.g. KIL-01.
   - `photos`: image links separated by spaces. For example, upload photos to the `assets/` folder in GitHub and use `assets/photo.jpg`.
3. Click **File → Share → Publish to web**, choose your listings tab and **Comma-separated values (.csv)**, then **Publish**. Copy the link.
4. Paste it into `js/config.js` as `LISTINGS_CSV_URL`.

Changes in the sheet show on the site within about 5 minutes. Google caches the published file.

### 3. Supabase: database and logins
1. Create a free account at supabase.com, then click **New project** (region: closest to Kenya, e.g. Frankfurt or Cape Town if offered).
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
3. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `js/config.js`. The anon key is safe in a website; the security rules protect the data. **Never** put the `service_role` key in the site.
4. Open **Authentication → URL Configuration**. Set **Site URL** to your live site address, and add `https://YOUR-USERNAME.github.io/viustay-website/dashboard.html` under Redirect URLs.

### 4. Upload the changed config
Edit `js/config.js` on GitHub (open the file, click the pencil, paste, then **Commit**). The demo banner disappears and forms start saving.

---

## Daily use

**New leads.** Supabase → **Table Editor**:
- `viewings`: one row per home per booking. Rows with the same `booking_ref` are one trip. Change `status` to `confirmed` or `done`.
- `home_requests`: people asking you to find a home.
- `property_submissions`: buildings wanting to list.

**Giving a manager their dashboard** (after your visit):
1. `buildings`: add a row with `code` (same as in the sheet), `name`, `location` and `owner_email` (the email they will log in with).
2. `units`: add their units with `building_id`, `label`, `type`, `rent`, `status` and `vacant_since`. Add `listing_id` to link a unit to its sheet row.
3. `placements`: add a row when a tenant signs. Set `status` to `paid` when the fee comes in.
4. Tell the manager to open `dashboard.html`, click **Create a login** with that same email, and confirm the email.

Managers see their own units, viewing dates and fees, but **never tenant names or phone numbers**.

---

## Before launch checklist
- [ ] Fill in the fee wording in `js/config.js` (`VIEWING_FEE_TEXT`, `PLACEMENT_FEE_TEXT`, `CARETAKER_REWARD_TEXT`)
- [ ] Complete the [BRACKETS] in `privacy.html` and have it reviewed
- [ ] Check whether you need to register with the ODPC (Office of the Data Protection Commissioner) as a data controller/processor
- [ ] Replace sample listings with real ones and real photos
- [ ] Point viustay.co.ke at GitHub Pages (Settings → Pages → Custom domain)
