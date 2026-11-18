import { PIPELINE_LABELS, type AiStatus, type PipelineStatus, type Priority } from "@fugo/shared";

const base = "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const PRIORITY_STYLES: Record<Priority, string> = {
  High: "bg-red-50 text-red-700 ring-1 ring-red-200",
  Medium: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  Low: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className="text-sm text-muted">—</span>;
  return <span className={`${base} ${PRIORITY_STYLES[priority]}`}>{priority}</span>;
}

const AI_STATUS: Record<AiStatus, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-slate-100 text-slate-600" },
  processing: { label: "Diproses", className: "bg-sky-50 text-sky-700" },
  done: { label: "Selesai", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Gagal", className: "bg-red-50 text-red-700" },
};

export function AiStatusBadge({ status }: { status: AiStatus }) {
  const { label, className } = AI_STATUS[status];
  return (
    <span className={`${base} ${className}`}>
      <span
        aria-hidden
        className={`size-1.5 rounded-full bg-current ${status === "processing" ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}

const PIPELINE_STYLES: Record<PipelineStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-sky-50 text-sky-700",
  proposal: "bg-violet-50 text-violet-700",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-stone-100 text-stone-500",
};

export function PipelineBadge({ status }: { status: PipelineStatus }) {
  return <span className={`${base} ${PIPELINE_STYLES[status]}`}>{PIPELINE_LABELS[status]}</span>;
}
