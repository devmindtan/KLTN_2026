import * as React from "react"
import { SearchIcon } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SearchableOption {
  /** Giá trị option */
  value: string
  /** Nhãn hiển thị */
  label: string
  /**
   * Chuỗi phụ dùng để tìm kiếm (không hiển thị).
   * Ví dụ: shortId, id, aliases – giúp user tìm bằng mã ngắn.
   */
  searchValue?: string
}

/** Kích thước trigger – ảnh hưởng height và font-size */
export type SelectWithSearchSize = "sm" | "default" | "lg"

const SIZE_CLASSES: Record<SelectWithSearchSize, string> = {
  sm:      "h-7 text-xs",
  default: "h-9 text-sm",
  lg:      "h-10 text-sm",
}

interface SelectWithSearchProps {
  /** Giá trị đang được chọn */
  value: string
  /** Callback khi chọn option mới */
  onChange: (value: string) => void
  /** Danh sách options có thể tìm kiếm */
  options: SearchableOption[]
  /** Option cố định ở đầu danh sách (không bị filter) */
  defaultOption?: SearchableOption
  /** Placeholder trigger khi chưa chọn */
  placeholder?: string
  /** Placeholder của ô tìm kiếm trong dropdown */
  searchPlaceholder?: string
  /** Text hiển thị khi không tìm thấy kết quả */
  emptyText?: string
  /**
   * Kích thước trigger: "sm" (h-7 text-xs) | "default" (h-9 text-sm) | "lg" (h-10 text-sm)
   * Mặc định: "default". Bị ghi đè nếu truyền `triggerClassName` chứa h-* / text-*.
   */
  size?: SelectWithSearchSize
  /** Class bổ sung cho SelectTrigger (ghi đè / mở rộng size) */
  triggerClassName?: string
  /**
   * Chiều rộng cố định của dropdown content (ví dụ: "240px", "w-[280px]").
   * Mặc định: theo chiều rộng trigger (shadcn default).
   */
  contentWidth?: string
  /** Chiều cao tối đa của list options, mặc định "200px" */
  maxListHeight?: string
  /** Aria label cho trigger */
  ariaLabel?: string
}

/**
 * Select dropdown có thanh tìm kiếm nội bộ – dùng cho danh sách dài (camera, tuyến đường, v.v.)
 * Tìm kiếm hoạt động client-side, filter theo `label`.
 */
export function SelectWithSearch({
  value,
  onChange,
  options,
  defaultOption,
  placeholder = "Chọn...",
  searchPlaceholder = "Tìm kiếm...",
  emptyText = "Không tìm thấy kết quả",
  size = "default",
  triggerClassName,
  contentWidth,
  maxListHeight = "200px",
  ariaLabel,
}: SelectWithSearchProps) {
  const [query, setQuery] = React.useState("")

  /** Reset query mỗi khi dropdown đóng/mở */
  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) setQuery("")
  }, [])

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.searchValue?.toLowerCase().includes(q) ?? false)
    )
  }, [query, options])

  return (
    <Select value={value} onValueChange={onChange} onOpenChange={handleOpenChange}>
      <SelectTrigger
        className={cn(SIZE_CLASSES[size], triggerClassName)}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent
        className="rounded-xl p-0 max-h-none overflow-hidden"
        style={contentWidth ? { width: contentWidth } : undefined}
      >
        {/* ── Search bar (sticky) ── */}
        <div className="sticky top-0 z-10 bg-background px-2 pt-2 pb-1.5 border-b">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                "w-full rounded-md border bg-transparent",
                "pl-8 pr-3 py-1.5 text-xs",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring"
              )}
              /* Ngăn Select đóng hoặc navigate khi gõ phím */
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* ── Options list (scrollable) ── */}
        <div className="overflow-y-auto scrollbar p-1" style={{ maxHeight: maxListHeight }}>
          {/* Default / "tất cả" option luôn hiển thị */}
          {defaultOption && (
            <SelectItem value={defaultOption.value} className="rounded-lg text-xs">
              {defaultOption.label}
            </SelectItem>
          )}

          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-xs">
                <span className="truncate block max-w-[220px]">{opt.label}</span>
              </SelectItem>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          )}
        </div>
      </SelectContent>
    </Select>
  )
}
