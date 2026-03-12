/**
 * Component hiển thị một dòng kết quả tìm kiếm và icon trạng thái
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/custom/highlight-text";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconMoonStars,
} from "@tabler/icons-react";
import { getTypeMeta, type SearchResult } from "@/components/search/search-types";

/** Icon trạng thái kết nối của camera */
export function StatusIcon({ status }: { status?: string }) {
  if (status === "online")  return <IconCircleCheck  className="w-3 h-3 text-green-500 shrink-0" />;
  if (status === "warning") return <IconAlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />;
  if (status === "offline") return <IconMoonStars     className="w-3 h-3 text-muted-foreground shrink-0" />;
  return null;
}

/** Một dòng kết quả tìm kiếm */
export function ResultItem({ result, query, onView }: {
  result: SearchResult;
  query: string;
  onView?: () => void;
}) {
  const { icon: Icon, color, bg } = getTypeMeta(result.type);
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors group"
      onClick={onView}
    >
      <div className={`p-2 ${bg} rounded-lg shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            <HighlightText text={result.title} query={query} />
          </span>
          {result.badge && (
            <Badge variant={result.badgeVariant ?? "secondary"} className="text-[10px] px-1.5 py-0 h-4 shrink-0">
              {result.badge}
            </Badge>
          )}
          {result.status && <StatusIcon status={result.status} />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          <HighlightText text={result.subtitle} query={query} />
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{result.meta}</p>
      </div>
      {onView && (
        <Button
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs shrink-0"
          onClick={e => { e.stopPropagation(); onView(); }}
        >
          Xem
        </Button>
      )}
    </div>
  );
}
