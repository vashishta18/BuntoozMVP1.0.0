# Buntooz — PRD (Digital Matchmaker / lead-matcher marketplace)

## Original problem statement
Pivot (June 2026) from a direct service-fulfilment platform to a **lightweight digital matchmaker**: customers post a
service request (MVP: House Cleaning), independent local providers view an open lead board and quote directly.
Hard requirement: **local-first, zero proprietary lock-in** — no managed cloud services, no platform serverless
queues, 100% runnable locally (`docker compose up`). Low-cost stack, standard local file uploads.

## Architecture
- **Frontend**: React 19 + Tailwind (CRA/craco) on port 3000.
- **API**: FastAPI REST under `/api` on port 8001.
- **DB**: MongoDB (local container or local install), configured via `MONGO_URL`/`DB_NAME`.
- **Uploads**: plain local disk (`backend/uploads`), served by `GET /api/uploads/{filename}`.
- **Removed in the pivot**: Stripe payments, cloud object storage, third-party geocoding, platform cron,
  bookings/dispatch/timeline/ratings/recurring-visit models.
- Local run paths documented in `/app/README.md` + `/app/docker-compose.yml`.

## Personas
- **Customer** — posts a request, compares quotes, picks a pro and deals with them directly.
- **Local provider** — browses the free open lead board, sends quotes, unlocks contact details when accepted.
- **Admin** — verifies providers and monitors leads/quotes/matches.

## Core requirements (static)
Matchmaker only (no fulfilment, no payment processing, no commission); free open lead board; in-app quotes accepted
by the customer; contact details revealed only on match; multi-category taxonomy with House Cleaning live.

## Data model
`users` (customer/provider/admin) · `providers` (business profile, service areas, verified flag, quotes_sent,
leads_won) · `service_types` + `categories` · `requests` (the lead: service type, description, property size, date +
time window, city/postal, optional street address, budget range, photos, status open|matched|closed) ·
`quotes` (request_id, provider, price, message, available date, status pending|accepted|declined).

## Implemented (2026-06)
- JWT auth (bcrypt, httpOnly cookies + Bearer) with brute-force lockout; seeded admin/customer/provider demos.
- Landing page with live marketplace stats, category cards and typical local price ranges.
- 4-step post-a-request wizard with local-disk photo uploads.
- Customer dashboard: requests, quote counts, quote comparison, accept-and-connect, close request.
- Provider console: filtered open lead board (city + service type, contact masked), in-app quoting, my quotes with
  contact reveal on win, editable business profile.
- Admin console: marketplace stats, provider verification (grant/revoke), all-requests overview.
- Verified pytest suite at `/app/backend/tests/test_buntooz_matchmaker.py` (37 tests, all passing).

## Backlog
- P1: email/SMS notification when a new lead matches a pro's area or a quote arrives; provider category selection
  beyond house-cleaning; in-app messaging thread per quote; reviews after a match completes.
- P2: split `server.py` into routers/models/seed; pagination on leads/quotes; lockout keyed on email+IP;
  optional Postgres/Prisma variant; Handyman & Errands categories go live.
