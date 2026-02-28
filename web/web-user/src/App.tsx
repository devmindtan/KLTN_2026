"use client"
import {createBrowserRouter, RouterProvider, Outlet} from "react-router-dom";
import {SidebarProvider, SidebarInset} from "@/components/ui/sidebar";
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

import {SiteHeader} from "@/components/site-header";
import {SocketProvider} from "@/contexts/SocketContext";
import {ThemeProvider} from "@/contexts/ThemeContext";
import {ScrollToTop} from "@/components/scroll-to-top";

const RootLayout = () => (
  <ThemeProvider>
    <SocketProvider>
      <SidebarProvider>
        <AppSidebar/>
        <SidebarInset data-slot="sidebar-inset">
          <SiteHeader/>
          <main className="flex flex-1 flex-col">
            <Outlet/>
          </main>
        </SidebarInset>
      </SidebarProvider>
      {/* ScrollToTop - Global component hiển thị ở mọi trang */}
      <ScrollToTop />
    </SocketProvider>
  </ThemeProvider>
);

const router = createBrowserRouter([
  {
    path: "/user",
    element: <RootLayout/>,
    children: [
      {
        index: true,
        element: <Dashboard/>,
      },
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
]);

export default function App() {
  return <RouterProvider router={router}/>;
}