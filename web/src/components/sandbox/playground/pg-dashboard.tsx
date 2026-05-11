/**
 * Playground: Trang Tổng quan – mô phỏng Dashboard với StatCards + bảng dữ liệu + chart area
 */
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ActivityIcon, CameraIcon, ShieldIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon, RefreshCwIcon } from "lucide-react"
import { StatCard } from "@/components/custom/stat-card"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { cn } from "@/lib/utils"

const MOCK_CAMERAS = [
  { id: "CAM-01", name: "Ngã tư Bình Dương", total: 142, car: 89, moto: 53, los: "B", trend: "up",   vc: 71 },
  { id: "CAM-02", name: "Cầu vượt An Phú",   total: 98,  car: 61, moto: 37, los: "A", trend: "down", vc: 49 },
  { id: "CAM-03", name: "Vòng xoay Mỹ Phước",total: 187, car: 112,moto: 75, los: "D", trend: "up",   vc: 87 },
  { id: "CAM-04", name: "Đường DT741",        total: 74,  car: 48, moto: 26, los: "A", trend: "stable",vc: 37},
  { id: "CAM-05", name: "Cổng KCN VSIP",      total: 221, car: 143,moto: 78, los: "E", trend: "up",   vc: 94 },
]

const LOS_BADGE: Record<string, string> = {
  A: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  B: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
  C: "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400",
  D: "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  E: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  F: "text-red-900 border-red-300 bg-red-100 dark:bg-red-950/40 dark:text-red-300",
}

const LOS_LABEL: Record<string, string> = {
  A: "Thông thoáng", B: "Trơn tru", C: "Trung bình",
  D: "Nặng", E: "Ùn tắc", F: "Kẹt cứng",
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")     return <TrendingUpIcon   className="size-3.5 text-orange-500" />
  if (trend === "down")   return <TrendingDownIcon className="size-3.5 text-green-500" />
  return <MinusIcon className="size-3.5 text-blue-500" />
}

/** Playground: Dashboard overview */
export function PgDashboard() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tổng quan hệ thống</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Cập nhật lần cuối: 08:42 — 12/03/2026</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <RefreshCwIcon className="size-3.5" />Làm mới
        </Button>
      </div>

      {/* StatCards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tổng Phương Tiện"
          tooltip="Tổng số phương tiện phát hiện realtime."
          headerRight={<><span className="size-1.5 rounded-full bg-green-500 animate-pulse" /><ActivityIcon className="size-4 text-blue-500" /></>}
          value="722"
          sub1={
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">453 ô tô</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-700 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400">269 xe máy</Badge>
            </div>
          }
          sub2={<p className="text-[11px] text-muted-foreground mt-1.5">5 camera đang hoạt động</p>}
        />
        <StatCard
          title="Camera Hoạt Động"
          tooltip="Số camera đang online."
          headerRight={<CameraIcon className="size-4 text-purple-500" />}
          value="5"
          sub1={
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">3 tốt</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400">1 TB</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400">1 tắc</Badge>
            </div>
          }
          sub2={<p className="text-[11px] text-muted-foreground mt-1.5">Trung bình 144 xe / camera</p>}
        />
        <StatCard
          title="Tình Trạng Mạng"
          tooltip="Phân loại LOS toàn mạng lưới."
          headerRight={<ShieldIcon className="size-4 text-green-500" />}
          value={<span className="flex items-end gap-1.5"><span>3</span><span className="text-sm text-muted-foreground mb-0.5">/ 5 tốt</span></span>}
          sub1={
            <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-muted">
              <div className="bg-green-500 rounded-l-full" style={{ width: "60%" }} />
              <div className="bg-yellow-400" style={{ width: "20%" }} />
              <div className="bg-red-500 rounded-r-full" style={{ width: "20%" }} />
            </div>
          }
          sub2={<p className="text-[11px] text-muted-foreground mt-1">2 camera cần theo dõi</p>}
        />
        <StatCard
          title="Xu Hướng Lưu Lượng"
          tooltip="Số camera đang có mật độ tăng."
          headerRight={<TrendingUpIcon className="size-4 text-orange-500" />}
          value="60%"
          sub1={<p className="text-[11px] text-muted-foreground mt-0.5">Mật độ tổng đang tăng</p>}
          sub2={
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">↑ 3 tăng</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">↓ 2 giảm</Badge>
            </div>
          }
        />
      </div>

      {/* Chart placeholder + Table */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardSectionHeader
              icon={ActivityIcon}
              title="Lưu lượng theo thời gian"
              iconColor="text-blue-600"
              iconBg="bg-blue-50 dark:bg-blue-950/30"
              description="Thực tế vs Dự báo — 1 giờ gần nhất"
              action={<Button variant="ghost" size="sm" className="text-xs h-7">Báo cáo →</Button>}
            />
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted/40 rounded-lg flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground border border-dashed border-border">
              <ActivityIcon className="size-6 text-muted-foreground/40" />
              AreaChart — 2 series (Thực tế + Dự báo)
            </div>
          </CardContent>
        </Card>

        {/* V/C per camera */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardSectionHeader
              icon={ShieldIcon}
              title="Tải V/C theo camera"
              iconColor="text-purple-600"
              iconBg="bg-purple-50 dark:bg-purple-950/30"
            />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {MOCK_CAMERAS.map(cam => (
              <div key={cam.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[130px]">{cam.name}</span>
                  <span className={cn("font-medium tabular-nums", cam.vc >= 85 ? "text-red-600" : cam.vc >= 65 ? "text-orange-600" : "text-green-600")}>
                    {cam.vc}%
                  </span>
                </div>
                <Progress
                  value={cam.vc}
                  className={cn("h-1.5", cam.vc >= 85 ? "[&>div]:bg-red-500" : cam.vc >= 65 ? "[&>div]:bg-orange-400" : "[&>div]:bg-green-500")}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Data table */}
      <Card>
        <CardHeader className="pb-3">
          <CardSectionHeader
            icon={CameraIcon}
            title="Dữ liệu theo camera"
            iconColor="text-blue-600"
            iconBg="bg-blue-50 dark:bg-blue-950/30"
            description="Khung 5 phút gần nhất"
            badge={<Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400">Live</Badge>}
          />
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Camera</TableHead>
                <TableHead className="text-right">Tổng xe</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Ô tô</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Xe máy</TableHead>
                <TableHead className="text-center">LOS</TableHead>
                <TableHead className="text-center">Xu hướng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_CAMERAS.map(cam => (
                <TableRow key={cam.id} className="text-sm hover:bg-accent/40 cursor-pointer">
                  <TableCell>
                    <div>
                      <p className="font-medium text-xs">{cam.id}</p>
                      <p className="text-[11px] text-muted-foreground">{cam.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{cam.total}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground hidden sm:table-cell">{cam.car}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground hidden sm:table-cell">{cam.moto}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", LOS_BADGE[cam.los])}>
                      {cam.los} – {LOS_LABEL[cam.los]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <TrendIcon trend={cam.trend} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
