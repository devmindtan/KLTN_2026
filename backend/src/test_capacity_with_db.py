"""
Script test capacity functions với database connection thực
Yêu cầu: Database đang chạy và có dữ liệu trong bảng camera_detections
Chạy: venv venv-py314 && python test_capacity_with_db.py
"""
from shared.los_utils import get_camera_max_realtime_capacity, get_camera_capacity_map
import sys
import os

# Prompt user cho database credentials
print("=" * 80)
print("DATABASE CONNECTION SETUP")
print("=" * 80)
print("Nhập thông tin database (Enter để dùng default):\n")

db_host = input("POSTGRES_HOST [localhost]: ").strip() or "localhost"
db_name = input("POSTGRES_DBS [traffic_db]: ").strip() or "traffic_db"
db_user = input("POSTGRES_USERNAME [postgres]: ").strip() or "postgres"
db_pass = input("POSTGRES_PASSWORD [postgres]: ").strip() or "postgres"
db_port = input("POSTGRES_PORT [5432]: ").strip() or "5432"

# Set environment variables
os.environ['POSTGRES_HOST'] = db_host
os.environ['POSTGRES_DBS'] = db_name
os.environ['POSTGRES_USERNAME'] = db_user
os.environ['POSTGRES_PASSWORD'] = db_pass
os.environ['POSTGRES_PORT'] = db_port

print(f"\n✅ Sẽ connect tới: {db_user}@{db_host}:{db_port}/{db_name}")
print("=" * 80)

# Import sau khi set env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))

# Test camera list
test_cameras = [
    "662b86c41afb9c00172dd31c",
    "5d9dde1f766c880017188c98",
    "587ee0ecb807da0011e33d50"
]

print("\n" + "=" * 80)
print("TEST CAPACITY FUNCTIONS")
print("=" * 80)

print("\n1️⃣ Testing get_camera_max_realtime_capacity() - MAX dòng lớn nhất")
print("-" * 80)
try:
    realtime_capacity = get_camera_max_realtime_capacity(
        lookback_days=7, camera_list=test_cameras)
    if all(v == 100.0 for v in realtime_capacity.values()):
        print(
            "⚠️  Tất cả capacity = 100 (DEFAULT) - Có thể không có data hoặc connection lỗi")
    else:
        print(f"✅ Success! Có data thực từ database:")

    for cam_id, capacity in realtime_capacity.items():
        print(f"   Camera {cam_id[:8]}...: {capacity:.2f} vehicles")
    print(f"\n   Tổng cộng: {len(realtime_capacity)} cameras")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("2️⃣ Testing get_camera_capacity_map() - MAX của AVG 5 phút")
print("-" * 80)
try:
    prediction_capacity = get_camera_capacity_map(
        lookback_days=7, camera_list=test_cameras)
    if all(v == 100.0 for v in prediction_capacity.values()):
        print(
            "⚠️  Tất cả capacity = 100 (DEFAULT) - Có thể không có data hoặc connection lỗi")
    else:
        print(f"✅ Success! Có data thực từ database:")

    for cam_id, capacity in prediction_capacity.items():
        print(f"   Camera {cam_id[:8]}...: {capacity:.2f} vehicles")
    print(f"\n   Tổng cộng: {len(prediction_capacity)} cameras")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("3️⃣ So sánh 2 loại capacity")
print("-" * 80)
try:
    has_real_data = False
    for cam_id in test_cameras:
        realtime_cap = realtime_capacity.get(cam_id, 0)
        prediction_cap = prediction_capacity.get(cam_id, 0)

        if realtime_cap != 100.0 or prediction_cap != 100.0:
            has_real_data = True

        diff = realtime_cap - prediction_cap
        diff_percent = (diff / prediction_cap *
                        100) if prediction_cap > 0 else 0

        print(f"\nCamera {cam_id[:8]}...")
        print(f"  Realtime (MAX dòng):    {realtime_cap:>7.2f} vehicles")
        print(f"  Prediction (MAX AVG):   {prediction_cap:>7.2f} vehicles")
        print(f"  Chênh lệch:             {diff:>7.2f} ({diff_percent:+.1f}%)")

    if not has_real_data:
        print("\n⚠️  WARNING: Không có data thực từ database!")
        print("   Kiểm tra:")
        print("   1. Database có đang chạy không?")
        print("   2. Bảng camera_detections có data không?")
        print("   3. Connection string có đúng không?")
except Exception as e:
    print(f"❌ Error comparing: {e}")

print("\n" + "=" * 80)
print("✅ Test hoàn tất!")
print("=" * 80)
