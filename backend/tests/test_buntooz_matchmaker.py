"""Buntooz Matchmaker backend tests — covers auth, catalog, requests, quotes, uploads, admin."""
import io
import os
import time
import uuid

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://task-dispatch-hub-6.preview.emergentagent.com"
API = f"{BASE}/api"

ADMIN = ("admin@buntooz.com", "Admin@123")
CUST = ("customer@buntooz.com", "Customer@123")
PRO = ("pro@buntooz.com", "Pro@123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def admin_tok():
    return _login(*ADMIN)


@pytest.fixture(scope="session")
def cust_tok():
    return _login(*CUST)


@pytest.fixture(scope="session")
def pro_tok():
    return _login(*PRO)


# ---------------- catalog & public
class TestPublic:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200 and "Buntooz" in r.json()["message"]

    def test_categories(self):
        r = requests.get(f"{API}/categories")
        assert r.status_code == 200
        slugs = {c["slug"] for c in r.json()}
        assert {"house-cleaning", "handyman", "errands"}.issubset(slugs)

    def test_service_types(self):
        r = requests.get(f"{API}/service-types")
        assert r.status_code == 200
        slugs = {s["slug"] for s in r.json()}
        assert {"standard-clean", "deep-clean", "move-out-clean", "express-tidy"}.issubset(slugs)

    def test_stats(self):
        r = requests.get(f"{API}/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("open_leads", "quotes_sent", "verified_pros", "matches_made"):
            assert k in d and isinstance(d[k], int)

    @pytest.mark.parametrize("path", ["/services", "/bookings", "/payments/checkout"])
    def test_removed_endpoints(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code in (404, 405), f"{path} should be gone, got {r.status_code}"


# ---------------- auth
class TestAuth:
    def test_login_and_me(self, cust_tok):
        r = requests.get(f"{API}/auth/me", headers=_hdr(cust_tok))
        assert r.status_code == 200 and r.json()["email"] == CUST[0]

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@buntooz.com", "password": "x" * 8})
        assert r.status_code == 401

    def test_unauth_requests_401(self):
        assert requests.get(f"{API}/requests").status_code == 401
        assert requests.get(f"{API}/leads").status_code == 401

    def test_register_customer_and_provider(self):
        eid = uuid.uuid4().hex[:8]
        r = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_c_{eid}@buntooz.com", "password": "Test@1234",
            "name": "Test Cust", "role": "customer"})
        assert r.status_code == 200 and r.json()["role"] == "customer"
        r2 = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_p_{eid}@buntooz.com", "password": "Test@1234",
            "name": "Test Pro", "role": "provider", "phone": "+1 555 0000"})
        assert r2.status_code == 200
        # provider should exist unverified
        tok = r2.json()["access_token"]
        prof = requests.get(f"{API}/provider/me", headers=_hdr(tok))
        assert prof.status_code == 200 and prof.json()["verified"] is False


# ---------------- role gating
class TestRoles:
    def test_customer_cannot_read_leads(self, cust_tok):
        assert requests.get(f"{API}/leads", headers=_hdr(cust_tok)).status_code == 403

    def test_customer_cannot_read_admin(self, cust_tok):
        assert requests.get(f"{API}/admin/providers", headers=_hdr(cust_tok)).status_code == 403

    def test_provider_cannot_post_request(self, pro_tok):
        r = requests.post(f"{API}/requests", headers=_hdr(pro_tok), json={
            "service_type": "standard-clean", "description": "hello world friend",
            "property_size": "1br", "preferred_date": "2026-02-01",
            "time_window": "morning", "city": "SF", "postal_code": "94105"})
        assert r.status_code == 403


# ---------------- requests validation
class TestRequestValidation:
    def _base(self):
        return {"service_type": "standard-clean", "description": "Needs a full standard clean please",
                "property_size": "1br", "preferred_date": "2026-02-01",
                "time_window": "morning", "city": "SF", "postal_code": "94105"}

    def test_short_desc(self, cust_tok):
        b = self._base(); b["description"] = "short"
        r = requests.post(f"{API}/requests", headers=_hdr(cust_tok), json=b)
        assert r.status_code == 422

    def test_unknown_service_type(self, cust_tok):
        b = self._base(); b["service_type"] = "nope-xyz"
        r = requests.post(f"{API}/requests", headers=_hdr(cust_tok), json=b)
        assert r.status_code == 404

    def test_budget_min_gt_max(self, cust_tok):
        b = self._base(); b["budget_min"] = 500; b["budget_max"] = 100
        r = requests.post(f"{API}/requests", headers=_hdr(cust_tok), json=b)
        assert r.status_code == 400


