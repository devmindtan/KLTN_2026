import { SearchIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

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
}

/**
 * Custom search input với icon tìm kiếm bên trái và nút xoá (X) khi có nội dung.
 * Dùng chung cho mọi search-in-table và filter list trong dự án.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  className,
  disabled,
}: SearchInputProps) {
  return (
    <div className={cn("relative flex-1", className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent",
          "pl-9 pr-8 py-1 text-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "absolute right-2.5 top-1/2 -translate-y-1/2",
            "rounded-sm p-0.5 text-muted-foreground",
            "hover:text-foreground hover:bg-accent",
            "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
          aria-label="Xoá tìm kiếm"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}
