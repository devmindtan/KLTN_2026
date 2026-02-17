"""
Test script để verify capacity synchronization giữa services
"""
from shared.los_utils import (
    calculate_los_status,
    get_camera_capacity_map,
    DEFAULT_CAPACITY,
    LOS_THRESHOLDS,
)
import sys
import os

# Add parent directory to path (giống như trong các service files)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def test_los_calculation():
    """Test LOS status calculation với các scenarios khác nhau"""
    print("=== Test LOS Calculation ===")

    test_cases = [
        (30, 100, "free_flow"),    # 30% capacity
        (50, 100, "free_flow"),    # 50% capacity
        (65, 100, "smooth"),       # 65% capacity
        (80, 100, "moderate"),     # 80% capacity
        (90, 100, "heavy"),        # 90% capacity
        (110, 100, "congested"),   # 110% capacity (over)

        # Test với capacity động (ví dụ camera có capacity thấp)
        (30, 60, "free_flow"),     # 50% of lower capacity
        (50, 60, "smooth"),        # 83% of lower capacity

        # Test với capacity cao
        (80, 150, "free_flow"),    # 53% of higher capacity
    ]

    for volume, capacity, expected in test_cases:
        result = calculate_los_status(volume, capacity)
        vc_ratio = (volume / capacity * 100) if capacity > 0 else 0
        status = "✅" if result == expected else "❌"
        print(f"{status} Vol={volume:3d}, Cap={capacity:3d}, V/C={vc_ratio:5.1f}% → {result:12s} (expect: {expected})")


def test_trend_calculation():
    """Test trend calculation với threshold mới (10%)"""
    print("\n=== Test Trend Calculation ===")

    # Import từ predict_realtime
    sys.path.append(os.path.abspath(os.path.join(
        os.path.dirname(__file__), "../image-predict")))
    from predict_realtime import calculate_trend

    test_cases = [
        (50, 55, "stable"),      # 10% increase (đúng ở ngưỡng)
        (50, 60, "increasing"),  # 20% increase
        (50, 45, "stable"),      # 10% decrease (đúng ở ngưỡng)
        (50, 40, "decreasing"),  # 20% decrease
        (100, 105, "stable"),    # 5% change
        (20, 25, "increasing"),  # 25% increase
        (0, 10, "increasing"),   # Edge case: from zero
    ]

    for current, predicted, expected in test_cases:
        result = calculate_trend(current, predicted)
        percent_change = ((predicted - current) / current *
                          100) if current > 0 else float('inf')
        status = "✅" if result == expected else "❌"
        print(f"{status} Curr={current:3.0f}, Pred={predicted:3.0f}, Change={percent_change:+6.1f}% → {result:12s} (expect: {expected})")


def test_capacity_consistency():
    """Verify rằng capacity map function giờ đã ở shared module"""
    print("\n=== Test Capacity Function Location ===")

    # Test import từ shared
    from shared.los_utils import get_camera_capacity_map
    print("✅ Import get_camera_capacity_map từ shared.los_utils OK")

    # Test import từ image-predict (deprecated wrapper)
    sys.path.append(os.path.abspath(os.path.join(
        os.path.dirname(__file__), "../image-predict")))
    from query import get_camera_capacity_map as deprecated_get_capacity
    print("✅ Import get_camera_capacity_map từ query.py (deprecated wrapper) OK")

    print("\n⚠️  NOTE: query.py version giờ chỉ là wrapper gọi shared version")
    print("    Recommend: Luôn import trực tiếp từ shared.los_utils")


if __name__ == "__main__":
    print("Testing capacity & LOS synchronization...\n")

    test_los_calculation()
    test_trend_calculation()
    test_capacity_consistency()

    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)
