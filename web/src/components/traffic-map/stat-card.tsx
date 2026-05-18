import { LOS_MARKER_COLOR } from "./constants";
import { getLosLabel } from "./helpers";

interface Props {
  los: string;
  count: number;
  total: number;
}

/** Card thống kê số camera theo từng LOS với progress bar */
export function StatCard({ los, count, total }: Props) {
  const color = LOS_MARKER_COLOR[los] ?? "#94a3b8";
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const label = los === "unknown" ? "Chưa rõ" : getLosLabel(los);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      </div>
      <p className="text-2xl font-bold leading-none">{count}</p>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct}% mạng lưới</p>
    </div>
  );
}
