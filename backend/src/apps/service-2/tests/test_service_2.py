import pytest
from src.service_2 import count_generator


def test_count_generator():
	gen = count_generator(1, 2)
	result = 0
	for _ in range(100):
		result = next(gen)
	
	assert result == 199  # 1 + (2 * 99)