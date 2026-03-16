"use client"

import {useLocation, Link} from "react-router-dom"
import {Separator} from "@/components/ui/separator"
import {SidebarTrigger} from "@/components/layout/custom-sidebar"
import {Button} from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {MoonIcon, SunIcon} from "lucide-react"
import {useTheme} from "@/contexts/ThemeContext"
import React from "react"

export function SiteHeader() {
  const {pathname} = useLocation()
  const {theme, toggleTheme} = useTheme()

  // Tách path: "/user/dashboard" -> ["user", "dashboard"]
  const pathSegments = pathname.split("/").filter(Boolean)

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1"/>
        <Separator orientation="vertical" className="mx-2 h-4"/>

        <Breadcrumb>
          <BreadcrumbList>
            {/* Bỏ qua segment đầu tiên (role prefix: user/technician/admin) — không hiển thị */}
            {pathSegments.slice(1).map((segment, index, arr) => {
              const fullIndex = index + 1 // vị trí thực trong pathSegments
              const href = `/${pathSegments.slice(0, fullIndex + 1).join("/")}`
              const isLast = index === arr.length - 1
              const title = segment
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
              return (
                <React.Fragment key={href}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-[550]">{title}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={href}>{title}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator/>}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Theme Toggle Button - Góc phải */}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-8"
            aria-label={theme === "light" ? "Chuyển sang chế độ tối" : "Chuyển sang chế độ sáng"}
          >
            {theme === "light" ? (
              <MoonIcon className="size-4" />
            ) : (
              <SunIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
