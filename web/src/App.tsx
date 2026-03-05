"use client"
import {createBrowserRouter, RouterProvider, Outlet, Navigate} from "react-router-dom";
import {CustomSidebarProvider, SidebarInset} from "@/components/custom-sidebar";
import {AppSidebar} from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard.tsx";
import Setting from "@/pages/setting.tsx";
import DataLibrary from "@/pages/data-library.tsx";
import Lifecycle from "@/pages/lifecycle.tsx";
import Analytics from "@/pages/analytics.tsx";
import Projects from "@/pages/projects.tsx";
import Models from "@/pages/models.tsx";
import Team from "@/pages/team.tsx";
import Reports from "@/pages/reports.tsx";
import WordAssistant from "@/pages/word-assistant.tsx";
import Help from "@/pages/help.tsx";
import Search from "@/pages/search.tsx";
import Login from "@/pages/login.tsx";

import {SiteHeader} from "@/components/site-header";
import {SocketProvider} from "@/contexts/SocketContext";
import {ThemeProvider} from "@/contexts/ThemeContext";
import {AuthProvider} from "@/contexts/AuthContext";
import {ScrollToTop} from "@/components/scroll-to-top";
import {Toaster} from "@/components/ui/sonner";

const RootLayout = () => (
  <ThemeProvider>
    <AuthProvider>
      <SocketProvider>
        <CustomSidebarProvider>
          <AppSidebar/>
          <SidebarInset>
            <SiteHeader/>
            <main className="flex flex-1 flex-col">
              <Outlet/>
            </main>
          </SidebarInset>
        </CustomSidebarProvider>
        {/* ScrollToTop - Global component hiển thị ở mọi trang */}
        <ScrollToTop />
      </SocketProvider>
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
      {path: "dashboard", element: <Dashboard/>},
      {path: "lifecycle", element: <Lifecycle/>},
      {path: "analytics", element: <Analytics/>},
      {path: "projects", element: <Projects/>},
      {path: "models", element: <Models/>},
      {path: "team", element: <Team/>},
      {path: "data-library", element: <DataLibrary/>},
      {path: "reports", element: <Reports/>},
      {path: "word-assistant", element: <WordAssistant/>},
      {path: "settings", element: <Setting/>},
      {path: "help", element: <Help/>},
      {path: "search", element: <Search/>},
    ],
  },
  // Redirect gốc về dashboard
  { path: "/", element: <Navigate to="/user/dashboard" replace /> },
]);

export default function App() {
  return <RouterProvider router={router}/>;
}