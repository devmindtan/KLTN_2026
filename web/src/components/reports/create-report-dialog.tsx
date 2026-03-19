/**
 * CreateReportDialog — Minimal & Clean redesign
 * Logic 100% giữ nguyên từ bản gốc, chỉ thay toàn bộ phần UI.
 */
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconCalendar,
  IconChartBar,
  IconChartLine,
  IconCalendarEvent,
  IconClock,
  IconRotate,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import type { CreateReportRequest, ReportSettings } from "@/services/reports.service";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportTypeOption = "daily" | "weekly" | "monthly" | "custom";

interface WeekOption  { label: string; from: string; to: string }
interface MonthOption { label: string; from: string; to: string }
interface DayOption   { label: string; value: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: CreateReportRequest) => void;
  loading?: boolean;
}

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────

function getAvailableWeeks(): WeekOption[] {
  const weeks: WeekOption[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - dow);
  for (let i = 0; i < 12; i++) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - i * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    weeks.push({
      label: `Tuần ${format(monday, "dd/MM")} – ${format(sunday, "dd/MM/yyyy")}`,
      from:  format(monday, "yyyy-MM-dd"),
      to:    format(sunday, "yyyy-MM-dd"),
    });
  }
  return weeks;
}

function getDaysInWeek(week: WeekOption): DayOption[] {
  const DAY_NAMES = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7","CN"];
  const days: DayOption[] = [];
  const start = new Date(week.from + "T00:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d <= yesterday)
      days.push({ label: `${DAY_NAMES[i]}, ${format(d, "dd/MM/yyyy")}`, value: format(d, "yyyy-MM-dd") });
  }
  return days;
}

function getAvailableMonths(): MonthOption[] {
  const months: MonthOption[] = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      label: `Tháng ${format(d, "MM/yyyy")}`,
      from:  format(d, "yyyy-MM-dd"),
      to:    format(new Date(d.getFullYear(), d.getMonth() + 1, 0), "yyyy-MM-dd"),
    });
  }
  return months;
}

const hourLabel = (h: number) => `${h.toString().padStart(2, "0")}:00`;

// ─── Report type options ───────────────────────────────────────────────────────

