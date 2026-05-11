# ============================================
# Stage 1: Builder - Install dependencies
# ============================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Install PostgreSQL 18 client từ PostgreSQL APT repository
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    gnupg \
    lsb-release \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và build wheels
COPY backup-postgres/requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ============================================
# Stage 2: Runtime - Lightweight final image
# ============================================
FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL 18 client và rclone
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    lsb-release \
    tzdata \
    unzip \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y postgresql-client-18 \
    && curl -O https://downloads.rclone.org/rclone-current-linux-amd64.zip \
    && unzip rclone-current-linux-amd64.zip \
    && cd rclone-*-linux-amd64 \
    && cp rclone /usr/bin/ \
    && chown root:root /usr/bin/rclone \
    && chmod 755 /usr/bin/rclone \
    && cd .. \
    && rm -rf rclone-* \
    && apt-get purge -y curl gnupg lsb-release unzip \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Set timezone to UTC (best practice cho backup timestamps)
ENV TZ=UTC

# Copy wheels từ builder stage
COPY --from=builder /wheels /wheels
COPY --from=builder /build/requirements.txt .

# Install packages từ wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Copy application code
COPY backup-postgres/app/ /app/

# Create backup directory
RUN mkdir -p /tmp/backups

# Run backup script
CMD ["python", "backup.py"]
