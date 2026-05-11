/**
 * Playground: Trang Phân tích mô hình dự báo – metrics, feature importance, prediction vs actual
 */
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TrendingUpIcon, BrainCircuitIcon, BarChartIcon, RefreshCwIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { StatCard } from "@/components/custom/stat-card"

const METRICS = [
  { title: "Độ chính xác (Acc.)",  value: "87.4%",  sub1: "+1.2% so với phiên trước" },
  { title: "MAE",                   value: "3.91",   sub1: "xe/phút — thấp hơn là tốt" },
  { title: "MAPE",                  value: "8.2%",   sub1: "Sai số %; tốt < 10%"       },
  { title: "R² Score",              value: "0.921",  sub1: "Khớp mô hình; tốt > 0.90"  },
]

const FEATURES = [
  { name: "Giờ trong ngày (hour)",       importance: 94, category: "time"    },
  { name: "Ngày trong tuần (weekday)",   importance: 81, category: "time"    },
  { name: "Xe trung bình 3 khung trước", importance: 75, category: "lag"     },
  { name: "Xe khung t-1",                importance: 68, category: "lag"     },
  { name: "Xe khung t-2",                importance: 55, category: "lag"     },
  { name: "Tỷ lệ V/C khung trước",       importance: 47, category: "traffic" },
  { name: "Ngày lễ / sự kiện",           importance: 33, category: "context" },
  { name: "Nhiệt độ (°C)",               importance: 18, category: "weather" },
] as const

type Feature = typeof FEATURES[number]

const CAT_COLOR: Record<Feature["category"], string> = {
  time:    "bg-blue-500",
  lag:     "bg-purple-500",
  traffic: "bg-orange-500",
  context: "bg-cyan-500",
  weather: "bg-slate-400",
}

const CAT_LABEL: Record<Feature["category"], string> = {
  time:    "Thời gian",
  lag:     "Trễ (Lag)",
  traffic: "Lưu lượng",
  context: "Ngữ cảnh",
  weather: "Thời tiết",
}

const CAMERA_METRICS = [
  { id: "CAM-01", name: "Ngã tư Bình Dương",  accuracy: 89, mae: 3.4, r2: 0.934 },
  { id: "CAM-02", name: "Cầu vượt An Phú",    accuracy: 91, mae: 2.9, r2: 0.948 },
  { id: "CAM-03", name: "Vòng xoay Mỹ Phước", accuracy: 83, mae: 4.8, r2: 0.891 },
  { id: "CAM-04", name: "Đường DT741",         accuracy: 94, mae: 2.1, r2: 0.961 },
  { id: "CAM-05", name: "Cổng KCN VSIP",       accuracy: 80, mae: 5.6, r2: 0.872 },
]

const PREDICTIONS = [
  { time: "07:00",  cam: "CAM-01", actual: 142, forecast: 138, error: 4,   pct: 2.8  },
  { time: "07:15",  cam: "CAM-01", actual: 158, forecast: 165, error: -7,  pct: 4.4  },
  { time: "07:30",  cam: "CAM-01", actual: 181, forecast: 175, error: 6,   pct: 3.3  },
  { time: "07:45",  cam: "CAM-03", actual: 203, forecast: 189, error: 14,  pct: 6.9  },
  { time: "08:00",  cam: "CAM-03", actual: 221, forecast: 208, error: 13,  pct: 5.9  },
  { time: "08:15",  cam: "CAM-05", actual: 187, forecast: 212, error: -25, pct: 13.4 },
]

/** Playground: Model analytics page */
export function PgAnalytics() {
  const [selectedCam, setSelectedCam] = useState("CAM-01")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuitIcon className="size-4 text-primary" />
          <span className="text-sm font-semibold">Random Forest – Phiên huấn luyện 2025-W12</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
            Active
          </Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
          <RefreshCwIcon className="size-3" />
          Làm mới
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="h-8">
          <TabsTrigger value="overview"  className="text-xs px-3">Tổng quan</TabsTrigger>
          <TabsTrigger value="camera"   className="text-xs px-3">Theo camera</TabsTrigger>
          <TabsTrigger value="history"  className="text-xs px-3">Lịch sử dự báo</TabsTrigger>
        </TabsList>

        {/* ── TỔNG QUAN ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {METRICS.map(m => (
              <StatCard
                key={m.title}
                title={m.title}
                value={m.value}
                sub1={<p className="text-[11px] text-muted-foreground mt-1">{m.sub1}</p>}
              />
            ))}
          </div>

          {/* Feature importance */}
          <Card>
            <CardContent className="pt-0">
              <CardSectionHeader
                icon={BarChartIcon}
                title="Tầm quan trọng của đặc trưng"
                description="Feature importance (Random Forest)"
              />
              <div className="space-y-2.5 mt-3">
                {FEATURES.map(f => (
                  <div key={f.name} className="flex items-center gap-3">
                    <div className="w-[200px] min-w-[140px] text-[12px] text-muted-foreground truncate">{f.name}</div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", CAT_COLOR[f.category])}
                          style={{ width: `${f.importance}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-mono tabular-nums w-8 text-right text-muted-foreground">{f.importance}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {CAT_LABEL[f.category]}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── THEO CAMERA ── */}
        <TabsContent value="camera" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-0">
              <CardSectionHeader
                icon={TrendingUpIcon}
                title="Hiệu suất mô hình theo camera"
                description="Accuracy / MAE / R²"
              />
              <Table className="text-xs mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Camera</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead>Accuracy bar</TableHead>
                    <TableHead className="text-right">MAE</TableHead>
                    <TableHead className="text-right">R²</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CAMERA_METRICS.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium">{c.id}</p>
                        <p className="text-[11px] text-muted-foreground">{c.name}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <span className={c.accuracy >= 90 ? "text-green-600 dark:text-green-400" : c.accuracy >= 85 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>
                          {c.accuracy}%
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <Progress
                          value={c.accuracy}
                          className={cn("h-1.5",
                            c.accuracy >= 90 ? "[&>div]:bg-green-500" : c.accuracy >= 85 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{c.mae}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{c.r2}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── LỊCH SỬ DỰ BÁO ── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedCam} onValueChange={setSelectedCam}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMERA_METRICS.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.id} – {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Hiển thị 15 phút gần nhất</span>
          </div>
          <Card>
            <CardContent className="pt-0">
              <Table className="text-xs mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead className="text-right">Thực tế</TableHead>
                    <TableHead className="text-right">Dự báo</TableHead>
                    <TableHead className="text-right">Sai lệch</TableHead>
                    <TableHead className="text-right">MAPE %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PREDICTIONS.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono tabular-nums text-muted-foreground">{p.time}</TableCell>
                      <TableCell>{p.cam}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{p.actual}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.forecast}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium",
                        p.error > 0 ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
                      )}>
                        {p.error > 0 ? `+${p.error}` : p.error}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0",
                          p.pct > 10 ? "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
                          : p.pct > 5  ? "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400"
                          :              "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
                        )}>
                          {p.pct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
