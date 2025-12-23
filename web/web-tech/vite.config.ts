import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        strictPort: true, // Nếu cổng 3000 đã bị dùng, Vite sẽ báo lỗi thay vì tự đổi sang cổng khác
        host: '0.0.0.0',
    }
})
