import { useLoading } from "@/contexts/LoadingContext"

/**
 * Overlay phủ toàn bộ <main> khi isLoading=true (API chậm >300ms).
 * Đặt bên trong <main className="relative"> để chỉ che content, không che sidebar/header.
 * Spinner + text "Đang tải dữ liệu..." ở giữa overlay.
 */
export function PageLoadingOverlay() {
  const { isLoading } = useLoading()

  if (!isLoading) return null

  return (
    <div
      role="status"
      aria-label="Đang tải dữ liệu..."
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
    </div>
  )
}
