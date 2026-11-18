import { PRIORITIES, SERVICE_CATEGORIES, type BriefListItem } from "@fugo/shared";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AiStatusBadge, PipelineBadge, PriorityBadge } from "../components/badges";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";

const POLL_MS = 10_000;
const POLL_PROCESSING_MS = 4_000;
const SKELETON_ROWS = 5;

const timeFormat = new Intl.DateTimeFormat("id-ID", { timeStyle: "medium", timeZone: "Asia/Jakarta" });

export function BriefListPage() {
  const navigate = useNavigate();
  // Filters live in the URL, so a filtered view can be shared or reloaded.
  const [searchParams, setSearchParams] = useSearchParams();
  const priority = searchParams.get("priority") ?? "";
  const category = searchParams.get("category") ?? "";
  const filtered = Boolean(priority || category);

  const [briefs, setBriefs] = useState<BriefListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // Set after every request, success or failure, so polling never stops on an error.
  const [fetchedAt, setFetchedAt] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Polling instead of push: realtime on Workers needs Durable Objects, which is
  // too much for an internal list. Faster while the AI is still working.
  const anyProcessing = briefs?.some((brief) => brief.ai_status === "processing") ?? false;
  useEffect(() => {
    const delay = anyProcessing ? POLL_PROCESSING_MS : POLL_MS;
    const refresh = () => setRefreshTick((tick) => tick + 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (document.visibilityState === "visible") timer = setTimeout(refresh, delay);

    // No requests from a hidden tab; refresh at once when the admin comes back.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
      else clearTimeout(timer);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [anyProcessing, fetchedAt]);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (priority) query.set("priority", priority);
    if (category) query.set("category", category);

    api<{ briefs: BriefListItem[] }>(`/admin/briefs?${query}`)
      .then((data) => {
        if (cancelled) return;
        setBriefs(data.briefs);
        setError(null);
        setUpdatedAt(new Date());
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setFetchedAt(Date.now()));
    return () => {
      cancelled = true;
    };
  }, [priority, category, refreshTick]);

  function setFilter(key: "priority" | "category", value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Brief masuk</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted tabular-nums">
            <span aria-hidden className="size-2 rounded-full bg-brand" title="Diperbarui otomatis" />
            {briefs ? `${briefs.length} brief` : "Memuat"}
            {updatedAt && <> · diperbarui {timeFormat.format(updatedAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Prioritas"
            value={priority}
            options={PRIORITIES}
            onChange={(value) => setFilter("priority", value)}
          />
          <FilterSelect
            label="Kategori"
            value={category}
            options={SERVICE_CATEGORIES}
            onChange={(value) => setFilter("category", value)}
          />
          {filtered && (
            <button type="button" className="btn btn-ghost" onClick={() => setSearchParams({}, { replace: true })}>
              Reset
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {briefs && briefs.length === 0 ? (
        <EmptyState filtered={filtered} onReset={() => setSearchParams({}, { replace: true })} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-paper/60 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Perusahaan</th>
                <th className="px-4 py-3 font-medium">Prioritas</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Status AI</th>
                <th className="px-4 py-3 font-medium">Pipeline</th>
                <th className="px-4 py-3 text-right font-medium">Masuk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {briefs
                ? briefs.map((brief) => (
                    <tr
                      key={brief.id}
                      // The whole row is a click target; the company link keeps it keyboard reachable.
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a")) return;
                        navigate(`/admin/briefs/${brief.id}`);
                      }}
                      className="h-16 cursor-pointer transition-colors duration-150 ease-out hover:bg-paper"
                    >
                      <td className="max-w-72 px-4 py-2.5">
                        <Link
                          to={`/admin/briefs/${brief.id}`}
                          className="block truncate font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {brief.company}
                        </Link>
                        <div className="truncate text-xs text-muted">{brief.name}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <PriorityBadge priority={brief.priority} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {brief.service_category ?? <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <AiStatusBadge status={brief.ai_status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <PipelineBadge status={brief.pipeline_status} />
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap text-muted tabular-nums">
                        {formatDateTime(brief.created_at)}
                      </td>
                    </tr>
                  ))
                : Array.from({ length: SKELETON_ROWS }, (_, index) => <SkeletonRow key={index} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// Same height and columns as a real row, so nothing moves when data arrives.
function SkeletonRow() {
  return (
    <tr aria-hidden className="h-16">
      <td className="px-4 py-2.5">
        <div className="skeleton h-4 w-36" />
        <div className="skeleton mt-1.5 h-3 w-20" />
      </td>
      <td className="px-4 py-2.5">
        <div className="skeleton h-5 w-14 rounded-full" />
      </td>
      <td className="px-4 py-2.5">
        <div className="skeleton h-4 w-20" />
      </td>
      <td className="px-4 py-2.5">
        <div className="skeleton h-5 w-16 rounded-full" />
      </td>
      <td className="px-4 py-2.5">
        <div className="skeleton h-5 w-16 rounded-full" />
      </td>
      <td className="px-4 py-2.5">
        <div className="skeleton ml-auto h-4 w-28" />
      </td>
    </tr>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const formUrl = `${window.location.origin}/`;

  async function copyLink() {
    await navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card flex min-h-[400px] flex-col items-center justify-center px-6 py-12 text-center">
      {filtered ? (
        <>
          <h2 className="font-semibold">Tidak ada brief yang cocok</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">Coba ubah prioritas atau kategori.</p>
          <button type="button" className="btn btn-secondary mt-6" onClick={onReset}>
            Reset filter
          </button>
        </>
      ) : (
        <>
          <h2 className="font-semibold">Belum ada brief masuk</h2>
          <p className="mt-1 max-w-sm text-pretty text-sm text-muted">
            Brief dari calon klien muncul di sini, lengkap dengan ringkasan dan prioritas dari AI. Bagikan link form
            ke klien untuk mulai.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary min-w-40" onClick={copyLink}>
              {copied ? "Link tersalin" : "Salin link form"}
            </button>
            <a href="/" target="_blank" rel="noreferrer" className="btn btn-secondary">
              Buka form
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-muted">
      <span className="mb-1 block">{label}</span>
      <select className="field-input min-w-40" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Semua</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
