FROM python:3.11-slim

WORKDIR /app

# Cài đặt thư viện hệ thống
# Thay libgl1-mesa-glx bằng libgl1
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libmagic1 \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy và cài đặt dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Copy source code
COPY . .

ENV PYTHONUNBUFFERED=1
ENV TZ="Asia/Ho_Chi_Minh"

CMD ["python", "main.py"]
