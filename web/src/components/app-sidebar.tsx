"use client"
import * as React from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconBorderHorizontal,
  IconFolderOpen,
  IconShare,
} from "@tabler/icons-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  CustomSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuItem,
  useSidebar,
} from "@/components/custom-sidebar"
import { NavUser } from "@/components/nav-user"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ─── Nav data factory ───────────────────────────────────────────────────────
function buildNavMain(p: string) { return [
  { title: "Bảng điều khiển", url: `/${p}/dashboard`, icon: IconDashboard },
  { title: "Giám sát",        url: `/${p}/monitoring`,  icon: IconListDetails },
  { title: "Phân tích",       url: `/${p}/analytics`,  icon: IconChartBar },
  { title: "Mô hình ML",      url: `/${p}/models`,     icon: IconFolder },
]}
function buildNavTechnician(p: string) { return [
  { title: "Đội ngũ phát triển", url: `/${p}/team`, icon: IconUsers },
]}
function buildNavDocuments(p: string) { return [
  { name: "Dữ liệu",  url: `/${p}/data-library`,  icon: IconDatabase },
  { name: "Báo cáo",  url: `/${p}/reports`,        icon: IconReport },
  { name: "Hỗ trợ",   url: `/${p}/word-assistant`, icon: IconFileWord },
]}
function buildNavSecondary(p: string) { return [
  { title: "Cài đặt",  url: `/${p}/settings`, icon: IconSettings },
  { title: "Liên hệ",  url: `/${p}/help`,     icon: IconHelp },
  { title: "Tìm kiếm", url: `/${p}/search`,   icon: IconSearch },
]}

// ─── Document item with action dropdown ──────────────────────────────────────
function DocItem({ name, url, icon: Icon }: { name: string; url: string; icon: React.ElementType }) {
  const { pathname } = useLocation()
  const { open } = useSidebar()
  const isActive = pathname === url

  const link = (
    <div className="group/doc relative flex items-center">
      <NavLink
        to={url}
        className={cn(
          "flex flex-1 min-w-0 items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring pr-8",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
          !open && "justify-center px-0 pr-0"
        )}
      >
        <span className="shrink-0 size-4 flex items-center justify-center">
          <Icon className="size-4" />
        </span>
        {open && <span className="flex-1 min-w-0 truncate">{name}</span>}
      </NavLink>
      {open && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="absolute right-1 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded opacity-0 group-hover/doc:opacity-100 hover:bg-sidebar-accent transition-opacity">
              <IconBorderHorizontal className="size-3.5" />
              <span className="sr-only">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-28 rounded-lg" side="right" align="start">
            <DropdownMenuItem>
              <IconFolderOpen className="mr-2 size-4" />
              <span>Mở</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <IconShare className="mr-2 size-4" />
              <span>Chia sẻ</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )

  if (!open) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" align="center">{name}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

// ─── Logo header ──────────────────────────────────────────────────────────────
function LogoButton({ prefix }: { prefix: string }) {
  const { open } = useSidebar()
  return (
    <NavLink
      to={`/${prefix}/dashboard`}
      className={cn(
        "flex items-center gap-2 rounded-md px-0 py-0 text-xl font-bold",
        "hover:bg-sidebar-accent transition-colors",
        !open && "justify-center px-0"
      )}
    >
      <img src="/logo_2.png" alt="logo" className="size-10 shrink-0 object-contain" />
      {open && <span className="min-w-0 truncate tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "1rem", fontWeight: 900 }}>SMARTCITY</span>}
    </NavLink>
  )
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────
/**
 * Sidebar chính của ứng dụng – dùng custom sidebar, width px cố định
 */
export function AppSidebar() {
  const { pathname } = useLocation()
  const { role, routePrefix } = useAuth()
  const p = routePrefix

  const mainItems = [
    ...buildNavMain(p),
    ...(role === "technician" ? buildNavTechnician(p) : []),
  ]

  return (
    <CustomSidebar>
      {/* Logo */}
      <SidebarHeader>
        <LogoButton prefix={p} />
      </SidebarHeader>

      {/* Main nav */}
      <SidebarContent>
        <SidebarGroup>
          {mainItems.map((item) => (
            <SidebarMenuItem
              key={item.url}
              as={NavLink}
              to={item.url}
              icon={<item.icon className="size-4" />}
              label={item.title}
              isActive={pathname === item.url}
            />
          ))}
        </SidebarGroup>

        {/* Documents – hidden when collapsed */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel>Tài liệu</SidebarGroupLabel>
          {buildNavDocuments(p).map((item) => (
            <DocItem key={item.url} name={item.name} url={item.url} icon={item.icon} />
          ))}
        </SidebarGroup>

        {/* Secondary – push to bottom */}
        <SidebarGroup className="mt-auto pt-2 border-t">
          {buildNavSecondary(p).map((item) => (
            <SidebarMenuItem
              key={item.url}
              as={NavLink}
              to={item.url}
              icon={<item.icon className="size-4" />}
              label={item.title}
              isActive={pathname === item.url}
            />
          ))}
        </SidebarGroup>
      </SidebarContent>

      {/* User info */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </CustomSidebar>
  )
}

