import { ActivityIcon, CameraIcon, TrendingUpIcon, MoreHorizontalIcon, ExternalLinkIcon } from "lucide-react"
import { IconChartAreaLine, IconTable } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { SectionTitle, PropTable, CodeBlock, ComponentName } from "./sandbox-helpers"

const PROPS = [
  { prop: "icon",        type: "React.ElementType", required: true,  desc: "Icon component (Lucide / @tabler/icons-react) — không phải JSX element" },
  { prop: "title",       type: "string",             required: true,  desc: "Tiêu đề section — luôn text-sm font-medium" },
  { prop: "iconColor",   type: "string", defaultVal: "text-black-600", desc: "Tailwind màu icon" },
  { prop: "iconBg",      type: "string", defaultVal: "—",              desc: "Tailwind màu nền ô icon — ví dụ: bg-blue-500/10" },
  { prop: "description", type: "ReactNode", defaultVal: "—",           desc: "Mô tả phụ text-[11px] bên dưới title" },
  { prop: "action",      type: "ReactNode", defaultVal: "—",           desc: "Link / button cùng hàng với title" },
  { prop: "badge",       type: "ReactNode", defaultVal: "—",           desc: "Badge / chip sau khối text — đếm số mục" },
  { prop: "menu",        type: "ReactNode", defaultVal: "—",           desc: "Dropdown / action button góc phải — DropdownMenu 3 chấm" },
  { prop: "className",   type: "string",    defaultVal: "—",           desc: "Class Tailwind bổ sung" },
]

/** Sandbox tab — tài liệu và ví dụ thực tế cho CardSectionHeader */
export function TabCardSectionHeader() {
  return (
    <div className="space-y-0">
      <ComponentName name="CardSectionHeader" path="@/components/custom/card-section-header" />
      <PropTable rows={PROPS} />

      {/* ── 1. Tối giản ── */}
      <SectionTitle>Tối giản — icon + title</SectionTitle>
      <div className="space-y-2">
        <Card><CardContent className="pt-4">
          <CardSectionHeader icon={ActivityIcon} title="Lưu lượng theo giờ" />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <CardSectionHeader icon={CameraIcon} title="Danh sách camera" />
        </CardContent></Card>
      </div>
      <CodeBlock>{`<CardSectionHeader
  icon={ActivityIcon}
  title="Lưu lượng theo giờ"
/>`}</CodeBlock>

      {/* ── 2. iconBg + iconColor ── */}
      <SectionTitle>iconBg + iconColor — màu sắc theo ngữ cảnh</SectionTitle>
      <div className="space-y-2">
        <Card><CardContent className="pt-4">
          <CardSectionHeader
            icon={IconChartAreaLine}
            title="Biểu đồ dự báo"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-600"
          />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <CardSectionHeader
            icon={IconTable}
            title="Lịch sử dự báo"
            iconBg="bg-violet-500/10"
            iconColor="text-violet-600"
          />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <CardSectionHeader
            icon={TrendingUpIcon}
            title="Xu hướng lưu lượng"
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-600"
          />
        </CardContent></Card>
      </div>
      <CodeBlock>{`<CardSectionHeader
  icon={IconChartAreaLine}
  title="Biểu đồ dự báo"
  iconBg="bg-blue-500/10"
  iconColor="text-blue-600"
/>`}</CodeBlock>

      {/* ── 3. description ── */}
      <SectionTitle>description — mô tả phụ</SectionTitle>
      <Card><CardContent className="pt-4">
        <CardSectionHeader
          icon={ActivityIcon}
          title="Lưu lượng theo giờ"
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          description="Dữ liệu tổng hợp từ 15 camera — cập nhật mỗi 5 phút"
        />
      </CardContent></Card>
      <CodeBlock>{`<CardSectionHeader
  icon={ActivityIcon}
  title="Lưu lượng theo giờ"
  description="Dữ liệu tổng hợp — cập nhật mỗi 5 phút"
/>`}</CodeBlock>

      {/* ── 4. action ── */}
      <SectionTitle>action — link cùng hàng title</SectionTitle>
      <Card><CardContent className="pt-4">
        <CardSectionHeader
          icon={CameraIcon}
          title="Danh sách camera"
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          action={
            <a href="#" className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
              Xem tất cả <ExternalLinkIcon className="size-3" />
            </a>
          }
        />
      </CardContent></Card>
      <CodeBlock>{`<CardSectionHeader
  icon={CameraIcon}
  title="Danh sách camera"
  action={
    <a href="/monitoring" className="text-[11px] text-primary hover:underline">
      Xem tất cả →
    </a>
  }
/>`}</CodeBlock>

      {/* ── 5. badge ── */}
      <SectionTitle>badge — đếm số mục</SectionTitle>
      <Card><CardContent className="pt-4">
        <CardSectionHeader
          icon={CameraIcon}
          title="Camera đang hoạt động"
          iconBg="bg-green-500/10"
          iconColor="text-green-600"
          badge={
            <Badge className="text-[10px] px-1.5 h-5 bg-green-500/10 text-green-700 dark:text-green-400 border-0">
              12 / 15
            </Badge>
          }
        />
      </CardContent></Card>
      <CodeBlock>{`<CardSectionHeader
  icon={CameraIcon}
  title="Camera đang hoạt động"
  badge={<Badge className="...">12 / 15</Badge>}
/>`}</CodeBlock>

      {/* ── 6. menu — 3 chấm ── */}
      <SectionTitle>menu — dropdown 3 chấm góc phải</SectionTitle>
      <Card><CardContent className="pt-4">
        <CardSectionHeader
          icon={ActivityIcon}
          title="Lưu lượng xe qua nút giao"
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          description="CAM-03 · Nút giao Điện Biên Phủ – 3/2"
          menu={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6">
                  <MoreHorizontalIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs">Xuất CSV</DropdownMenuItem>
                <DropdownMenuItem className="text-xs">Xem chi tiết</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </CardContent></Card>
      <CodeBlock>{`<CardSectionHeader
  icon={ActivityIcon}
  title="Lưu lượng xe"
  description="CAM-03 · Nút giao Điện Biên Phủ"
  menu={
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6">
          <MoreHorizontalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Xuất CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  }
/>`}</CodeBlock>
    </div>
  )
}
