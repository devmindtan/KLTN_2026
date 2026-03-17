import { CameraIcon, BrainCircuitIcon, FileTextIcon, SettingsIcon, PlusIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/custom/page-header"
import { SectionTitle, PropTable, CodeBlock, ComponentName } from "./sandbox-helpers"

const PROPS = [
  { prop: "title",       type: "string",    required: true,  desc: "Tiêu đề trang — text-lg font-semibold" },
  { prop: "icon",        type: "ReactNode", defaultVal: "—", desc: "Icon trái trong ô vuông bg-primary/10 — khuyến nghị size-5" },
  { prop: "description", type: "string",    defaultVal: "—", desc: "Mô tả ngắn text-xs text-muted-foreground bên dưới title" },
  { prop: "children",    type: "ReactNode", defaultVal: "—", desc: "Slot phải: buttons, badges, selects — tự động full-width trên mobile" },
  { prop: "className",   type: "string",    defaultVal: "—", desc: "Class Tailwind bổ sung cho container" },
]

/** Sandbox tab — tài liệu và ví dụ thực tế cho PageHeader */
export function TabPageHeader() {
  return (
    <div className="space-y-0">
      <ComponentName name="PageHeader" path="@/components/custom/page-header" />
      <PropTable rows={PROPS} />

      {/* ── 1. Tối giản ── */}
      <SectionTitle>Tối giản — title only</SectionTitle>
      <div className="border rounded-md p-4">
        <PageHeader title="Phân tích Mô hình" />
      </div>
      <CodeBlock>{`<PageHeader title="Phân tích Mô hình" />`}</CodeBlock>

      {/* ── 2. icon + title ── */}
      <SectionTitle>Với icon</SectionTitle>
      <div className="space-y-3">
        <div className="border rounded-md p-4">
          <PageHeader
            icon={<CameraIcon className="size-5" />}
            title="Giám sát Camera"
          />
        </div>
        <div className="border rounded-md p-4">
          <PageHeader
            icon={<BrainCircuitIcon className="size-5" />}
            title="Phân tích Mô hình"
          />
        </div>
      </div>
      <CodeBlock>{`<PageHeader
  icon={<CameraIcon className="size-5" />}
  title="Giám sát Camera"
/>`}</CodeBlock>

      {/* ── 3. icon + title + description ── */}
      <SectionTitle>Với description</SectionTitle>
      <div className="border rounded-md p-4">
        <PageHeader
          icon={<FileTextIcon className="size-5" />}
          title="Báo cáo"
          description="Xem lại lịch sử báo cáo và kết quả dự báo lưu lượng giao thông theo ngày/tuần/tháng."
        />
      </div>
      <CodeBlock>{`<PageHeader
  icon={<FileTextIcon className="size-5" />}
  title="Báo cáo"
  description="Xem lại lịch sử báo cáo và kết quả dự báo."
/>`}</CodeBlock>

      {/* ── 4. Đầy đủ với right actions ── */}
      <SectionTitle>Đầy đủ — icon + title + description + right actions</SectionTitle>
      <div className="border rounded-md p-4">
        <PageHeader
          icon={<CameraIcon className="size-5" />}
          title="Giám sát Camera"
          description="Theo dõi trạng thái và lưu lượng thực tế từ 15 camera trên toàn mạng lưới."
        >
          <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30">
            12 Online
          </Badge>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <SettingsIcon className="size-3.5" />
            Cài đặt
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <PlusIcon className="size-3.5" />
            Thêm camera
          </Button>
        </PageHeader>
      </div>
      <CodeBlock>{`<PageHeader
  icon={<CameraIcon className="size-5" />}
  title="Giám sát Camera"
  description="Theo dõi trạng thái 15 camera trên toàn mạng."
>
  <Badge variant="outline">12 Online</Badge>
  <Button variant="outline" size="sm">Cài đặt</Button>
  <Button size="sm">Thêm camera</Button>
</PageHeader>`}</CodeBlock>

      {/* ── 5. Badge Dev only ── */}
      <SectionTitle>Với badge trạng thái trang</SectionTitle>
      <div className="border rounded-md p-4">
        <PageHeader
          icon={<BrainCircuitIcon className="size-5" />}
          title="Thử nghiệm giao diện"
          description="Thử nghiệm component trước khi áp dụng vào production."
        >
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
            Dev only
          </Badge>
        </PageHeader>
      </div>
      <CodeBlock>{`<PageHeader
  icon={<BrainCircuitIcon className="size-5" />}
  title="Thử nghiệm giao diện"
  description="Chỉ hiển thị cho kỹ thuật viên."
>
  <Badge variant="outline" className="... text-orange-700 border-orange-200">
    Dev only
  </Badge>
</PageHeader>`}</CodeBlock>
    </div>
  )
}
