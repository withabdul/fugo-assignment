import { BUDGET_LABELS, BUDGET_RANGES, briefInputSchema, todayInJakarta } from "@fugo/shared";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";

type FieldName = "name" | "email" | "company" | "need" | "budget_range" | "target_date";
type Errors = Partial<Record<FieldName | "_form", string>>;

const EMPTY = { name: "", email: "", company: "", need: "", budget_range: "", target_date: "" };

export function BriefFormPage() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (field: FieldName) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Same schema as the server, so the user sees errors before a round trip.
    // The server still validates everything again.
    const parsed = briefInputSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldName;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await api("/briefs", { method: "POST", body: parsed.data });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields as Errors);
      } else {
        setErrors({ _form: err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Shell>
        <div className="card p-8 text-center" role="status">
          <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Brief Anda sudah kami terima</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Terima kasih, {values.name.trim()}. Tim kami akan meninjau brief dari {values.company.trim()} dan
            menghubungi Anda lewat {values.email.trim()}.
          </p>
          <button
            type="button"
            className="btn-secondary mt-6"
            onClick={() => {
              setValues(EMPTY);
              setSubmitted(false);
            }}
          >
            Kirim brief lain
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={onSubmit} noValidate className="card space-y-5 p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nama" name="name" error={errors.name}>
            <input
              id="name"
              className="field-input"
              autoComplete="name"
              value={values.name}
              onChange={(e) => set("name")(e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
          </Field>
          <Field label="Email" name="email" error={errors.email}>
            <input
              id="email"
              type="email"
              className="field-input"
              autoComplete="email"
              spellCheck={false}
              value={values.email}
              onChange={(e) => set("email")(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
          </Field>
        </div>

        <Field label="Nama perusahaan" name="company" error={errors.company}>
          <input
            id="company"
            className="field-input"
            autoComplete="organization"
            value={values.company}
            onChange={(e) => set("company")(e.target.value)}
            aria-invalid={!!errors.company}
            aria-describedby={errors.company ? "company-error" : undefined}
          />
        </Field>

        <Field label="Apa yang Anda butuhkan?" name="need" error={errors.need}>
          <textarea
            id="need"
            rows={6}
            className="field-input resize-y"
            placeholder="Contoh: Kami butuh website company profile dengan katalog produk dan form kontak, plus refresh logo."
            value={values.need}
            onChange={(e) => set("need")(e.target.value)}
            aria-invalid={!!errors.need}
            aria-describedby={errors.need ? "need-error" : undefined}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Budget" name="budget_range" error={errors.budget_range}>
            <select
              id="budget_range"
              className="field-input"
              value={values.budget_range}
              onChange={(e) => set("budget_range")(e.target.value)}
              aria-invalid={!!errors.budget_range}
              aria-describedby={errors.budget_range ? "budget_range-error" : undefined}
            >
              <option value="" disabled>
                Pilih rentang
              </option>
              {BUDGET_RANGES.map((range) => (
                <option key={range} value={range}>
                  {BUDGET_LABELS[range]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target timeline" name="target_date" error={errors.target_date}>
            <input
              id="target_date"
              type="date"
              className="field-input"
              min={todayInJakarta()}
              value={values.target_date}
              onChange={(e) => set("target_date")(e.target.value)}
              aria-invalid={!!errors.target_date}
              aria-describedby={errors.target_date ? "target_date-error" : undefined}
            />
          </Field>
        </div>

        {errors._form && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors._form}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted">Semua field wajib diisi.</p>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Mengirim…" : "Kirim brief"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <p className="text-sm font-semibold tracking-wide text-accent-strong">Fugo Creative</p>
      <h1 className="mt-2 text-2xl font-semibold text-balance sm:text-3xl">Ceritakan proyek Anda</h1>
      <p className="mt-2 mb-8 max-w-prose text-muted text-pretty">
        Isi brief singkat di bawah. Tim kami akan membalas dalam 1–2 hari kerja.
      </p>
      {children}
    </main>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
