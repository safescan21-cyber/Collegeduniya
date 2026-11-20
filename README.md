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
10. Run **`supabase/migrations/007_quota_global.sql`** (direct admission & quota seats for every country, any currency).
11. Run **`supabase/migrations/008_cities_languages.sql`** (districts + city names in every language + multilingual city search).
12. Run **`supabase/migrations/009_security_hardening.sql`** (visitors can read only safe columns; fixed function search paths).
13. Run **`supabase/migrations/010_roadmap.sql`** then **`010_seed_exams.sql`** (rankings, marks→rank, verified PG & visits, senior connect, roommates, messages, recommender, scholarships, visa guides, payments, lead partners).
14. Run **`supabase/migrations/011_growth2.sql`** (top-college pages, job alerts, resumes, exam library, percentile → rank, rewards, referrals & ambassadors, salary trends).
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

**Worldwide (migration 007):**
- **Admission routes:** India's Management / NRI / Institutional quota, plus International, Direct admission, Self-financed, Private / fee-paying and Scholarship seats for any country.
- **Seat fields:** intake (e.g. "September 2027"), fee period (year / semester / term / month / total), English requirement (IELTS/TOEFL/PTE), scholarship note, and *who can apply* (all / domestic / international).
- **Currency:** leave it blank and it is taken from the college, then the college's country (`countries.currency_code`), then USD.
- **Converted fees:** visitors also see an approximate fee in their own currency. It is guessed from the browser locale and they can change it. The API serves it at `GET /api/fx?base=GBP`, using free daily rates from open.er-api.com, cached for 12 hours. Set a different source with `FX_API_URL`.
- **Browsing:** `/management-quota` has country chips with seat counts, plus continent, country, region, city, level, admission-route and "open to international students" filters.
  - `?country=GB` pages are indexed and listed in the sitemap.
- **Application form:** it adapts to the seat's country.
  - India: reservation category.
  - Everywhere else: nationality, English test and score, and "needs a student visa".
  - It also records the site language the student used, so counsellors can reply in it.
- **Languages:** all page text, the form and the "how it works" steps are in the site dictionary, so they appear in all 39 languages. Eligibility, fee details, English requirement, scholarship and description have a *Translate* button.

**Fee wording:** every page states that applying is free, that fees are paid only to the college against an official receipt, and that no donation or capitation money is taken. Several Indian states ban capitation fees, so keep listings to official fees only.

## 5d. Every language, every city, every Indian college

**Languages (133).**
- Every language Google Translate supports is in the picker. You can search it by native or English name ("German", "தமிழ்").
- English and Hindi are hand-written. The other languages are machine-translated once and cached in `translations`.
  - Set `GOOGLE_TRANSLATE_API_KEY` (500K characters/month free).
  - Or set `LIBRETRANSLATE_URL`. Languages LibreTranslate lacks fall back to English.
- Right-to-left scripts (Arabic, Urdu, Persian, Pashto, Sindhi, Sorani, Hebrew, Yiddish, Uyghur, Dhivehi) flip the layout automatically.
- Any page accepts **`?hl=<code>`**, e.g. `/colleges?hl=ta`. It switches the language and remembers it, so links can be shared per language.
- Every public page carries `hreflang` tags for all 133 languages, so Google can index each version.

**Every city, town and village (GeoNames, CC BY 4.0):**
```bash
cd server
npm run import:cities -- cities15000 --names     # world: 33k cities + local names (start here)
npm run import:cities -- IN --names              # ALL of India: every city, town & village (~500k+) + Hindi/Tamil/Bengali… names
npm run import:cities -- IN,NP,BD,LK --names     # several countries
npm run import:cities -- IN --min-pop 1          # only places with a known population
```
- **Existing URLs:** `/city/...` URLs never change on re-import. The biggest place keeps the plain slug, e.g. `pune-maharashtra-in`; same-named villages get an id suffix.
- **Districts** are stored. AISHE colleges that list only a district are placed in the district HQ.
- **Local names:** city search works in any script ("पुण", "புனே" → Pune), and city pages show the local name in the visitor's language.
- **Size:** all of India is roughly 150–250 MB in Postgres (places + names). The Supabase free plan has 500 MB, so use Pro or your own Postgres for several large countries.

**Every Indian college, university and standalone institution (AISHE, Ministry of Education):**
1. Download *All Universities*, *All Colleges* and *All Standalone Institutions* (Excel) from https://dashboard.aishe.gov.in/hedirectory/. The same files are on aikosh.indiaai.gov.in as "All … as per AISHE Dashboard".
2. Put the three files in one folder and run:
```bash
npm run import:india -- ./aishe/ --dry   # check the column mapping
npm run import:india -- ./aishe/         # ~65,000 institutions
```
- The importer detects which list each file is. It stores the institution kind (University / College / Standalone institution), the AISHE category, Urban/Rural and management type. It also links each record to its town.
- Re-running refreshes rows by AISHE code and never overwrites colleges your team edited.
- The colleges page has an **Institution** filter, and college pages show the kind and category.

**Sitemaps:**
- `robots.txt` lists `/sitemap/0.xml` (pages, PGs, jobs, exams, news, Q&A, quota seats).
- Then one file per 40,000 colleges, and one per 40,000 cities with population ≥ `SITEMAP_CITY_MIN_POP` (default 1000).

## 5e. Roadmap features (migration 010)

