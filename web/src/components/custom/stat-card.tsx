import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { InfoTooltip } from "@/components/custom/info-tooltip"

interface StatCardProps {
  /**
   * Tiêu đề ngắn gọn — hiển thị text-xs text-muted-foreground.
   * Không thay đổi font-size via className.
   */
  title: string

  /**
   * Tối đa 2 phần tử (icon, dot, text) hiển thị bên phải tiêu đề.
   * Ví dụ: dot trạng thái + icon loại, hoặc chỉ 1 icon đơn.
   * Được bọc trong flex items-center gap-1.5.
   */
  headerRight?: React.ReactNode

  /**
   * Giá trị dữ liệu chính — luôn bọc trong text-2xl font-bold tabular-nums.
   * Truyền string/number cho value đơn giản.
   * Truyền ReactNode khi cần layout phức tạp (ví dụ: số lớn + text phụ cùng hàng).
   * Lưu ý: class text-2xl font-bold áp dụng ở wrapper div — inner element có thể override nếu cần.
   */
  value: React.ReactNode

  /**
   * Vùng dữ liệu phụ 1 — render trực tiếp sau value (không có wrapper tự động).
   * Caller tự định nghĩa layout và spacing (ví dụ: badges row với mt-1.5 flex gap-1.5).
   */
  sub1?: React.ReactNode

  /**
   * Vùng dữ liệu phụ 2 — render trực tiếp sau sub1 (không có wrapper tự động).
   * Caller tự định nghĩa layout và spacing (ví dụ: text mô tả với mt-1.5).
   */
  sub2?: React.ReactNode

  /**
   * Tooltip giải thích ngắn gọn cho tiêu đề — nếu có, thêm icon ? sau label.
   * Dùng khi cần giải thích thuật ngữ hoặc đơn vị đo.
   */
  tooltip?: string

  className?: string
}

/**
 * Card thống kê chuẩn — dùng cho stats overview row trên Dashboard và các trang khác.
 * Layout: [title — tooltip?] [headerRight] / value lớn / sub1 / sub2
 * Xem style-guide/frontend/UI_STYLE_GUIDE.md — Section 2 (Stats Cards).
 */
export function StatCard({
  title,
  headerRight,
  value,
  sub1,
  sub2,
  tooltip,
  className,
}: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="pt-4 pb-4">
        {/* Header: title + optional tooltip | right icons */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs text-muted-foreground leading-none">{title}</span>
            {tooltip && <InfoTooltip content={tooltip} />}
          </div>
          {headerRight && (
            <div className="flex items-center gap-1.5 shrink-0">{headerRight}</div>
          )}
        </div>

        {/* Main value — always text-2xl font-bold tabular-nums */}
        <div className="text-2xl font-bold tabular-nums">{value}</div>

        {/* Secondary content areas — no auto-wrapper; caller controls layout + spacing */}
        {sub1}
        {sub2}
      </CardContent>
    </Card>
  )
}
