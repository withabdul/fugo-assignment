import { PRIORITIES, SERVICE_CATEGORIES, type BriefListItem } from "@fugo/shared";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AiStatusBadge, PipelineBadge, PriorityBadge } from "../components/badges";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";

export function BriefListPage() {
  // Filters live in the URL, so a filtered view can be shared or reloaded.
  const [searchParams, setSearchParams] = useSearchParams();
  const priority = searchParams.get("priority") ?? "";
  const category = searchParams.get("category") ?? "";

  const [briefs, setBriefs] = useState<BriefListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // New briefs are analyzed in the background. Refresh while any is still running.
  const anyProcessing = briefs?.some((brief) => brief.ai_status === "processing") ?? false;
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setTimeout(() => setRefreshTick((tick) => tick + 1), 4000);
    return () => clearTimeout(timer);
  }, [anyProcessing, briefs]);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (priority) query.set("priority", priority);
    if (category) query.set("category", category);

    setError(null);
    api<{ briefs: BriefListItem[] }>(`/admin/briefs?${query}`)
      .then((data) => !cancelled && setBriefs(data.briefs))
      .catch((err) => !cancelled && setError(err.message));
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Brief masuk</h1>
          <p className="mt-1 text-sm text-muted">Terbaru di atas.</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !briefs && <p className="text-sm text-muted">Memuat…</p>}
      {briefs && briefs.length === 0 && (
        <div className="card p-10 text-center text-sm text-muted">
          {priority || category ? "Tidak ada brief yang cocok dengan filter ini." : "Belum ada brief masuk."}
        </div>
      )}
      {briefs && briefs.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Perusahaan</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Prioritas</th>
                <th className="px-4 py-3 font-medium">Status AI</th>
                <th className="px-4 py-3 font-medium">Pipeline</th>
                <th className="px-4 py-3 font-medium">Masuk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {briefs.map((brief) => (
                <tr key={brief.id} className="hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link to={`/admin/briefs/${brief.id}`} className="font-medium hover:underline">
                      {brief.company}
                    </Link>
                    <div className="text-xs text-muted">{brief.name}</div>
                  </td>
                  <td className="px-4 py-3">{brief.service_category ?? <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={brief.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <AiStatusBadge status={brief.ai_status} />
                  </td>
                  <td className="px-4 py-3">
                    <PipelineBadge status={brief.pipeline_status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted tabular-nums">
                    {formatDateTime(brief.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
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
    <label className="text-xs text-muted">
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
