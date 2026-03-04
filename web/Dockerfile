# --- Giai đoạn 1: Build dự án ---
FROM node:20-alpine AS build-stage

WORKDIR /app

# Định nghĩa các tham số nhận vào từ câu lệnh build
ARG VITE_SOCKET_URL
ARG VITE_MINIO_URL
ARG VITE_BACKEND_URL

# Chuyển tham số ARG thành biến ENV để Vite nhận ra lúc build
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_MINIO_URL=$VITE_MINIO_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY package*.json ./
RUN npm install

COPY . .

# Khi lệnh này chạy, Vite sẽ tìm các biến ENV bắt đầu bằng VITE_ để nhúng vào JS
RUN npm run build

# --- Giai đoạn 2: Chạy với Nginx ---
FROM nginx:stable-alpine AS production-stage

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Lưu ý: Sửa lại đường dẫn đích nếu nginx.conf của bạn trỏ vào /usr/share/nginx/html/user
COPY --from=build-stage /app/dist /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
