import {type LucideIcon} from "lucide-react"
import {NavLink, useLocation} from "react-router-dom" // 1. Import NavLink

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
                          items,
                        }: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
}) {
  const {pathname} = useLocation()
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {/* 2. Thêm asChild để SidebarMenuButton đóng vai trò là Link */}
              <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                <NavLink to={item.url}>
                  {item.icon && <item.icon/>}
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}