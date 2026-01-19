import os

from dotenv import load_dotenv
from psycopg2 import OperationalError
from psycopg2.pool import ThreadedConnectionPool

load_dotenv()
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_DBS = os.getenv("POSTGRES_DBS")
POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))

# Postgres
try:
    db_pool = ThreadedConnectionPool(
        minconn=1,
        maxconn=20,
        host=POSTGRES_HOST,
        database=POSTGRES_DBS,
        user=POSTGRES_USERNAME,
        password=POSTGRES_PASSWORD,
        port=POSTGRES_PORT,
        connect_timeout=5,
    )

    # Thử lấy 1 kết nối để kiểm tra thực tế
    conn = db_pool.getconn()

    if conn:
        print(f"✅ Kết nối Postgres thành công tới: {POSTGRES_HOST}")
        # Quan trọng: Test xong phải trả lại kết nối cho pool
        db_pool.putconn(conn)

except OperationalError as e:
    print(f"❌ Kết nối thất bại: {e}")
except Exception as e:
    print(f"⚠️ Lỗi không xác định: {e}")
