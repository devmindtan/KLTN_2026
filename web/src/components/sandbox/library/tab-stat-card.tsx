import { ActivityIcon, CameraIcon, TrendingUpIcon, TrendingDownIcon, ShieldIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/custom/stat-card"
import { SectionTitle, PropTable, CodeBlock, ComponentName } from "./sandbox-helpers"

const PROPS = [
  { prop: "title",       type: "string",    required: true,  desc: "Tiêu đề ngắn gọn — text-xs text-muted-foreground" },
  { prop: "value",       type: "ReactNode", required: true,  desc: "Giá trị chính — bọc trong text-2xl font-bold tabular-nums" },
  { prop: "headerRight", type: "ReactNode", defaultVal: "—", desc: "Slot phải header: icon trạng thái, dot, v.v." },
  { prop: "sub1",        type: "ReactNode", defaultVal: "—", desc: "Vùng phụ 1 ngay sau value — caller tự định nghĩa spacing" },
  { prop: "sub2",        type: "ReactNode", defaultVal: "—", desc: "Vùng phụ 2 sau sub1 — caller tự định nghĩa spacing" },
  { prop: "tooltip",     type: "string",    defaultVal: "—", desc: "Tooltip giải thích tiêu đề — thêm icon ? sau label" },
  { prop: "className",   type: "string",    defaultVal: "—", desc: "Class Tailwind bổ sung cho Card wrapper" },
]

/** Sandbox tab — tài liệu và ví dụ thực tế cho StatCard */
export function TabStatCard() {
  return (
    <div className="space-y-0">
      <ComponentName name="StatCard" path="@/components/custom/stat-card" />
      <PropTable rows={PROPS} />

      {/* ── 1. Cơ bản ── */}
      <SectionTitle>Cơ bản — title + value</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Tổng phương tiện" value="1,248" />
        <StatCard title="Camera hoạt động" value="12 / 15" />
        <StatCard title="Mật độ TB" value="0.74" />
        <StatCard title="Dự báo hôm nay" value="1,320" />
      </div>
      <CodeBlock>{`<StatCard title="Tổng phương tiện" value="1,248" />`}</CodeBlock>

      {/* ── 2. tooltip prop ── */}
      <SectionTitle>tooltip — giải thích thuật ngữ</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          title="MAE"
          value="42.3"
          tooltip="Mean Absolute Error — sai số tuyệt đối trung bình (phương tiện/giờ)"
        />
        <StatCard
          title="MAPE"
          value="6.8%"
          tooltip="Mean Absolute Percentage Error — sai số tương đối. Dưới 10% là tốt."
        />
        <StatCard
          title="V/C Ratio"
          value="0.81"
          tooltip="Volume/Capacity — tỉ lệ lưu lượng thực tế / năng lực thiết kế. > 0.9 = quá tải"
        />
      </div>
      <CodeBlock>{`<StatCard
  title="MAE"
  value="42.3"
  tooltip="Mean Absolute Error — sai số tuyệt đối trung bình"
/>`}</CodeBlock>

      {/* ── 3. headerRight ── */}
      <SectionTitle>headerRight — icon / dot trạng thái</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          title="Trạng thái mạng"
          value="Online"
          headerRight={<ShieldIcon className="size-3.5 text-green-500" />}
        />
        <StatCard
          title="Camera hoạt động"
          value="12 / 15"
          headerRight={<CameraIcon className="size-3.5 text-blue-500" />}
        />
        <StatCard
          title="Xu hướng lưu lượng"
          value="+8.2%"
          headerRight={<TrendingUpIcon className="size-3.5 text-emerald-500" />}
        />
      </div>
      <CodeBlock>{`<StatCard
  title="Camera hoạt động"
  value="12 / 15"
  headerRight={<CameraIcon className="size-3.5 text-blue-500" />}
/>`}</CodeBlock>

      {/* ── 4. sub1 — badges row ── */}
      <SectionTitle>sub1 — badges / thông tin phụ</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatCard
          title="LOS hiện tại"
          value="LOS C"
          sub1={
            <div className="mt-1.5 flex gap-1.5">
              <Badge className="text-[10px] px-1.5 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-0">Trung bình</Badge>
              <Badge className="text-[10px] px-1.5 bg-muted border-0 text-muted-foreground">V/C 0.74</Badge>
            </div>
          }
        />
        <StatCard
          title="Xu hướng 7 ngày"
          value="−3.5%"
          headerRight={<TrendingDownIcon className="size-3.5 text-red-500" />}
          sub1={
            <div className="mt-1.5 flex gap-1.5">
              <Badge className="text-[10px] px-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border-0">Giảm</Badge>
              <Badge className="text-[10px] px-1.5 bg-muted border-0 text-muted-foreground">vs tuần trước</Badge>
            </div>
          }
          sub2={<p className="mt-1 text-[11px] text-muted-foreground">Dữ liệu cập nhật 15 phút / lần</p>}
        />
      </div>
      <CodeBlock>{`<StatCard
  title="LOS hiện tại"
  value="LOS C"
  sub1={
    <div className="mt-1.5 flex gap-1.5">
      <Badge className="...">Trung bình</Badge>
      <Badge className="...">V/C 0.74</Badge>
    </div>
  }
/>`}</CodeBlock>

      {/* ── 5. value phức tạp (ReactNode) ── */}
      <SectionTitle>value dạng ReactNode — số + đơn vị</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          title="Lưu lượng giờ cao điểm"
          value={
            <span>
              1,248
              <span className="text-sm font-normal text-muted-foreground ml-1">xe/h</span>
            </span>
          }
        />
        <StatCard
          title="Tốc độ di chuyển TB"
          value={
            <span>
              34
              <span className="text-sm font-normal text-muted-foreground ml-1">km/h</span>
            </span>
          }
        />
        <StatCard
          title="Phạm vi dự báo"
          value={
            <span>
              ±5.2
              <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
            </span>
          }
          headerRight={<ActivityIcon className="size-3.5 text-blue-500" />}
        />
      </div>
      <CodeBlock>{`<StatCard
  title="Lưu lượng giờ cao điểm"
  value={
    <span>
      1,248
      <span className="text-sm font-normal text-muted-foreground ml-1">xe/h</span>
    </span>
  }
/>`}</CodeBlock>
    </div>
  )
}
