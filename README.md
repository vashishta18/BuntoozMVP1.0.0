# Buntooz — Local-First Lead Matcher

Buntooz is a **digital matchmaker** for local services (MVP: House Cleaning). Customers post a request,
verified independent pros browse an open lead board and send quotes, and the customer accepts one quote to
exchange contact details. Buntooz never processes payments and takes no commission.

Everything runs on your machine. No SaaS accounts, no API keys, no cloud buckets, no managed queues.

---

## 1. Stack

| Layer | Tech | Port |
|-------|------|------|
| Frontend | React 19 + Tailwind + shadcn/ui (CRA via craco) | 3000 |
| API | FastAPI (Python 3.11) — REST, all routes under `/api` | 8001 |
| Database | MongoDB 7 (motor async driver) | 27017 |
| File uploads | Local disk (`backend/uploads`), served by `GET /api/uploads/{filename}` | — |
| Auth | JWT (PyJWT) + bcrypt, httpOnly cookies **and** `Authorization: Bearer` | — |

Tooling versions used in development: Python 3.11, Node 20, Yarn 1.22, MongoDB 7.

---

## 2. Run it locally

### Option A — Docker Compose (one command)

```bash
docker compose up --build
# Frontend  → http://localhost:3000
# API       → http://localhost:8001/api
# API docs  → http://localhost:8001/docs
```

Compose starts Mongo, the API (with `--reload`) and the React dev server. Source folders are bind-mounted,
so edits hot-reload inside the containers.

### Option B — run each piece yourself

```bash
# 1) MongoDB
docker run -d -p 27017:27017 --name buntooz-mongo mongo:7
#    (or use a local install / `brew services start mongodb-community`)

# 2) API
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # then edit JWT_SECRET
uvicorn server:app --reload --port 8001

# 3) Frontend (new terminal)
cd frontend
yarn install
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env
yarn start
```

On first API start the database is **seeded automatically** (categories, service types, demo accounts,
three verified Tampa-area directory pros). Seeding is idempotent — restart as often as you like.

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@buntooz.com | Admin@123 |
| Customer | customer@buntooz.com | Customer@123 |
| Provider (verified) | pro@buntooz.com | Pro@123 |

Newly registered providers start **unverified** and cannot quote until an admin verifies them at `/admin`.

---

## 3. Environment variables

`backend/.env` (see `backend/.env.example`):

| Key | Purpose |
|-----|---------|
| `MONGO_URL` | Mongo connection string, e.g. `mongodb://localhost:27017` |
| `DB_NAME` | Database name |
| `CORS_ORIGINS` | Allowed origins (`*` in dev) |
| `JWT_SECRET` | **Change this.** Signing key for access/refresh tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin account; the password is re-synced on every boot |
| `UPLOAD_DIR` | Upload folder, relative to `backend/` (default `uploads`) |

`frontend/.env`:

| Key | Purpose |
|-----|---------|
| `REACT_APP_BACKEND_URL` | API origin. The frontend appends `/api` itself — never hardcode URLs in components |

---

## 4. Project layout

```
backend/
  server.py             # the whole API: models, auth, routes, seed data
  requirements.txt
  .env / .env.example
  uploads/              # user-uploaded images (gitignore in real deployments)
  tests/
    test_buntooz_matchmaker.py
frontend/
  src/
    App.js              # routes + role-protected route wrapper
    index.css           # design tokens (Electric Navy + Vivid Mint), utility classes
    lib/api.js          # axios instance, API base, apiError(), money()
    context/AuthContext.jsx
    components/
      Nav.jsx  StatusBadge.jsx  PriceEstimator.jsx  RecommendedPros.jsx
      ui/               # shadcn primitives
    pages/
      Landing.jsx  PostRequest.jsx  Login.jsx  Register.jsx
      CustomerDashboard.jsx  ProviderDashboard.jsx  AdminDashboard.jsx
docker-compose.yml
README.md
```

---

## 5. Data model (MongoDB collections)

| Collection | Shape |
|------------|-------|
| `users` | `email`, `password_hash`, `name`, `role` (`customer`\|`provider`\|`admin`), `phone` |
| `providers` | `user_id` (null for directory-only pros), `business_name`, `city`, `service_areas[]`, `skills[]`, `bio`, `years_experience`, `rating`, `jobs_completed`, `avatar`, `verified`, `quotes_sent`, `leads_won` |
| `categories` | `slug`, `name`, `tagline`, `status` (`live`\|`soon`), `icon`, `position` |
| `service_types` | `category_slug`, `slug`, `name`, `description`, `typical_duration`, `typical_range`, `image` |
| `requests` | the lead: `customer_id`, contact fields, `service_type`, `description`, `property_size`, `preferred_date`, `time_window`, `city`, `postal_code`, `address_line1`, `budget_min/max`, `photos[]`, `status` (`open`\|`matched`\|`closed`), `quotes_count`, `accepted_quote_id`, `matched_provider_*`, `notify` |
| `quotes` | `request_id`, `provider_id`, `provider_*` snapshot, `price`, `message`, `available_date`, `status` (`pending`\|`accepted`\|`declined`) |
| `invites` | priority pings: `request_id` + `provider_id` (unique together) |
| `login_attempts` | brute-force counter keyed on `login:{email}` |

