import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, ShieldCheck, Sparkles } from "lucide-react";

const BEDROOMS = ["1", "2", "3", "4", "5+"];
const BATHROOMS = ["1", "2", "3", "4+"];
const TYPES = [
  { slug: "standard-clean", label: "Standard Clean", multiplier: 1 },
  { slug: "deep-clean", label: "Deep Clean", multiplier: 1.4 },
];

const round5 = (n) => Math.round(n / 5) * 5;

export const PriceEstimator = () => {
  const navigate = useNavigate();
  const [beds, setBeds] = useState("2");
  const [baths, setBaths] = useState("1");
  const [type, setType] = useState("standard-clean");

  const estimate = useMemo(() => {
    const bedCount = beds === "5+" ? 5 : Number(beds);
    const bathCount = baths === "4+" ? 4 : Number(baths);
    const multiplier = TYPES.find((t) => t.slug === type).multiplier;
    const base = (80 + bedCount * 20 + bathCount * 15) * multiplier;
    const hours = (1.5 + bedCount * 0.4 + bathCount * 0.3) * multiplier;
    return {
      low: round5(base),
      high: round5(base * 1.25),
      hours: Math.round(hours * 2) / 2,
    };
  }, [beds, baths, type]);

  const go = () =>
    navigate(`/post?type=${type}&beds=${encodeURIComponent(beds)}&baths=${encodeURIComponent(baths)}`);

  const selectCls =
    "w-full appearance-none rounded-xl border border-border bg-[#030a1c] px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-[#2ff2b3]";

  return (
    <div className="rise glass rounded-3xl p-7" data-testid="price-estimator">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Instant price estimator
        </span>
        <span className="flex items-center gap-2 text-xs font-bold mint-text">
          <span className="pulse-dot h-2 w-2 rounded-full mint-bg" /> Live
        </span>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bedrooms</span>
          <select
            data-testid="estimator-bedrooms-select"
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className={`mt-2 ${selectCls}`}
          >
            {BEDROOMS.map((b) => (
              <option key={b} value={b}>
                {b} {b === "1" ? "bedroom" : "bedrooms"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bathrooms</span>
          <select
            data-testid="estimator-bathrooms-select"
            value={baths}
            onChange={(e) => setBaths(e.target.value)}
            className={`mt-2 ${selectCls}`}
          >
            {BATHROOMS.map((b) => (
              <option key={b} value={b}>
                {b} {b === "1" ? "bathroom" : "bathrooms"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cleaning type</span>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-full border border-border p-1">
          {TYPES.map((t) => (
            <button
              key={t.slug}
              data-testid={`estimator-type-${t.slug}`}
              onClick={() => setType(t.slug)}
              className={`rounded-full px-3 py-2.5 text-xs font-bold transition-colors ${
                type === t.slug ? "mint-bg text-[#030a1c]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 rounded-2xl border border-[#2ff2b3]/25 bg-[#030a1c]/70 p-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Estimated range
        </div>
        <div data-testid="estimator-range" className="display mt-2 text-4xl font-extrabold mint-text">
          ${estimate.low} – ${estimate.high}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <span data-testid="estimator-duration" className="inline-flex items-center gap-1.5">
            <Clock size={13} className="mint-text" /> Avg completion ~{estimate.hours} hours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={13} className="mint-text" /> Based on local pro pricing
          </span>
        </div>
      </div>

      <button
        data-testid="estimator-cta-btn"
        onClick={go}
        className="btn-mint mt-6 flex w-full items-center justify-center gap-2 px-6 py-3.5 text-sm"
      >
        Get Exact Quotes from Local Pros <ArrowRight size={16} />
      </button>

      <p className="mt-5 flex items-start gap-2.5 text-xs text-muted-foreground">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 mint-text" />
        An estimate only — your real prices come from independent local pros, and we never take a cut.
      </p>
    </div>
  );
};
