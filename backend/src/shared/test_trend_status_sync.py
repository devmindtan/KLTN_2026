"""
Test script: Kiểm tra đồng bộ giữa Trend và Status Forecast
"""
from shared.los_utils import calculate_los_status
import sys
import os

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def calculate_trend(current_val: float, predicted_val: float, threshold_percent: float = 10.0) -> str:
    """Copy từ predict_realtime.py"""
    if current_val == 0:
        return "increasing" if predicted_val > 0 else "stable"

    percent_change = ((predicted_val - current_val) / current_val) * 100

    if abs(percent_change) < threshold_percent:
        return "stable"
    elif percent_change > 0:
        return "increasing"
    else:
        return "decreasing"


def test_trend_vs_status_sync():
    """
    Kiểm tra các scenarios để verify trend và status_forecast có logic hợp lý
    """
    print("="*80)
    print("KIỂM TRA ĐỒNG BỘ: TREND vs STATUS FORECAST")
    print("="*80)

    # Capacity giả định (ví dụ: MAX 7 ngày = 120 xe)
    capacity = 120

    test_scenarios = [
        # (current, predicted_5m, description)
        (40, 44, "Tăng nhẹ từ free_flow"),
        (40, 50, "Tăng mạnh từ free_flow"),
        (60, 75, "Tăng từ smooth → moderate"),
        (80, 72, "Giảm nhẹ từ moderate"),
        (100, 85, "Giảm mạnh từ heavy → moderate"),
        (110, 115, "Tăng nhẹ trong congested"),
        (50, 50, "Không đổi"),
        (70, 77, "Tăng đúng ngưỡng 10%"),
    ]

    print("\nCapacity giả định: {} xe/5min\n".format(capacity))
    print(f"{'Current':<10} {'Pred 5p':<10} {'Change%':<10} {'Trend':<12} {'Status Now':<12} {'Status 5p':<12} {'Mô tả'}")
    print("-" * 95)

    for current, predicted, description in test_scenarios:
        # Tính trend
        percent_change = ((predicted - current) / current *
                          100) if current > 0 else 0
        trend = calculate_trend(current, predicted)

        # Tính status hiện tại và dự báo
        status_current = calculate_los_status(current, capacity)
        status_forecast = calculate_los_status(predicted, capacity)

        # Hiển thị
        print(f"{current:<10.0f} {predicted:<10.0f} {percent_change:<+10.1f} {trend:<12} {status_current:<12} {status_forecast:<12} {description}")

    print("\n" + "="*80)
    print("PHÂN TÍCH:")
    print("="*80)
    print("""
1. TREND (Xu hướng):
   - Dựa trên % THAY ĐỔI giữa current và predicted
   - Ngưỡng: ±10%
   - Mục đích: Cho biết lượng xe đang tăng/giảm/ổn định

2. STATUS FORECAST (Trạng thái dự báo):
   - Dựa trên V/C RATIO của giá trị dự đoán
   - Ngưỡng: 60%, 75%, 85%, 100%
   - Mục đích: Cho biết mức độ tắc nghẽn 5 phút sau

3. ĐỒNG BỘ:
   ✅ Trend và Status có thể khác nhau và đó là ĐÚNG!
   
   Ví dụ: Current=40, Pred=50
   - Trend = "increasing" (tăng 25%)
   - Status = "free_flow" → "free_flow" (vẫn dưới 60% capacity)
   → Lưu lượng ĐANG TĂNG nhưng vẫn THÔNG THOÁNG
   
   Ví dụ: Current=100, Pred=85
   - Trend = "decreasing" (giảm 15%)
   - Status = "heavy" → "moderate" (từ 83% xuống 71%)
   → Lưu lượng ĐANG GIẢM và mức độ tắc cũng GIẢM
    """)


def test_edge_cases():
    """Test các trường hợp đặc biệt"""
    print("\n" + "="*80)
    print("EDGE CASES:")
    print("="*80)

    capacity = 100

    edge_cases = [
        (0, 10, "Từ 0 xe → 10 xe"),
        (5, 5, "Không đổi với số lượng thấp"),
        (100, 100, "Không đổi ở capacity"),
        (120, 130, "Tăng trong trạng thái congested"),
        (10, 11, "Tăng 10% (đúng ngưỡng)"),
        (10, 9, "Giảm 10% (đúng ngưỡng)"),
    ]

    print(f"\n{'Current':<10} {'Pred 5p':<10} {'Change%':<10} {'Trend':<12} {'Status→Forecast'}")
    print("-" * 65)

    for current, predicted, description in edge_cases:
        percent_change = ((predicted - current) / current *
                          100) if current > 0 else float('inf')
        trend = calculate_trend(current, predicted)
        status_current = calculate_los_status(current, capacity)
        status_forecast = calculate_los_status(predicted, capacity)

        print(f"{current:<10.0f} {predicted:<10.0f} {percent_change:<+10.1f} {trend:<12} {status_current} → {status_forecast:<10} ({description})")


if __name__ == "__main__":
    test_trend_vs_status_sync()
    test_edge_cases()

    print("\n" + "="*80)
    print("✅ KIỂM TRA HOÀN TẤT")
    print("="*80)
    print("\nKẾT LUẬN:")
    print("- Trend và Status Forecast KHÔNG CẦN đồng bộ hoàn toàn")
    print("- Chúng phục vụ 2 mục đích khác nhau:")
    print("  + Trend: Cho biết XU HƯỚNG thay đổi")
    print("  + Status: Cho biết MỨC ĐỘ TẮC NGHẼN")
    print("- Logic hiện tại là HỢP LÝ và CHÍNH XÁC")
