# --- Giai đoạn 1: Build TypeScript ---
FROM node:20-alpine AS builder

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy package.json và package-lock.json trước để tận dụng Docker Cache
COPY package*.json ./

# Cài đặt tất cả dependencies (bao gồm devDependencies cho build)
RUN npm ci

# Copy toàn bộ mã nguồn
COPY . .

# Build TypeScript -> JavaScript vào thư mục /dist
RUN npm run build

# --- Giai đoạn 2: Production ---
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Chỉ cài production dependencies (loại bỏ devDependencies)
RUN npm ci --only=production

# Copy compiled JavaScript từ builder stage
COPY --from=builder /app/dist ./dist

# Thiết lập biến môi trường
ARG DATABASE_URL

# Chuyển tham số ARG thành biến ENV để Vite nhận ra lúc build
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production
ENV PORT=8080

# Bảo mật: Không chạy bằng quyền root
USER node

# Mở port 8080
EXPOSE 8080

# Lệnh khởi chạy ứng dụng (chạy compiled JavaScript)
CMD ["node", "dist/index.js"]