FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements và cài đặt thư viện Python
COPY model-performance/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared utilities
COPY shared /app/shared

# Copy toàn bộ mã nguồn vào container
COPY model-performance/ .

# Environment variables
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:/app/shared

EXPOSE 8000

# Chạy continuous mode (60 phút/lần update)
CMD ["python", "main.py"]
