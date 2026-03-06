import { IconCamera } from "@tabler/icons-react";
import { type CameraData } from "@/contexts/SocketContext";

interface CameraWallCellProps {
  camera: CameraData;
}

/**
 * Trả về màu dot tương ứng trạng thái LOS
 */
const getStatusDotColor = (status: string, hasImage: boolean): string => {
  if (!hasImage) return "bg-red-500";
  switch (status) {
    case "free_flow":  return "bg-green-400";
    case "smooth":     return "bg-blue-400";
    case "moderate":   return "bg-yellow-400";
    case "heavy":      return "bg-orange-400";
    case "congested":  return "bg-red-500";
    default:           return "bg-gray-400";
  }
};

/**
 * Ô camera đơn trong Camera Wall – hiển thị ảnh từ MinIO + overlay tối giản
 */
export function CameraWallCell({ camera }: CameraWallCellProps) {
  const hasImage = !!camera.imageUrl;

  return (
    <div className="relative w-full h-full bg-gray-950 overflow-hidden">
      {hasImage ? (
        <img
          src={camera.imageUrl}
          alt={camera.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (placeholder) placeholder.style.display = "flex";
          }}
        />
      ) : null}

      {/* Placeholder: hiện khi không có ảnh hoặc ảnh lỗi */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500"
        style={{ display: hasImage ? "none" : "flex" }}
      >
        <IconCamera className="w-6 h-6 opacity-40" />
        <span className="text-[10px] opacity-40">Không có tín hiệu</span>
      </div>

      {/* Overlay dưới cùng – gradient + tên camera + status dot */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1.5 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(camera.status.current, hasImage)}`}
          />
          <span className="text-white text-[11px] font-medium truncate leading-tight">
            {camera.name}
          </span>
        </div>
      </div>
    </div>
  );
}
