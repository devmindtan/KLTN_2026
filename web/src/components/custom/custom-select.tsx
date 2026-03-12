import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SelectOption<T extends string = string> {
  /** Giá trị option (string) */
  value: T
  /** Nhãn hiển thị */
  label: string
  /** Icon hiển thị trước label trong dropdown (tuỳ chọn) */
  icon?: React.ComponentType<{ className?: string }>
}

interface CustomSelectProps<T extends string = string> {
  /** Giá trị đang được chọn */
  value: T
  /** Callback khi chọn giá trị mới */
  onChange: (value: T) => void
  /** Danh sách options */
  options: SelectOption<T>[]
  /** Placeholder khi chưa chọn */
  placeholder?: string
  /** Icon bên trái trigger (ví dụ: FilterIcon) */
  icon?: React.ComponentType<{ className?: string }>
  /** CSS class bổ sung cho SelectTrigger */
  className?: string
  /** Disable toàn bộ select */
  disabled?: boolean
}

/**
 * Custom select dropdown – wrapper của shadcn Select với API options-array.
 * Tự động hiển thị icon trước label trong trigger và trong mỗi option.
 * Dùng cho bộ lọc, status filter, trend filter, và mọi dropdown đơn chọn.
 */
export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  icon: Icon,
  className,
  disabled,
}: CustomSelectProps<T>) {
  const selected = options.find((o) => o.value === value)
  const SelectedIcon = selected?.icon

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as T)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-9 text-sm gap-1.5",
          className
        )}
      >
        {/* Leading icon: từ trigger prop hoặc từ icon của option đang chọn */}
        {Icon && !SelectedIcon && (
          <Icon className="size-3.5 text-muted-foreground shrink-0" />
        )}
        {SelectedIcon && (
          <SelectedIcon className="size-3.5 text-muted-foreground shrink-0" />
        )}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent>
        {options.map((opt) => {
          const OptIcon = opt.icon
          return (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex items-center gap-2">
                {OptIcon && <OptIcon className="size-3.5 text-muted-foreground shrink-0" />}
                {opt.label}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
