# --- Giai đoạn 1: Build dự án ---
FROM node:20-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

# --- Giai đoạn 2: Chạy với Nginx ---
FROM nginx:stable-alpine AS production-stage

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Lưu ý: Sửa lại đường dẫn đích nếu nginx.conf của bạn trỏ vào /usr/share/nginx/html/user
COPY --from=build-stage /app/dist /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
