import asyncio
import io
import logging
import os
import time
from datetime import datetime

import aiohttp
import boto3
import cv2
import numpy as np
from dotenv import load_dotenv
from psycopg2.extras import Json
from psycopg2.pool import ThreadedConnectionPool
from ultralytics import YOLO

load_dotenv()
# ENV
MINIO_ENDPOINT_URL = os.getenv("MINIO_ENDPOINT_URL")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET_NAME = os.getenv("MINIO_BUCKET_NAME")
FIWARE_ORION_BASE = os.getenv("FIWARE_ORION_BASE")
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_DBS = os.getenv("POSTGRES_DBS")
POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# --- CẤU HÌNH ---
MINIO_CONFIG = {
    "endpoint_url": MINIO_ENDPOINT_URL,
    "access_key": MINIO_ACCESS_KEY,
    "secret_key": MINIO_SECRET_KEY,
    "bucket_name": MINIO_BUCKET_NAME,
}

CAMERA_LIST = [
    "662b86c41afb9c00172dd31c",
    "5a6065c58576340017d06615",
    "6623f4df6f998a001b2528eb",
    "662b7ce71afb9c00172dc676",
    "649da77ea6068200171a6dd4",
    "662b857b1afb9c00172dd106",
    "5d9ddd49766c880017188c94",
    "5d9ddec9766c880017188c9c",
    "5a8256315058170011f6eac9",
    "58b5510817139d0010f35d4e",
    "5d8cd653766c88001718894c",
    "5d9ddf0f766c880017188c9e",
    "5d9dde1f766c880017188c98",
    "587ee0ecb807da0011e33d50",
    "5a8253615058170011f6eabf",
    "6623df636f998a001b251e92",
    "58e49e3dd9d6200011e0b9d1",
    "5a8241105058170011f6eaa6",
    "662b7f9f1afb9c00172dca50",
    "587ed91db807da0011e33d4e",
]
# Cấu hình FIWARE Orion
FIWARE_ORION_URL = f"http://{FIWARE_ORION_BASE}/v2/entities"

# Postgres
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

# 1. Khởi tạo Model và S3 Client
model = YOLO("best.pt")
s3_client = boto3.client(
    "s3",
    endpoint_url=MINIO_CONFIG["endpoint_url"],
    aws_access_key_id=MINIO_CONFIG["access_key"],
    aws_secret_access_key=MINIO_CONFIG["secret_key"],
)


async def update_fiware(camera_id, detections, total_objects, minio_key):
    """Cập nhật dữ liệu realtime sang FIWARE Orion Context Broker"""
    entity_id = f"urn:ngsi-ld:Camera:{camera_id}"

    # Payload theo chuẩn NGSI-v2
    payload = {
        "id": entity_id,
        "type": "Camera",
        "total_objects": {"type": "Integer", "value": total_objects},
        "detections": {"type": "StructuredValue", "value": detections},
        "minio_key": {"type": "Text", "value": minio_key},
        "last_updated": {"type": "DateTime", "value": datetime.now().isoformat()},
    }

    headers = {
        "Content-Type": "application/json",
        "fiware-service": "traffic_monitor",
        "fiware-servicepath": "/",
    }

    try:
        async with aiohttp.ClientSession() as session:
            # Sử dụng UPSERT (POST với options=upsert)
            # để tạo mới nếu chưa có hoặc cập nhật nếu đã tồn tại
            url = f"{FIWARE_ORION_URL}?options=upsert"
            async with session.post(
                url, json=payload, headers=headers, timeout=5
            ) as resp:
                if resp.status in [201, 204]:
                    logger.info(f"[{camera_id}] FIWARE Update OK")
                    pass
                else:
                    logger.error(f"FIWARE Error: {resp.status}")
    except Exception as e:
        logger.error(f"Lỗi kết nối FIWARE: {e}")


def save_to_db(minio_key, cam_id, detections, total_objects):
    """Hàm đồng bộ để chèn dữ liệu vào Postgres"""
    conn = None
    try:
        conn = db_pool.getconn()
        cur = conn.cursor()
        query = """
            INSERT INTO camera_detections (minio_key, camera_id, detections, total_objects, created_at)
            VALUES (%s, %s, %s, %s, %s)
        """
        cur.execute(
            query, (minio_key, cam_id, Json(detections), total_objects, datetime.now())
        )
        conn.commit()
        cur.close()
        logger.info(f"{minio_key} DB Save OK")
    except Exception as e:
        logger.error(f"Lỗi Postgres: {e}")
    finally:
        if conn:
            # Trả lại kết nối cho pool thay vì đóng hẳn
            db_pool.putconn(conn)


