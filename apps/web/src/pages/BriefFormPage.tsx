import { BUDGET_LABELS, BUDGET_RANGES, briefInputSchema, todayInJakarta } from "@fugo/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { FugoLogo, Spinner } from "../components/brand";
import { api, ApiError } from "../lib/api";

type FieldName = "name" | "email" | "company" | "need" | "budget_range" | "target_date";
type Errors = Partial<Record<FieldName | "_form", string>>;

const EMPTY = { name: "", email: "", company: "", need: "", budget_range: "", target_date: "" };
const NEED_MAX = 5000;

const NEXT_STEPS = [
  { title: "Kami baca brief Anda", body: "Tim kami meninjau kebutuhan, budget, dan timeline." },
  { title: "Kami hubungi Anda", body: "Dalam 1–2 hari kerja, lewat email yang Anda isi." },
  { title: "Diskusi singkat", body: "Kami susun ruang lingkup dan proposal bersama Anda." },
];

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
      document.getElementById(Object.keys(next)[0]!)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await api("/briefs", { method: "POST", body: parsed.data });
      setSubmitted(true);
      window.scrollTo({ top: 0 });
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

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-night px-6 pt-8 pb-10 text-white sm:px-10 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-12 lg:py-12">
        <FugoLogo height={36} />
        <div className="mt-10 lg:mt-auto">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ceritakan proyek Anda</h1>
          <p className="mt-3 max-w-md text-pretty text-white/70">
            Branding, website, aplikasi, otomasi AI, atau media sosial. Isi brief singkat ini dan tim kami akan
            membalas.
          </p>
        </div>
        <ol className="mt-10 hidden max-w-md space-y-5 lg:mb-auto lg:block">
          {NEXT_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-medium text-brand tabular-nums">
                {index + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-white/60">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>

      <main className="px-4 py-8 sm:px-10 sm:py-12 lg:flex lg:items-center lg:px-16">
        <div className="mx-auto w-full max-w-xl">
          {submitted ? (
            <SuccessCard
              name={values.name.trim()}
              company={values.company.trim()}
              email={values.email.trim()}
              onReset={() => {
                setValues(EMPTY);
                setSubmitted(false);
              }}
            />
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nama" name="name" error={errors.name}>
                  <input
                    id="name"
                    className="field-input"
                    autoComplete="name"
                    value={values.name}
                    onChange={(e) => set("name")(e.target.value)}
                    {...invalidProps("name", errors.name)}
                  />
                </Field>
                <Field label="Email" name="email" error={errors.email}>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    className="field-input"
                    autoComplete="email"
                    spellCheck={false}
                    value={values.email}
                    onChange={(e) => set("email")(e.target.value)}
                    {...invalidProps("email", errors.email)}
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
                  {...invalidProps("company", errors.company)}
                />
              </Field>

              <Field
                label="Apa yang Anda butuhkan?"
                name="need"
                error={errors.need}
                hint={
                  <span className="tabular-nums">
                    {values.need.length.toLocaleString("id-ID")}/{NEED_MAX.toLocaleString("id-ID")}
                  </span>
                }
              >
                <textarea
                  id="need"
                  rows={6}
                  maxLength={NEED_MAX}
                  className="field-input resize-y"
                  placeholder="Contoh: Kami butuh website company profile dengan katalog produk dan form kontak, plus refresh logo."
                  value={values.need}
                  onChange={(e) => set("need")(e.target.value)}
                  {...invalidProps("need", errors.need)}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Budget" name="budget_range" error={errors.budget_range}>
                  <select
                    id="budget_range"
                    className="field-input"
                    value={values.budget_range}
                    onChange={(e) => set("budget_range")(e.target.value)}
                    {...invalidProps("budget_range", errors.budget_range)}
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
                    {...invalidProps("target_date", errors.target_date)}
                  />
                </Field>
              </div>

              {errors._form && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {errors._form}
                </p>
              )}

              <div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">Semua field wajib diisi.</p>
                <button type="submit" className="btn btn-primary sm:min-w-36" disabled={submitting}>
                  {submitting && <Spinner />}
                  {submitting ? "Mengirim…" : "Kirim brief"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function invalidProps(name: FieldName, error: string | undefined) {
  return { "aria-invalid": !!error, "aria-describedby": error ? `${name}-error` : undefined };
}

function SuccessCard(props: { name: string; company: string; email: string; onReset: () => void }) {
  return (
    <div className="card p-8 text-center sm:p-10" role="status">
      <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-6" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold">Brief Anda sudah kami terima</h2>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-muted">
        Terima kasih, {props.name}. Tim kami akan meninjau brief dari {props.company} dan menghubungi Anda lewat{" "}
        <span className="text-ink">{props.email}</span>.
      </p>
      <button type="button" className="btn btn-secondary mt-8" onClick={props.onReset}>
        Kirim brief lain
      </button>
    </div>
  );
}

function Field(props: { label: string; name: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={props.name} className="field-label">
          {props.label}
        </label>
        {props.hint && <span className="text-xs text-muted">{props.hint}</span>}
      </div>
      {props.children}
      {props.error && (
        <p id={`${props.name}-error`} className="field-error">
          {props.error}
        </p>
      )}
    </div>
  );
}
