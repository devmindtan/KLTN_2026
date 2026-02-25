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
COPY sync-actual/requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt


# STAGE 2: Runner (Final Image)
FROM python:3.11-slim

WORKDIR /app

# Chỉ cài runtime libraries (không cần gcc)
RUN apt-get update && apt-get install -y \
    libpq5 \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels từ builder và install
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy code (Đặt cuối để tận dụng cache)
COPY shared /app/shared
COPY sync-actual/app/ /app/

ENV PYTHONUNBUFFERED=1
ENV TZ="Asia/Ho_Chi_Minh"

CMD ["python", "sync_actual.py"]
