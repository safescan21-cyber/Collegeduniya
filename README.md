# StudyEarnstay.com 🎓💼🏠

**Study · Earn · Stay** — a college discovery platform (like Collegedunia) where students can:

- 🔎 Search **colleges worldwide**: courses, fees, ranking, facilities, gallery, student reviews
- 🏠 Find **PG / hostels** near their college (rent, gender, amenities, WhatsApp / call owner)
- 💼 Apply to **part-time jobs & internships** near campus (with resume upload)
- 📍 **Near me**: colleges, PGs and jobs within X km using browser location
- 🔐 **Login / register with email OTP** (no password)
- ⭐ Logged-in students **review colleges**; admins can **edit, block, approve or delete** reviews
- 🛡️ **Multi-admin panel**: colleges (+ courses + nearby companies/hospitals), hostels, jobs, applications, reviews, users
- 📈 **Visitor analytics**: visitors today, unique visitors (30 days), page views, signups, daily chart, top pages

**Added in v4 (all colleges + admin visibility)**

- **Show / hide per college** — Admin → Colleges → open a college → *Show / hide*: switch off any field (fees, phone & email, website, address, map, ranking, accreditation, year, students, about, logo, photos) or any page section (courses, placements, cutoffs, reviews, Q&A, PGs, jobs, nearby, gallery, apply, enquiry). Hidden data is removed at database level (`colleges_public` view + row-level security), so it never reaches visitors, search, compare or the AI chat.
- **Hide / show the whole college**, feature it, or delete it — one click in the editor, or in bulk by ticking many colleges in the list.
- **Full college editor** with tabs: Details · Show/hide · Courses & fees · Placements · Cutoffs · Nearby places. Every field has an eye icon to hide it right where you edit it.
- **All colleges**: spreadsheet importer (AISHE / any CSV or XLSX, auto column matching), U.S. College Scorecard importer with tuition, plus the worldwide Hipolabs + Wikidata importer. Re-imports refresh data without overwriting your team's edits.

**Added in v3 (worldwide)**

| Area | Feature | Data source |
|---|---|---|
| 🌍 Every city | Autocomplete for any city/town, `/city/<slug>` pages (colleges, PGs, jobs, hospitals), `/cities` by country | GeoNames (CC BY 4.0) + OpenStreetMap Nominatim |
| 🎓 College data | Bulk import of 10,000+ universities with website, location, founding year, logo, photo, students | Hipolabs university list + Wikidata |
| 💼 Local jobs | Live part-time jobs for each college's city (cached per city) | Adzuna + Jooble APIs (free keys) |
| 🏥 Nearby | Hospitals (with 24×7 ER), pharmacies, hostels, railway, buses, banks, food around every college, PG and city | OpenStreetMap Overpass |
| 🗣️ Languages | 39 languages (RTL for Arabic/Urdu/Persian/Hebrew), auto-detect from browser, "Translate" button on descriptions & reviews | Google Cloud Translation v2 or LibreTranslate, cached forever |
| 🏠 PG owner login | Register as PG owner → `/owner`: properties, room types, **free beds +/-** (live, no re-approval), enquiries, reviews | — |
| 🏢 Company login | Register as employer → `/employer`: company profile (verified badge), post jobs, applicants, CV download; public `/companies/<slug>` | — |

**Added in v2 (growth features)**

