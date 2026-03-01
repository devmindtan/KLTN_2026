import functools
import logging
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def monitor_performance(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()

        duration = end_time - start_time
        # Log ra console để theo dõi trước mắt
        logger.info(f"Hàm '{func.__name__}' chạy mất {duration:.4f} giây")

        # Ở đây bạn có thể push dữ liệu này tới Grafana/Prometheus
        # Ví dụ: metrics.push(func.__name__, duration)

        return result

    return wrapper
