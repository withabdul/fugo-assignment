import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { FugoLogo } from "../components/brand";
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

  return (
    <div className="min-h-dvh">
      <header className="bg-night text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/admin" className="flex items-center gap-3 rounded-md py-2" aria-label="Fugo Brief Hub, ke daftar brief">
            <FugoLogo height={26} />
            <span aria-hidden className="h-5 w-px bg-white/20" />
            <span className="text-sm font-medium text-white/80">Brief Hub</span>
          </Link>
          {email && (
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden max-w-56 truncate text-white/60 sm:inline">{email}</span>
              <button
                type="button"
                className="btn text-white/80 hover:bg-white/10 hover:text-white"
                onClick={logout}
              >
                Keluar
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {error ? (
          <Notice>{error}</Notice>
        ) : email ? (
          <Outlet />
        ) : (
          <div aria-busy className="space-y-3">
            <div className="skeleton h-7 w-40" />
            <div className="skeleton h-4 w-64" />
          </div>
        )}
      </main>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{children}</p>;
}
