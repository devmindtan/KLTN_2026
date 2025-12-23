import pytest
from src.service_1 import tinh_tong, count_generator

@pytest.mark.parametrize("a, b, tong", [
    (100,10, 110),
    (200,20, 220),
    (50,-2, 48),
    (1000,20, 1020),
])
def test_tinh_tong(a,b,tong):
	# 1. Arrange
	# a = 10
	# b = 20
	
	# 2. Act
	result = tinh_tong(a, b)
	
	# 3. Assert (Khẳng định kết quả)
	assert result == tong


def test_count_generator():
	gen = count_generator(1, 2)
	result = 0
	for _ in range(100):
		result = next(gen)
	
	assert result == 199  # 1 + (2 * 99)