# STAGE 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app

# Cài công cụ biên dịch
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Build wheels để cache dependencies
COPY image-predict/requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt


# STAGE 2: Runner (Final Image)
FROM python:3.11-slim

WORKDIR /app

# Chỉ cài runtime libraries
RUN apt-get update && apt-get install -y \
    libpq5 \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels từ builder và install
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy code (Đặt cuối để tận dụng cache)
COPY shared /app/shared
COPY image-predict/app/ /app/

# Tạo thư mục models
RUN mkdir -p /app/models

# Download Random Forest models từ MinIO
# MinIO credentials được pass qua ENV variables khi build
ARG MINIO_ENDPOINT_URL
ARG MINIO_ACCESS_KEY
ARG MINIO_SECRET_KEY
ARG MINIO_BUCKET_NAME=ml-models

ENV MINIO_ENDPOINT_URL=${MINIO_ENDPOINT_URL}
ENV MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
ENV MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
ENV MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME}
ENV PYTHONUNBUFFERED=1


CMD ["python", "predict_realtime.py"]
