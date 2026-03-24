"use client";
import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
  useParams,
} from "react-router-dom";
import {
  CustomSidebarProvider,
  SidebarInset,
} from "@/components/layout/custom-sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

// Lazy-load tất cả pages để code-split thành các chunk riêng
const Dashboard = React.lazy(() => import("@/pages/dashboard.tsx"));
const Setting = React.lazy(() => import("@/pages/setting.tsx"));
const DataLibrary = React.lazy(() => import("@/pages/data-library.tsx"));
const Monitoring = React.lazy(() => import("@/pages/monitoring.tsx"));
const Analytics = React.lazy(() => import("@/pages/analytics.tsx"));
const Models = React.lazy(() => import("@/pages/models.tsx"));
const Team = React.lazy(() => import("@/pages/team.tsx"));
const Reports = React.lazy(() => import("@/pages/reports"));
// const WordAssistant = React.lazy(() => import("@/pages/assistant"));
const Help = React.lazy(() => import("@/pages/help.tsx"));
const Documentation = React.lazy(() => import("@/pages/documentation.tsx"));
const Search = React.lazy(() => import("@/pages/search.tsx"));
const Login = React.lazy(() => import("@/pages/login.tsx"));

// Chỉ load sandbox trong môi trường development — Vite tree-shake khỏi production bundle
const SandboxPage = import.meta.env.DEV
  ? React.lazy(() => import("@/pages/sandbox.tsx"))
  : null;

import { SiteHeader } from "@/components/layout/site-header";
import { SocketProvider } from "@/contexts/SocketContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ScrollToTop } from "@/components/custom/scroll-to-top";
import { Toaster } from "@/components/ui/sonner";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { TopProgressBar } from "@/components/custom/top-progress-bar";
import { PageLoadingOverlay } from "@/components/custom/page-loading-overlay";
import { useLocation } from "react-router-dom";

/**
 * Reset scroll của #main-scroll-container về đầu trang mỗi khi chuyển route.
 * React Router chỉ xử lý window.scrollY, không biết về custom scroll container.
 */
const RouteScrollReset = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    const container = document.getElementById("main-scroll-container");
    if (container) container.scrollTop = 0;
  }, [pathname]);
  return null;
};

/**
 * Guard: Đảm bảo URL prefix luôn khớp với routePrefix của user.
 * - viewer (anonymous) → routePrefix = "" → dùng bare path, nếu vào /:prefix → strip prefix
 * - technician         → prefix phải là email prefix của họ
 * Nếu sai → redirect về đúng path.
 */
const PrefixGuardedLayout = () => {
  const { prefix } = useParams<{ prefix: string }>();
  const { routePrefix, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (prefix !== routePrefix) {
    if (!routePrefix) {
      // Viewer truy cập route có prefix → bỏ prefix, redirect về bare path
      const subPath = location.pathname.slice(`/${prefix}`.length) || "/";
      return <Navigate to={subPath} replace />;
    }
    const segments = location.pathname.split("/"); // ['', prefix, 'dashboard', ...]
    segments[1] = routePrefix;
    return <Navigate to={segments.join("/")} replace />;
  }

  return <Outlet />;
};

/**
 * Guard cho viewer routes (bare path, không có prefix).
 * Technician cố tình truy cập bare path → redirect về route có prefix của họ.
 */
const ViewerGuardedLayout = () => {
  const { routePrefix, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (role === "technician" && routePrefix) {
    return <Navigate to={`/${routePrefix}${location.pathname}`} replace />;
  }

  return <Outlet />;
};

/**
 * Chặn render nội dung trang cho đến khi AuthContext hoàn thành init (có token).
 * Tránh race condition: page components gọi API trước khi guest token được lưu vào localStorage.
 */
const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }
  return <>{children}</>;
};

