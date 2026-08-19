export const STATUS_LABEL = {
  open: "Collecting quotes",
  matched: "Matched",
  closed: "Closed",
  pending: "Awaiting reply",
  accepted: "Accepted",
  declined: "Not selected",
};

const TONE = {
  open: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  matched: "bg-[#2ff2b3]/10 text-[#2ff2b3] border-[#2ff2b3]/30",
  closed: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  accepted: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  declined: "bg-rose-400/10 text-rose-300 border-rose-400/30",
};

export const StatusBadge = ({ status, testId }) => (
  <span
    data-testid={testId || `status-${status}`}
    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
      TONE[status] || "border-border bg-muted text-muted-foreground"
    }`}
  >
    {STATUS_LABEL[status] || status}
  </span>
);
