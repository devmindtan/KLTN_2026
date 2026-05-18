import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { GTI_COLORS, GTI_LABELS, GTI_RANGES } from "./constants";

/** Thẻ quy tắc GTI có thể thu gọn/mở rộng */
export function RulesCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card overflow-hidden shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
      >
        {open ? <IconChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <IconChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="flex-1 text-left">Bảng GTI</span>
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {GTI_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: GTI_COLORS[i] }}
              />
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0 shrink-0", [
                  "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
                  "text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
                  "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
                  "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
                ][i])}
              >
                {GTI_RANGES[i]}
              </Badge>
              <span className="text-xs text-muted-foreground leading-snug">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
