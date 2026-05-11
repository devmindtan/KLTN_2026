import * as React from "react"
import { cn } from "@/lib/utils"

interface CardSectionHeaderProps {
  /** Icon component (lucide-react / @tabler/icons-react) */
  icon: React.ElementType
  /** Tiêu đề — luôn text-sm font-medium */
  title: string
  /** Tailwind class màu icon — mặc định "text-black-600 dark:text-white-400" */
  iconColor?: string
  /** Tailwind class màu nền ô icon — mặc định "" (không có nền) */
  iconBg?: string
  /** Mô tả phụ hiển thị dưới title */
  description?: React.ReactNode
  /** Phần tử bổ sung cùng hàng với title — ví dụ link "Xem chi tiết →" */
  action?: React.ReactNode
  /** Badge/chip bổ sung sau khối text — ví dụ badge đếm số camera */
  badge?: React.ReactNode
  /** Dropdown / action button góc phải — ví dụ DropdownMenu 3 chấm */
  menu?: React.ReactNode
  className?: string
}

/**
 * Header chuẩn cho card chứa biểu đồ (chart) hoặc bảng liệt kê (table).
 * Cấu trúc thống nhất: ô icon vuông + (title + action ngang hàng) + description phụ + badge.
 * Quy tắc: title luôn text-sm font-medium — nội dung bên trong ≤ text-sm.
 * Xem style-guide/frontend/UI_STYLE_GUIDE.md — Section 13.
 */
export function CardSectionHeader({
  icon: Icon,
  title,
  iconColor = "text-black-600 dark:text-white-400",
  iconBg = "",
  description,
  action,
  badge,
  menu,
  className,
}: CardSectionHeaderProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("size-5 shrink-0", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium leading-tight">{title}</h2>
          {action}
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
      {badge}
      {menu && <div className="shrink-0 ml-auto">{menu}</div>}
    </div>
  )
}
