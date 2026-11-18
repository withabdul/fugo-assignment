import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { FugoLogo, Spinner } from "../components/brand";
import { api } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { email, password } });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-night px-4">
      <main className="m-auto w-full max-w-sm py-12">
        <FugoLogo height={36} className="mx-auto" />
        <div className="card mt-8 p-6 sm:p-8">
          <h1 className="text-lg font-semibold">Masuk ke Brief Hub</h1>
          <p className="mt-1 text-sm text-muted">Dashboard internal tim sales.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                required
                autoFocus
                autoComplete="username"
                spellCheck={false}
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting && <Spinner />}
              {submitting ? "Masuk…" : "Masuk"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
