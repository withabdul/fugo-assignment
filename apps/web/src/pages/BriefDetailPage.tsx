import {
  BUDGET_LABELS,
  PIPELINE_LABELS,
  PIPELINE_STATUSES,
  PRIORITIES,
  type Brief,
  type PipelineStatus,
} from "@fugo/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { AiStatusBadge, PriorityBadge } from "../components/badges";
import { api } from "../lib/api";
import { formatDate, formatDateTime, formatPercent } from "../lib/format";

const POLL_MS = 3000;

export function BriefDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"process" | "pipeline" | "email" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ brief: Brief }>(`/admin/briefs/${id}`);
      setBrief(data.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat brief");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // A new brief is analyzed in the background, so poll until it is done.
  useEffect(() => {
    if (brief?.ai_status !== "processing" || busy === "process") return;
    const timer = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(timer);
  }, [brief, busy, load]);

  async function run(kind: "process" | "pipeline" | "email", request: () => Promise<{ brief: Brief }>) {
    setBusy(kind);
    setActionError(null);
    try {
      setBrief((await request()).brief);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Aksi gagal");
    } finally {
      setBusy(null);
    }
  }

  const reprocess = () =>
    run("process", () => api(`/admin/briefs/${id}/process`, { method: "POST" }));
  const changePipeline = (status: PipelineStatus) =>
    run("pipeline", () => api(`/admin/briefs/${id}/pipeline`, { method: "PATCH", body: { pipeline_status: status } }));
  const draftEmail = () => run("email", () => api(`/admin/briefs/${id}/email-draft`, { method: "POST" }));

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!brief) return <p className="text-sm text-muted">Memuat…</p>;

  const ai = brief.ai_result;
  const scores = brief.ai_scores;
  const processing = brief.ai_status === "processing" || busy === "process";

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{brief.company}</h1>
          <p className="mt-1 text-sm text-muted">Masuk {formatDateTime(brief.created_at)}</p>
        </div>
        <label className="text-xs text-muted">
          <span className="mb-1 block">Status pipeline</span>
          <select
            className="field-input min-w-44"
            value={brief.pipeline_status}
            disabled={busy === "pipeline"}
            onChange={(e) => changePipeline(e.target.value as PipelineStatus)}
          >
            {PIPELINE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PIPELINE_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Data dari form</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Nama">{brief.name}</Row>
            <Row label="Email">
              <a href={`mailto:${brief.email}`} className="hover:underline">
                {brief.email}
              </a>
            </Row>
            <Row label="Perusahaan">{brief.company}</Row>
            <Row label="Budget">{BUDGET_LABELS[brief.budget_range]}</Row>
            <Row label="Target timeline">{formatDate(brief.target_date)}</Row>
            <Row label="Kebutuhan">
              <p className="whitespace-pre-wrap">{brief.need}</p>
            </Row>
          </dl>
        </section>

        <section className="card p-5 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Hasil AI</h2>
              <AiStatusBadge status={processing ? "processing" : brief.ai_status} />
            </div>
            <button type="button" className="btn-secondary" onClick={reprocess} disabled={processing}>
              {processing ? "Memproses…" : "Proses ulang AI"}
            </button>
          </div>

          {brief.ai_status === "failed" && brief.ai_error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm break-words text-red-700">
              AI gagal: {brief.ai_error}
            </p>
          )}

          {ai ? (
            <dl className="space-y-4 text-sm">
              <Row label="Ringkasan">{ai.summary}</Row>
              <div className="grid gap-4 sm:grid-cols-2">
                <Row label="Kategori">
                  {ai.service_category}
                  {scores && (
                    <span className="ml-2 text-xs text-muted tabular-nums">
                      {formatPercent(scores.category.confidence)} yakin
                    </span>
                  )}
                </Row>
                <Row label="Prioritas">
                  <PriorityBadge priority={ai.priority} />
                  {scores && (
                    <span className="ml-2 text-xs text-muted tabular-nums">
                      {PRIORITIES.map((p) => `${p} ${formatPercent(scores.priority.probabilities[p])}`).join(" · ")}
                    </span>
                  )}
                </Row>
              </div>
              <Row label="Alasan prioritas">{ai.priority_reason}</Row>
              <Row label="Info yang masih kurang">
                {ai.missing_info.length ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {ai.missing_info.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">Tidak ada</span>
                )}
              </Row>
              <p className="text-xs text-muted">
                {brief.ai_model} · percobaan ke-{brief.ai_attempts}
                {brief.ai_processed_at && ` · ${formatDateTime(brief.ai_processed_at)}`}
              </p>
            </dl>
          ) : (
            !processing && brief.ai_status !== "failed" && <p className="text-sm text-muted">Belum ada hasil.</p>
          )}
          {processing && !ai && <p className="text-sm text-muted">AI sedang membaca brief ini…</p>}
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Draft email balasan</h2>
          <button type="button" className="btn-secondary" onClick={draftEmail} disabled={busy === "email"}>
            {busy === "email" ? "Membuat draft…" : brief.email_draft ? "Buat ulang draft" : "Buat draft dengan AI"}
          </button>
        </div>
        {brief.email_draft ? (
          <EmailDraftView to={brief.email} subject={brief.email_draft.subject} body={brief.email_draft.body} />
        ) : (
          <p className="text-sm text-muted">Belum ada draft. AI akan menulis balasan pertama berdasarkan brief ini.</p>
        )}
      </section>
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
      <pre className="rounded-md bg-paper p-4 font-sans whitespace-pre-wrap">{body}</pre>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? "Tersalin" : "Salin"}
        </button>
        <a
          className="btn-secondary"
          href={`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        >
          Buka di aplikasi email
        </a>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 text-xs text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/admin" className="text-sm text-muted hover:text-ink">
      ← Semua brief
    </Link>
  );
}
