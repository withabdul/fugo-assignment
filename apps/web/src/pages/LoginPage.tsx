import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <p className="text-sm font-semibold tracking-wide text-accent-strong">Fugo Creative</p>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Masuk ke dashboard</h1>
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <div>
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
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
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Masuk…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
