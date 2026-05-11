import { useEffect, useRef, useState } from "react"
import { useNavigation } from "react-router-dom"

/**
 * Thanh tiến trình 3px cố định đỉnh viewport – luôn hiện khi chuyển route.
 * Hoàn toàn độc lập với LoadingContext, tự subscribe useNavigation().
 * Animation: 0% → 85% ease-out (đang load) → 100% ease-in (xong) → fade out.
 */
export function TopProgressBar() {
  const navigation = useNavigation()
  const isNavigating = navigation.state === "loading"

  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(0)
  // "going" = về 85%, "completing" = về 100%, "hiding" = fade out
  const [phase, setPhase] = useState<"idle" | "going" | "completing" | "hiding">("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    if (isNavigating) {
      clearTimer()
      // Reset ngay về 0, hiện ra
      setWidth(0)
      setOpacity(1)
      setPhase("idle")
      // Đợi 1 frame để 0% paint xong rồi mới animate lên 85%
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWidth(85)
          setPhase("going")
        })
      })
    } else {
      // Route xong: chạy nốt lên 100% nhanh
      setWidth(100)
      setPhase("completing")
      // Sau 250ms (transition xong) → fade out
      timerRef.current = setTimeout(() => {
        setOpacity(0)
        setPhase("hiding")
        // Sau khi fade xong → reset về 0 để sẵn sàng lần sau
        timerRef.current = setTimeout(() => {
          setWidth(0)
          setPhase("idle")
        }, 350)
      }, 250)
    }
    return clearTimer
  }, [isNavigating])

  // Transition duration khác nhau theo phase
  const transitionStyle: React.CSSProperties = {
    width: `${width}%`,
    opacity,
    transition: phase === "going"
      ? "width 8s ease-out, opacity 0.15s"
      : phase === "completing"
        ? "width 0.25s ease-in, opacity 0.15s"
        : "opacity 0.35s ease-out",
  }

  return (
    <div
      role="progressbar"
      aria-label="Đang tải trang..."
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-primary rounded-r-full shadow-[0_0_6px_1px] shadow-primary/50"
        style={transitionStyle}
      />
    </div>
  )
}
