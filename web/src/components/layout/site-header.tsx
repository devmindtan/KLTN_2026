"use client"

import { useEffect, useState } from "react"
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
import { useAuth } from "@/contexts/AuthContext"
import { IconSearch } from "@tabler/icons-react"
import { QuickSearchDialog } from "@/components/search/quick-search-dialog"
import React from "react"

export function SiteHeader() {
  const {pathname} = useLocation()
  const {theme, toggleTheme} = useTheme()
  const { routePrefix } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)

  // Tách path: "/admin/dashboard" -> ["admin", "dashboard"]
  // Viewer dùng bare path: "/dashboard" -> ["dashboard"]
  const pathSegments = pathname.split("/").filter(Boolean)
  // prefixOffset = 1 nếu có prefix (technician), 0 nếu không (viewer)
  const prefixOffset = routePrefix ? 1 : 0
  const displaySegments = pathSegments.slice(prefixOffset)

  /** Phím tắt Ctrl+K / Cmd+K mở dialog tìm kiếm nhanh */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1"/>
        <Separator orientation="vertical" className="mx-2 h-4"/>

        <Breadcrumb>
          <BreadcrumbList>
            {/* Hiển thị từ segment sau prefix (bỏ prefix khỏi breadcrumb) */}
            {displaySegments.map((segment, index, arr) => {
              const fullIndex = index + prefixOffset
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

        {/* Search + Theme Toggle – Góc phải */}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground hover:text-foreground px-2 hidden sm:flex"
            onClick={() => setSearchOpen(true)}
            aria-label="Tìm kiếm nhanh"
          >
            <IconSearch className="size-4" />
            <span className="text-xs">Tìm kiếm</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono leading-none">
              Ctrl K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 sm:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Tìm kiếm nhanh"
          >
            <IconSearch className="size-4" />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-4 hidden sm:block" />
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
      <QuickSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
