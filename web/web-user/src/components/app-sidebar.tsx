"use client"
import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react"
import {NavLink} from "react-router-dom"
import {NavDocuments} from "@/components/nav-documents"
import {NavMain} from "@/components/nav-main"
import {NavSecondary} from "@/components/nav-secondary"
import {NavUser} from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Bảng điều khiển",
      url: "/user/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Giám sát",
      url: "/user/lifecycle",
      icon: IconListDetails,
    },
    {
      title: "Phân tích",
      url: "/user/analytics",
      icon: IconChartBar,
    },
    {
      title: "Mô hình ML",
      url: "/user/projects",
      icon: IconFolder,
    },
    {
      title: "Đội ngũ",
      url: "/user/team",
      icon: IconUsers,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Cài đặt",
      url: "/user/settings",
      icon: IconSettings,
    },
    {
      title: "Liên hệ",
      url: "/user/help",
      icon: IconHelp,
    },
    {
      title: "Tìm kiếm",
      url: "/user/search",
      icon: IconSearch,
    },
  ],
  documents: [
    {
      name: "Dữ liệu",
      url: "/user/data-library",
      icon: IconDatabase,
    },
    {
      name: "Báo cáo",
      url: "/user/reports",
      icon: IconReport,
    },
    {
      name: "Hỗ trợ",
      url: "/user/word-assistant",
      icon: IconFileWord,
    },
  ],
}

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <NavLink to="/user/dashboard">
                <IconInnerShadowTop className="!size-5"/>
                <span className="text-base font-semibold">KLTN_2026</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain}/>
        <NavDocuments items={data.documents}/>
        <NavSecondary items={data.navSecondary} className="mt-auto"/>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user}/>
      </SidebarFooter>
    </Sidebar>
  )
}
