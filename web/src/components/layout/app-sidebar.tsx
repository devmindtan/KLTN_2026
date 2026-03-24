"use client";
import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  IconBook,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  // IconFileWord,
  IconFolder,
  IconHelp,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconFlask,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  CustomSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuItem,
  useSidebar,
} from "@/components/layout/custom-sidebar";
import { NavUser } from "@/components/layout/nav-user";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PAGE_TITLES } from "@/lib/app-constants";

// ─── Nav data factory — labels từ PAGE_TITLES trong app-constants ──────────
const u = (p: string, page: string) => (p ? `/${p}/${page}` : `/${page}`);

function buildNavMain(p: string) {
  return [
    {
      title: PAGE_TITLES.DASHBOARD,
      url: u(p, "dashboard"),
      icon: IconDashboard,
    },
    {
      title: PAGE_TITLES.MONITORING,
      url: u(p, "monitoring"),
      icon: IconListDetails,
    },
    {
      title: PAGE_TITLES.ANALYTICS,
      url: u(p, "analytics"),
      icon: IconChartBar,
    },
    { title: PAGE_TITLES.MODELS, url: u(p, "models"), icon: IconFolder },
  ];
}

function buildNavReports(p: string) {
  return [
    {
      name: PAGE_TITLES.DATA_LIBRARY,
      url: u(p, "data-library"),
      icon: IconDatabase,
    },
    { name: PAGE_TITLES.REPORTS, url: u(p, "reports"), icon: IconReport },
    // { name: "Hỗ trợ ra quyết định",  url: u(p, "assistant"),         icon: IconFileWord },
    { name: PAGE_TITLES.DOCS, url: u(p, "documentation"), icon: IconBook },
  ];
}
function buildNavSecondary(p: string) {
  return [
    { title: PAGE_TITLES.SEARCH, url: u(p, "search"), icon: IconSearch },
    { title: PAGE_TITLES.HELP, url: u(p, "help"), icon: IconHelp },
    { title: PAGE_TITLES.TEAM, url: u(p, "team"), icon: IconUsers },
    { title: PAGE_TITLES.SETTINGS, url: u(p, "settings"), icon: IconSettings },
  ];
}

// ─── Document item (simple NavLink, no dropdown) ─────────────────────────────
function DocItem({
  name,
  url,
  icon: Icon,
}: {
  name: string;
  url: string;
  icon: React.ElementType;
}) {
  const { pathname } = useLocation();
  const { open } = useSidebar();
  const isActive = pathname === url;

  const link = (
    <NavLink
      to={url}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        !open && "justify-center px-0",
      )}
    >
      <span className="shrink-0 size-4 flex items-center justify-center">
        <Icon className="size-4" />
      </span>
      {open && <span className="flex-1 min-w-0 truncate">{name}</span>}
    </NavLink>
  );

  if (!open) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

// Định nghĩa khung sườn cho hiệu ứng container – stagger mỗi item 0.05s
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

// Định nghĩa hiệu ứng cho từng item – trượt lên nhẹ + fade in
const itemVariants = {
  hidden: { y: 6, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.18, ease: "easeOut" as const },
  },
};

// ─── Logo header ──────────────────────────────────────────────────────────────
function LogoButton({ prefix }: { prefix: string }) {
  const { open } = useSidebar();
  return (
    <NavLink
      to={prefix ? `/${prefix}/dashboard` : "/dashboard"}
      className={cn(
        "flex items-center gap-2 rounded-md px-0 py-0 text-xl font-bold",
        "hover:bg-sidebar-accent transition-colors",
        !open && "justify-center px-0",
      )}
    >
      <img
        src="/logo_2.png"
        alt="logo"
        className="size-10 shrink-0 object-contain"
      />
      {open && (
        <span
          className="min-w-0 truncate tracking-widest"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: "1rem",
            fontWeight: 900,
          }}
        >
          SMARTCITY
        </span>
      )}
    </NavLink>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────
/**
 * Sidebar chính của ứng dụng – dùng custom sidebar, width px cố định
 */
export function AppSidebar() {
  const { pathname } = useLocation();
  const { routePrefix } = useAuth();
  const p = routePrefix;
  const { role } = useAuth();

  const mainItems = [...buildNavMain(p)];

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

        {/* Báo cáo – collapsible */}
        <SidebarGroup className="mt-2" collapsible defaultOpen>
          <SidebarGroupLabel>Báo cáo</SidebarGroupLabel>
          <SidebarGroupContent>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {buildNavReports(p).map((item) => (
                <motion.div key={item.url} variants={itemVariants}>
                  <DocItem name={item.name} url={item.url} icon={item.icon} />
                </motion.div>
              ))}
            </motion.div>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Secondary – collapsible, push to bottom */}
        <SidebarGroup className="mt-auto pt-2 border-t" collapsible defaultOpen>
          <SidebarGroupLabel>Tiện ích</SidebarGroupLabel>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dev – chỉ hiện cho technician trong môi trường development */}
        {import.meta.env.DEV && role === "technician" && (
          <SidebarGroup className="pt-2 border-t" collapsible defaultOpen>
            <SidebarGroupLabel>Phát triển</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenuItem
                as={NavLink}
                to={u(p, "sandbox")}
                icon={<IconFlask className="size-4" />}
                label="Thử nghiệm giao diện"
                isActive={pathname === u(p, "sandbox")}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User info */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </CustomSidebar>
  );
}
