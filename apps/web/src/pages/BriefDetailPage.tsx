import {
  BUDGET_LABELS,
  PIPELINE_LABELS,
  PIPELINE_STATUSES,
  PRIORITIES,
  type AiScores,
  type Brief,
  type PipelineStatus,
} from "@fugo/shared";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { AiStatusBadge, PriorityBadge } from "../components/badges";
import { Spinner } from "../components/brand";
import { api } from "../lib/api";
import { formatDate, formatDateTime, formatPercent } from "../lib/format";

const POLL_MS = 3000;

type Action = "process" | "pipeline" | "email";

// Keyed by id: going from one brief to another mounts a fresh page, so a late
// response for the old brief can never land on the new one.
export function BriefDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <BriefDetailPage key={id} id={id!} />;
}

function BriefDetailPage({ id }: { id: string }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Polls and actions can overlap. Each request takes a number, and only the
  // newest one may write the brief, so an old poll cannot undo a newer result.
  const latestRequest = useRef(0);
  const applyIfLatest = useCallback((requestId: number, next: Brief) => {
    if (requestId === latestRequest.current) setBrief(next);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const data = await api<{ brief: Brief }>(`/admin/briefs/${id}`);
      applyIfLatest(requestId, data.brief);
    } catch (err) {
      if (requestId === latestRequest.current) {
        setError(err instanceof Error ? err.message : "Gagal memuat brief");
      }
    }
  }, [id, applyIfLatest]);

  useEffect(() => {
    void load();
  }, [load]);

  // Analysis and email draft both run in the background on the server. Their
  // status is saved there, so polling picks it up again after leaving the page.
  const serverBusy = brief?.ai_status === "processing" || brief?.email_draft_status === "processing";
  useEffect(() => {
    if (!serverBusy || busy === "process") return;
    const timer = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(timer);
  }, [brief, serverBusy, busy, load]);

  async function run(kind: Action, request: () => Promise<{ brief: Brief }>) {
    const requestId = ++latestRequest.current;
    setBusy(kind);
    setActionError(null);
    try {
      applyIfLatest(requestId, (await request()).brief);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Aksi gagal");
      // A 409 means the server is already busy; fetch the real state.
      void load();
    } finally {
      setBusy(null);
    }
  }

  const reprocess = () => run("process", () => api(`/admin/briefs/${id}/process`, { method: "POST" }));
  const changePipeline = (status: PipelineStatus) =>
    run("pipeline", () =>
      api(`/admin/briefs/${id}/pipeline`, { method: "PATCH", body: { pipeline_status: status } }),
    );
  const draftEmail = () => run("email", () => api(`/admin/briefs/${id}/email-draft`, { method: "POST" }));

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
      </div>
    );
  }
  if (!brief) return <DetailSkeleton />;

  const ai = brief.ai_result;
  const scores = brief.ai_scores;
  const processing = brief.ai_status === "processing" || busy === "process";
  // From the server, so it survives leaving the page; busy covers the click itself.
  const drafting = brief.email_draft_status === "processing" || busy === "email";

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{brief.company}</h1>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {brief.name} · masuk {formatDateTime(brief.created_at)}
          </p>
        </div>
        {ai && <PriorityBadge priority={ai.priority} />}
      </div>

      <PipelineStepper value={brief.pipeline_status} saving={busy === "pipeline"} onChange={changePipeline} />

      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3" aria-labelledby="ai-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-center gap-2.5">
              <h2 id="ai-heading" className="text-sm font-semibold">
                Hasil AI
              </h2>
              <AiStatusBadge status={processing ? "processing" : brief.ai_status} />
            </div>
            <button type="button" className="btn btn-secondary min-w-40" onClick={reprocess} disabled={processing}>
              {processing ? <Spinner /> : <RefreshIcon />}
              Proses ulang AI
            </button>
          </div>

          <div className="space-y-5 p-5">
            {brief.ai_status === "failed" && brief.ai_error && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <p className="font-medium">AI gagal memproses brief ini.</p>
                <p className="mt-0.5 break-words text-red-700/80">{brief.ai_error}</p>
              </div>
            )}

            {ai ? (
              <>
                <p className="text-base text-pretty">{ai.summary}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Stat label="Kategori">
                    <span className="font-medium">{ai.service_category}</span>
                    {scores && (
                      <span className="ml-2 text-xs text-muted tabular-nums">
                        {formatPercent(scores.category.confidence)} yakin
                      </span>
                    )}
                  </Stat>
                  <Stat label="Alasan prioritas">{ai.priority_reason}</Stat>
                </div>

                {scores && <PriorityBars probabilities={scores.priority.probabilities} chosen={ai.priority} />}

                <Stat label="Info yang masih kurang">
                  {ai.missing_info.length ? (
                    <ul className="space-y-1.5">
                      {ai.missing_info.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">Tidak ada, brief sudah lengkap.</span>
                  )}
                </Stat>

                <p className="border-t border-line pt-4 text-xs text-muted tabular-nums">
                  {brief.ai_model} · percobaan ke-{brief.ai_attempts}
                  {brief.ai_processed_at && ` · ${formatDateTime(brief.ai_processed_at)}`}
                </p>
              </>
            ) : processing ? (
              <div aria-busy className="space-y-3">
                <p className="text-sm text-muted">AI sedang membaca brief ini…</p>
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            ) : (
              brief.ai_status !== "failed" && <p className="text-sm text-muted">Belum ada hasil.</p>
            )}
          </div>
        </section>

        <section className="card lg:col-span-2" aria-labelledby="form-heading">
          <h2 id="form-heading" className="border-b border-line px-5 py-3 text-sm font-semibold leading-10">
            Data dari form
          </h2>
          <div className="space-y-4 p-5 text-sm">
            <Stat label="Nama">{brief.name}</Stat>
            <Stat label="Email">
              <a href={`mailto:${brief.email}`} className="break-all underline-offset-2 hover:underline">
                {brief.email}
              </a>
            </Stat>
            <Stat label="Perusahaan">{brief.company}</Stat>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Budget">{BUDGET_LABELS[brief.budget_range]}</Stat>
              <Stat label="Target timeline">
                <span className="tabular-nums">{formatDate(brief.target_date)}</span>
              </Stat>
            </div>
            <Stat label="Kebutuhan">
              <p className="whitespace-pre-wrap">{brief.need}</p>
            </Stat>
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="email-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="email-heading" className="text-sm font-semibold">
            Draft email balasan
          </h2>
          <button
            type="button"
            className="btn btn-secondary min-w-44"
            onClick={draftEmail}
            disabled={drafting}
          >
            {drafting && <Spinner />}
            {drafting ? "Membuat draft…" : brief.email_draft ? "Buat ulang draft" : "Buat draft dengan AI"}
          </button>
        </div>
        <div className="space-y-4 p-5">
          {brief.email_draft_status === "failed" && brief.email_draft_error && !drafting && (
            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <p className="font-medium">AI gagal membuat draft. Coba lagi.</p>
              <p className="mt-0.5 break-words text-red-700/80">{brief.email_draft_error}</p>
            </div>
          )}
          {drafting && !brief.email_draft ? (
            <div aria-busy className="space-y-3">
              <p className="text-sm text-muted">AI sedang menulis draft…</p>
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : brief.email_draft ? (
            <EmailDraftView to={brief.email} subject={brief.email_draft.subject} body={brief.email_draft.body} />
          ) : (
            <p className="text-sm text-muted">
              Belum ada draft. AI akan menulis balasan pertama berdasarkan brief ini dan info yang masih kurang.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// New → Contacted → Proposal, then one of two outcomes. Buttons (not a select)
// so the whole pipeline is visible and one click moves the brief.
function PipelineStepper(props: {
  value: PipelineStatus;
  saving: boolean;
  onChange: (status: PipelineStatus) => void;
}) {
  const isOutcome = (status: PipelineStatus) => status === "won" || status === "lost";
  const stages = PIPELINE_STATUSES.filter((status) => !isOutcome(status));
  const outcomes = PIPELINE_STATUSES.filter(isOutcome);
  const currentIndex = PIPELINE_STATUSES.indexOf(props.value);

  const button = (status: PipelineStatus) => {
    const selected = status === props.value;
    // Stages before the current one are shown as done.
    const passed = !isOutcome(status) && PIPELINE_STATUSES.indexOf(status) < currentIndex;
    const selectedStyle =
      status === "won"
        ? "bg-brand-strong text-white border-brand-strong"
        : status === "lost"
          ? "bg-stone-600 text-white border-stone-600"
          : "bg-ink text-white border-ink";
    return (
      <button
        key={status}
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={props.saving}
        onClick={() => !selected && props.onChange(status)}
        className={`btn min-w-24 border ${
          selected
            ? selectedStyle
            : passed
              ? "border-line bg-brand-soft text-brand-deep hover:border-brand/40"
              : "border-line bg-white text-muted hover:border-ink/20 hover:text-ink"
        }`}
      >
        {PIPELINE_LABELS[status]}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span id="pipeline-label" className="mr-1 text-xs font-medium text-muted">
        Pipeline
      </span>
      <div role="radiogroup" aria-labelledby="pipeline-label" className="flex flex-wrap items-center gap-2">
        {stages.map((status, index) => (
          <span key={status} className="flex items-center gap-2">
            {index > 0 && <ChevronIcon />}
            {button(status)}
          </span>
        ))}
        <ChevronIcon />
        {outcomes.map(button)}
      </div>
      <span className="flex size-5 items-center justify-center text-muted">{props.saving && <Spinner />}</span>
    </div>
  );
}

function PriorityBars({
  probabilities,
  chosen,
}: {
  probabilities: AiScores["priority"]["probabilities"];
  chosen: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-muted">Probabilitas prioritas (Gemini Decisions)</p>
      <div className="space-y-1.5">
        {PRIORITIES.map((priority) => {
          const value = probabilities[priority] ?? 0;
          const isChosen = priority === chosen;
          return (
            <div key={priority} className="flex items-center gap-3 text-xs">
              <span className={`w-14 ${isChosen ? "text-ink" : "text-muted"}`}>{priority}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
                <div
                  className={`h-full rounded-full ${isChosen ? "bg-brand" : "bg-ink/20"}`}
                  style={{ width: `${Math.round(value * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right text-muted tabular-nums">{formatPercent(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmailDraftView({ to, subject, body }: { to: string; subject: string; body: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="text-muted">Subjek:</span> <span className="font-medium">{subject}</span>
      </p>
      <pre className="max-h-96 overflow-auto rounded-lg border border-line bg-paper p-4 font-sans leading-relaxed whitespace-pre-wrap">
        {body}
      </pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary min-w-24" onClick={copy}>
          {copied ? "Tersalin" : "Salin"}
        </button>
        <a
          className="btn btn-secondary"
          href={`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        >
          Buka di aplikasi email
        </a>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin"
      className="-mx-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors duration-150 ease-out hover:text-ink"
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-4">
        <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Semua brief
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy className="space-y-6">
      <div className="skeleton h-5 w-24" />
      <div className="space-y-2">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-48" />
      </div>
      <div className="skeleton h-10 w-full max-w-xl" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="skeleton h-80 lg:col-span-3" />
        <div className="skeleton h-80 lg:col-span-2" />
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-4">
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.8h-2.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5 shrink-0 text-ink/25">
      <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
