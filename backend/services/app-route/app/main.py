import psutil
import socket
import logging
from flask_socketio import SocketIO
from flask import Flask, request
import gevent.monkey

gevent.monkey.patch_all()


app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def get_ip():
    """
    Lấy địa chỉ IP nội bộ của máy/container
    Sử dụng không kết nối thực sự, chỉ để xác định interface mạng đang sử dụng
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # không cần kết nối thật, chỉ để lấy interface mạng đang dùng
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
        print(IP)
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP


def show_all_ips(port):
    """
    Quét và hiển thị tất cả các địa chỉ IP khả dụng trên máy
    Args:
        port: Số cổng đang lắng nghe
    """
    print("\n" + "=" * 60)
    print(f"🚀 BACKEND SERVER IS RUNNING (Listening on 0.0.0.0:{port})")
    print("--- Các địa chỉ bạn có thể dùng để gọi Webhook: ---")

    interfaces = psutil.net_if_addrs()
    for iface_name, addresses in interfaces.items():
        for addr in addresses:
            # Chỉ lấy IPv4 (AddressFamily.AF_INET) và bỏ qua loopback (127.0.0.1)
            if addr.family == socket.AF_INET:
                print(f" ➤ {iface_name:12}: http://{addr.address}:{port}")

    print(f"🛠  Mode: Production (Gevent)")
    print("=" * 60 + "\n")


@app.route('/webhook', methods=['POST'])
def fiware_webhook():
    """
    Xử lý FIWARE Orion webhook và broadcast data qua Socket.IO
    Support: Camera entities và ModelMetrics entities
    POST /webhook
    """
    payload = request.json

    # Validation: Kiểm tra payload có tồn tại và có trường 'data'
    if not payload or 'data' not in payload:
        logger.warning("Webhook payload thiếu trường 'data'")
        return "", 400

    logger.info("--- Nhận từ Orion ---")
    if payload and 'data' in payload:
        for entity in payload['data']:
            entity_type = entity.get('type')
            entity_id = entity.get('id')

            if entity_type == 'Camera':
                socketio.emit('CAMERA_UPDATED', entity)
                logger.info(f"📷 Emit CAMERA_UPDATED: {entity_id}")
            elif entity_type == 'ModelMetrics':
                socketio.emit('METRICS_UPDATED', entity)
                logger.info(f"📊 Emit METRICS_UPDATED: {entity_id}")
            else:
                logger.warning(f"⚠️ Unknown entity type: {entity_type}")

    return "", 204


if __name__ == '__main__':
    internal_ip = get_ip()
    port = 5000

    show_all_ips(port)
    socketio.run(app, host='0.0.0.0', port=port)
