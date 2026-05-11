/**
 * LOSBadgeGroup — Hiển thị 5 badge LOS với màu và ngưỡng VC% để tham chiếu nhanh.
 * Dùng inline trong bài viết giải thích LOS.
 */
import { Badge } from "@/components/ui/badge";
import { LOS_LABEL } from "@/lib/app-constants";

const LOS_CONFIG = [
  {
    key: "free_flow",
    grade: "A",
    vcRange: "VC% ≤ 40%",
    cls: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  },
  {
    key: "smooth",
    grade: "B",
    vcRange: "40–60%",
    cls: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  {
    key: "moderate",
    grade: "C",
    vcRange: "60–80%",
    cls: "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400",
  },
  {
    key: "heavy",
    grade: "D",
    vcRange: "80–100%",
    cls: "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  },
  {
    key: "congested",
    grade: "E",
    vcRange: "VC% > 100%",
    cls: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  },
] as const;

export function LOSBadgeGroup() {
  return (
    <div className="flex flex-col gap-2 my-3">
      {LOS_CONFIG.map(({ key, grade, vcRange, cls }) => (
        <div key={key} className="flex items-center gap-3">
          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 font-medium min-w-[120px] justify-center ${cls}`}>
            {grade} — {LOS_LABEL[key]}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{vcRange}</span>
        </div>
      ))}
    </div>
  );
}
