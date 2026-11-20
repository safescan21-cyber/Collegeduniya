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
