/**
 * ScrollToTop - Component hiển thị nút cuộn lên đầu trang
 * Chỉ hiển thị khi scroll xuống quá 1 viewport height
 * Có độ mờ để không che dữ liệu
 */
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUpIcon } from "lucide-react"

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Hiển thị khi scroll xuống > 1 viewport height
      if (window.scrollY > window.innerHeight) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", toggleVisibility)

    return () => {
      window.removeEventListener("scroll", toggleVisibility)
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  if (!isVisible) return null

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      className="fixed bottom-8 right-8 z-50 size-12 rounded-full shadow-lg opacity-70 hover:opacity-100 transition-opacity duration-300"
      aria-label="Cuộn lên đầu trang"
    >
      <ArrowUpIcon className="size-5" />
    </Button>
  )
}
