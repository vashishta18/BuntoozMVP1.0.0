import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, ArrowRight, CalendarDays, Camera, MapPin, X } from "lucide-react";

const STEPS = ["Service", "Details", "Place", "Photos"];
const WINDOWS = ["Morning", "Afternoon", "Evening", "Flexible"];
const SIZES = ["Studio", "1 bedroom", "2 bedrooms", "3+ bedrooms", "Whole house"];

const nextDays = (n) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().slice(0, 10);
  });

const field =
  "w-full rounded-xl border border-border bg-[#030a1c]/70 px-4 py-3 text-sm outline-none transition-colors focus:border-[#2ff2b3]";

export default function PostRequest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [types, setTypes] = useState([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => {
    const beds = params.get("beds");
    const baths = params.get("baths");
    const sizeFromBeds = { "1": "1 bedroom", "2": "2 bedrooms" }[beds] || (beds ? "3+ bedrooms" : "");
    const prefill =
      beds || baths
        ? `${beds ? `${beds} bedroom${beds === "1" ? "" : "s"}` : ""}${beds && baths ? ", " : ""}${
            baths ? `${baths} bathroom${baths === "1" ? "" : "s"}` : ""
          }. `
        : "";
    return {
      service_type: params.get("type") || "",
      description: prefill,
      property_size: sizeFromBeds,
      preferred_date: "",
      time_window: "Flexible",
      city: "",
      postal_code: "",
      address_line1: "",
      budget_min: "",
      budget_max: "",
      photos: [],
    };
  });

  const dates = useMemo(() => nextDays(10), []);

  useEffect(() => {
    api.get("/service-types", { params: { category: "house-cleaning" } }).then(({ data }) => {
      setTypes(data);
      setForm((f) => ({ ...f, service_type: f.service_type || data[0]?.slug || "" }));
    });
  }, []);

  useEffect(() => {
    if (!loading && user === false)
      navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
  }, [loading, user, navigate, location.pathname, location.search]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const canNext =
    (step === 1 && form.service_type) ||
    (step === 2 && form.description.trim().length >= 10 && form.property_size && form.preferred_date) ||
    (step === 3 && form.city && form.postal_code) ||
    step === 4;

  const addPhoto = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, photos: [...f.photos, data.filename] }));
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      };
      const { data } = await api.post("/requests", payload);
      navigate("/dashboard", { state: { newRequest: data._id } });
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
      setBusy(false);
    }
  };

  const selected = types.find((t) => t.slug === form.service_type);

  return (
    <div className="px-5 py-12 sm:px-8" data-testid="post-request-page">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3" data-testid="post-steps">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    step > i ? "border-[#2ff2b3]/50 mint-text" : "border-border text-muted-foreground"
                  }`}
                >
                  <span>{i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && <span className="h-px w-4 bg-border" />}
              </div>
            ))}
          </div>

          <h1 className="mt-8 text-3xl font-extrabold sm:text-4xl">
            {step === 1 && "What do you need done?"}
            {step === 2 && "Tell pros the details."}
            {step === 3 && "Where is it?"}
            {step === 4 && "Add photos (optional)."}
          </h1>

          <div className="glass mt-8 rounded-3xl p-7">
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2" data-testid="step-service">
                {types.map((t) => (
                  <button
                    key={t.slug}
                    data-testid={`type-option-${t.slug}`}
                    onClick={() => setForm({ ...form, service_type: t.slug })}
                    className={`rounded-2xl border p-5 text-left transition-colors ${
                      form.service_type === t.slug
                        ? "border-[#2ff2b3] bg-[#2ff2b3]/8"
                        : "border-border hover:border-[#2ff2b3]/40"
                    }`}
                  >
                    <div className="text-sm font-bold">{t.name}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{t.description}</div>
                    <div className="mt-3 text-xs mint-text">
                      {t.typical_duration} · {t.typical_range}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6" data-testid="step-details">
                <textarea
                  data-testid="description-input"
                  rows={4}
                  placeholder="What needs doing? Rooms, pets, supplies, anything a pro should know (min 10 characters)."
                  value={form.description}
                  onChange={set("description")}
                  className={field}
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Property size
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        data-testid={`size-option-${s.split(" ")[0].toLowerCase()}`}
                        onClick={() => setForm({ ...form, property_size: s })}
                        className={`rounded-full border px-4 py-2 text-xs transition-colors ${
                          form.property_size === s
                            ? "border-[#2ff2b3] mint-text bg-[#2ff2b3]/10"
                            : "border-border text-muted-foreground hover:border-[#2ff2b3]/40"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <CalendarDays size={14} /> Preferred date
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {dates.map((d) => {
                      const dt = new Date(`${d}T00:00:00`);
                      return (
                        <button
                          key={d}
                          data-testid={`date-option-${d}`}
                          onClick={() => setForm({ ...form, preferred_date: d })}
                          className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                            form.preferred_date === d
                              ? "border-[#2ff2b3] bg-[#2ff2b3]/10"
                              : "border-border hover:border-[#2ff2b3]/40"
                          }`}
                        >
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {dt.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                          <div className="display text-lg font-extrabold">{dt.getDate()}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Time window
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {WINDOWS.map((w) => (
                      <button
                        key={w}
                        data-testid={`window-option-${w.toLowerCase()}`}
                        onClick={() => setForm({ ...form, time_window: w })}
                        className={`rounded-full border px-4 py-2 text-xs transition-colors ${
                          form.time_window === w
                            ? "border-[#2ff2b3] mint-text bg-[#2ff2b3]/10"
                            : "border-border text-muted-foreground hover:border-[#2ff2b3]/40"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input data-testid="budget-min-input" type="number" min="0" placeholder="Budget from ($, optional)" value={form.budget_min} onChange={set("budget_min")} className={field} />
                  <input data-testid="budget-max-input" type="number" min="0" placeholder="Budget up to ($, optional)" value={form.budget_max} onChange={set("budget_max")} className={field} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4" data-testid="step-place">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input data-testid="city-input" placeholder="City" value={form.city} onChange={set("city")} className={field} />
                  <input data-testid="postal-input" placeholder="Postal code" value={form.postal_code} onChange={set("postal_code")} className={field} />
                </div>
                <input data-testid="address-input" placeholder="Street address (only shared with the pro you accept)" value={form.address_line1} onChange={set("address_line1")} className={field} />
                <p className="text-xs text-muted-foreground">
                  Pros browsing the board see only your city and postal code. Your street address, phone and
                  email unlock for one pro — the one whose quote you accept.
                </p>
              </div>
            )}

            {step === 4 && (
              <div data-testid="step-photos">
                <label
                  data-testid="photo-upload-label"
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center transition-colors hover:border-[#2ff2b3]/50"
                >
                  <Camera size={26} className="mint-text" />
                  <span className="text-sm font-bold">Add a photo of the space</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG or WEBP up to 8MB · stored on our own server</span>
                  <input
                    data-testid="photo-input"
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => addPhoto(e.target.files?.[0])}
                  />
                </label>
                {form.photos.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-4" data-testid="photo-previews">
                    {form.photos.map((p) => (
                      <div key={p} className="relative">
                        <img
                          src={`${api.defaults.baseURL}/uploads/${p}`}
                          alt="request"
                          className="h-24 w-24 rounded-xl object-cover"
                        />
                        <button
                          data-testid={`remove-photo-${p}`}
                          onClick={() => setForm({ ...form, photos: form.photos.filter((x) => x !== p) })}
                          className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#030a1c] text-rose-300 ring-1 ring-border"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <p data-testid="post-error" className="mt-5 text-sm text-rose-400">
                {error}
              </p>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                data-testid="post-back-btn"
                onClick={() => (step === 1 ? navigate("/") : setStep(step - 1))}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft size={15} /> Back
              </button>
              {step < 4 ? (
                <button
                  data-testid="post-next-btn"
                  disabled={!canNext}
                  onClick={() => setStep(step + 1)}
                  className="btn-mint inline-flex items-center gap-1.5 px-6 py-3 text-sm disabled:opacity-40"
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  data-testid="post-submit-btn"
                  disabled={busy}
                  onClick={submit}
                  className="btn-mint px-6 py-3 text-sm disabled:opacity-60"
                >
                  {busy ? "Posting…" : "Post request & get quotes"}
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="glass h-fit rounded-3xl p-7" data-testid="post-summary">
          <div className="text-xs font-bold uppercase tracking-[0.18em] mint-text">Your request</div>
          <div className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Service</span>
              <span className="text-right font-bold">{selected?.name || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Size</span>
              <span className="text-right font-bold">{form.property_size || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">When</span>
              <span className="text-right font-bold">
                {form.preferred_date ? `${form.preferred_date} · ${form.time_window}` : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin size={13} /> Area
              </span>
              <span className="text-right font-bold">
                {form.city ? `${form.city} ${form.postal_code}` : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Photos</span>
              <span className="text-right font-bold">{form.photos.length}</span>
            </div>
          </div>
          <p className="mt-7 border-t border-border pt-6 text-xs text-muted-foreground">
            Posting is free. You&apos;ll get quotes from independent local pros and deal with them directly —
            Buntooz never takes a cut.
          </p>
        </aside>
      </div>
    </div>
  );
}
