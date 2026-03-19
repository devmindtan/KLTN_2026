/**
 * HistoryTable – Bảng audit log thao tác báo cáo (tab Lịch sử)
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconDownload,
  IconPlus,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "./reports-types";
import { MOCK_HISTORY } from "./reports-types";

const PAGE_SIZE = 10;

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  "Tạo báo cáo": { label: "Tạo mới",  icon: <IconPlus     className="size-3.5 text-blue-500" />,  badge: "text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30" },
  "Download": { label: "Tải về",   icon: <IconDownload  className="size-3.5 text-green-500" />, badge: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30" },
  "Xóa báo cáo":   { label: "Xóa",      icon: <IconTrash     className="size-3.5 text-red-500" />,   badge: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30" },
};

function fmtDateTime(iso: string) {
  try { return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

interface Props {
  entries?: HistoryEntry[];
}

/** Bảng lịch sử thao tác báo cáo với pagination */
export function HistoryTable({ entries = MOCK_HISTORY }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paged = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto scrollbar rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {["Thao tác", "Báo cáo", "Thời gian", "Người dùng"].map(h => (
                <th key={h} className="text-left font-medium text-muted-foreground py-3 px-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Chưa có lịch sử thao tác</td></tr>
            ) : (
              paged.map(entry => {
                const cfg = ACTION_CONFIG[entry.action] || { label: "Khác", icon: <IconPlus className="size-3.5" />, badge: "text-gray-700 border-gray-200 bg-gray-50" };
                return (
                  <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={cn("flex items-center gap-1.5 w-fit text-xs px-2 py-0.5", cfg.badge)}>
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="max-w-[280px] truncate block">{entry.target}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-xs">
                      {fmtDateTime(entry.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium">{entry.user}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{entries.length} bản ghi · Trang {page}/{totalPages}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <IconChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
