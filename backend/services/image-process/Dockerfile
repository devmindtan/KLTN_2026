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
COPY image-process/models /app/models

ENV PYTHONUNBUFFERED=1
ENV TZ="Asia/Ho_Chi_Minh"

# ID: DOCKER-7A2 - Tối ưu hóa build layer và kích thước image
CMD ["python", "main.py"]