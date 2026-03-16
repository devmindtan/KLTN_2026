/**
 * Playground: Trang Giám sát camera – mô phỏng camera wall + filter + detail panel
 */
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SearchInput } from "@/components/custom/search-input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CameraIcon,
  WifiIcon,
  WifiOffIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const MOCK_CAMERAS = [
  { id: "CAM-01", name: "Ngã tư Bình Dương",  status: "online",  los: "B", trend: "up",     total: 142, car: 89,  moto: 53,  vc: 71,  forecast: "D" },
  { id: "CAM-02", name: "Cầu vượt An Phú",    status: "online",  los: "A", trend: "down",   total: 98,  car: 61,  moto: 37,  vc: 49,  forecast: "A" },
  { id: "CAM-03", name: "Vòng xoay Mỹ Phước", status: "online",  los: "D", trend: "up",     total: 187, car: 112, moto: 75,  vc: 87,  forecast: "E" },
  { id: "CAM-04", name: "Đường DT741",         status: "online",  los: "A", trend: "stable", total: 74,  car: 48,  moto: 26,  vc: 37,  forecast: "A" },
  { id: "CAM-05", name: "Cổng KCN VSIP",       status: "error",   los: "E", trend: "up",     total: 221, car: 143, moto: 78,  vc: 94,  forecast: "F" },
  { id: "CAM-06", name: "Trường ĐH TDM",       status: "offline", los: "—", trend: "stable", total: 0,   car: 0,   moto: 0,   vc: 0,   forecast: "—" },
] as const

type Camera = typeof MOCK_CAMERAS[number]

const LOS_BADGE: Record<string, string> = {
  A: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  B: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
  C: "text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400",
  D: "text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  E: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  F: "text-red-900 border-red-300 bg-red-100 dark:bg-red-950/40 dark:text-red-300",
  "—": "text-muted-foreground border-border bg-muted",
}

const LOS_LABEL: Record<string, string> = {
  A: "Thông thoáng", B: "Trơn tru", C: "Trung bình",
  D: "Nặng", E: "Ùn tắc", F: "Kẹt cứng", "—": "Không có dữ liệu",
}

function CameraCell({ cam, onClick, selected }: { cam: Camera; onClick: () => void; selected: boolean }) {
  const isOnline = cam.status === "online"
  const isOffline = cam.status === "offline"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all hover:shadow-sm",
        selected ? "border-primary ring-1 ring-primary bg-accent/30" : "bg-card hover:bg-accent/20",
        !isOnline && "opacity-60"
      )}
    >
      {/* Camera feed placeholder */}
      <div className={cn(
        "rounded-lg mb-3 h-28 flex flex-col items-center justify-center gap-1",
        isOffline ? "bg-muted" : cam.status === "error" ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/60"
      )}>
        {isOffline
          ? <WifiOffIcon className="size-6 text-muted-foreground/50" />
          : cam.status === "error"
            ? <WifiIcon className="size-6 text-red-400" />
            : <CameraIcon className="size-6 text-muted-foreground/40" />
        }
        <span className="text-[10px] text-muted-foreground">
          {isOffline ? "Offline" : cam.status === "error" ? "Lỗi kết nối" : "Live feed"}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{cam.id}</p>
            <p className="text-[11px] text-muted-foreground truncate">{cam.name}</p>
          </div>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", LOS_BADGE[cam.los])}>
            {cam.los}
          </Badge>
        </div>
        {isOnline && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{cam.total} xe</span>
            <div className="flex items-center gap-0.5">
              {cam.trend === "up"     && <TrendingUpIcon   className="size-3 text-orange-500" />}
              {cam.trend === "down"   && <TrendingDownIcon className="size-3 text-green-500"  />}
              {cam.trend === "stable" && <MinusIcon        className="size-3 text-blue-500"   />}
              <span className={cn("text-[10px]",
                cam.trend === "up" ? "text-orange-600" : cam.trend === "down" ? "text-green-600" : "text-blue-600"
              )}>
                {cam.trend === "up" ? "Tăng" : cam.trend === "down" ? "Giảm" : "Ổn định"}
              </span>
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

function CameraDetailPanel({ cam, onClose }: { cam: Camera; onClose: () => void }) {
  return (
    <Card className="sticky top-0 h-fit">
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{cam.id}</p>
            <p className="text-xs text-muted-foreground">{cam.name}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <XIcon className="size-3.5" />
          </Button>
        </div>

        <div className="h-40 rounded-lg bg-muted/60 flex items-center justify-center">
          <CameraIcon className="size-8 text-muted-foreground/40" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <p className="text-2xl font-bold tabular-nums">{cam.total}</p>
            <p className="text-[11px] text-muted-foreground">Tổng xe</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <p className="text-2xl font-bold tabular-nums">{cam.vc}%</p>
            <p className="text-[11px] text-muted-foreground">V/C ratio</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1 rounded-full bg-blue-500" />
          {cam.car} ô tô
          <span className="size-1 rounded-full bg-purple-500 ml-1" />
          {cam.moto} xe máy
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium">Trạng thái hiện tại</p>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", LOS_BADGE[cam.los])}>
              LOS {cam.los} — {LOS_LABEL[cam.los]}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", LOS_BADGE[cam.forecast])}>
              Dự báo: {cam.forecast}
            </Badge>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium">Mức tải V/C</p>
          <Progress
            value={cam.vc}
            className={cn("h-2", cam.vc >= 85 ? "[&>div]:bg-red-500" : cam.vc >= 65 ? "[&>div]:bg-orange-400" : "[&>div]:bg-green-500")}
          />
          <p className="text-[11px] text-muted-foreground">
            {cam.vc >= 85 ? "Quá tải — cần can thiệp" : cam.vc >= 65 ? "Tải cao — theo dõi" : "Bình thường"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/** Playground: Camera monitoring wall */
export function PgMonitoring() {
  const [selected, setSelected] = useState<Camera | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")

  const filtered = MOCK_CAMERAS.filter(c => {
    const matchStatus = filter === "all" || c.status === filter
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          size="sm"
          placeholder="Tìm camera..."
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-[180px]"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="error">Lỗi</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-green-500" />{MOCK_CAMERAS.filter(c => c.status === "online").length} online</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-red-500" />{MOCK_CAMERAS.filter(c => c.status !== "online").length} lỗi/offline</span>
        </div>
      </div>

      {/* Grid + detail */}
      <div className={cn("grid gap-4", selected ? "lg:grid-cols-[1fr_280px]" : "")}>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 content-start">
          {filtered.map(cam => (
            <CameraCell
              key={cam.id}
              cam={cam}
              selected={selected?.id === cam.id}
              onClick={() => setSelected(selected?.id === cam.id ? null : cam)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CameraIcon className="size-8 mb-2 opacity-30" />
              <p className="text-sm">Không tìm thấy camera</p>
            </div>
          )}
        </div>
        {selected && <CameraDetailPanel cam={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
