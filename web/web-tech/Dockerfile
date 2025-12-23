# --- Giai đoạn 1: Build dự án ---
FROM node:20-alpine AS build-stage

# Đặt thư mục làm việc
WORKDIR /app

# Copy các file quản lý thư viện vào trước để tận dụng Docker Cache
COPY package*.json ./

# Cài đặt thư viện
RUN npm install

# Copy toàn bộ code nguồn vào container
COPY . .

# Build dự án ra thư mục dist
RUN npm run build

# --- Giai đoạn 2: Chạy với Nginx ---
FROM nginx:stable-alpine AS production-stage

# 1. Copy file cấu hình tùy chỉnh vào đúng chỗ của Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Copy code đã build vào thư mục mà nginx.conf trỏ tới
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Mở cổng 80 cho Nginx (Kớp với cổng --port 80 trong Jenkinsfile của bạn)
EXPOSE 80

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]