| Area | Feature |
|---|---|
| Decide | ⚖️ Compare up to 4 colleges side by side · ❤️ Shortlist colleges, PGs and jobs · 🎯 College predictor from rank + category (uses last year's closing ranks) · 💷 Study-abroad cost, loan EMI & payback calculator |
| Apply | 📝 One common application sent to many partner colleges · 📞 "Free counselling" + "Enquire" lead forms on every college/PG page (admin Leads inbox + CSV export) |
| Trust | ✅ Verified college reviews (student uploads ID/fee receipt) with optional reward (set `NEXT_PUBLIC_REVIEW_REWARD`) · ⭐ PG/hostel reviews (food, safety, cleanliness) |
| Content & SEO | 📰 News & guides (Markdown) · 📚 Exam pages · 💬 Q&A with expert answers · 📊 Placements and cutoffs on college pages · sitemap + schema.org (QAPage, NewsArticle, JobPosting) |
| Supply | 🏠 PG owners and 💼 employers post listings themselves → admin approves → employers manage their own applicants |
| Reach | 🤖 AI assistant answering from your own database (`ANTHROPIC_API_KEY`, falls back to links) · 📧 Newsletter signup · 📱 Installable app (PWA) · 🇮🇳 Hindi / English switch |

## Tech stack

| Part | Tech | Folder |
|---|---|---|
| Front-end | Next.js 16 (App Router, TypeScript, Tailwind CSS v4) | `web/` |
| Database / Auth / Storage | Supabase (Postgres + RLS, email OTP, storage buckets) | `supabase/` |
| Backend API | Node.js + Express (admin CRUD, image uploads, visitor tracking & stats) | `server/` |

```
Browser ──► Next.js (web) ──► Supabase  (public reads, OTP login, reviews, job applications — protected by RLS)
              │
              └──► Node API (server) ──► Supabase service role  (admin actions, uploads, analytics)
```

---

## 1. Supabase setup (10 minutes)

1. Create a project at <https://supabase.com>.
2. **SQL Editor** → paste and run `supabase/schema.sql` (tables, security rules, storage buckets, nearby search).
3. (Optional) run `supabase/seed.sql` for demo colleges, hostels and jobs. **All seed fees/rents/jobs are sample data — edit or delete before launch.**
4. Run **`supabase/migrations/002_growth.sql`** (shortlist, leads, PG reviews, owner/employer listings, Q&A, news, exams, newsletter, placements, cutoffs, predictor, common application).
   Optional: `supabase/migrations/002_seed_demo.sql` adds sample exams, cutoffs, placements and one article so you can try the predictor and compare pages.
5. Run **`supabase/migrations/003_global.sql`** (world cities, translation cache, PG owner / employer accounts, companies, room availability, API caches).
6. Load worldwide data from the `server/` folder (needs `server/.env`):
   ```bash
   npm run import:cities                    # ~25k cities (pop > 15k) + all countries — or: -- cities500 for ~185k towns
   npm run import:universities -- IN GB US  # colleges from Hipolabs + Wikidata (or --all for every country)
   ```
   Or use **Admin → Import & APIs** to preview/import one country at a time.
7. Run **`supabase/migrations/004_visibility_import.sql`** (per-college show/hide + import fields).
8. Run **`supabase/migrations/005_wiki_enrich.sql`** (Wikipedia text + Wikimedia Commons photos with credits).
9. Run **`supabase/migrations/006_management_quota.sql`** (management / NRI quota seats + student applications).
8. Load full college lists:
   ```bash
   npm run import:sheet -- ./All_Colleges.xlsx IN aishe   # India: official AISHE "All Colleges" list (~48k colleges)
   npm run import:us                                      # USA: College Scorecard, real tuition (COLLEGE_SCORECARD_API_KEY)
   npm run enrich -- IN --limit 500                       # free About text, logo & real campus photos (Wikipedia/Commons)
   npm run import:universities -- --all                   # rest of the world: Hipolabs + Wikidata
   ```
   The AISHE sheet can also be uploaded in **Admin → Import & APIs → Import a college list** (column matching is shown before import).
4. **Authentication → Providers → Email**: enable Email, keep "Confirm email" ON.
5. **Authentication → Email Templates → Magic Link** — replace the body so it sends a **code** instead of a link:

   ```html
   <h2>Your StudyEarnstay login code</h2>
   <p>Enter this code to continue:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>This code expires in 1 hour. If you didn't request it, ignore this email.</p>
   ```
   Do the same for the **Confirm signup** template (new users get that one first).
6. **Authentication → URL Configuration**: Site URL = `https://studyearnstay.com`.
7. For production email, set up **custom SMTP** (Authentication → SMTP Settings — e.g. Resend, Brevo, Zoho, Amazon SES). Supabase's built-in mailer is limited to a few emails per hour.
8. **Project Settings → API**: copy the Project URL, `anon` key and `service_role` key.

### Make yourself super admin
Log in once on the website with your email, then in SQL Editor:
```sql
update public.profiles set role = 'super_admin' where email = 'your@email.com';
```
After that, add more admins from **Admin → Users & Admins** (no SQL needed).

---

## 2. Run locally

```bash
# Backend API
cd server
cp .env.example .env        # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev                 # http://localhost:4000/api/health

# Website (new terminal)
cd web
cp .env.example .env.local  # fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
npm install
npm run dev                 # http://localhost:3000
```

> 🔒 The `service_role` key goes **only** in `server/.env`. Never put it in `web/`.

Optional settings:

| File | Variable | What it does |
|---|---|---|
| `server/.env` | `ANTHROPIC_API_KEY` | Turns on AI answers in the "Ask StudyEarnstay" chat. Without it the chat replies with matching links. |
| `server/.env` | `ANTHROPIC_MODEL` | Model for the chat (default `claude-haiku-5-5`). |
| `server/.env` | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Live local jobs (free key: developer.adzuna.com). |
| `server/.env` | `JOOBLE_API_KEY` | More countries for live jobs (free key: jooble.org/api/about; limited calls — results are cached 12 h per city). |
| `server/.env` | `GOOGLE_TRANSLATE_API_KEY` *or* `LIBRETRANSLATE_URL` | Turns on the 37 machine-translated languages. Without it the site offers English + Hindi. |
| `web/.env.local` | `API_URL_INTERNAL` | Node API address used by the Next.js server (e.g. `http://127.0.0.1:4000` on the VPS). |
| `web/.env.local` | `NEXT_PUBLIC_REVIEW_REWARD` | e.g. `₹100 Amazon voucher` — shows the "earn a reward for a verified review" banner. Leave empty to hide it. |

---

## 3. Pages

| URL | What |
|---|---|
| `/` | Hero search (colleges / PG / jobs), live counters, top colleges, countries, streams, hostels, jobs |
| `/colleges` | Filters: search, country, city, stream, course level, ownership, max fees, sort; pagination |
| `/colleges/[slug]` | Overview, courses & fees, reviews (write/edit), nearby PG & jobs, nearby companies & hospitals, gallery, SEO schema |
| `/hostels`, `/hostels/[id]` | PG / hostel search and detail (call / WhatsApp owner) |
| `/jobs`, `/jobs/[id]` | Job search and detail with **Apply** form + resume upload |
| `/near-me` | Geolocation search (5–100 km) |
| `/login` | Login / Register tabs → email → OTP code |
| `/dashboard` | My applications (status, withdraw), my reviews, profile |
| `/admin` | Visitor & signup stats, 30-day chart, top pages |
| `/admin/colleges` | Add / edit colleges with photo upload → courses & nearby places per college |
| `/admin/hostels`, `/admin/jobs` | Manage stays and jobs |
| `/admin/applications` | Change status (pending / shortlisted / hired / rejected), download CV |
| `/admin/reviews` | Approve, block, edit, delete reviews |
| `/admin/users` | Block / unblock students; super admin promotes admins |
| `/compare`, `/predictor`, `/apply`, `/study-abroad/calculator` | Decision tools |
| `/exams`, `/news`, `/questions`, `/counselling` | Content, Q&A and lead capture |
| `/post` | PG owners / employers submit listings (reviewed by admin) |
| `/admin/leads`, `/admin/college-applications` | Call-back requests and common applications (status, notes, CSV) |
| `/admin/qa`, `/admin/hostel-reviews`, `/admin/articles`, `/admin/exams`, `/admin/newsletter` | Moderation and content |
| `/admin/colleges/[id]` | Courses, **placements**, **cutoffs** (feed the predictor) and nearby places |

## 4. Roles & security

- **student** — review colleges (one per college), apply to jobs, edit own profile.
- **admin** — manage all content, moderate reviews, view applications, block students.
- **super_admin** — everything + make/remove admins.

Enforced in the database with Row Level Security and triggers (a student cannot change their own role, unblock themselves, or change an application's status), and again in the Node API (`requireAdmin`, `requireSuperAdmin`). Resumes are in a **private** bucket; admins get a 5-minute signed link.

## 5. Node API endpoints (`server/`)

All `/api/admin/*` routes need `Authorization: Bearer <supabase access token>` from an admin.

```
GET  /api/health
POST /api/track                         visitor page-view (rate-limited, bots skipped)
GET  /api/admin/stats
POST /api/admin/upload                  multipart images → public "media" bucket
GET|POST /api/admin/{colleges|courses|places|hostels|jobs}
GET|PATCH|DELETE /api/admin/{resource}/:id
GET|PATCH|DELETE /api/admin/reviews[/:id]
GET|PATCH /api/admin/applications[/:id]     GET /api/admin/applications/:id/resume
GET|PATCH /api/admin/users[/:id]
```

---

## 5b. College details & photos (free — Wikidata, Wikipedia, Wikimedia Commons)

No API key needed. For each college the API:

1. **Finds it on Wikidata.** It uses the saved Wikidata ID, or searches by name and scores the results on type, country, website domain and name. It never matches on country alone.
2. **Takes facts from Wikidata:** year founded, website, map location, student count, logo (P154), main image (P18) and Commons category (P373).
3. **Gets the About text** from the Wikipedia summary. This text is CC BY-SA, so the college page shows a "Text from Wikipedia" credit with a link back to the article.
4. **Collects campus photos** from Wikimedia Commons (category + main image, JPEG/PNG only, ≥600 px). Logos, maps and seals are filtered out. Each photo keeps its **author + licence + source link** in `colleges.photo_credits`. The gallery, lightbox and cover photo show that credit, which the CC licences require.

**Using it:**

- **One college:** Admin → Colleges → open a college → **Wikipedia & photos** tab → *Find details & photos*.
  - Tick the fields and photos you want; the first ticked photo becomes the cover. Then press Save.
  - If the wrong college was matched, paste the correct Q-number.
- **Many at once:** Admin → Import & APIs → *Fill details & real photos*, or `npm run enrich -- IN --limit 500`.
  - This runs only for colleges without a cover photo that haven't been checked yet.
  - It only fills empty fields.
- **Speed:** Wikimedia rate-limits anonymous use, so it runs at about 5–10 s per college.
  - A free personal token in `WIKIMEDIA_ACCESS_TOKEN` (from api.wikimedia.org) raises the limit.
  - Set `HTTP_USER_AGENT` to your real contact email.
- **Coverage:** big universities almost always have photos. Many small affiliated colleges have no Wikipedia page, so for those, upload photos in the Details tab or ask the college/PG owner.
- **Hiding:** hiding "Photos" in Show/hide also hides the credits.

Google Places photos are **not** free (billed per request and they must not be stored), so they are not used.

## 5c. Management quota admissions

**Admin side:**
- Post seats in **Admin → Management quota**, or open a college and use its **Management quota** tab.
- Each seat has: course, quota type (Management / NRI / NRI Sponsored / Institutional / Foreign National), session, total and available seats, official fee per year, total fee, fee details, eligibility, minimum %, exams accepted, documents required and last date.
- Seats become unavailable to applicants automatically when the status is *closed* or *filled*, seats available is 0, or the last date has passed.

**Student side:**
- Students browse **/management-quota** (filters for level, quota, state, city; sort by fee or closing date) or the *Management quota* section on a college page.
- They apply after OTP login, with marks and documents (PDF/JPG, up to 6 × 5 MB).
- Documents go to the private `resumes` bucket under `<user_id>/`, so only the student and admins can open them. The database rejects paths outside the student's own folder.
- Students track progress in **Dashboard → College applications** and can withdraw while the status is *submitted*, *under review* or *contacted*.

**Tracking applications:**
- Applications arrive in **Admin → Quota applications**.
- Status flow: submitted → under review → contacted → shortlisted → offered → admitted, or rejected.
- Admins can add a note (the student sees it), download documents through 5-minute signed links, and export to CSV.

**Rules built in:**
- Students can only withdraw; they can't change their own status or note.
- Hiding the *Management quota seats* section of a college hides its seats and blocks new applications.
- Hiding *fees* hides the quota fee too.

**Fee wording:** every page states that applying is free, that fees are paid only to the college against an official receipt, and that no donation or capitation money is taken. Several Indian states ban capitation fees, so keep listings to official fees only.

## 6. Deploy on your own VPS (Ubuntu + Nginx + PM2)

```bash
# on the server
git clone https://github.com/safescan21-cyber/Collegeduniya.git /var/www/studyearnstay
cd /var/www/studyearnstay

cd server && npm ci --omit=dev && cp .env.example .env && nano .env
pm2 start src/index.js --name ses-api

cd ../web && npm ci && cp .env.example .env.local && nano .env.local   # NEXT_PUBLIC_API_URL=https://studyearnstay.com
npm run build
pm2 start npm --name ses-web -- start
pm2 save && pm2 startup
```

`/etc/nginx/sites-available/studyearnstay`:
```nginx
server {
  server_name studyearnstay.com www.studyearnstay.com;
  client_max_body_size 20M;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/studyearnstay /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d studyearnstay.com -d www.studyearnstay.com
```
With Nginx serving both on one domain, set `NEXT_PUBLIC_API_URL=https://studyearnstay.com` and `CORS_ORIGIN=https://studyearnstay.com,https://www.studyearnstay.com`.

Point the domain's DNS **A records** (`@` and `www`) to the VPS IP.

Alternative: front-end on Vercel, API on the VPS or Render — just set the two URLs accordingly.
