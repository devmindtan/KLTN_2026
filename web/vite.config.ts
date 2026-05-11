import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Charts – nặng nhất (~400kB)
          "vendor-recharts": ["recharts"],
          // Icon libraries
          "vendor-icons": ["lucide-react", "@tabler/icons-react"],
          // Radix UI primitives
          "vendor-radix": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
          // DnD Kit
          "vendor-dndkit": [
            "@dnd-kit/core",
            "@dnd-kit/modifiers",
            "@dnd-kit/sortable",
            "@dnd-kit/utilities",
          ],
          // Table
          "vendor-table": ["@tanstack/react-table"],
          // Misc utils
          "vendor-misc": [
            "socket.io-client",
            "zod",
            "clsx",
            "tailwind-merge",
            "class-variance-authority",
            "sonner",
            "vaul",
          ],
          // Animation – dùng trong sidebar layout
          "vendor-motion": ["framer-motion"],
        },
      },
    },
    // Tăng giới hạn cảnh báo chunk; pages lazy-load sẽ được split riêng
    chunkSizeWarningLimit: 600,
  },
});
