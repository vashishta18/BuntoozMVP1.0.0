import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Bell, Check, Mail, Smartphone, Star, Zap } from "lucide-react";

export const RecommendedPros = ({ requestId, notify, onNotifyChange }) => {
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState(notify || { email: true, sms: false });
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/requests/${requestId}/recommended-pros`)
      .then(({ data }) => setData(data))
      .catch(() => setData({ providers: [] }));
  }, [requestId]);

  const invite = async (providerId) => {
    setError("");
    try {
      await api.post(`/requests/${requestId}/invite`, { provider_id: providerId });
      setData((d) => ({
        ...d,
        providers: d.providers.map((p) => (p.id === providerId ? { ...p, invited: true } : p)),
      }));
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  const savePrefs = async (next) => {
    setPrefs(next);
    try {
      await api.put(`/requests/${requestId}/notifications`, next);
      onNotifyChange?.(next);
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  if (!data) return null;

  return (
    <div className="mt-6" data-testid={`recommended-pros-${requestId}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-sm font-bold">
          Recommended Local Pros Near You{data.area ? ` (${data.area})` : ""}
        </h4>
        <span
          data-testid={`response-sla-${requestId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#2ff2b3]/30 bg-[#2ff2b3]/8 px-3 py-1 text-[11px] font-bold mint-text"
        >
          <Zap size={11} /> Pros in {data.area?.split(" ").pop()} usually respond within {data.response_sla}
        </span>
      </div>

      {data.providers.length === 0 ? (
        <p data-testid={`no-recommended-${requestId}`} className="mt-4 text-xs text-muted-foreground">
          No verified pros listed in your area yet — your request is still live on the open board.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.providers.map((p) => (
            <div
              key={p.id}
              data-testid={`recommended-card-${p.id}`}
              className="card-lift rounded-2xl border border-border bg-[#030a1c]/60 p-5"
            >
              <div className="flex items-center gap-3">
                {p.avatar ? (
                  <img src={p.avatar} alt={p.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#12305f] text-sm font-bold mint-text">
                    {p.name?.slice(0, 1)}
                  </span>
                )}
                <div>
                  <div className="text-sm font-bold">{p.name}</div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 mint-text">
                      <Star size={11} fill="#2ff2b3" /> {p.rating}
                    </span>
                    <span data-testid={`recommended-jobs-${p.id}`}>{p.jobs_completed} jobs done</span>
                  </div>
                </div>
              </div>
              {p.bio && <p className="mt-4 text-xs text-muted-foreground">{p.bio}</p>}
              <button
                data-testid={`invite-btn-${p.id}`}
                disabled={p.invited || p.already_quoted}
                onClick={() => invite(p.id)}
                className={`mt-5 w-full rounded-full px-4 py-2.5 text-xs font-bold transition-colors ${
                  p.invited || p.already_quoted
                    ? "border border-[#2ff2b3]/40 mint-text"
                    : "mint-bg text-[#030a1c] hover:opacity-90"
                }`}
              >
                {p.already_quoted ? (
                  "Already quoted"
                ) : p.invited ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Invited <Check size={12} />
                  </span>
                ) : (
                  "Invite to Quote"
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-[#030a1c]/50 px-5 py-4">
        <span className="inline-flex items-center gap-2 text-xs font-bold">
          <Bell size={13} className="mint-text" /> Get notified when quotes arrive
        </span>
        {[
          ["email", "Email", Mail],
          ["sms", "SMS", Smartphone],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            data-testid={`notify-toggle-${key}-${requestId}`}
            onClick={() => savePrefs({ ...prefs, [key]: !prefs[key] })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-colors ${
              prefs[key]
                ? "border-[#2ff2b3] mint-text bg-[#2ff2b3]/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={11} /> {label} {prefs[key] ? "on" : "off"}
          </button>
        ))}
      </div>

      {error && (
        <p data-testid={`recommended-error-${requestId}`} className="mt-3 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
};
