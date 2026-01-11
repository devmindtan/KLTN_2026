"use client"
import {createBrowserRouter, RouterProvider, Outlet} from "react-router-dom";
import {SidebarProvider, SidebarInset} from "@/components/ui/sidebar";
import {AppSidebar} from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard.tsx";
import Setting from "@/pages/setting.tsx";

import {SiteHeader} from "@/components/site-header"
import DataLibrary from "@/pages/data-library.tsx";

const RootLayout = () => (
  <SidebarProvider>
    <AppSidebar/>
    <SidebarInset data-slot="sidebar-inset">
      <SiteHeader/>
      <main className="flex flex-1 flex-col">
        <Outlet/>
      </main>
    </SidebarInset>
  </SidebarProvider>
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
      {path: "settings", element: <Setting/>},
      {path: "data-library", element: <DataLibrary/>},
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router}/>;
}