"""
Script test để kiểm tra 2 hàm capacity
Chạy: python test_capacity_functions.py
"""
from shared.los_utils import get_camera_max_realtime_capacity, get_camera_capacity_map
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))


# Test camera list (một vài camera từ list)
test_cameras = [
    "662b86c41afb9c00172dd31c",
    "5d9dde1f766c880017188c98",
    "587ee0ecb807da0011e33d50"
]

print("=" * 80)
print("TEST CAPACITY FUNCTIONS")
print("=" * 80)

print("\n1️⃣ Testing get_camera_max_realtime_capacity() - MAX dòng lớn nhất")
print("-" * 80)
try:
    realtime_capacity = get_camera_max_realtime_capacity(
        lookback_days=7, camera_list=test_cameras)
    print(f"✅ Success! Kết quả:")
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
    print(f"✅ Success! Kết quả:")
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
    for cam_id in test_cameras:
        realtime_cap = realtime_capacity.get(cam_id, 0)
        prediction_cap = prediction_capacity.get(cam_id, 0)
        diff = realtime_cap - prediction_cap
        diff_percent = (diff / prediction_cap *
                        100) if prediction_cap > 0 else 0

        print(f"\nCamera {cam_id[:8]}...")
        print(f"  Realtime (MAX dòng):    {realtime_cap:>7.2f} vehicles")
        print(f"  Prediction (MAX AVG):   {prediction_cap:>7.2f} vehicles")
        print(f"  Chênh lệch:             {diff:>7.2f} ({diff_percent:+.1f}%)")
except Exception as e:
    print(f"❌ Error comparing: {e}")

print("\n" + "=" * 80)
print("✅ Test hoàn tất!")
print("=" * 80)