| Feature | Where | You add the data |
|---|---|---|
| **Official cutoffs** | Admin → Import & APIs → *Official cutoffs & rankings*, or `npm run import:cutoffs -- file.xlsx jee-main 2026 "Round 6"` | JoSAA / MCC / state counselling opening–closing rank tables (Institute, Program, Quota AI/HS/OS, Seat Type, Gender, Opening, Closing). Unmatched institute names are listed. |
| **NIRF rankings** | same card, or `npm run import:rankings -- nirf-2025-engineering.csv 2025 Engineering` | NIRF table (Name, City, State, Score, Rank). Also updates `colleges.ranking` for sorting. |
| **Exam predictor pages** | `/predictor/<exam>` (e.g. `/predictor/jee-main`) | Each exam gets an SEO page with home-state quota, category, a “hardest to get” table and an FAQ. 22 official exams are seeded (names, conducting bodies and official sites only; add dates from the official notices). |
| **Marks → rank** | Admin → Marks → rank | Bands from official result statistics (marks range → rank range + source). |
| **Verified PG** | Admin → PG & Hostels (verify after a physical check + note); owners add video, 360° tour, safety, deposit, notice period, lock-in, house rules, visit times | An owner's edit removes the badge until it is re-checked. |
| **Visit booking** | “Book a visit” on every PG page; owners confirm in the Owner portal; students track and cancel in the Dashboard | — |
| **Senior connect** | “Talk to students” on college pages, `/messages`; Admin → Community verifies members | Members show only their first name. People can be messaged only if they opted in. Users can block or report; there are rate limits. |
| **Roommate finder** | `/roommates` | Posts expire after 60 days. |
| **Recommender** | `/recommend`. The chatbot also uses it when a student mentions a rank, budget or state. | Ranks colleges by your chance (cutoffs), NIRF, ratings, budget, state and distance, with the reasons shown. |
| **Career quiz** | `/career-quiz` | RIASEC interest quiz → courses → colleges. |
| **Scholarships / visa guides** | `/scholarships`, `/study-abroad/visa`; Admin → Scholarships / Visa guides | An official URL is required for each. The calculator has “Use today's rate”. |
| **Android app** | `android/README.md` (Bubblewrap TWA) + `/.well-known/assetlinks.json` | Set `ANDROID_PACKAGE_NAME` + `ANDROID_SHA256_CERT_FINGERPRINTS` in web env. |
| **Boost (paid)** | “Boost” button in the Owner/Employer portals. Listings appear first with a **Sponsored** label. | Set the `RAZORPAY_*` keys and add the webhook `https://<api>/api/payments/razorpay/webhook` (event `order.paid`). Prices are set on the server (`BOOST_PRICES`). |
| **Lead partners** | Admin → Lead partners (price per lead, auto-share, monthly amount due); Leads → *Send to college* | Leads are shared only if the student ticked the consent box. Email needs `SMTP_URL`. |

## 5f. Growth features (migration 011)

| Feature | Where | You add the data |
|---|---|---|
| **Top colleges pages** | `/top`, `/top/engineering`, `/top/engineering/pune`, `/top/engineering/maharashtra`, `/top/engineering/in` | Nothing. Pages are generated for every stream × city/state/country with at least 3 published colleges, ranked by official ranking. They include ItemList, FAQ and breadcrumb JSON-LD and are added to `sitemap/0.xml`. |
| **Job alerts** | “Email me new jobs like these” on `/jobs`; Dashboard → Job alerts | The API checks hourly and sends daily or weekly. Needs `SMTP_URL`. WhatsApp is optional: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` (an approved Meta template with one body variable); without these it falls back to email. Test with `POST /api/admin/job-alerts/run?dry=1`. Turn off with `JOB_ALERTS=off`. |
| **Resume builder** | `/resume` (Download PDF = print → Save as PDF). The apply form ticks “Attach my StudyEarnstay resume”. Employers and admins open it at `/resume/view?app=…` | — |
| **Student filters** | `/jobs` → Work mode (work from home) and “Hours per week ≤ 20 (student-visa friendly)” | — |
| **Exam library** | `/papers`, plus a section on each exam page; Admin → Exam library (PDF upload up to 20 MB) | Only documents the exam body or board has published publicly, each with the official source URL. CBSE 10/12 and ICSE/ISC are added as exams. |
| **Percentile → rank** | `/predictor/<exam>` (e.g. JEE Main, CAT) | Admin → Exam library → *Candidate counts*: the official number of candidates and its source. The tool stays hidden until this is filled in. |
| **Rewards** | `/rewards`; Admin → Rewards | Automatic points: 50 per verified review, 10 per college or quota application, 20 per referral. Add catalog items (voucher title + points). Fulfil a request by typing the voucher code and setting *fulfilled*; *rejected* refunds the points. |
| **Referrals & ambassadors** | Any link with `?ref=CODE`; `/ambassador` (apply, stats, 30-day leaderboard); Admin → Ambassadors | Referral points stay *pending* until the friend applies somewhere or reviews. A referral can only be claimed within 7 days of joining, and a student can't refer themselves. |
| **Salary trends** | `/trends` | Uses the placement data you add to colleges: median by year, growth, and the top colleges by median package. |

Also fixed in 011: admin actions made through the API (verifying a review, marking an answer official, changing a job-application status) were being silently undone by database guards. Visa-guide and lead-partner rows can now be edited and deleted from the admin pages.

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
