"Claude, dựa trên cấu trúc dự án hiện tại, hãy thực hiện một đợt refactor lớn để chuyển từ Mock Data sang Real-time Data mà không bị mất dữ liệu khi chuyển Route. Hãy thực hiện theo các bước sau:

1. Tạo SocketContext.tsx (Global State):

Quản lý kết nối Socket.io và state cameras (dạng Record<string, any>) ở cấp độ ứng dụng.

Sử dụng import.meta.env.VITE_SOCKET_URL để kết nối.

Lắng nghe sự kiện "CAMERA_UPDATED" và thực hiện mapping dữ liệu từ payload FIWARE Orion (truy cập sâu vào attrs.total_objects.value, attrs.prediction.value, v.v... như tôi đã cung cấp).

Đảm bảo khi chuyển trang, kết nối socket không bị khởi tạo lại và dữ liệu trong state không bị mất.

1. Cập nhật Dashboard.tsx và các Sub-components:

Xóa bỏ dữ liệu mock từ data.json.

Sử dụng hook useSocket (hoặc lấy từ Context) để lấy dữ liệu cameras và isConnected.

Refactor SectionCards.tsx: Tính toán tổng lượng xe và số camera online từ dữ liệu thật.

Refactor DataTable.tsx: Truyền mảng Object.values(cameras) vào bảng. Map các cột ID, Vehicles, Status (Badge) và Forecast theo đúng cấu trúc payload thực tế.

Refactor ChartAreaInteractive.tsx: Chuyển đổi dữ liệu prediction.value.forecasts của camera đang chọn thành mảng { time: string, value: number } để vẽ biểu đồ diện tích (Area Chart).

1. Quy tắc kỹ thuật:

Sử dụng Optional Chaining (?.) tuyệt đối cho mọi truy cập vào attrs để tránh crash giao diện.

Giữ nguyên các Component Shadcn UI, chỉ thay đổi phần Logic dữ liệu bên trong.

URL ảnh MinIO: ${import.meta.env.VITE_MINIO_URL}/images/${attrs.minio_key.value}.

Hãy bắt đầu bằng việc tạo file Context, sau đó sửa Dashboard và các component liên quan."
