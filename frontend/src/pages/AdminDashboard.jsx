import { useEffect, useState } from "react";
import { api, apiError, money } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { BadgeCheck, MapPin, ShieldOff } from "lucide-react";

export default function AdminDashboard() {
  const [providers, setProviders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [error, setError] = useState("");

  const load = () => {
    api.get("/admin/providers").then(({ data }) => setProviders(data));
    api.get("/requests").then(({ data }) => setRequests(data));
    api.get("/stats").then(({ data }) => setStats(data));
  };

  useEffect(() => {
    load();
  }, []);

  const setVerified = async (id, verified) => {
    setError("");
    try {
      await api.post(`/admin/providers/${id}/verify?verified=${verified}`);
      load();
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="px-5 py-12 sm:px-8" data-testid="admin-dashboard">
      <div className="mx-auto max-w-7xl">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Marketplace console
        </span>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Leads, quotes and pros.</h1>

        <div className="mt-10 grid gap-5 sm:grid-cols-4">
          {[
            ["admin-open-leads", stats.open_leads ?? 0, "Open requests"],
            ["admin-quotes", stats.quotes_sent ?? 0, "Quotes sent"],
            ["admin-verified", stats.verified_pros ?? 0, "Verified pros"],
            ["admin-matches", stats.matches_made ?? 0, "Matches made"],
          ].map(([id, value, label]) => (
            <div key={id} data-testid={id} className="glass rounded-2xl p-6">
              <div className="display text-3xl font-extrabold mint-text">{value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {error && (
          <p data-testid="admin-error" className="mt-6 text-sm text-rose-400">
            {error}
          </p>
        )}

        <h2 className="mt-14 text-xl font-bold">Provider verification</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <div key={p.id} data-testid={`provider-card-${p.id}`} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">{p.business_name || p.name}</h3>
                  <div className="mt-1 text-xs text-muted-foreground">{p.email}</div>
                </div>
                {p.verified ? (
                  <BadgeCheck size={16} className="mint-text" />
                ) : (
                  <ShieldOff size={16} className="text-amber-300" />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={12} /> {p.city || "—"}
                </span>
                <span>{p.years_experience} yrs</span>
                <span>{p.quotes_sent} quotes</span>
                <span>{p.leads_won} won</span>
              </div>
              {p.bio && <p className="mt-3 text-xs text-muted-foreground">{p.bio}</p>}
              <button
                data-testid={`verify-btn-${p.id}`}
                onClick={() => setVerified(p.id, !p.verified)}
                className={`mt-4 w-full rounded-full px-4 py-2.5 text-xs font-bold transition-colors ${
                  p.verified
                    ? "border border-border text-muted-foreground hover:text-foreground"
                    : "mint-bg text-[#030a1c]"
                }`}
              >
                {p.verified ? "Revoke verification" : "Verify provider"}
              </button>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-xl font-bold">All requests</h2>
        <div className="mt-6 space-y-4">
          {requests.length === 0 && (
            <p data-testid="admin-no-requests" className="text-sm text-muted-foreground">
              No requests posted yet.
            </p>
          )}
          {requests.map((r) => (
            <div key={r._id} data-testid={`admin-request-row-${r._id}`} className="glass flex flex-wrap items-center justify-between gap-5 rounded-2xl p-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-bold">{r.service_type_name}</h3>
                  <StatusBadge status={r.status} testId={`admin-status-${r._id}`} />
                  <span className="text-xs text-muted-foreground">{r.quotes_count} quotes</span>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {r.customer_name} · {r.preferred_date} {r.time_window} · {r.city} {r.postal_code}
                </div>
                {r.matched_provider_name && (
                  <div className="mt-2 text-xs mint-text">Matched with {r.matched_provider_name}</div>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {(r.budget_min || r.budget_max) && (
                  <span>
                    Budget {r.budget_min ? money(r.budget_min) : "—"} – {r.budget_max ? money(r.budget_max) : "—"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
