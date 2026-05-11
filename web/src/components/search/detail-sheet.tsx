/**
 * Sheet xem nhanh chi tiết camera hoặc mô hình từ kết quả tìm kiếm
 */
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getTypeMeta, type SearchResult } from "@/components/search/search-types";
import { StatusIcon } from "@/components/search/result-item";

/** Sheet xem nhanh chi tiết camera hoặc mô hình */
export function DetailSheet({ result, onClose }: { result: SearchResult | null; onClose: () => void }) {
  const navigate = useNavigate();
  if (!result) return null;

  const { icon: Icon, color, bg } = getTypeMeta(result.type);
  const d = result.details ?? {};

  const sheetTitle = result.type === "model"
    ? String(d.display_name || d.model_type || result.title)
    : result.title;
  const sheetDesc = result.type === "model" ? result.meta : result.subtitle;

  const mainPath = result.type === "camera" ? "../monitoring" : "../models";

  const rows: { label: string; value: string | number | boolean | undefined }[] =
    result.type === "camera"
      ? [
          { label: "Tên đường",  value: String(d.display_name ?? "") },
          { label: "Tọa độ",    value: String(d.location ?? "") },
          { label: "ID Camera",  value: String(d.cam_id ?? "") },
          { label: "Trạng thái", value: result.badge ?? "" },
          { label: "Lưu lượng", value: d.totalObjects != null ? `${d.totalObjects} xe` : "—" },
          { label: "Mức LOS",   value: String(d.losStatus ?? "—") },
          { label: "Cập nhật",  value: d.lastUpdated ? new Date(String(d.lastUpdated)).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—" },
        ]
      : [
          { label: "Phiên bản",      value: String(d.model_version ?? "") },
          { label: "Tên hiển thị",   value: String(d.display_name  ?? "") || "—" },
          { label: "Loại mô hình",   value: String(d.model_type    ?? "") },
          { label: "Trạng thái",     value: result.badge ?? "" },
          { label: "R² (Accuracy)",  value: d.r2  != null ? String(d.r2)  : "—" },
          { label: "MAE",            value: d.mae != null ? String(d.mae) : "—" },
          { label: "Mẫu huấn luyện", value: d.training_samples != null ? `${Number(d.training_samples).toLocaleString("vi-VN")} mẫu` : "—" },
          { label: "Ngày tạo",       value: String(d.created_at ?? "") },
        ];

  return (
    <Sheet open={!!result} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-sm scrollbar overflow-y-auto flex flex-col">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className={`p-2 ${bg} rounded-lg shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base leading-tight break-words">{sheetTitle}</SheetTitle>
              <SheetDescription className="text-xs mt-0.5 break-words">{sheetDesc}</SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {result.badge && (
              <Badge variant={result.badgeVariant ?? "secondary"} className="text-xs">
                {result.badge}
              </Badge>
            )}
            {result.status && <StatusIcon status={result.status} />}
          </div>
        </SheetHeader>

        <Separator className="mb-4" />

        <div className="space-y-3 flex-1">
          {rows.map(row => (
            <div key={row.label} className="flex justify-between items-start gap-3">
              <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{row.label}</span>
              <span className="text-xs font-medium text-right break-all">
                {row.value != null && row.value !== "" ? String(row.value) : "—"}
              </span>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <Button
          className="w-full"
          onClick={() => {
            onClose();
            const navState = result.type === "camera"
              ? { openCamId: result.id }
              : { openModelVersion: String(result.details?.model_version ?? "") };
            navigate(mainPath, { relative: "path", state: navState });
          }}
        >
          Xem chi tiết đầy đủ
        </Button>
      </SheetContent>
    </Sheet>
  );
}