def process_and_upload(camera_id, image_bytes):
    """Hàm xử lý AI và Upload (Chạy trong thread riêng để không block async)"""
    try:
        # Decode ảnh
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is not None:
            # Chạy AI
            results = model(frame, verbose=False)

            # --- LẤY DỮ LIỆU ---
            data_summary = []
            detection_counts = {}

            for box in results[0].boxes:
                class_id = int(box.cls[0])
                label = model.names[class_id]
                confidence = float(box.conf[0])

                # Lưu vào danh sách chi tiết
                data_summary.append(
                    {
                        "label": label,
                        "confidence": confidence,
                        "box": box.xyxy[0].tolist(),  # [x1, y1, x2, y2]
                    }
                )

                # Đếm số lượng từng loại
                detection_counts[label] = detection_counts.get(label, 0) + 1

            # In ra để kiểm tra
            total_objects = 0
            for i in detection_counts.values():
                total_objects += i

            logger.info(f"[{camera_id}] Phát hiện: {detection_counts}")

            # Vẽ kết quả
            annotated_frame = results[0].plot(line_width=1, font_size=0.5, labels=False)

            # Encode lại thành JPEG
            _, buffer = cv2.imencode(".jpg", annotated_frame)
            io_buf = io.BytesIO(buffer)

            # Upload lên MinIO
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = (
                f"{camera_id}/{timestamp}.jpg"  # Lưu vào thư mục riêng cho từng cam
            )

            s3_client.upload_fileobj(
                io_buf,
                MINIO_CONFIG["bucket_name"],
                file_name,
                ExtraArgs={"ContentType": "image/jpeg"},
            )

            # {minio-key, camid, detection, total-objects, createdat}
            save_to_db(
                minio_key=file_name,
                cam_id=camera_id,
                detections=detection_counts,
                total_objects=total_objects,
            )
            logger.info(f"Thành công: {camera_id}")

            return {
                "minio_key": file_name,
                "detections": detection_counts,
                "total_objects": total_objects,
            }
    except Exception as e:
        return f"Lỗi xử lý {camera_id}: {e}"


async def fetch_camera(session, camera_id):
    """Tải một ảnh từ một camera"""
    url = f"https://giaothong.hochiminhcity.gov.vn:8007/Render/CameraHandler.ashx?id={camera_id}"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://giaothong.hochiminhcity.gov.vn/",
    }
    try:
        async with session.get(url, headers=headers, timeout=15) as response:
            if response.status == 200:
                image_bytes = await response.read()
                # Đẩy việc xử lý AI nặng sang ThreadPool để tránh treo loop
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, process_and_upload, camera_id, image_bytes
                )
                logger.info(result)
                if result:
                    await update_fiware(
                        camera_id=camera_id,
                        detections=result["detections"],
                        total_objects=result["total_objects"],
                        minio_key=result["minio_key"],
                    )
                    logger.info(f"[{camera_id}] Toàn bộ quy trình hoàn tất.")
            else:
                logger.info(f"Cam {camera_id} lỗi HTTP: {response.status}")
    except Exception as e:
        logger.error(f"Cam {camera_id} lỗi kết nối: {e}")


async def main():
    # Khởi tạo cookie lần đầu
    async with aiohttp.ClientSession() as session:
        logger.info("Đang khởi tạo Cookie...")
        await session.get(
            "https://giaothong.hochiminhcity.gov.vn/",
            headers={"User-Agent": "Mozilla/5.0"},
        )

        while True:
            start_time = time.time()

            # Tạo danh sách các task chạy song song
            tasks = [fetch_camera(session, cid) for cid in CAMERA_LIST]

            # Chờ tất cả camera hoàn thành chu kỳ này
            await asyncio.gather(*tasks)

            logger.info(
                f"--- Hoàn thành chu kỳ trong {time.time() - start_time:.2f} giây ---"
            )

            # Đợi 5 giây trước khi bắt đầu chu kỳ tiếp theo
            await asyncio.sleep(3)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.error("Đã dừng chương trình.")
