/**
 * ThemeProvider - Quản lý theme (dark/light mode) cho toàn bộ ứng dụng
 * Sử dụng localStorage để lưu theme preference của user
 */
import React, { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Kiểm tra localStorage trước
    const storedTheme = localStorage.getItem("theme") as Theme | null
    if (storedTheme) return storedTheme
    
    // Fallback: Kiểm tra system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark"
    }
    
    return "light"
  })

  useEffect(() => {
    const root = document.documentElement
    
    // Xóa cả 2 class trước
    root.classList.remove("light", "dark")
    
    // Thêm class theme hiện tại
    root.classList.add(theme)
    
    // Lưu vào localStorage
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
