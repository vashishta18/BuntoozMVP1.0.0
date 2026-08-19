import { useEffect, useState } from "react";
import { api, apiError, money } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { BadgeCheck, CalendarDays, Mail, MapPin, Phone, Search, Send } from "lucide-react";

const field =
  "w-full rounded-xl border border-border bg-[#030a1c]/70 px-4 py-3 text-sm outline-none transition-colors focus:border-[#2ff2b3]";

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("leads");
  const [profile, setProfile] = useState(null);
  const [leads, setLeads] = useState([]);
  const [myQuotes, setMyQuotes] = useState([]);
  const [filters, setFilters] = useState({ city: "", service_type: "" });
  const [types, setTypes] = useState([]);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () => {
    api.get("/provider/me").then(({ data }) => setProfile(data));
    api.get("/leads", { params: { city: filters.city || undefined, service_type: filters.service_type || undefined } })
      .then(({ data }) => setLeads(data))
      .catch(() => setLeads([]));
    api.get("/provider/quotes").then(({ data }) => setMyQuotes(data));
  };

  useEffect(() => {
    api.get("/service-types").then(({ data }) => setTypes(data));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.city, filters.service_type]);

  const sendQuote = async (leadId) => {
    const d = draft[leadId] || {};
    setError("");
    setNotice("");
    try {
      await api.post(`/requests/${leadId}/quotes`, {
        price: Number(d.price),
        message: d.message || "",
        available_date: d.available_date || null,
      });
      setDraft({ ...draft, [leadId]: undefined });
      setNotice("Quote sent. The customer will see it right away.");
      load();
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const { data } = await api.put("/provider/me", {
        business_name: profile.business_name || profile.name,
        phone: profile.phone,
        city: profile.city || "",
        service_areas: (profile.service_areas || []).filter(Boolean),
        bio: profile.bio || "",
        years_experience: Number(profile.years_experience) || 0,
      });
      setProfile(data);
      setNotice("Profile saved.");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  const won = myQuotes.filter((q) => q.status === "accepted");

  return (
    <div className="px-5 py-12 sm:px-8" data-testid="provider-dashboard">
      <div className="mx-auto max-w-6xl">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Pro console</span>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{profile?.business_name || user?.name}</h1>
          {profile?.verified ? (
            <span data-testid="verified-badge" className="inline-flex items-center gap-1.5 rounded-full border border-[#2ff2b3]/40 px-3 py-1 text-xs font-bold mint-text">
              <BadgeCheck size={13} /> Verified
            </span>
          ) : (
            <span data-testid="unverified-badge" className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-300">
              Awaiting verification
            </span>
          )}
        </div>

        {!profile?.verified && (
          <p data-testid="verification-notice" className="mt-4 max-w-2xl text-sm text-muted-foreground">
            You can browse the lead board now. Quoting unlocks once an admin verifies your profile — fill in
            your business details below to speed that up.
          </p>
        )}

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <div className="glass rounded-2xl p-6" data-testid="stat-open-leads">
            <div className="display text-3xl font-extrabold">{leads.length}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Open leads</div>
          </div>
          <div className="glass rounded-2xl p-6" data-testid="stat-quotes-sent">
            <div className="display text-3xl font-extrabold">{myQuotes.length}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Quotes sent</div>
          </div>
          <div className="glass rounded-2xl p-6" data-testid="stat-leads-won">
            <div className="display text-3xl font-extrabold mint-text">{won.length}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Jobs won</div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-2 rounded-full border border-border p-1 sm:w-fit">
          {[
            ["leads", `Lead board (${leads.length})`],
            ["quotes", `My quotes (${myQuotes.length})`],
            ["profile", "Profile"],
          ].map(([value, label]) => (
            <button
              key={value}
              data-testid={`provider-tab-${value}`}
              onClick={() => setTab(value)}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition-colors ${
                tab === value ? "mint-bg text-[#030a1c]" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p data-testid="provider-error" className="mt-6 text-sm text-rose-400">
            {error}
          </p>
        )}
        {notice && (
          <p data-testid="provider-notice" className="mt-6 text-sm mint-text">
            {notice}
          </p>
        )}

        {tab === "leads" && (
          <div className="mt-8" data-testid="lead-board">
            <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
              <Search size={16} className="text-muted-foreground" />
              <input
                data-testid="filter-city-input"
                placeholder="Filter by city"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                className="flex-1 min-w-[160px] rounded-xl border border-border bg-[#030a1c]/70 px-4 py-2.5 text-sm outline-none focus:border-[#2ff2b3]"
              />
              <select
                data-testid="filter-type-select"
                value={filters.service_type}
                onChange={(e) => setFilters({ ...filters, service_type: e.target.value })}
                className="rounded-xl border border-border bg-[#030a1c] px-4 py-2.5 text-sm outline-none focus:border-[#2ff2b3]"
              >
                <option value="">All service types</option>
                {types.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 space-y-4">
              {leads.length === 0 && (
                <p data-testid="no-leads" className="text-sm text-muted-foreground">
                  No open requests match this filter right now.
                </p>
              )}
              {leads.map((l) => (
                <div key={l._id} data-testid={`lead-row-${l._id}`} className="glass rounded-2xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-bold">{l.service_type_name}</h3>
                        <span className="text-xs text-muted-foreground">{l.property_size}</span>
                        {l.invited && (
                          <span data-testid={`priority-invite-${l._id}`} className="inline-flex items-center gap-1 rounded-full border border-[#2ff2b3]/40 bg-[#2ff2b3]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mint-text">
                            Priority invite
                          </span>
                        )}
                        {l.already_quoted && (
                          <span data-testid={`already-quoted-${l._id}`} className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Quoted
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={13} /> {l.preferred_date} · {l.time_window}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} /> {l.city} {l.postal_code}
                        </span>
                        <span>{l.quotes_count} quote(s) so far</span>
                      </div>
                      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{l.description}</p>
                      {l.photos?.length > 0 && (
                        <div className="mt-4 flex gap-3">
                          {l.photos.map((p) => (
                            <img
                              key={p}
                              src={`${api.defaults.baseURL}/uploads/${p}`}
                              alt="lead"
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {(l.budget_min || l.budget_max) && (
                        <div>
                          Budget {l.budget_min ? money(l.budget_min) : "—"} – {l.budget_max ? money(l.budget_max) : "—"}
                        </div>
                      )}
                      <div className="mt-2">Contact unlocks when accepted</div>
                    </div>
                  </div>

                  {!l.already_quoted && profile?.verified && (
                    <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-[140px_160px_1fr_auto]">
                      <input
                        data-testid={`quote-price-input-${l._id}`}
                        type="number"
                        min="1"
                        placeholder="Your price $"
                        value={draft[l._id]?.price || ""}
                        onChange={(e) => setDraft({ ...draft, [l._id]: { ...draft[l._id], price: e.target.value } })}
                        className={field}
                      />
                      <input
                        data-testid={`quote-date-input-${l._id}`}
                        type="date"
                        value={draft[l._id]?.available_date || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, [l._id]: { ...draft[l._id], available_date: e.target.value } })
                        }
                        className={field}
                      />
                      <input
                        data-testid={`quote-message-input-${l._id}`}
                        placeholder="Short message to the customer"
                        value={draft[l._id]?.message || ""}
                        onChange={(e) => setDraft({ ...draft, [l._id]: { ...draft[l._id], message: e.target.value } })}
                        className={field}
                      />
                      <button
                        data-testid={`send-quote-btn-${l._id}`}
                        onClick={() => sendQuote(l._id)}
                        className="btn-mint inline-flex items-center justify-center gap-1.5 px-5 py-3 text-sm"
                      >
                        <Send size={14} /> Quote
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "quotes" && (
          <div className="mt-8 space-y-4" data-testid="my-quotes">
            {myQuotes.length === 0 && (
              <p data-testid="no-quotes" className="text-sm text-muted-foreground">
                You haven&apos;t quoted on anything yet.
              </p>
            )}
            {myQuotes.map((q) => (
              <div key={q._id} data-testid={`my-quote-${q._id}`} className="glass rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold">{q.request?.service_type_name || "Request"}</h3>
                      <StatusBadge status={q.status} testId={`my-quote-status-${q._id}`} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> {q.request?.preferred_date} · {q.request?.time_window}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} /> {q.request?.city} {q.request?.postal_code}
                      </span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm text-muted-foreground">{q.message}</p>
                    {q.status === "accepted" && (
                      <div data-testid={`won-contact-${q._id}`} className="mt-4 rounded-xl border border-[#2ff2b3]/35 bg-[#2ff2b3]/8 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider mint-text">
                          You won this job — contact the customer
                        </div>
                        <div className="mt-2 flex flex-wrap gap-5 text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            {q.request?.customer_name}
                          </span>
                          {q.request?.contact_phone && (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone size={12} /> {q.request.contact_phone}
                            </span>
                          )}
                          {q.request?.contact_email && (
                            <span className="inline-flex items-center gap-1.5">
                              <Mail size={12} /> {q.request.contact_email}
                            </span>
                          )}
                        </div>
                        {q.request?.address_line1 && (
                          <div className="mt-2 text-xs text-muted-foreground">{q.request.address_line1}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="display text-2xl font-extrabold mint-text">{money(q.price)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "profile" && profile && (
          <form onSubmit={saveProfile} className="glass mt-8 max-w-xl space-y-4 rounded-2xl p-7" data-testid="provider-profile-form">
            <input data-testid="profile-business-input" placeholder="Business name" value={profile.business_name || ""} onChange={(e) => setProfile({ ...profile, business_name: e.target.value })} className={field} />
            <div className="grid gap-4 sm:grid-cols-2">
              <input data-testid="profile-city-input" placeholder="Base city" value={profile.city || ""} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className={field} />
              <input data-testid="profile-phone-input" placeholder="Phone" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={field} />
            </div>
            <input
              data-testid="profile-areas-input"
              placeholder="Service areas (comma separated)"
              value={(profile.service_areas || []).join(", ")}
              onChange={(e) => setProfile({ ...profile, service_areas: e.target.value.split(",").map((s) => s.trim()) })}
              className={field}
            />
            <input data-testid="profile-years-input" type="number" min="0" placeholder="Years of experience" value={profile.years_experience ?? 0} onChange={(e) => setProfile({ ...profile, years_experience: e.target.value })} className={field} />
            <textarea data-testid="profile-bio-input" rows={4} placeholder="Tell customers about your work" value={profile.bio || ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} className={field} />
            <button data-testid="profile-save-btn" className="btn-mint px-6 py-3 text-sm">
              Save profile
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
