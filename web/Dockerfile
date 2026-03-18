# --- Giai đoạn 1: Build dự án --
FROM node:20-alpine AS build-stage

# Nhận build-args từ CI (GitHub Actions secrets)
ARG VITE_BACKEND_URL
ARG VITE_SOCKET_URL
ARG VITE_MINIO_URL
ARG VITE_LOG=false

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Tạo .env.production từ build-args — không lưu URL trong git.
RUN echo "VITE_BACKEND_URL=${VITE_BACKEND_URL}" > .env.production && \
    echo "VITE_SOCKET_URL=${VITE_SOCKET_URL}" >> .env.production && \
    echo "VITE_MINIO_URL=${VITE_MINIO_URL}" >> .env.production && \
    echo "VITE_LOG=${VITE_LOG}" >> .env.production

RUN npm run build

# --- Giai đoạn 2: Chạy với Nginx ---
FROM nginx:stable-alpine AS production-stage

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Lưu ý: Sửa lại đường dẫn đích nếu nginx.conf của bạn trỏ vào /usr/share/nginx/html/user
COPY --from=build-stage /app/dist /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
