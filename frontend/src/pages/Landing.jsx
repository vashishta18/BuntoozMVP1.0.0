import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PriceEstimator } from "@/components/PriceEstimator";
import { ArrowRight, MessagesSquare, Package, Send, ShieldCheck, Sparkles, Wrench } from "lucide-react";

const ICONS = { sparkles: Sparkles, wrench: Wrench, package: Package };

export default function Landing() {
  const [types, setTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({ open_leads: 0, quotes_sent: 0, verified_pros: 0, matches_made: 0 });

  useEffect(() => {
    api.get("/service-types", { params: { category: "house-cleaning" } })
      .then(({ data }) => setTypes(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching service types:", err));

    api.get("/categories")
      .then(({ data }) => setCategories(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching categories:", err));

    api.get("/stats")
      .then(({ data }) => setStats(data || { open_leads: 0, quotes_sent: 0, verified_pros: 0, matches_made: 0 }))
      .catch((err) => console.error("Error fetching stats:", err));
  }, []);

  return (
    <div data-testid="landing-page">
      <section className="relative grain overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rise">
            <span
              data-testid="model-pill"
              className="inline-flex items-center gap-2 rounded-full border border-[#2ff2b3]/30 bg-[#2ff2b3]/8 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] mint-text"
            >
              <MessagesSquare size={14} /> Free lead board · No commission
            </span>
            <h1 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.03] sm:text-5xl lg:text-6xl">
              Post the job once.
              <br />
              Local pros come
              <br />
              <span className="mint-text">to you.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base text-muted-foreground sm:text-lg">
              Buntooz is a matchmaker, not a middleman. Describe what you need, independent local
              professionals send real quotes, and you pick who you deal with directly.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to="/post" data-testid="hero-post-btn" className="btn-mint px-7 py-3.5 text-sm">
                Post a request
              </Link>
              <Link to="/register" data-testid="hero-pro-link" className="btn-ghost-mint px-7 py-3.5 text-sm">
                I&apos;m a local pro
              </Link>
            </div>

            <div className="mt-14 grid max-w-2xl grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
              {[
                ["open-leads", stats?.open_leads || 0, "Open requests"],
                ["quotes-sent", stats?.quotes_sent || 0, "Quotes sent"],
                ["verified-pros", stats?.verified_pros || 0, "Verified pros"],
                ["matches", stats?.matches_made || 0, "Matches made"],
              ].map(([id, value, label]) => (
                <div key={id} data-testid={`stat-${id}`}>
                  <div className="display text-3xl font-extrabold mint-text sm:text-4xl">{value}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <PriceEstimator />
        </div>
      </section>

      <section className="px-5 pb-6 sm:px-8" data-testid="how-strip">
        <div className="mx-auto grid max-w-7xl gap-6 border-t border-border pt-12 md:grid-cols-3">
          {[
            ["01", "Post your request", "Service, date window, place and photos — two minutes."],
            ["02", "Get real quotes", "Verified local pros send a price and a message."],
            ["03", "Accept and connect", "Pick a quote; contact details are exchanged instantly."],
          ].map(([n, title, body]) => (
            <div key={n} className="flex gap-4">
              <span className="display shrink-0 text-3xl font-extrabold text-[#12305f]">{n}</span>
              <div>
                <div className="text-sm font-bold">{title}</div>
                <div className="mt-1.5 text-xs text-muted-foreground">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Categories</span>
          <h2 className="mt-4 max-w-2xl text-3xl font-extrabold sm:text-4xl">
            Starting with House Cleaning.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {Array.isArray(categories) && categories.map((c, i) => {
              const Icon = ICONS[c?.icon] || Sparkles;
              const live = c?.status === "live";
              return (
                <div
                  key={c?.slug || i}
                  data-testid={`category-card-${c?.slug}`}
                  className={`card-lift rise glass rounded-2xl p-7 ${live ? "" : "opacity-70"}`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <Icon size={26} className={live ? "mint-text" : "text-muted-foreground"} />
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                        live ? "border-[#2ff2b3]/40 mint-text" : "border-border text-muted-foreground"
                      }`}
                    >
                      {live ? "Live" : "Soon"}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold">{c?.name}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{c?.tagline}</p>
                  {live && (
                    <Link
                      to="/post"
                      data-testid={`category-cta-${c?.slug}`}
                      className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold mint-text"
                    >
                      Post a request <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                What people ask for
              </span>
              <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">Typical local pricing.</h2>
              <p className="mt-4 max-w-xl text-sm text-muted-foreground">
                Indicative ranges from local pros — your actual quotes come straight from them.
              </p>
            </div>
            <Link to="/post" data-testid="see-all-types-link" className="btn-ghost-mint px-5 py-2.5 text-sm">
              Start a request
            </Link>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.isArray(types) && types.map((s, i) => (
              <Link
                key={s?.slug || i}
                to={`/post?type=${s?.slug}`}
                data-testid={`type-card-${s?.slug}`}
                className="card-lift rise glass group overflow-hidden rounded-2xl"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="h-40 overflow-hidden">
                  <img
                    src={s?.image}
                    alt={s?.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-base font-bold">{s?.name}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{s?.typical_duration}</p>
                  <div className="mt-3 display text-lg font-extrabold mint-text">{s?.typical_range}</div>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold mint-text">
                    Request quotes <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-[#2ff2b3]/25 bg-[#05122e]/70 p-10 text-center sm:p-16">
          <h3 className="mx-auto max-w-2xl text-2xl font-extrabold sm:text-3xl">
            Stop calling around. Let them come to you.
          </h3>
          <p className="mt-4 text-sm text-muted-foreground">
            Free to post. Free to quote. No commission, ever.
          </p>
          <Link to="/post" data-testid="footer-cta-btn" className="btn-mint mt-8 inline-flex items-center gap-2 px-8 py-3.5 text-sm">
            <Send size={15} /> Post a request
          </Link>
        </div>
      </section>
    </div>
  );
}
