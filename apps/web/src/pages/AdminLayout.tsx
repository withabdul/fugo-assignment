import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { api, ApiError } from "../lib/api";

// Guards every /admin page. The real protection is on the API (every
// /api/admin route checks the session); this only decides what to render.
export function AdminLayout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ email: string }>("/auth/me")
      .then((session) => setEmail(session.email))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) navigate("/admin/login", { replace: true });
        else setError(err instanceof Error ? err.message : "Gagal memuat sesi");
      });
  }, [navigate]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    navigate("/admin/login", { replace: true });
  }

  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!email) return <p className="p-8 text-sm text-muted">Memuat…</p>;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/admin" className="text-sm font-semibold">
            Fugo Brief Hub
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{email}</span>
            <button type="button" className="btn-secondary" onClick={logout}>
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