const REPORT_TYPES: {
  id: ReportTypeOption;
  label: string;
  desc: string;
  Icon: React.ElementType;
}[] = [
  { id: "daily",   label: "Ngày",      desc: "1 ngày cụ thể",  Icon: IconCalendar      },
  { id: "weekly",  label: "Tuần",      desc: "1 tuần",          Icon: IconChartBar      },
  { id: "monthly", label: "Tháng",     desc: "1 tháng",         Icon: IconChartLine     },
  { id: "custom",  label: "Tuỳ chọn", desc: "Khoảng ngày tự do", Icon: IconCalendarEvent },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Label muted uppercase dùng đầu mỗi section */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CreateReportDialog({ open, onClose, onSubmit, loading = false }: Props) {
  const weeks  = useMemo(() => getAvailableWeeks(),  []);
  const months = useMemo(() => getAvailableMonths(), []);

  const [reportType,    setReportType]    = useState<ReportTypeOption>("daily");
  const [selectedWeek,  setSelectedWeek]  = useState<WeekOption>(weeks[0]);
  const [selectedDay,   setSelectedDay]   = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<MonthOption>(months[0]);
  const [customFrom,    setCustomFrom]    = useState<string>("");
  const [customTo,      setCustomTo]      = useState<string>("");
  const [allHours,      setAllHours]      = useState<boolean>(true);
  const [hourFrom,      setHourFrom]      = useState<number>(6);
  const [hourTo,        setHourTo]        = useState<number>(22);
  const [title,         setTitle]         = useState<string>("");
  const [titleEdited,   setTitleEdited]   = useState<boolean>(false);

  const daysInWeek = useMemo(() => getDaysInWeek(selectedWeek), [selectedWeek]);

  useEffect(() => { setSelectedDay(""); }, [selectedWeek]);

  useEffect(() => {
    if (!allHours && hourTo <= hourFrom) setHourTo(hourFrom + 1);
  }, [hourFrom, allHours, hourTo]);

  // Auto-generate title
  useEffect(() => {
    if (titleEdited) return;
    let t = "";
    switch (reportType) {
      case "daily":
        if (selectedDay) {
          const d = new Date(selectedDay + "T00:00:00");
          t = `Báo cáo lưu lượng ngày ${format(d, "dd/MM/yyyy")}`;
        }
        break;
      case "weekly":
        t = `Báo cáo tuần ${format(new Date(selectedWeek.from + "T00:00:00"), "dd/MM")}–${format(new Date(selectedWeek.to + "T00:00:00"), "dd/MM/yyyy")}`;
        break;
      case "monthly":
        t = `Báo cáo tháng ${format(new Date(selectedMonth.from + "T00:00:00"), "MM/yyyy")}`;
        break;
      case "custom":
        if (customFrom && customTo)
          t = `Báo cáo tuỳ chọn ${format(new Date(customFrom + "T00:00:00"), "dd/MM")}–${format(new Date(customTo + "T00:00:00"), "dd/MM/yyyy")}`;
        break;
    }
    setTitle(t);
  }, [reportType, selectedDay, selectedWeek, selectedMonth, customFrom, customTo, titleEdited]);

  const [periodFrom, periodTo] = useMemo((): [string, string] => {
    switch (reportType) {
      case "daily":   return [selectedDay, selectedDay];
      case "weekly":  return [selectedWeek.from,  selectedWeek.to];
      case "monthly": return [selectedMonth.from, selectedMonth.to];
      case "custom":  return [customFrom, customTo];
    }
  }, [reportType, selectedDay, selectedWeek, selectedMonth, customFrom, customTo]);

  const isValid = useMemo(() => {
    if (!title.trim() || !periodFrom || !periodTo) return false;
    if (reportType === "daily" && !selectedDay) return false;
    if (!allHours && hourTo <= hourFrom) return false;
    return true;
  }, [title, periodFrom, periodTo, reportType, selectedDay, allHours, hourFrom, hourTo]);

  const handleSubmit = () => {
    if (!isValid || loading) return;
    onSubmit({
      title: title.trim(),
      type: reportType,
      period_from: periodFrom,
      period_to: periodTo,
      settings: {
        includeCharts: true,
        includeRawData: true,
        hour_from: allHours ? null : hourFrom,
        hour_to:   allHours ? null : hourTo,
      } as ReportSettings,
    });
  };

  // Period preview label
  const periodLabel = useMemo(() => {
    if (!periodFrom) return null;
    if (periodFrom === periodTo) {
      return format(new Date(periodFrom + "T00:00:00"), "dd/MM/yyyy", { locale: vi });
    }
    if (periodTo) {
      const from = format(new Date(periodFrom + "T00:00:00"), "dd/MM", { locale: vi });
      const to   = format(new Date(periodTo   + "T00:00:00"), "dd/MM/yyyy", { locale: vi });
      return `${from} – ${to}`;
    }
    return null;
  }, [periodFrom, periodTo]);

  const hourDiff = !allHours ? hourTo - hourFrom : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[500px]">

        {/* Header */}
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-[15px] font-medium">Tạo báo cáo mới</DialogTitle>
          <DialogDescription className="text-[12px]">
            Chọn loại báo cáo, khoảng thời gian và khung giờ phân tích
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">

          {/* ── 1. Loại báo cáo ── */}
          <section>
            <FieldLabel>Loại báo cáo</FieldLabel>
            <div className="grid grid-cols-4 gap-2">
              {REPORT_TYPES.map(({ id, label, desc, Icon }) => {
                const active = reportType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setReportType(id); setTitleEdited(false); }}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-all duration-100",
                      active
                        ? "border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/40"
                        : "border-border bg-background hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        active
                          ? "bg-teal-200/70 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={cn("text-[12px] font-medium leading-tight", active ? "text-teal-800 dark:text-teal-300" : "text-foreground")}>
                        {label}
                      </p>
                      <p className={cn("mt-0.5 text-[10px] leading-tight", active ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground")}>
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 2. Khoảng thời gian ── */}
          <section>
            <FieldLabel>Khoảng thời gian</FieldLabel>

            {reportType === "daily" && (
              <div className="space-y-2">
                <Select
                  value={selectedWeek.from}
                  onValueChange={(v) => { const w = weeks.find((w) => w.from === v); if (w) setSelectedWeek(w); }}
                >
                  <SelectTrigger className="h-9 text-[13px]">
                    <SelectValue placeholder="Chọn tuần" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map((w) => <SelectItem key={w.from} value={w.from}>{w.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {daysInWeek.length > 0 ? (
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue placeholder="Chọn ngày trong tuần" />
                    </SelectTrigger>
                    <SelectContent>
                      {daysInWeek.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[12px] italic text-muted-foreground">Tuần này chưa có dữ liệu</p>
                )}
              </div>
            )}

            {reportType === "weekly" && (
              <Select
                value={selectedWeek.from}
                onValueChange={(v) => { const w = weeks.find((w) => w.from === v); if (w) setSelectedWeek(w); }}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Chọn tuần" />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((w) => <SelectItem key={w.from} value={w.from}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {reportType === "monthly" && (
              <Select
                value={selectedMonth.from}
                onValueChange={(v) => { const m = months.find((m) => m.from === v); if (m) setSelectedMonth(m); }}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Chọn tháng" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => <SelectItem key={m.from} value={m.from}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {reportType === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Từ ngày</Label>
                  <Input type="date" value={customFrom} max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)} className="h-9 text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Đến ngày</Label>
                  <Input type="date" value={customTo} min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)} className="h-9 text-[13px]" />
                </div>
              </div>
            )}

            {/* Period preview chip */}
            {periodLabel && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                <IconCalendar className="h-3 w-3" />
                {periodLabel}
              </div>
            )}
          </section>

          {/* ── 3. Khung giờ ── */}
          <section>
            <FieldLabel>Khung giờ phân tích</FieldLabel>

            {/* Toggle all hours */}
            <button
              type="button"
              onClick={() => setAllHours(!allHours)}
              className="mb-2.5 flex items-center gap-2"
            >
              <div
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                  allHours
                    ? "border-teal-600 bg-teal-600"
                    : "border-border bg-background"
                )}
              >
                {allHours && (
                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-[13px] text-foreground">Tất cả khung giờ</span>
            </button>

            {/* Custom time range */}
            {!allHours && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                <Select value={String(hourFrom)} onValueChange={(v) => setHourFrom(Number(v))}>
                  <SelectTrigger className="h-8 w-[86px] text-[13px] font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                      <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-[12px] text-muted-foreground">đến</span>

                <Select value={String(hourTo)} onValueChange={(v) => setHourTo(Number(v))}>
                  <SelectTrigger className="h-8 w-[86px] text-[13px] font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 18 }, (_, i) => i + 7)
                      .filter((h) => h > hourFrom)
                      .map((h) => (
                        <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {hourDiff !== null && hourDiff > 0 && (
                  <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                    <IconClock className="h-3 w-3" />
                    <span>{hourDiff} giờ</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── 4. Tiêu đề ── */}
          <section>
            <FieldLabel>Tiêu đề báo cáo</FieldLabel>
            <Input
              id="reportTitle"
              value={title}
              placeholder="Tự động tạo khi chọn khoảng thời gian…"
              onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }}
              className="h-9 text-[13px]"
            />
            {titleEdited && (
              <button
                type="button"
                onClick={() => setTitleEdited(false)}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
              >
                <IconRotate className="h-3 w-3" />
                Đặt lại tiêu đề tự động
              </button>
            )}
          </section>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t px-5 py-3.5">
          <Button variant="outline" onClick={onClose} disabled={loading} className="h-9 text-[13px]">
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading} className="h-9 text-[13px]">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round"/>
                </svg>
                Đang tạo…
              </span>
            ) : "Tạo báo cáo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}