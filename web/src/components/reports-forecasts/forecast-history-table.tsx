/**
 * ForecastHistoryTable – Zone 4: Bảng so sánh dự báo vs thực tế đã qua
 * Hiển thị errorPct badge xanh/vàng/đỏ, confidence progress
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconHistory, IconClock } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ForecastSlot } from "./reports-types";
import { LOS_LABEL, MOCK_FORECAST_SLOTS } from "./reports-types";
import { ForecastAccuracyBadges } from "./forecast-summary-bar";
import { MOCK_FORECAST_SUMMARY } from "./reports-types";

/** Màu badge sai số */
function ErrorBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = pct <= 5  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400" :
              pct <= 15 ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400" :
                          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400";
  return <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 tabular-nums", cls)}>{pct.toFixed(1)}%</Badge>;
}

/** Badge trạng thái dự báo */
function StatusBadge({ slot }: { slot: ForecastSlot }) {
  if (slot.actualVehicles === null) {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">⏳ Chờ</Badge>;
  }
  if (slot.errorPct == null) {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">—</Badge>;
  }
  if (slot.errorPct <= 5)  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50">✅ Chính xác</Badge>;
  if (slot.errorPct <= 15) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50">⚠️ Lệch</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50">❌ Sai nhiều</Badge>;
}

function fmtSlotTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}

const ALL_CAMERAS = [
  { id: "all",    name: "Tất cả camera" },
  { id: "cam-01", name: "Cầu Sài Gòn" },
  { id: "cam-02", name: "Ngã tư Đinh Tiên Hoàng" },
];

interface Props {
  slots?: ForecastSlot[];
}

/** Bảng lịch sử dự báo vs thực tế */
export function ForecastHistoryTable({ slots = MOCK_FORECAST_SLOTS }: Props) {
  const [camFilter, setCamFilter] = useState("all");

  const filtered = slots
    .filter(s => camFilter === "all" || s.camId === camFilter)
    .sort((a, b) => new Date(b.timeSlot).getTime() - new Date(a.timeSlot).getTime());

  const coveredSlots = filtered.filter(s => s.actualVehicles !== null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconHistory className="size-4 text-primary" />
            Lịch sử dự báo vs Thực tế
          </CardTitle>
          <Select value={camFilter} onValueChange={setCamFilter}>
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_CAMERAS.map(c => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="overflow-x-auto scrollbar">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                {["Khung giờ", "Camera", "Dự báo", "Thực tế", "LOS TT", "Sai số", "Tin cậy", "Trạng thái"].map(h => (
                  <th key={h} className="text-left font-medium text-muted-foreground py-2 px-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Không có dữ liệu</td></tr>
              ) : (
                filtered.map(slot => (
                  <tr key={slot.id} className="hover:bg-accent/30 transition-colors">
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <IconClock className="size-3 shrink-0" />
                        {fmtSlotTime(slot.timeSlot)}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap font-medium">{slot.camName}</td>
                    <td className="py-2.5 px-2 tabular-nums">{slot.predictedVehicles} xe</td>
                    <td className="py-2.5 px-2 tabular-nums">
                      {slot.actualVehicles != null ? `${slot.actualVehicles} xe` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap text-muted-foreground">
                      {slot.actualLos ? LOS_LABEL[slot.actualLos] ?? slot.actualLos : "—"}
                    </td>
                    <td className="py-2.5 px-2">
                      <ErrorBadge pct={slot.errorPct} />
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress value={slot.confidence} className="h-1.5 flex-1" />
                        <span className="tabular-nums text-[10px] text-muted-foreground shrink-0">{slot.confidence}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge slot={slot} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Stats footer */}
        {coveredSlots.length > 0 && (
          <div className="pt-3 mt-2 border-t">
            <ForecastAccuracyBadges summary={MOCK_FORECAST_SUMMARY} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
