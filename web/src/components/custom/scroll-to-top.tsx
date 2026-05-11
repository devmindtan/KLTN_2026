/**
 * ScrollToTop - Component hiển thị nút cuộn lên đầu trang
 * Lắng nghe scroll từ #main-scroll-container (SidebarInset overflow-y-auto)
 * Hiển thị khi scroll xuống > 300px; dùng CSS transition thay vì mount/unmount để tránh flicker
 * Scroll dùng rAF easing thay vì native smooth để nhất quán và nhanh hơn (~350ms cố định)
 */
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUpIcon } from "lucide-react"

const SHOW_THRESHOLD = 300  // px — ngưỡng cố định, không dùng clientHeight để tránh jitter
const SCROLL_DURATION = 250  // ms — thời gian scroll cố định, không phụ thuộc distance

/** easeInOutCubic — mượt ở đầu và cuối */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Cuộn container về top với rAF easing, hủy được qua cancelAnimationFrame */
function smoothScrollToTop(container: HTMLElement, duration: number): () => void {
  const start = container.scrollTop
  if (start === 0) return () => {}
  const startTime = performance.now()
  let rafId: number

  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    container.scrollTop = start * (1 - easeInOutCubic(progress))
    if (progress < 1) rafId = requestAnimationFrame(step)
  }

  rafId = requestAnimationFrame(step)
  return () => cancelAnimationFrame(rafId)
}

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const container = document.getElementById("main-scroll-container")
    if (!container) return

    const handleScroll = () => {
      setIsVisible(container.scrollTop > SHOW_THRESHOLD)
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    const container = document.getElementById("main-scroll-container")
    if (!container) return
    // Hủy animation đang chạy trước (tránh conflict nếu click nhanh)
    cancelRef.current?.()
    cancelRef.current = smoothScrollToTop(container, SCROLL_DURATION)
  }

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      aria-label="Cuộn lên đầu trang"
      className={[
        "fixed bottom-8 right-8 z-50 size-12 rounded-full shadow-lg",
        "transition-[opacity,transform] duration-300",
        isVisible
          ? "opacity-70 hover:opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none",
      ].join(" ")}
    >
      <ArrowUpIcon className="size-5" />
    </Button>
  )
}
