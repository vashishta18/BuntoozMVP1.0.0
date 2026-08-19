import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError, money } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { RecommendedPros } from "@/components/RecommendedPros";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  MapPin,
  MessagesSquare,
  Phone,
  Plus,
} from "lucide-react";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  const load = () => api.get("/requests").then(({ data }) => setRequests(data));

  useEffect(() => {
    load();
  }, []);

  const toggle = async (id) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    try {
      const { data } = await api.get(`/requests/${id}/quotes`);
      setQuotes((q) => ({ ...q, [id]: data }));
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  const accept = async (requestId, quoteId) => {
    setError("");
    try {
      await api.post(`/quotes/${quoteId}/accept`);
      const { data } = await api.get(`/requests/${requestId}/quotes`);
      setQuotes((q) => ({ ...q, [requestId]: data }));
      load();
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  const close = async (id) => {
    setError("");
    try {
      await api.post(`/requests/${id}/close`);
      load();
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="px-5 py-12 sm:px-8" data-testid="customer-dashboard">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Your requests
            </span>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Hey {user?.name?.split(" ")[0]}.</h1>
          </div>
          <Link to="/post" data-testid="new-request-btn" className="btn-mint inline-flex items-center gap-1.5 px-6 py-3 text-sm">
            <Plus size={15} /> Post a request
          </Link>
        </div>

        {error && (
          <p data-testid="dashboard-error" className="mt-6 text-sm text-rose-400">
            {error}
          </p>
        )}

        {requests.length === 0 ? (
          <p data-testid="no-requests" className="mt-10 text-sm text-muted-foreground">
            No requests yet. Post one and local pros will start quoting.
          </p>
        ) : (
          <div className="mt-10 space-y-4">
            {requests.map((r) => (
              <div key={r._id} data-testid={`request-row-${r._id}`} className="glass rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base font-bold">{r.service_type_name}</h3>
                      <StatusBadge status={r.status} testId={`request-status-${r._id}`} />
                      <span
                        data-testid={`quote-count-${r._id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold mint-text"
                      >
                        <MessagesSquare size={12} /> {r.quotes_count} quote{r.quotes_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> {r.preferred_date} · {r.time_window}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} /> {r.city} {r.postal_code}
                      </span>
                      <span>{r.property_size}</span>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{r.description}</p>
                    {r.photos?.length > 0 && (
                      <div className="mt-4 flex gap-3" data-testid={`request-photos-${r._id}`}>
                        {r.photos.map((p) => (
                          <img
                            key={p}
                            src={`${api.defaults.baseURL}/uploads/${p}`}
                            alt="request"
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {r.matched_provider_name && (
                      <p data-testid={`matched-with-${r._id}`} className="mt-4 text-sm font-bold mint-text">
                        Matched with {r.matched_provider_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {(r.budget_min || r.budget_max) && (
                      <div className="text-xs text-muted-foreground">
                        Budget {r.budget_min ? money(r.budget_min) : "—"} – {r.budget_max ? money(r.budget_max) : "—"}
                      </div>
                    )}
                    {r.status === "open" && (
                      <button
                        data-testid={`close-request-btn-${r._id}`}
                        onClick={() => close(r._id)}
                        className="mt-3 text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                      >
                        Close request
                      </button>
                    )}
                  </div>
                </div>

                <button
                  data-testid={`quotes-toggle-${r._id}`}
                  onClick={() => toggle(r._id)}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold mint-text"
                >
                  {open === r._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} View quotes
                </button>

                {open === r._id && (
                  <div className="mt-5 space-y-4 border-t border-border pt-6" data-testid={`quotes-list-${r._id}`}>
                    {(quotes[r._id] || []).length === 0 && (
                      <>
                        <p data-testid={`no-quotes-${r._id}`} className="text-xs text-muted-foreground">
                          No quotes yet — verified pros in your area see this request on the lead board.
                        </p>
                        {r.status === "open" && (
                          <RecommendedPros requestId={r._id} notify={r.notify} />
                        )}
                      </>
                    )}
                    {(quotes[r._id] || []).map((q) => (
                      <div
                        key={q._id}
                        data-testid={`quote-card-${q._id}`}
                        className={`rounded-2xl border p-5 ${
                          q.status === "accepted" ? "border-[#2ff2b3]/50 bg-[#2ff2b3]/6" : "border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <h4 className="text-sm font-bold">{q.provider_name}</h4>
                              <StatusBadge status={q.status} testId={`quote-status-${q._id}`} />
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {q.provider_city} · {q.provider_rating_note}
                              {q.available_date && ` · can do ${q.available_date}`}
                            </div>
                            <p className="mt-3 max-w-xl text-sm">{q.message}</p>
                            {q.status === "accepted" && (
                              <div data-testid={`contact-${q._id}`} className="mt-4 flex flex-wrap gap-5 text-xs mint-text">
                                {q.provider_phone && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Phone size={12} /> {q.provider_phone}
                                  </span>
                                )}
                                {q.provider_email && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Mail size={12} /> {q.provider_email}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="display text-2xl font-extrabold mint-text">{money(q.price)}</div>
                            {q.status === "pending" && r.status === "open" && (
                              <button
                                data-testid={`accept-quote-btn-${q._id}`}
                                onClick={() => accept(r._id, q._id)}
                                className="btn-mint mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                              >
                                <CheckCircle2 size={12} /> Accept &amp; connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
