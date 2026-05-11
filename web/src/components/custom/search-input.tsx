import { SearchIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type SearchInputSize = "sm" | "default" | "lg"

interface SearchInputProps {
  /** Giá trị hiện tại của input */
  value: string
  /** Callback khi giá trị thay đổi */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** CSS class bổ sung cho wrapper */
  className?: string
  /** Disable input */
  disabled?: boolean
  /**
   * Kích thước input:
   * - "sm"      → h-8, text-xs  (dùng trong filter bar nhỏ, sheet, sidebar)
   * - "default" → h-9, text-sm  (mặc định)
   * - "lg"      → h-10, text-base (form chính, trang tìm kiếm)
   */
  size?: SearchInputSize
}

const sizeMap: Record<SearchInputSize, {
  input: string
  iconLeft: string
  icon: string
  clearRight: string
  clearIcon: string
}> = {
  sm: {
    input:      "h-8 pl-8 pr-7 py-1 text-xs",
    iconLeft:   "left-2.5",
    icon:       "size-3",
    clearRight: "right-2",
    clearIcon:  "size-3",
  },
  default: {
    input:      "h-9 pl-9 pr-8 py-1 text-sm",
    iconLeft:   "left-3",
    icon:       "size-3.5",
    clearRight: "right-2.5",
    clearIcon:  "size-3.5",
  },
  lg: {
    input:      "h-10 pl-10 pr-9 py-2 text-sm",
    iconLeft:   "left-3.5",
    icon:       "size-4",
    clearRight: "right-3",
    clearIcon:  "size-4",
  },
}

/**
 * Custom search input với icon tìm kiếm bên trái và nút xoá (X) khi có nội dung.
 * Hỗ trợ 3 kích thước: "sm" | "default" | "lg".
 * Dùng chung cho mọi search-in-table và filter list trong dự án.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  className,
  disabled,
  size = "default",
}: SearchInputProps) {
  const s = sizeMap[size]

  return (
    <div className={cn("relative flex-1", className)}>
      <SearchIcon
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          s.iconLeft,
          s.icon
        )}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex w-full rounded-md border border-input bg-transparent",
          "shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          s.input
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "absolute top-1/2 -translate-y-1/2",
            "rounded-sm p-0.5 text-muted-foreground",
            "hover:text-foreground hover:bg-accent",
            "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            s.clearRight
          )}
          aria-label="Xoá tìm kiếm"
        >
          <XIcon className={s.clearIcon} />
        </button>
      )}
    </div>
  )
}
