/**
 * ForecastHistoryTable – Bảng so sánh dự báo vs thực tế đã qua
 * Hiển thị errorPct badge xanh/vàng/đỏ, confidence progress, phân trang
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconHistory, IconClock, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ForecastSlot, ForecastSummary } from "./forecast-types";
import { LOS_LABEL, MOCK_FORECAST_SLOTS, MOCK_FORECAST_SUMMARY } from "./forecast-types";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Badge hiển thị R², MAPE, MAE tóm tắt cuối bảng */
function AccuracyBadges({ summary }: { summary: ForecastSummary }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {[
        { label: "MAE",           value: `${summary.mae} xe` },
        { label: "MAPE",          value: `${summary.mape}%` },
        { label: "R²",            value: summary.r2 != null ? String(summary.r2) : "—" },
        { label: "Khung dữ liệu", value: `${summary.coveredSlots}/${summary.totalSlots}` },
      ].map(b => (
        <Badge key={b.label} variant="secondary" className="gap-1 font-normal">
          <span className="text-muted-foreground">{b.label}:</span>
          <span className="font-semibold">{b.value}</span>
        </Badge>
      ))}
    </div>
  );
}

/** Màu badge sai số */
function ErrorBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls =
    pct <= 5  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400" :
    pct <= 15 ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400" :
                "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400";
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 tabular-nums", cls)}>
      {pct.toFixed(1)}%
    </Badge>
  );
}

/** Badge trạng thái dự báo */
function StatusBadge({ slot }: { slot: ForecastSlot }) {
  if (slot.actualVehicles === null)
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">⏳ Chờ</Badge>;
  if (slot.errorPct == null)
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">—</Badge>;
  if (slot.errorPct <= 5)
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50">✅ Chính xác</Badge>;
  if (slot.errorPct <= 15)
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50">⚠️ Lệch</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50">❌ Sai nhiều</Badge>;
}

/** Format ISO → "HH:mm dd/mm" */
function fmtSlotTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}

interface Props {
  slots?: ForecastSlot[];
  loading?: boolean;
}

/** Bảng lịch sử dự báo vs thực tế */
export function ForecastHistoryTable({ slots = MOCK_FORECAST_SLOTS, loading = false }: Props) {
  const [camFilter, setCamFilter] = useState("all");
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(10);

  const cameraOptions = useMemo(() => {
    const seen = new Map<string, string>();
    slots.forEach(s => { if (!seen.has(s.camId)) seen.set(s.camId, s.camName); });
    return [
      { id: "all", name: "Tất cả máy quay" },
      ...Array.from(seen.entries()).map(([id, name]) => ({ id, name })),
    ];
  }, [slots]);

  const filtered = useMemo(() =>
    slots
      .filter(s => camFilter === "all" || s.camId === camFilter)
      .sort((a, b) => new Date(b.timeSlot).getTime() - new Date(a.timeSlot).getTime()),
    [slots, camFilter],
  );

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage    = Math.min(page, totalPages);
  const paginated   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const coveredSlots = filtered.filter(s => s.actualVehicles !== null);

  const handleCamFilter = (val: string) => { setCamFilter(val); setPage(1); };
  const handlePageSize  = (val: string) => { setPageSize(Number(val)); setPage(1); };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground animate-pulse">Đang tải bảng dự báo...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconHistory className="size-4 text-primary" />
            Lịch sử dự báo vs Thực tế
            <span className="text-[10px] font-normal text-muted-foreground">
              ({filtered.length} bản ghi)
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={handlePageSize}>
              <SelectTrigger className="h-7 w-[80px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={camFilter} onValueChange={handleCamFilter}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cameraOptions.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="overflow-x-auto scrollbar">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                {["Khung giờ", "Máy quay", "Dự báo", "Thực tế", "LOS TT", "Sai số", "Tin cậy", "Trạng thái"].map(h => (
                  <th key={h} className="text-left font-medium text-muted-foreground py-2 px-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">Không có dữ liệu</td>
                </tr>
              ) : (
                paginated.map(slot => (
                  <tr key={slot.id} className="hover:bg-accent/30 transition-colors">
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <IconClock className="size-3 shrink-0" />
                        {fmtSlotTime(slot.timeSlot)}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap font-medium max-w-[160px] truncate" title={slot.camName}>
                      {slot.camName}
                    </td>
                    <td className="py-2.5 px-2 tabular-nums">{slot.predictedVehicles} xe</td>
                    <td className="py-2.5 px-2 tabular-nums">
                      {slot.actualVehicles != null
                        ? `${slot.actualVehicles} xe`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap text-muted-foreground">
                      {slot.actualLos ? (LOS_LABEL[slot.actualLos] ?? slot.actualLos) : "—"}
                    </td>
                    <td className="py-2.5 px-2">
                      <ErrorBadge pct={slot.errorPct} />
                    </td>
                    <td className="py-2.5 px-2">
                      {slot.confidence !== null ? (
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <Progress value={slot.confidence} className="h-1.5 flex-1" />
                          <span className="tabular-nums text-[10px] text-muted-foreground shrink-0">
                            {slot.confidence}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span className="text-[11px] text-muted-foreground">
              Trang {safePage} / {totalPages}
              {" — "}
              hiển thị {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon"
                className="h-6 w-6"
                disabled={safePage <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <IconChevronLeft className="size-3" />
              </Button>
              <Button
                variant="outline" size="icon"
                className="h-6 w-6"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <IconChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Footer: accuracy badges */}
        {coveredSlots.length > 0 && (
          <div className="pt-3 mt-2 border-t">
            <AccuracyBadges summary={MOCK_FORECAST_SUMMARY} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
