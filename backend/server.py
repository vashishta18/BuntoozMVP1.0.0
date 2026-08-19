from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, List, Optional

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

logger = logging.getLogger("buntooz")
logging.basicConfig(level=logging.INFO)

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

UPLOAD_DIR = ROOT_DIR / os.environ.get("UPLOAD_DIR", "uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif"}
MIME_BY_EXT = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
               "webp": "image/webp", "gif": "image/gif"}

JWT_ALGORITHM = "HS256"


# ---------------------------------------------------------------- models
def _to_str(v: Any) -> Any:
    return str(v) if isinstance(v, ObjectId) else v


PyObjectId = Annotated[str, BeforeValidator(_to_str)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls(**doc) if doc else None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class UserOut(BaseDocument):
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    created_at: Optional[str] = None


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str = "customer"
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class Category(BaseDocument):
    slug: str
    name: str
    tagline: str
    status: str
    icon: str
    position: int


class ServiceType(BaseDocument):
    category_slug: str
    slug: str
    name: str
    description: str
    typical_duration: str
    typical_range: str
    image: str


class RequestIn(BaseModel):
    service_type: str
    description: str = Field(min_length=10, max_length=2000)
    property_size: str
    preferred_date: str
    time_window: str
    city: str
    postal_code: str
    address_line1: Optional[str] = None
    budget_min: Optional[float] = Field(default=None, ge=0)
    budget_max: Optional[float] = Field(default=None, ge=0)
    photos: List[str] = []


class QuoteIn(BaseModel):
    price: float = Field(gt=0)
    message: str = Field(min_length=5, max_length=1000)
    available_date: Optional[str] = None


class InviteIn(BaseModel):
    provider_id: str


class NotifyIn(BaseModel):
    email: bool = True
    sms: bool = False


class ProviderProfileIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=120)
    phone: Optional[str] = None
    city: str
    service_areas: List[str] = []
    bio: str = Field(default="", max_length=800)
    years_experience: int = Field(default=0, ge=0, le=60)


class ProviderOut(BaseDocument):
    name: str
    business_name: Optional[str] = None
    email: str
    avatar: Optional[str] = None
    rating: float = 5.0
    jobs_completed: int = 0
    phone: Optional[str] = None
    city: Optional[str] = None
    service_areas: List[str] = []
    skills: List[str] = []
    bio: Optional[str] = None
    years_experience: int = 0
    verified: bool = False
    quotes_sent: int = 0
    leads_won: int = 0


# ---------------------------------------------------------------- auth
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "type": "access",
                       "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
                      get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "type": "refresh",
                       "exp": datetime.now(timezone.utc) + timedelta(days=7)},
                      get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    try:
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except InvalidId:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user


