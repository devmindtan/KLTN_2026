import * as React from "react";
import { CameraWallCell } from "@/components/monitoring/camera-wall-cell";
import { type CameraData } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import {
  IconChevronLeft,
  IconChevronRight,
  IconMaximize,
  IconMinimize,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const WALL_PRESETS: { value: number; cols: number; label: string }[] = [
  { value: 4,  cols: 2, label: "4"  },
  { value: 6,  cols: 3, label: "6"  },
  { value: 9,  cols: 3, label: "9"  },
  { value: 16, cols: 4, label: "16" },
  { value: 20, cols: 5, label: "20" },
  { value: 25, cols: 5, label: "25" },
];

interface CameraWallViewProps {
  cameras: CameraData[];
  perPage: number;
  currentPage: number;
  onPerPageChange: (v: number) => void;
  onPageChange: (v: number) => void;
  onExit: () => void;
}

/**
 * Màn hình Camera Wall – hiển thị nhiều camera đồng thời trên một lưới
 * Tích hợp vào lifecycle.tsx, hỗ trợ phân trang và fullscreen
 */
export function CameraWallView({
  cameras,
  perPage,
  currentPage,
  onPerPageChange,
  onPageChange,
  onExit,
}: CameraWallViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showToolbar, setShowToolbar] = React.useState(true);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(cameras.length / perPage));
  const preset = WALL_PRESETS.find((p) => p.value === perPage) ?? WALL_PRESETS[2];
  const pageCameras = cameras.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Clamp currentPage nếu tổng trang giảm
  React.useEffect(() => {
    if (currentPage > totalPages) onPageChange(1);
  }, [totalPages, currentPage, onPageChange]);

  // ─── Fullscreen API ────────────────────────────────────────────────────────
  const toggleFullscreen = React.useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  React.useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ─── Toolbar auto-hide khi fullscreen ──────────────────────────────────────
  const showToolbarBriefly = React.useCallback(() => {
    setShowToolbar(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => setShowToolbar(false), 3000);
  }, []);

  React.useEffect(() => {
    if (!isFullscreen) {
      setShowToolbar(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    } else {
      showToolbarBriefly();
    }
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isFullscreen, showToolbarBriefly]);

  // ─── Auto-rotate ──────────────────────────────────────────────────────────
  const nextPage = React.useCallback(() => {
    onPageChange(currentPage >= totalPages ? 1 : currentPage + 1);
  }, [currentPage, totalPages, onPageChange]);

  const prevPage = React.useCallback(() => {
    onPageChange(currentPage <= 1 ? totalPages : currentPage - 1);
  }, [currentPage, totalPages, onPageChange]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextPage();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevPage();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          if (!document.fullscreenElement) onExit();
          break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [nextPage, prevPage, toggleFullscreen, onExit]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col flex-1 min-h-0 bg-black",
        isFullscreen && "fixed inset-0 z-[100]"
      )}
      onMouseMove={isFullscreen ? showToolbarBriefly : undefined}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-background border-b shrink-0 flex-wrap transition-opacity duration-300 min-h-[44px]",
          isFullscreen && !showToolbar && "opacity-0 pointer-events-none select-none"
        )}
      >
        {/* Preset buttons */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1 select-none">Lưới:</span>
          {WALL_PRESETS.map((p) => (
            <Button
              key={p.value}
              variant={perPage === p.value ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                onPerPageChange(p.value);
                onPageChange(1);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Pagination */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={totalPages <= 1}
            onClick={prevPage}
          >
            <IconChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs tabular-nums px-1 min-w-[72px] text-center select-none">
            Trang {currentPage}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={totalPages <= 1}
            onClick={nextPage}
          >
            <IconChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Tổng số camera */}
        <span className="text-xs text-muted-foreground select-none">
          {cameras.length} camera
        </span>

        {/* Fullscreen */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Thu nhỏ (F)" : "Toàn màn hình (F)"}
        >
          {isFullscreen ? (
            <IconMinimize className="w-4 h-4" />
          ) : (
            <IconMaximize className="w-4 h-4" />
          )}
        </Button>

        {/* Thoát wall */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onExit}
        >
          <IconX className="w-3.5 h-3.5" />
          Thoát
        </Button>
      </div>

      {/* ── Camera Grid ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          className="w-full h-full gap-px bg-gray-800"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${preset.cols}, 1fr)`,
          }}
        >
          {pageCameras.map((cam) => (
            <CameraWallCell key={cam.id} camera={cam} />
          ))}
          {/* Empty slots giữ đều lưới */}
          {Array.from({ length: Math.max(0, perPage - pageCameras.length) }).map(
            (_, i) => (
              <div key={`empty-${i}`} className="bg-gray-950" />
            )
          )}
        </div>
      </div>

    </div>
  );
}
