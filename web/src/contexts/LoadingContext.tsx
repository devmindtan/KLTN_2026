import React, { createContext, useCallback, useContext, useRef, useState } from "react"

interface LoadingContextType {
  /** Bắt đầu loading – hiển thị sau debounce 300ms tránh flash */
  startLoading: () => void
  /** Dừng loading – ẩn bar ngay lập tức */
  stopLoading: () => void
  isLoading: boolean
}

const LoadingContext = createContext<LoadingContextType>({
  startLoading: () => {},
  stopLoading: () => {},
  isLoading: false,
})

/** Hook lấy loading state + controls từ LoadingProvider */
export function useLoading() {
  return useContext(LoadingContext)
}

/**
 * Provider quản lý trạng thái loading toàn cục với debounce 300ms.
 * Chỉ hiển thị spinner nếu tác vụ mất hơn 300ms để tránh flash ngắn.
 */
export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef(false)

  const startLoading = useCallback(() => {
    if (activeRef.current) return
    activeRef.current = true
    timerRef.current = setTimeout(() => {
      if (activeRef.current) setIsLoading(true)
    }, 100)
  }, [])

  const stopLoading = useCallback(() => {
    activeRef.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsLoading(false)
  }, [])

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading, isLoading }}>
      {children}
    </LoadingContext.Provider>
  )
}