def require_role(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


# ---------------------------------------------------------------- app
app = FastAPI(title="Buntooz Matchmaker")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "Buntooz Matchmaker API", "brand": "Post it once. Get matched."}


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    if body.role not in {"customer", "provider"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"email": email, "password_hash": hash_password(body.password), "name": body.name,
           "role": body.role, "phone": body.phone, "created_at": now_iso()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    if body.role == "provider":
        await db.providers.insert_one({
            "user_id": uid, "name": body.name, "business_name": body.name, "email": email,
            "phone": body.phone, "city": "", "service_areas": [], "skills": ["house-cleaning"],
            "bio": "", "years_experience": 0, "verified": False, "quotes_sent": 0,
            "leads_won": 0, "created_at": now_iso()})
    access = create_access_token(uid, email)
    set_auth_cookies(response, access, create_refresh_token(uid))
    doc["_id"] = uid
    out = UserOut.from_mongo(doc).model_dump()
    out["access_token"] = access
    return out


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    ident = f"login:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        count = (attempt.get("count", 0) if attempt else 0) + 1
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$set": {"identifier": ident, "count": count,
                      "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    set_auth_cookies(response, access, create_refresh_token(uid))
    user["_id"] = uid
    out = UserOut.from_mongo(user).model_dump()
    out["access_token"] = access
    return out


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut.from_mongo(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


# ---------------------------------------------------------------- catalog
@api.get("/categories", response_model=List[Category])
async def categories():
    docs = await db.categories.find().sort("position", 1).to_list(50)
    return [Category.from_mongo(d) for d in docs]


@api.get("/service-types", response_model=List[ServiceType])
async def service_types(category: Optional[str] = None):
    q = {"category_slug": category} if category else {}
    docs = await db.service_types.find(q).sort("position", 1).to_list(100)
    return [ServiceType.from_mongo(d) for d in docs]


@api.get("/stats")
async def stats():
    return {
        "open_leads": await db.requests.count_documents({"status": "open"}),
        "quotes_sent": await db.quotes.count_documents({}),
        "verified_pros": await db.providers.count_documents({"verified": True}),
        "matches_made": await db.requests.count_documents({"status": "matched"}),
    }


# ---------------------------------------------------------------- local uploads
@api.post("/uploads")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Plain local-disk upload — no cloud dependency."""
    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail="Only jpg, png, webp or gif images are allowed")
    data = bytearray()
    while chunk := await file.read(1024 * 256):
        data.extend(chunk)
        if len(data) > 8 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image must be under 8MB")
    data = bytes(data)
    name = f"{uuid.uuid4()}.{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return {"filename": name, "url": f"/api/uploads/{name}"}


@api.get("/uploads/{filename}")
async def serve_image(filename: str):
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = UPLOAD_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    ext = filename.rsplit(".", 1)[-1].lower()
    return FileResponse(path, media_type=MIME_BY_EXT.get(ext, "application/octet-stream"))


# ---------------------------------------------------------------- requests (leads)
def mask_request(doc: dict, reveal: bool) -> dict:
    doc["_id"] = str(doc["_id"])
    if not reveal:
        doc.pop("contact_phone", None)
        doc.pop("contact_email", None)
        doc.pop("address_line1", None)
        doc["contact_locked"] = True
    else:
        doc["contact_locked"] = False
    return doc


@api.post("/requests")
async def create_request(body: RequestIn, user: dict = Depends(require_role("customer", "admin"))):
    st = await db.service_types.find_one({"slug": body.service_type})
    if not st:
        raise HTTPException(status_code=404, detail="Service type not found")
    if body.budget_min is not None and body.budget_max is not None and body.budget_min > body.budget_max:
        raise HTTPException(status_code=400, detail="Budget minimum cannot exceed the maximum")
    doc = {
        "customer_id": user["_id"], "customer_name": user["name"],
        "contact_email": user["email"], "contact_phone": user.get("phone"),
        "category_slug": st["category_slug"], "service_type": st["slug"],
        "service_type_name": st["name"], "description": body.description,
        "property_size": body.property_size, "preferred_date": body.preferred_date,
        "time_window": body.time_window, "city": body.city, "postal_code": body.postal_code,
        "address_line1": body.address_line1, "budget_min": body.budget_min,
        "budget_max": body.budget_max, "photos": body.photos[:6],
        "status": "open", "quotes_count": 0, "accepted_quote_id": None,
        "matched_provider_id": None, "matched_provider_name": None,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.requests.insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    return doc


@api.get("/requests")
async def my_requests(user: dict = Depends(get_current_user)):
    q = {} if user["role"] == "admin" else {"customer_id": user["_id"]}
    docs = await db.requests.find(q).sort("created_at", -1).to_list(300)
    return [mask_request(d, True) for d in docs]


@api.get("/requests/{request_id}")
async def get_request(request_id: str, user: dict = Depends(get_current_user)):
    try:
        doc = await db.requests.find_one({"_id": ObjectId(request_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid request id")
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")
    reveal = user["role"] == "admin" or doc["customer_id"] == user["_id"]
    if not reveal and user["role"] == "provider":
        prov = await db.providers.find_one({"user_id": user["_id"]})
        reveal = bool(prov) and doc.get("matched_provider_id") == str(prov["_id"])
    return mask_request(doc, reveal)


@api.post("/requests/{request_id}/close")
async def close_request(request_id: str, user: dict = Depends(require_role("customer", "admin"))):
    try:
        oid = ObjectId(request_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid request id")
    doc = await db.requests.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "customer" and doc["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not your request")
    await db.requests.update_one({"_id": oid}, {"$set": {"status": "closed", "updated_at": now_iso()}})
    return {"status": "closed"}


# ---------------------------------------------------------------- provider side
async def my_provider(user: dict) -> dict:
    prov = await db.providers.find_one({"user_id": user["_id"]})
    if not prov:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return prov


@api.get("/provider/me", response_model=ProviderOut, response_model_by_alias=False)
async def provider_me(user: dict = Depends(require_role("provider"))):
    return ProviderOut.from_mongo(await my_provider(user))


@api.put("/provider/me", response_model=ProviderOut, response_model_by_alias=False)
async def update_provider_me(body: ProviderProfileIn, user: dict = Depends(require_role("provider"))):
    prov = await my_provider(user)
    await db.providers.update_one({"_id": prov["_id"]}, {"$set": {
        **body.model_dump(), "updated_at": now_iso()}})
    return ProviderOut.from_mongo(await db.providers.find_one({"_id": prov["_id"]}))


@api.get("/leads")
async def lead_board(city: Optional[str] = None, service_type: Optional[str] = None,
                     user: dict = Depends(require_role("provider", "admin"))):
    """Open lead board — every provider sees every open lead, contact details masked."""
    q: dict = {"status": "open"}
    if city:
        q["city"] = {"$regex": f"^{city}", "$options": "i"}
    if service_type:
        q["service_type"] = service_type
    if user["role"] == "provider":
        prov = await my_provider(user)
        q["category_slug"] = {"$in": prov.get("skills", [])}
        quoted = {r["request_id"] for r in
                  await db.quotes.find({"provider_id": str(prov["_id"])}).to_list(500)}
        invited = {i["request_id"] for i in
                   await db.invites.find({"provider_id": str(prov["_id"])}).to_list(500)}
    else:
        quoted, invited = set(), set()
    docs = await db.requests.find(q).sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        lead = mask_request(d, False)
        lead["already_quoted"] = lead["_id"] in quoted
        lead["invited"] = lead["_id"] in invited
        out.append(lead)
    out.sort(key=lambda l: (not l["invited"],))
    return out


@api.get("/requests/{request_id}/recommended-pros")
async def recommended_pros(request_id: str, user: dict = Depends(require_role("customer", "admin"))):
    """Verified pros serving this request's area, so a customer with no quotes can invite directly."""
    try:
        req = await db.requests.find_one({"_id": ObjectId(request_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid request id")
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "customer" and req["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not your request")

    area_match = {"$or": [
        {"city": {"$regex": f"^{req['city']}", "$options": "i"}},
        {"service_areas": {"$regex": req["postal_code"], "$options": "i"}},
        {"service_areas": {"$regex": f"^{req['city']}", "$options": "i"}},
    ]}
    base = {"verified": True, "skills": req["category_slug"]}
    local = await db.providers.find({**base, **area_match}).sort("rating", -1).to_list(20)
    if len(local) < 3:
        seen = {p["_id"] for p in local}
        extra = await db.providers.find({**base, "_id": {"$nin": list(seen)}}).sort("rating", -1).to_list(10)
        local += extra
    invited = {i["provider_id"] for i in
               await db.invites.find({"request_id": request_id}).to_list(100)}
    quoted = {q["provider_id"] for q in
              await db.quotes.find({"request_id": request_id}).to_list(200)}
    out = []
    for p in local[:3]:
        pid = str(p["_id"])
        out.append({
            "id": pid, "name": p.get("business_name") or p["name"], "city": p.get("city"),
            "avatar": p.get("avatar"), "rating": p.get("rating", 5.0),
            "jobs_completed": p.get("jobs_completed", 0),
            "years_experience": p.get("years_experience", 0),
            "bio": p.get("bio"), "invited": pid in invited, "already_quoted": pid in quoted,
        })
    return {"area": f"{req['city']} {req['postal_code']}", "response_sla": "15–30 minutes",
            "providers": out}


@api.post("/requests/{request_id}/invite")
async def invite_provider(request_id: str, body: InviteIn,
                          user: dict = Depends(require_role("customer", "admin"))):
    """Priority match ping — the lead jumps to the top of that provider's inbox."""
    try:
        req = await db.requests.find_one({"_id": ObjectId(request_id)})
        prov = await db.providers.find_one({"_id": ObjectId(body.provider_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")
    if not req or not prov:
        raise HTTPException(status_code=404, detail="Not found")
    if user["role"] == "customer" and req["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not your request")
    if req["status"] != "open":
        raise HTTPException(status_code=400, detail="This request is no longer open")
    if await db.invites.find_one({"request_id": request_id, "provider_id": body.provider_id}):
        raise HTTPException(status_code=400, detail="Already invited")
    await db.invites.insert_one({"request_id": request_id, "provider_id": body.provider_id,
                                 "customer_id": req["customer_id"], "created_at": now_iso()})
    return {"invited": True, "provider_name": prov.get("business_name") or prov["name"]}


@api.put("/requests/{request_id}/notifications")
async def set_notifications(request_id: str, body: NotifyIn,
                            user: dict = Depends(require_role("customer", "admin"))):
    try:
        oid = ObjectId(request_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid request id")
    req = await db.requests.find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "customer" and req["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not your request")
    prefs = {"email": body.email, "sms": body.sms}
    await db.requests.update_one({"_id": oid}, {"$set": {"notify": prefs, "updated_at": now_iso()}})
    return prefs


@api.post("/requests/{request_id}/quotes")
async def submit_quote(request_id: str, body: QuoteIn, user: dict = Depends(require_role("provider"))):
    prov = await my_provider(user)
    if not prov.get("verified"):
        raise HTTPException(status_code=403, detail="Your provider profile is awaiting verification")
    try:
        oid = ObjectId(request_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid request id")
    req = await db.requests.find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "open":
        raise HTTPException(status_code=400, detail="This lead is no longer open")
    if await db.quotes.find_one({"request_id": request_id, "provider_id": str(prov["_id"])}):
        raise HTTPException(status_code=400, detail="You already quoted on this lead")
    doc = {"request_id": request_id, "provider_id": str(prov["_id"]),
           "provider_name": prov.get("business_name") or prov["name"],
           "provider_rating_note": f"{prov.get('years_experience', 0)} yrs experience",
           "provider_city": prov.get("city"), "provider_phone": prov.get("phone"),
           "provider_email": prov.get("email"), "price": body.price, "message": body.message,
           "available_date": body.available_date, "status": "pending",
           "created_at": now_iso()}
    res = await db.quotes.insert_one(doc)
    await db.requests.update_one({"_id": oid}, {"$inc": {"quotes_count": 1},
                                               "$set": {"updated_at": now_iso()}})
    await db.providers.update_one({"_id": prov["_id"]}, {"$inc": {"quotes_sent": 1}})
    doc["_id"] = str(res.inserted_id)
    return doc


@api.get("/requests/{request_id}/quotes")
async def request_quotes(request_id: str, user: dict = Depends(get_current_user)):
    try:
        req = await db.requests.find_one({"_id": ObjectId(request_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid request id")
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    owner = user["role"] == "admin" or req["customer_id"] == user["_id"]
    docs = await db.quotes.find({"request_id": request_id}).sort("price", 1).to_list(200)
    out = []
    for d in docs:
        d["_id"] = str(d["_id"])
        if not owner:
            prov = await db.providers.find_one({"user_id": user["_id"]})
            if not prov or d["provider_id"] != str(prov["_id"]):
                continue
        if d["status"] != "accepted":
            d.pop("provider_phone", None)
            d.pop("provider_email", None)
        out.append(d)
    return out


@api.get("/provider/quotes")
async def provider_quotes(user: dict = Depends(require_role("provider"))):
    prov = await my_provider(user)
    docs = await db.quotes.find({"provider_id": str(prov["_id"])}).sort("created_at", -1).to_list(300)
    out = []
    for d in docs:
        d["_id"] = str(d["_id"])
        req = await db.requests.find_one({"_id": ObjectId(d["request_id"])})
        if req:
            d["request"] = mask_request(req, d["status"] == "accepted")
        out.append(d)
    return out


@api.post("/quotes/{quote_id}/accept")
async def accept_quote(quote_id: str, user: dict = Depends(require_role("customer", "admin"))):
    """Match made: the winning provider unlocks the customer's contact details."""
    try:
        quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid quote id")
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    req = await db.requests.find_one({"_id": ObjectId(quote["request_id"])})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "customer" and req["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not your request")
    if req["status"] != "open":
        raise HTTPException(status_code=400, detail="This request is already matched or closed")
    await db.quotes.update_one({"_id": quote["_id"]}, {"$set": {"status": "accepted"}})
    await db.quotes.update_many({"request_id": quote["request_id"], "_id": {"$ne": quote["_id"]}},
                               {"$set": {"status": "declined"}})
    await db.requests.update_one({"_id": req["_id"]}, {"$set": {
        "status": "matched", "accepted_quote_id": str(quote["_id"]),
        "matched_provider_id": quote["provider_id"], "matched_provider_name": quote["provider_name"],
        "updated_at": now_iso()}})
    await db.providers.update_one({"_id": ObjectId(quote["provider_id"])}, {"$inc": {"leads_won": 1}})
    return {"status": "matched", "provider_name": quote["provider_name"],
            "provider_phone": quote.get("provider_phone"), "provider_email": quote.get("provider_email")}


# ---------------------------------------------------------------- admin
@api.get("/admin/providers", response_model=List[ProviderOut], response_model_by_alias=False)
async def admin_providers(user: dict = Depends(require_role("admin"))):
    docs = await db.providers.find().sort("created_at", -1).to_list(300)
    return [ProviderOut.from_mongo(d) for d in docs]


@api.post("/admin/providers/{provider_id}/verify")
async def verify_provider(provider_id: str, verified: bool = Query(True),
                          user: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(provider_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid provider id")
    res = await db.providers.update_one({"_id": oid}, {"$set": {"verified": verified,
                                                               "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"verified": verified}


# ---------------------------------------------------------------- seed
IMG = "https://images.unsplash.com/"
SEED_CATEGORIES = [
    {"slug": "house-cleaning", "name": "House Cleaning", "status": "live", "position": 1,
     "icon": "sparkles", "tagline": "Post what needs cleaning; local pros send you quotes."},
    {"slug": "handyman", "name": "Handyman", "status": "soon", "position": 2, "icon": "wrench",
     "tagline": "Repairs, mounting and assembly (coming soon)."},
    {"slug": "errands", "name": "Errands", "status": "soon", "position": 3, "icon": "package",
     "tagline": "Grocery runs, deliveries and personal errands (coming soon)."},
]
SEED_SERVICE_TYPES = [
    {"slug": "standard-clean", "name": "Standard Home Clean", "position": 1,
     "typical_duration": "2-3 hours", "typical_range": "$70 – $110",
     "description": "Kitchen, bathrooms, floors and surfaces refreshed top to bottom.",
     "image": IMG + "photo-1647381518264-97ff1835026f?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"slug": "deep-clean", "name": "Deep Clean", "position": 2,
     "typical_duration": "4-6 hours", "typical_range": "$150 – $250",
     "description": "Every corner, baseboard and appliance scrubbed.",
     "image": IMG + "photo-1740657254989-42fe9c3b8cce?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"slug": "move-out-clean", "name": "Move-Out Clean", "position": 3,
     "typical_duration": "5-7 hours", "typical_range": "$200 – $320",
     "description": "Deposit-back clean including inside cabinets, oven and fridge.",
     "image": IMG + "photo-1581578731548-c64695cc6952?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"slug": "express-tidy", "name": "Express Tidy-Up", "position": 4,
     "typical_duration": "1 hour", "typical_range": "$40 – $70",
     "description": "A fast reset before guests arrive.",
     "image": IMG + "photo-1646980241033-cd7abda2ee88?crop=entropy&cs=srgb&fm=jpg&q=85"},
]
DEMO_USERS = [
    {"email": "customer@buntooz.com", "password": "Customer@123", "name": "Riley Chen",
     "role": "customer", "phone": "+1 415 555 0104"},
    {"email": "pro@buntooz.com", "password": "Pro@123", "name": "Marisol Vega",
     "role": "provider", "phone": "+1 415 555 0110"},
]
SEED_PROVIDER_PROFILE = {
    "business_name": "Vega Home Care", "city": "San Francisco", "verified": True,
    "service_areas": ["San Francisco", "Daly City", "94105"], "years_experience": 7,
    "rating": 4.9, "jobs_completed": 214,
    "avatar": IMG + "photo-1609371497456-3a55a205d5eb?crop=faces&cs=srgb&fm=jpg&q=85&w=200&h=200&fit=crop",
    "bio": "Independent two-person cleaning crew serving the city for 7 years. Eco products, own supplies.",
}
# Directory pros: real verified provider profiles with no login, so customers always have someone to invite.
SEED_DIRECTORY_PROVIDERS = [
    {"email": "sunshine.clean@buntooz.example", "name": "Alicia Moreno",
     "business_name": "Sunshine Clean Co.", "city": "Tampa", "phone": "+1 813 555 0142",
     "service_areas": ["Tampa", "33610", "33612"], "years_experience": 9, "rating": 4.9,
     "jobs_completed": 318,
     "avatar": IMG + "photo-1594824476967-48c8b964273f?crop=faces&cs=srgb&fm=jpg&q=85&w=200&h=200&fit=crop",
     "bio": "Family-run crew covering north Tampa. Same team every visit, supplies included."},
    {"email": "baywide.pro@buntooz.example", "name": "Devon Hale",
     "business_name": "Baywide Home Pros", "city": "Tampa", "phone": "+1 813 555 0177",
     "service_areas": ["Tampa", "33610", "33605"], "years_experience": 6, "rating": 4.8,
     "jobs_completed": 205,
     "avatar": IMG + "photo-1507003211169-0a1dd7228f2d?crop=faces&cs=srgb&fm=jpg&q=85&w=200&h=200&fit=crop",
     "bio": "Deep cleans and move-outs. Flexible evenings and weekends."},
    {"email": "freshnest@buntooz.example", "name": "Priya Raman",
     "business_name": "FreshNest Cleaning", "city": "Tampa", "phone": "+1 813 555 0188",
     "service_areas": ["Tampa", "33610", "33647"], "years_experience": 4, "rating": 4.7,
     "jobs_completed": 141,
     "avatar": IMG + "photo-1580489944761-15a19d654956?crop=faces&cs=srgb&fm=jpg&q=85&w=200&h=200&fit=crop",
     "bio": "Eco-friendly products, pet-friendly home specialist."},
]


async def seed() -> None:
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.categories.create_index("slug", unique=True)
    await db.service_types.create_index("slug", unique=True)
    await db.quotes.create_index("request_id")
    await db.invites.create_index([("request_id", 1), ("provider_id", 1)], unique=True)

    for p in SEED_DIRECTORY_PROVIDERS:
        await db.providers.update_one({"email": p["email"]}, {
            "$set": {**p, "skills": ["house-cleaning"], "verified": True},
            "$setOnInsert": {"quotes_sent": 0, "leads_won": 0, "created_at": now_iso()}},
            upsert=True)

    for c in SEED_CATEGORIES:
        await db.categories.update_one({"slug": c["slug"]}, {"$set": c}, upsert=True)
    for s in SEED_SERVICE_TYPES:
        await db.service_types.update_one({"slug": s["slug"]},
                                         {"$set": {**s, "category_slug": "house-cleaning"}},
                                         upsert=True)

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password),
                                   "name": "Buntooz Admin", "role": "admin", "created_at": now_iso()})
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    for u in DEMO_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing is None:
            res = await db.users.insert_one({
                "email": u["email"], "password_hash": hash_password(u["password"]),
                "name": u["name"], "role": u["role"], "phone": u.get("phone"),
                "created_at": now_iso()})
            uid = str(res.inserted_id)
        else:
            uid = str(existing["_id"])
            if not verify_password(u["password"], existing.get("password_hash", "")):
                await db.users.update_one({"_id": existing["_id"]},
                                          {"$set": {"password_hash": hash_password(u["password"])}})
        if u["role"] == "provider":
            await db.providers.update_one({"user_id": uid}, {"$set": {
                "user_id": uid, "name": u["name"], "email": u["email"], "phone": u.get("phone"),
                "skills": ["house-cleaning"], **SEED_PROVIDER_PROFILE},
                "$setOnInsert": {"quotes_sent": 0, "leads_won": 0, "created_at": now_iso()}},
                upsert=True)
    logger.info("seed complete")


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