const RootLayout = () => (
  <ThemeProvider>
    <AuthProvider>
      {/* TopProgressBar độc lập – tự theo dõi useNavigation(), không cần LoadingProvider */}
      <TopProgressBar />
      <LoadingProvider>
        <SocketProvider>
          <CustomSidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <RouteScrollReset />
              <SiteHeader />
              {/* relative để PageLoadingOverlay dùng absolute inset-0 */}
              <main className="relative flex flex-1 flex-col">
                {/* Overlay che trang khi API chậm >300ms */}
                <PageLoadingOverlay />
                <AuthGate>
                  <React.Suspense fallback={null}>
                    <Outlet />
                  </React.Suspense>
                </AuthGate>
              </main>
            </SidebarInset>
          </CustomSidebarProvider>
          <ScrollToTop />
        </SocketProvider>
      </LoadingProvider>
    </AuthProvider>
    <Toaster richColors position="top-right" />
  </ThemeProvider>
);

const router = createBrowserRouter([
  // Trang đăng nhập – ngoài layout chính
  {
    path: "/login",
    element: (
      <ThemeProvider>
        <AuthProvider>
          <React.Suspense fallback={null}>
            <Login />
          </React.Suspense>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    ),
  },
  {
    // RootLayout bao toàn bộ app (viewer + technician)
    path: "/",
    element: <RootLayout />,
    children: [
      // ── Viewer routes (bare path — không có prefix) ─────────────────────
      // Literal paths ("dashboard", "monitoring" …) luôn có độ ưu tiên cao hơn
      // dynamic segment (":prefix") nên React Router chọn đúng mà không cần guard path.
      {
        element: <ViewerGuardedLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          // loader dùng setTimeout(0) thay vì Promise.resolve() để tạo macrotask,
          // cho React kịp re-render với navigation.state==="loading" trước khi loader resolve,
          // giúp TopProgressBar hiển thị đúng khi chuyển route.
          {
            path: "dashboard",
            element: <Dashboard />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "monitoring",
            element: <Monitoring />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "analytics",
            element: <Analytics />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "models",
            element: <Models />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "team",
            element: <Team />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "data-library",
            element: <DataLibrary />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "reports",
            element: <Reports />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          // {
          //   path: "assistant",
          //   element: <WordAssistant />,
          //   loader: () => new Promise((r) => setTimeout(r, 0)),
          // },
          {
            path: "settings",
            element: <Setting />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "help",
            element: <Help />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "documentation",
            element: <Documentation />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "search",
            element: <Search />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          ...(import.meta.env.DEV && SandboxPage
            ? [
                {
                  path: "sandbox",
                  element: (
                    <React.Suspense fallback={null}>
                      <SandboxPage />
                    </React.Suspense>
                  ),
                  loader: () => new Promise((r) => setTimeout(r, 0)),
                },
              ]
            : []),
        ],
      },
      // ── Technician routes (với email prefix) ────────────────────────────
      {
        path: ":prefix",
        element: <PrefixGuardedLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          {
            path: "dashboard",
            element: <Dashboard />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "monitoring",
            element: <Monitoring />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "analytics",
            element: <Analytics />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "models",
            element: <Models />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "team",
            element: <Team />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "data-library",
            element: <DataLibrary />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "reports",
            element: <Reports />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          // {path: "assistant",        element: <WordAssistant/>, loader: () => new Promise(r => setTimeout(r, 0))},
          {
            path: "settings",
            element: <Setting />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "help",
            element: <Help />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "documentation",
            element: <Documentation />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          {
            path: "search",
            element: <Search />,
            loader: () => new Promise((r) => setTimeout(r, 0)),
          },
          ...(import.meta.env.DEV && SandboxPage
            ? [
                {
                  path: "sandbox",
                  element: (
                    <React.Suspense fallback={null}>
                      <SandboxPage />
                    </React.Suspense>
                  ),
                  loader: () => new Promise((r) => setTimeout(r, 0)),
                },
              ]
            : []),
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
