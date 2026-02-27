# STAGE 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app

# Chỉ cài các công cụ cần để biên dịch
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Tận dụng Cache cho Requirements
COPY image-process/requirements.txt .
# Build wheel để tránh cài đặt lại từ đầu
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt


# STAGE 2: Runner (Final Image)
FROM python:3.11-slim

WORKDIR /app

# Chỉ cài các thư viện runtime cần thiết (bỏ gcc, python-dev)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libmagic1 \
    libpq5 \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels từ stage builder và cài đặt
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy code (Đặt ở cuối để tránh làm hỏng cache của các layer trên)
COPY shared /app/shared
COPY image-process/app/ /app/

# Tạo thư mục models
RUN mkdir -p /app/models

# Download YOLO model từ MinIO (thay vì COPY local file)
# Yêu cầu MinIO credentials được pass qua ENV khi build
ARG MINIO_ENDPOINT_URL
ARG MINIO_ACCESS_KEY
ARG MINIO_SECRET_KEY
ARG MINIO_BUCKET_NAME=ml-models

ENV MINIO_ENDPOINT_URL=${MINIO_ENDPOINT_URL}
ENV MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
ENV MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
ENV MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME}
ENV PYTHONUNBUFFERED=1

# ID: DOCKER-7A2 - Tối ưu hóa build layer và kích thước image
# ID: DOCKER-8F5 - Download YOLO model từ MinIO thay vì COPY local
CMD ["python", "main.py"]