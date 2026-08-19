# Test Credentials — Buntooz (Matchmaker model)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@buntooz.com | Admin@123 |
| Customer | customer@buntooz.com | Customer@123 |
| Provider (verified) | pro@buntooz.com | Pro@123 |

Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout
Login returns `access_token` in the body plus httpOnly cookies.

Notes:
- New providers register unverified and cannot quote until an admin verifies them
  (POST /api/admin/providers/{id}/verify).
- No Stripe / cloud storage / cron — photo uploads go to `backend/uploads` on local disk.
