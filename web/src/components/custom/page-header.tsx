import React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** Icon hiển thị bên trái title (nên dùng size w-5 h-5) */
  icon?: React.ReactNode
  /** Tiêu đề trang */
  title: string
  /** Mô tả ngắn bên dưới title */
  description?: string
  /** Slot bên phải: buttons, badges, ... */
  children?: React.ReactNode
  className?: string
}

/**
 * Header section thống nhất cho tất cả các trang (trừ Dashboard).
 * Layout: [icon + title + desc] ..... [right actions]
 */
export function PageHeader({
  icon,
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b",
        className
      )}
    >
      {/* Left: icon + text */}
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-snug truncate">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right: actions / badges – full-width row on mobile, shrink on desktop */}
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  )
}