# ---------------- upload
class TestUploads:
    def test_reject_non_image(self, cust_tok):
        files = {"file": ("hack.txt", b"hello", "text/plain")}
        r = requests.post(f"{API}/uploads", headers=_hdr(cust_tok), files=files)
        assert r.status_code == 400

    def test_upload_and_serve(self, cust_tok):
        # 1x1 png
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff"
               b"?\x00\x05\xfe\x02\xfe\xa3Sy\x8d\x00\x00\x00\x00IEND\xaeB`\x82")
        files = {"file": ("t.png", png, "image/png")}
        r = requests.post(f"{API}/uploads", headers=_hdr(cust_tok), files=files)
        assert r.status_code == 200
        j = r.json()
        assert j["url"].startswith("/api/uploads/")
        get = requests.get(f"{BASE}{j['url']}")
        assert get.status_code == 200 and get.headers.get("content-type", "").startswith("image/")

    def test_path_traversal(self):
        r = requests.get(f"{API}/uploads/..%2Fserver.py")
        # FastAPI decodes url; either 400 or 404 is acceptable, but the handler should reject
        assert r.status_code in (400, 404)

    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/uploads", files={"file": ("a.png", b"x", "image/png")})
        assert r.status_code == 401

    def test_large_file(self, cust_tok):
        big = b"\x89PNG" + b"0" * (9 * 1024 * 1024)
        r = requests.post(f"{API}/uploads", headers=_hdr(cust_tok),
                          files={"file": ("big.png", big, "image/png")})
        assert r.status_code == 400


# ---------------- full flow: customer posts, pro quotes, customer accepts
class TestMatchmakingFlow:
    @pytest.fixture(scope="class")
    def created_request(self, cust_tok):
        body = {"service_type": "standard-clean",
                "description": "Please clean my apartment thoroughly before guests arrive",
                "property_size": "2br", "preferred_date": "2026-02-05",
                "time_window": "morning", "city": "San Francisco", "postal_code": "94105",
                "address_line1": "123 Test St", "budget_min": 80, "budget_max": 150}
        r = requests.post(f"{API}/requests", headers=_hdr(cust_tok), json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def test_request_appears_in_dashboard(self, cust_tok, created_request):
        r = requests.get(f"{API}/requests", headers=_hdr(cust_tok))
        assert r.status_code == 200
        ids = [x["_id"] for x in r.json()]
        assert created_request["_id"] in ids

    def test_leads_masked_for_provider(self, pro_tok, created_request):
        r = requests.get(f"{API}/leads", headers=_hdr(pro_tok))
        assert r.status_code == 200
        lead = next((x for x in r.json() if x["_id"] == created_request["_id"]), None)
        assert lead is not None, "lead not visible to provider"
        assert lead["contact_locked"] is True
        assert "contact_phone" not in lead
        assert "contact_email" not in lead
        assert "address_line1" not in lead

    def test_lead_filters(self, pro_tok, created_request):
        r = requests.get(f"{API}/leads?city=San&service_type=standard-clean",
                         headers=_hdr(pro_tok))
        assert r.status_code == 200
        ids = [x["_id"] for x in r.json()]
        assert created_request["_id"] in ids

    def test_unverified_pro_cannot_quote(self, created_request):
        eid = uuid.uuid4().hex[:8]
        reg = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_uv_{eid}@buntooz.com", "password": "Test@1234",
            "name": "UV Pro", "role": "provider"}).json()
        tok = reg["access_token"]
        r = requests.post(f"{API}/requests/{created_request['_id']}/quotes",
                          headers=_hdr(tok),
                          json={"price": 100, "message": "hello I can help you"})
        assert r.status_code == 403

    def test_quote_validation(self, pro_tok, created_request):
        rid = created_request["_id"]
        # price <= 0
        r = requests.post(f"{API}/requests/{rid}/quotes", headers=_hdr(pro_tok),
                          json={"price": 0, "message": "hello there"})
        assert r.status_code == 422
        # short message
        r = requests.post(f"{API}/requests/{rid}/quotes", headers=_hdr(pro_tok),
                         json={"price": 100, "message": "hi"})
        assert r.status_code == 422

    def test_pro_quotes_and_duplicate(self, pro_tok, created_request):
        rid = created_request["_id"]
        r = requests.post(f"{API}/requests/{rid}/quotes", headers=_hdr(pro_tok),
                          json={"price": 120, "message": "Vega Home Care can do this Tuesday",
                                "available_date": "2026-02-05"})
        assert r.status_code == 200, r.text
        self.quote_id = r.json()["_id"]
        # duplicate
        r2 = requests.post(f"{API}/requests/{rid}/quotes", headers=_hdr(pro_tok),
                          json={"price": 130, "message": "second attempt hello"})
        assert r2.status_code == 400

    def test_leads_already_quoted_flag(self, pro_tok, created_request):
        r = requests.get(f"{API}/leads", headers=_hdr(pro_tok))
        lead = next(x for x in r.json() if x["_id"] == created_request["_id"])
        assert lead["already_quoted"] is True

    def test_customer_sees_quotes_masked(self, cust_tok, created_request):
        r = requests.get(f"{API}/requests/{created_request['_id']}/quotes",
                         headers=_hdr(cust_tok))
        assert r.status_code == 200
        qs = r.json()
        assert len(qs) >= 1
        q = qs[0]
        assert q["status"] == "pending"
        assert "provider_phone" not in q
        assert "provider_email" not in q
        self.__class__._q = q

    def test_accept_quote(self, cust_tok, created_request):
        # find our quote
        r = requests.get(f"{API}/requests/{created_request['_id']}/quotes",
                         headers=_hdr(cust_tok))
        q = r.json()[0]
        acc = requests.post(f"{API}/quotes/{q['_id']}/accept", headers=_hdr(cust_tok))
        assert acc.status_code == 200, acc.text
        data = acc.json()
        assert data["status"] == "matched"
        assert data.get("provider_phone")
        assert data.get("provider_email")
        # request now matched
        rr = requests.get(f"{API}/requests/{created_request['_id']}",
                          headers=_hdr(cust_tok))
        assert rr.json()["status"] == "matched"
        # second accept -> 400
        again = requests.post(f"{API}/quotes/{q['_id']}/accept", headers=_hdr(cust_tok))
        assert again.status_code == 400

    def test_contact_revealed_after_accept(self, cust_tok, pro_tok, created_request):
        # customer sees provider phone/email now
        qs = requests.get(f"{API}/requests/{created_request['_id']}/quotes",
                          headers=_hdr(cust_tok)).json()
        accepted = [q for q in qs if q["status"] == "accepted"][0]
        assert accepted.get("provider_phone")
        assert accepted.get("provider_email")
        # winning provider sees customer contact
        pq = requests.get(f"{API}/provider/quotes", headers=_hdr(pro_tok)).json()
        won = [q for q in pq if q["status"] == "accepted"]
        assert won and won[0]["request"].get("contact_locked") is False
        assert won[0]["request"].get("contact_email")

    def test_close_request(self, cust_tok, admin_tok, pro_tok):
        # new request just for close test
        body = {"service_type": "express-tidy",
                "description": "Small quick tidy up needed please",
                "property_size": "studio", "preferred_date": "2026-02-10",
                "time_window": "afternoon", "city": "San Francisco",
                "postal_code": "94105"}
        rid = requests.post(f"{API}/requests", headers=_hdr(cust_tok), json=body).json()["_id"]
        # provider cannot close
        r = requests.post(f"{API}/requests/{rid}/close", headers=_hdr(pro_tok))
        assert r.status_code == 403
        # owner closes
        r = requests.post(f"{API}/requests/{rid}/close", headers=_hdr(cust_tok))
        assert r.status_code == 200
        # gone from lead board
        leads = requests.get(f"{API}/leads", headers=_hdr(pro_tok)).json()
        assert rid not in [x["_id"] for x in leads]


