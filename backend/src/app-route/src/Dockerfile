# --- Giai đoạn 1: Cài đặt thư viện ---
FROM python:3.11-slim AS builder
WORKDIR /app

# Cài đặt công cụ để biên dịch gevent và psutil (quan trọng cho bản slim)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# --- Giai đoạn 2: Chạy ứng dụng ---
FROM python:3.11-slim
WORKDIR /app

# Copy thư viện từ builder
COPY --from=builder /root/.local /root/.local
COPY . .

# Đảm bảo Python nhận diện được thư viện và không tạo file .pyc rác
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["python", "main.py"]