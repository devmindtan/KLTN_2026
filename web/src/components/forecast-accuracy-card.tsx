"use client"

import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { IconExternalLink, IconShieldCheck } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getLatestModelMetrics,
  type HorizonMetric,
} from "@/services/model-metrics.service"

/**
 * Trả về Badge màu dựa trên accuracy ≤5 xe
 */
function AccuracyBadge({ value }: { value: number }) {
  if (value >= 80) {
    return (
      <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 font-semibold pointer-events-none">
        {value}%
      </Badge>
    )
  }
  if (value >= 60) {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 font-semibold pointer-events-none">
        {value}%
      </Badge>
    )
  }
  return (
    <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-semibold pointer-events-none">
      {value}%
    </Badge>
  )
}

/**
 * Card hiển thị độ tin cậy (Accuracy ≤5 xe) của từng mốc dự đoán — dashboard sidebar
 * Wrap với React.memo vì không nhận props từ ngoài — chặn re-render khi WS update
 */
export const ForecastAccuracyCard = React.memo(function ForecastAccuracyCard() {
  const [horizons, setHorizons] = React.useState<HorizonMetric[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const { prefix } = useParams<{ prefix: string }>()

  React.useEffect(() => {
    /** Tải dữ liệu metrics mới nhất để hiển thị độ tin cậy từng mốc */
    let cancelled = false
    async function load() {
      try {
        const data = await getLatestModelMetrics()
        if (!cancelled && data?.by_horizon) {
          setHorizons(data.by_horizon)
        }
      } catch {
        // Fail silently — card chỉ là thông tin bổ trợ
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <IconShieldCheck className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Độ tin cậy dự đoán</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Tỷ lệ dự đoán sai số ≤5 xe theo mốc
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pb-2">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                <div className="h-5 w-14 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : horizons.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Chưa có dữ liệu
          </p>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center pb-1.5 mb-1 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground">Mốc</span>
              <span className="text-xs font-medium text-muted-foreground">Accuracy ≤5 xe</span>
            </div>
            {/* Rows */}
            {horizons.map((row) => (
              <div
                key={row.horizon_minutes}
                className="flex justify-between items-center py-2 border-b border-border/40 last:border-0"
              >
                <span className="text-sm font-medium">{row.horizon_minutes} phút</span>
                <AccuracyBadge value={row.accuracy_5xe} />
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link to={`/${prefix}/analytics#horizon-comparison`}>
            Xem chi tiết phân tích
            <IconExternalLink className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
})
