# Chọn base image có sẵn các công cụ K8s xịn
FROM alpine/k8s:1.28.3

# 1. Cài đặt Python, Pip, Docker-cli, Nodejs và NPM trong 1 lần quét
# Thêm py3-pip và python3 để có môi trường chạy pytest
RUN apk add --no-cache \
    docker-cli \
    python3 \
    py3-pip \
    nodejs \
    npm

# 2. Cài đặt pytest (dùng cờ --break-system-packages vì đây là môi trường container)
RUN pip install --no-cache-dir pytest --break-system-packages

# Đặt thư mục làm việc mặc định
WORKDIR /app