"use client"
/**
 * Custom Sidebar – tự viết, không phụ thuộc shadcn/ui sidebar.tsx
 * Width cố định bằng px: mở 256px | thu 48px
 * overflow-x: hidden tuyệt đối – text dài không bao giờ đè lên content
 */
import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { PanelLeftIcon, ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Constants ───────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH = 256        // px – expanded
const SIDEBAR_ICON_WIDTH = 48    // px – collapsed (icon only)
const COOKIE_KEY = "custom_sidebar_open"

// ─── Context ─────────────────────────────────────────────────────────────────
interface SidebarCtx {
  open: boolean
  toggle: () => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarCtx | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar(): SidebarCtx {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within CustomSidebarProvider")
  return ctx
}

// ─── Provider ────────────────────────────────────────────────────────────────
/**
 * Bọc toàn bộ layout – cung cấp context open/close
 */
export function CustomSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(() => {
    try {
      const cookie = document.cookie
        .split(";")
        .find((c) => c.trim().startsWith(`${COOKIE_KEY}=`))
      if (cookie) return cookie.split("=")[1].trim() !== "false"
    } catch { /* empty */ }
    return true
  })

  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // keyboard shortcut Ctrl+B
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const toggle = () =>
    setOpen((prev) => {
      const next = !prev
      document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=${60 * 60 * 24 * 7}`
      return next
    })

  return (
    <SidebarContext.Provider value={{ open, toggle, isMobile }}>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-svh w-full overflow-hidden bg-background">
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

// ─── Sidebar shell ────────────────────────────────────────────────────────────
/**
 * Container sidebar – width cố định px, overflow-hidden tuyệt đối
 */
export function CustomSidebar({ children }: { children: React.ReactNode }) {
  const { open, toggle, isMobile } = useSidebar()

  const width = open ? SIDEBAR_WIDTH : SIDEBAR_ICON_WIDTH

  if (isMobile) {
    // Mobile: ẩn hoàn toàn khi collapsed (drawer style)
    return (
      <>
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r transition-transform duration-200 ease-linear",
            !open && "-translate-x-full"
          )}
          style={{ width: SIDEBAR_WIDTH }}
        >
          {children}
        </div>
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={toggle}
          />
        )}
      </>
    )
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col bg-sidebar border-r overflow-hidden transition-[width] duration-200 ease-linear"
      style={{ width }}
      data-open={open}
    >
      {/* Inner: snap theo width thực tế, animation do aside xử lý */}
      <div
        className="flex flex-col h-full overflow-x-hidden"
        style={{ width: open ? SIDEBAR_WIDTH : SIDEBAR_ICON_WIDTH, minWidth: open ? SIDEBAR_WIDTH : SIDEBAR_ICON_WIDTH }}
      >
        {children}
      </div>
    </aside>
  )
}

// ─── Layout slots ─────────────────────────────────────────────────────────────
export function SidebarHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 p-2 overflow-hidden shrink-0", className)}>
      {children}
    </div>
  )
}

export function SidebarContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-1 flex-col gap-2 overflow-y-auto scrollbar overflow-x-hidden min-h-0 p-2", className)}>
      {children}
    </div>
  )
}

export function SidebarFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 p-2 overflow-hidden shrink-0 border-t", className)}>
      {children}
    </div>
  )
}

// ─── Main content area ────────────────────────────────────────────────────────
/**
 * Phần nội dung chính – flex-1, min-w-0, overflow-hidden đảm bảo không bị đè
 */
export function SidebarInset({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main id="main-scroll-container" className={cn("flex flex-1 flex-col min-w-0 overflow-y-auto scrollbar overflow-x-hidden bg-background", className)}>
      {children}
    </main>
  )
}

// ─── Trigger button ───────────────────────────────────────────────────────────
/**
 * Nút toggle mở/đóng sidebar
 */
export function SidebarTrigger({ className }: { className?: string }) {
  const { toggle } = useSidebar()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-8", className)}
      onClick={toggle}
      aria-label="Toggle sidebar"
    >
      <PanelLeftIcon className="size-4" />
    </Button>
  )
}

// ─── Nav group ────────────────────────────────────────────────────────────────
interface SidebarGroupCtx { isOpen: boolean; toggle: () => void; collapsible: boolean }
const SidebarGroupContext = React.createContext<SidebarGroupCtx>({ isOpen: true, toggle: () => {}, collapsible: false })

export function SidebarGroup({
  className,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  className?: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const { open } = useSidebar()
  const toggle = React.useCallback(() => setIsOpen(v => !v), [])
  return (
    <SidebarGroupContext.Provider value={{ isOpen, toggle, collapsible }}>
      <div className={cn("flex flex-col gap-1", className)} data-open={open}>
        {children}
      </div>
    </SidebarGroupContext.Provider>
  )
}

export function SidebarGroupLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open } = useSidebar()
  const { isOpen, toggle, collapsible } = React.useContext(SidebarGroupContext)
  if (!open) return null
  if (collapsible) {
    return (
      <button
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between px-2 py-1 text-xs font-medium",
          "text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-sm",
          className
        )}
      >
        <span>{children}</span>
        <ChevronDownIcon className={cn("size-3 transition-transform duration-200", !isOpen && "-rotate-90")} />
      </button>
    )
  }
  return (
    <div className={cn("px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider", className)}>
      {children}
    </div>
  )
}

/** Bọc nội dung của group có collapsible – animate height khi đóng/mở */
export function SidebarGroupContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { isOpen, collapsible } = React.useContext(SidebarGroupContext)

  if (!collapsible) {
    return <div className={cn("flex flex-col gap-1", className)}>{children}</div>
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="sidebar-group-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
          className={cn("flex flex-col gap-1", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Menu item ────────────────────────────────────────────────────────────────
interface MenuItemProps {
  icon: React.ReactNode
  label: string
  isActive?: boolean
  onClick?: () => void
  href?: string
  as?: React.ElementType
  className?: string
  [key: string]: unknown
}

/**
 * Menu item dùng trong sidebar – tự xử lý truncate + tooltip khi collapsed
 */
export function SidebarMenuItem({
  icon,
  label,
  isActive = false,
  className,
  as: Comp = "button",
  ...props
}: MenuItemProps) {
  const { open } = useSidebar()

  const inner = (
    <Comp
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        !open && "justify-center px-0",
        className
      )}
      {...props}
    >
      {/* Icon – luôn hiển thị */}
      <span className="shrink-0 size-4 flex items-center justify-center">{icon}</span>
      {/* Label – chỉ hiển thị khi open */}
      {open && (
        <span className="flex-1 min-w-0 truncate text-left">{label}</span>
      )}
    </Comp>
  )

  if (!open) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" align="center">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return inner
}