# ---------------- admin & provider profile
class TestAdminAndProfile:
    def test_admin_list_providers(self, admin_tok):
        r = requests.get(f"{API}/admin/providers", headers=_hdr(admin_tok))
        assert r.status_code == 200 and any(p["email"] == PRO[0] for p in r.json())

    def test_verify_toggle(self, admin_tok):
        # register a new unverified pro, verify, then revoke
        eid = uuid.uuid4().hex[:8]
        reg = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_vv_{eid}@buntooz.com", "password": "Test@1234",
            "name": "Verify Test", "role": "provider"}).json()
        tok = reg["access_token"]
        prof = requests.get(f"{API}/provider/me", headers=_hdr(tok)).json()
        pid = prof["id"]
        v = requests.post(f"{API}/admin/providers/{pid}/verify", headers=_hdr(admin_tok))
        assert v.status_code == 200 and v.json()["verified"] is True
        v2 = requests.post(f"{API}/admin/providers/{pid}/verify?verified=false",
                           headers=_hdr(admin_tok))
        assert v2.status_code == 200 and v2.json()["verified"] is False

    def test_provider_profile_persistence(self, pro_tok):
        payload = {"business_name": "Vega Home Care", "phone": "+1 415 555 0110",
                   "city": "San Francisco", "service_areas": ["San Francisco", "Daly City"],
                   "bio": "Independent crew — updated bio", "years_experience": 8}
        r = requests.put(f"{API}/provider/me", headers=_hdr(pro_tok), json=payload)
        assert r.status_code == 200 and r.json()["years_experience"] == 8
        r2 = requests.get(f"{API}/provider/me", headers=_hdr(pro_tok))
        assert r2.json()["years_experience"] == 8


# ---------------- brute force lockout (run last; uses a unique email so real accounts unaffected)
class TestBruteForce:
    def test_lockout_after_5(self):
        email = f"TEST_bf_{uuid.uuid4().hex[:8]}@buntooz.com"
        for i in range(5):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"})
            assert r.status_code == 401
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"})
        assert r.status_code == 429
