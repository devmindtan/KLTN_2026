# Multi-stage build for decision-analyzer service
FROM python:3.11-slim AS builder

# Build deps for psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY decision-analyzer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv

# Copy app
COPY decision-analyzer/app/ ./

# Timezone support
RUN apt-get update && apt-get install -y \
    libpq5 \
    tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Ho_Chi_Minh

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "print('healthy')" || exit 1

# Default entrypoint (can be overridden)
ENTRYPOINT ["python", "main.py"]
CMD []
