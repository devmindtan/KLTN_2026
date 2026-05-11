import * as React from "react"
import { IconInfoCircle } from "@tabler/icons-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface InfoTooltipProps {
  /** Nội dung tooltip — string hoặc ReactNode */
  content: React.ReactNode
  /** Custom trigger element — mặc định: icon ? nhỏ */
  trigger?: React.ReactNode
  /** Vị trí tooltip — mặc định "top" */
  side?: "top" | "right" | "bottom" | "left"
  /** Class bổ sung cho content box */
  className?: string
  /** Delay trước khi hiện tooltip (ms) — mặc định 200 */
  delayDuration?: number
}

/**
 * Tooltip thông tin tổng quát — dùng khi cần giải thích ngắn gọn cho label/tiêu đề.
 * Mặc định trigger là icon ? nhỏ, có thể override bằng prop trigger.
 * Dùng chung cho mọi nơi cần tooltip giải thích trong hệ thống.
 */
export function InfoTooltip({
  content,
  trigger,
  side = "top",
  className,
  delayDuration = 200,
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {trigger ?? (
            <span className="inline-flex items-center cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors">
              <IconInfoCircle className="h-3.5 w-3.5" />
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side={side} className={cn("max-w-xs", className)}>
          <p className="text-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface TermTooltipProps {
  /** Thuật ngữ hiển thị inline – có gạch chân nét đứt */
  term: string
  /** Mô tả giải thích thuật ngữ */
  description: string
  /** Vị trí tooltip — mặc định "top" */
  side?: "top" | "right" | "bottom" | "left"
}

/**
 * Tooltip cho thuật ngữ chuyên ngành — hiển thị text có gạch chân + icon ?, khi hover hiện mô tả.
 * Dùng thay thế cho TermTooltip nội bộ trong analytics.tsx.
 */
export function TermTooltip({ term, description, side = "top" }: TermTooltipProps) {
  return (
    <InfoTooltip
      content={description}
      side={side}
      trigger={
        <span className="inline-flex items-center gap-1 cursor-help text-primary ">
          {term}
          <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
        </span>
      }
    />
  )
}
