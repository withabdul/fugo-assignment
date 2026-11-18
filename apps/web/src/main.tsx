import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { AdminLayout } from "./pages/AdminLayout";
import { BriefDetailRoute } from "./pages/BriefDetailPage";
import { BriefFormPage } from "./pages/BriefFormPage";
import { BriefListPage } from "./pages/BriefListPage";
import { LoginPage } from "./pages/LoginPage";

const router = createBrowserRouter([
  { path: "/", Component: BriefFormPage },
  { path: "/admin/login", Component: LoginPage },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: BriefListPage },
      { path: "briefs/:id", Component: BriefDetailRoute },
    ],
  },
  { path: "*", Component: () => <p className="p-8 text-sm text-muted">Halaman tidak ditemukan.</p> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
