"use client"
import React from "react";
import {createBrowserRouter, RouterProvider, Outlet, Navigate} from "react-router-dom";
import {CustomSidebarProvider, SidebarInset} from "@/components/custom-sidebar";
import {AppSidebar} from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard.tsx";
import Setting from "@/pages/setting.tsx";
import DataLibrary from "@/pages/data-library.tsx";
import Monitoring from "@/pages/monitoring.tsx";
import Analytics from "@/pages/analytics.tsx";
import Projects from "@/pages/projects.tsx";
import Models from "@/pages/models.tsx";
import Team from "@/pages/team.tsx";
import Reports from "@/pages/reports-forecasts";
import WordAssistant from "@/pages/word-assistant.tsx";
import Help from "@/pages/help.tsx";
import Search from "@/pages/search.tsx";
import Login from "@/pages/login.tsx";

import {SiteHeader} from "@/components/site-header";
import {SocketProvider} from "@/contexts/SocketContext";
import {ThemeProvider} from "@/contexts/ThemeContext";
import {AuthProvider, useAuth} from "@/contexts/AuthContext";
import {ScrollToTop} from "@/components/scroll-to-top";
import {Toaster} from "@/components/ui/sonner";
import {LoadingProvider} from "@/contexts/LoadingContext";
import {TopProgressBar} from "@/components/top-progress-bar";
import {PageLoadingOverlay} from "@/components/page-loading-overlay";
import {useLocation} from "react-router-dom";

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
            <AppSidebar/>
            <SidebarInset>
              <RouteScrollReset />
              <SiteHeader/>
              {/* relative để PageLoadingOverlay dùng absolute inset-0 */}
              <main className="relative flex flex-1 flex-col">
                {/* Overlay che trang khi API chậm >300ms */}
                <PageLoadingOverlay />
                <AuthGate>
                  <Outlet/>
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
          <Login />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    ),
  },
  {
    path: "/:prefix",
    element: <RootLayout/>,
    children: [
      {index: true, element: <Navigate to="dashboard" replace />},
      // loader dùng setTimeout(0) thay vì Promise.resolve() để tạo macrotask,
      // cho React kịp re-render với navigation.state==="loading" trước khi loader resolve,
      // giúp TopProgressBar hiển thị đúng khi chuyển route.
      {path: "dashboard",        element: <Dashboard/>,     loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "monitoring",       element: <Monitoring/>,    loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "analytics",        element: <Analytics/>,     loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "projects",         element: <Projects/>,      loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "models",           element: <Models/>,        loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "team",             element: <Team/>,          loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "data-library",     element: <DataLibrary/>,   loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "reports-forecasts",element: <Reports/>,       loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "assistant",        element: <WordAssistant/>, loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "settings",         element: <Setting/>,       loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "help",             element: <Help/>,          loader: () => new Promise(r => setTimeout(r, 0))},
      {path: "search",           element: <Search/>,        loader: () => new Promise(r => setTimeout(r, 0))},
    ],
  },
  // Redirect gốc về dashboard
  { path: "/", element: <Navigate to="/user/dashboard" replace /> },
]);

export default function App() {
  return <RouterProvider router={router}/>;
}