**Privacy rule that drives most of the code:** on the lead board a request is returned through
`mask_request(doc, reveal=False)`, which strips `contact_phone`, `contact_email` and `address_line1` and sets
`contact_locked: true`. Those fields unlock for exactly one provider — the one whose quote is accepted.

---

## 6. API reference

```
Auth
  POST   /api/auth/register            {email,password,name,role,phone}
  POST   /api/auth/login               → user + access_token (+ httpOnly cookies)
  GET    /api/auth/me
  POST   /api/auth/logout

Catalog / public
  GET    /api/categories
  GET    /api/service-types?category=house-cleaning
  GET    /api/stats                    open_leads, quotes_sent, verified_pros, matches_made

Customer
  POST   /api/requests
  GET    /api/requests                 own requests (all, for admin)
  GET    /api/requests/{id}
  POST   /api/requests/{id}/close
  GET    /api/requests/{id}/quotes
  GET    /api/requests/{id}/recommended-pros
  POST   /api/requests/{id}/invite     {provider_id}
  PUT    /api/requests/{id}/notifications  {email,sms}
  POST   /api/quotes/{id}/accept       → match; contact details exchanged

Provider
  GET    /api/leads?city=&service_type=    invited leads sort first
  POST   /api/requests/{id}/quotes         {price,message,available_date}  (verified only)
  GET    /api/provider/quotes
  GET    /api/provider/me   ·  PUT /api/provider/me

Admin
  GET    /api/admin/providers
  POST   /api/admin/providers/{id}/verify?verified=true|false

Uploads
  POST   /api/uploads          multipart `file` (auth required, images ≤ 8MB)
  GET    /api/uploads/{name}   public so <img> tags work
```

Interactive docs while the API runs: <http://localhost:8001/docs>.

### Quick smoke test with curl

```bash
API=http://localhost:8001
TOKEN=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"customer@buntooz.com","password":"Customer@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -s -X POST $API/api/requests -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "service_type":"deep-clean","description":"Two bed flat, deep clean before guests.",
  "property_size":"2 bedrooms","preferred_date":"2026-07-02","time_window":"Morning",
  "city":"Tampa","postal_code":"33610"}'
```

---

## 7. Tests

```bash
cd backend
pytest tests/ -q          # full suite
pytest tests/ -q -k quote # single area
```

The suite talks to a running API + Mongo, so start those first. `pytest.ini` runs 2 xdist workers with
`--dist loadscope`; use `-n 0` if you need strictly serial execution while debugging.

Frontend has no unit tests yet — `yarn test` is wired to craco if you want to add them.

---

## 8. Conventions worth following

- **Backend**: every route lives under the `/api` prefix (`api = APIRouter(prefix="/api")`). Validate input with
  Pydantic models, guard access with `Depends(require_role(...))`, and always stringify `_id` before returning
  a document (`mask_request`, or `Model.from_mongo`). Timestamps are ISO strings in UTC (`now_iso()`).
- **Frontend**: call the API only through `lib/api.js` (`api.get/post/...`); it injects the token and base URL.
  Surface errors with `apiError(err.response?.data?.detail)` so FastAPI validation arrays render as text.
- **Test IDs**: every interactive element carries a `data-testid` in kebab-case, suffixed with the entity id
  where a list is involved (`invite-btn-{providerId}`, `accept-quote-btn-{quoteId}`). Keep this up — the tests
  and any browser automation depend on it.
- **Styling**: design tokens and helper classes (`glass`, `btn-mint`, `card-lift`, `rise`, `mint-text`) live in
  `src/index.css`. Prefer them over new one-off CSS. Fonts: Bricolage Grotesque (headings) + Karla (body).
- **No new managed dependencies.** If a feature seems to need a third-party service, implement it locally
  (local disk, a DB collection, an in-process job) or make it opt-in via env vars.

### Adding a new service category

1. Add the category to `SEED_CATEGORIES` and its service types to `SEED_SERVICE_TYPES` in `server.py`
   (set `status: "live"`).
2. Restart the API — the upsert-based seed picks it up.
3. Give providers the matching `skills` entry (they're filtered by `skills` on the lead board).

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Not authenticated` in the browser | Token missing/expired — sign in again; check `REACT_APP_BACKEND_URL` matches the API origin |
| `429 Too many failed attempts` | Brute-force lock (5 bad logins / 15 min). Clear it: `mongosh <db> --eval 'db.login_attempts.deleteMany({})'` |
| Provider gets `403 awaiting verification` | Verify them from `/admin` (or `POST /api/admin/providers/{id}/verify`) |
| Lead board is empty | Requests must be `open` and match the provider's `skills`; check the city filter |
| Uploaded image 404s | Confirm `UPLOAD_DIR` and that `backend/uploads/` is writable and persisted (a volume in Docker) |
| Ports already in use | Change the host side of the port mappings in `docker-compose.yml` |

---

## 10. Where to take it next

- Real notifications (the `notify` preference on each request is stored but nothing sends yet).
- Public provider profile pages; in-app messaging per quote; reviews after a match.
- Split `server.py` into `routers/`, `models/`, `seed.py` once it outgrows one file.
- Pagination on `/api/leads` and `/api/requests`; brute-force lockout keyed on email **+** IP.
- Bring Handyman and Errands categories live.
