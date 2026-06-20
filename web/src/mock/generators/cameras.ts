/**
 * Danh sách camera mock — DÙNG ĐÚNG cam_id, tên giao lộ và toạ độ THẬT (TP.HCM),
 * khớp với các thư mục ảnh thật trong src/mock/engine/mock-cameras/<cam_id>/.
 * KHÔNG tự sinh cam_id giả nữa — bắt buộc giữ nguyên cam_id thật để traffic-images.ts
 * (dùng import.meta.glob) match đúng ảnh theo từng camera.
 */

export type RoadType = "highway" | "major" | "arterial";

export interface CameraSeed {
  cam_id: string;
  display_name: string;
  lat: number;
  lng: number;
  capacity: number;
  roadType: RoadType;
}

export const CAMERA_SEEDS: CameraSeed[] = [
  { cam_id: "662b86c41afb9c00172dd31c", display_name: "Trần Quang Khải - Trần Khắc Chân", lat: 10.7918902432446, lng: 106.691054105759, capacity: 160, roadType: "major" },
  { cam_id: "5a6065c58576340017d06615", display_name: "Tô Ngọc Vân – TX25", lat: 10.8797100979598, lng: 106.677986383438, capacity: 140, roadType: "arterial" },
  { cam_id: "6623f4df6f998a001b2528eb", display_name: "Quốc Lộ 13 - cầu Ông Dầu", lat: 10.8361932799182, lng: 106.713809967041, capacity: 210, roadType: "highway" },
  { cam_id: "662b7ce71afb9c00172dc676", display_name: "Cách Mạng Tháng Tám - Bùi Thị Xuân", lat: 10.7726452614037, lng: 106.691064834595, capacity: 175, roadType: "major" },
  { cam_id: "649da77ea6068200171a6dd4", display_name: "Tôn Đức Thắng - Công trường Mê Linh", lat: 10.775301268578, lng: 106.70676112175, capacity: 165, roadType: "major" },
  { cam_id: "662b857b1afb9c00172dd106", display_name: "Điện Biên Phủ - Nguyễn Bỉnh Khiêm", lat: 10.7920852162229, lng: 106.699739098549, capacity: 180, roadType: "major" },
  { cam_id: "5d9ddd49766c880017188c94", display_name: "Nút giao Hàng Xanh 1 (Viện Máy tính)", lat: 10.8016545453012, lng: 106.71106338501, capacity: 200, roadType: "major" },
  { cam_id: "5d9ddec9766c880017188c9c", display_name: "Nút giao Hàng Xanh 5 (Hàng Xanh - Bạch Đằng)", lat: 10.8021551350728, lng: 106.711503267288, capacity: 200, roadType: "major" },
  { cam_id: "5a8256315058170011f6eac9", display_name: "Đinh Bộ Lĩnh - Nguyễn Xí", lat: 10.8133575888573, lng: 106.709566712379, capacity: 170, roadType: "arterial" },
  { cam_id: "58b5510817139d0010f35d4e", display_name: "Phạm Văn Đồng - Quốc Lộ 13 (2)", lat: 10.8254711543978, lng: 106.71435713768, capacity: 195, roadType: "arterial" },
  { cam_id: "5d8cd653766c88001718894c", display_name: "Kha Vạn Cân - Võ Văn Ngân", lat: 10.8509770648006, lng: 106.75500869751, capacity: 150, roadType: "arterial" },
  { cam_id: "5d9ddf0f766c880017188c9e", display_name: "Nút giao Hàng Xanh 6 (Cầu Điện Biên Phủ - Hàng Xanh)", lat: 10.8007429428369, lng: 106.709132194519, capacity: 200, roadType: "major" },
  { cam_id: "5d9dde1f766c880017188c98", display_name: "Nút giao Hàng Xanh 3 (Cầu Thị Nghè - Hàng Xanh)", lat: 10.8001422321862, lng: 106.711294054985, capacity: 200, roadType: "major" },
  { cam_id: "587ee0ecb807da0011e33d50", display_name: "Phan Đăng Lưu - Lê Văn Duyệt", lat: 10.8019970541825, lng: 106.696482896805, capacity: 165, roadType: "arterial" },
  { cam_id: "5a8253615058170011f6eabf", display_name: "Đinh Bộ Lĩnh - Bạch Đằng 1", lat: 10.8030720025958, lng: 106.710022687912, capacity: 170, roadType: "arterial" },
  { cam_id: "6623df636f998a001b251e92", display_name: "Hai Bà Trưng - Trần Cao Vân", lat: 10.7839015119534, lng: 106.69704079628, capacity: 160, roadType: "major" },
  { cam_id: "58e49e3dd9d6200011e0b9d1", display_name: "Nam Kỳ Khởi Nghĩa - Lý Chính Thắng", lat: 10.7886020312638, lng: 106.6847884655, capacity: 175, roadType: "major" },
  { cam_id: "5a8241105058170011f6eaa6", display_name: "Đinh Tiên Hoàng - Võ Thị Sáu 2", lat: 10.7919218604929, lng: 106.695785522461, capacity: 155, roadType: "arterial" },
  { cam_id: "662b7f9f1afb9c00172dca50", display_name: "Nguyễn Đình Chiểu - Nguyễn Bỉnh Khiêm", lat: 10.7904674636287, lng: 106.701471805573, capacity: 150, roadType: "arterial" },
  { cam_id: "587ed91db807da0011e33d4e", display_name: "Phan Đăng Lưu - Đinh Tiên Hoàng 2", lat: 10.8024818353159, lng: 106.697963476181, capacity: 165, roadType: "arterial" },
];