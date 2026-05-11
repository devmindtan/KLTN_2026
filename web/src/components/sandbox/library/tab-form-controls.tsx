import { useState } from "react"
import {
  FilterIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CircleDotIcon,
  CircleIcon,
  ActivityIcon,
} from "lucide-react"
import { SearchInput } from "@/components/custom/search-input"
import { CustomSelect, type SelectOption } from "@/components/custom/custom-select"
import { SelectWithSearch, type SearchableOption } from "@/components/custom/select-with-search"
import { SectionTitle, PropTable, CodeBlock, ComponentName } from "./sandbox-helpers"
import { Badge } from "@/components/ui/badge"

// ─── Sample options ────────────────────────────────────────────────────────────
const STATUS_OPTIONS: SelectOption[] = [
  { value: "all",        label: "Tất cả"       },
  { value: "free_flow",  label: "Thông thoáng" },
  { value: "smooth",     label: "Trôi chảy"    },
  { value: "moderate",   label: "Trung bình"   },
  { value: "heavy",      label: "Nặng"         },
  { value: "congested",  label: "Ùn tắc"       },
]

const TREND_OPTIONS: SelectOption[] = [
  { value: "all",        label: "Tất cả",    icon: ActivityIcon     },
  { value: "increasing", label: "Tăng",      icon: TrendingUpIcon   },
  { value: "stable",     label: "Ổn định",   icon: MinusIcon        },
  { value: "decreasing", label: "Giảm",      icon: TrendingDownIcon },
]

const STATUS_WITH_ICONS: SelectOption[] = [
  { value: "all",        label: "Tất cả",          icon: CircleIcon       },
  { value: "online",     label: "Hoạt động",        icon: CheckCircle2Icon },
  { value: "warning",    label: "Cảnh báo",         icon: AlertCircleIcon  },
  { value: "offline",    label: "Ngoại tuyến",      icon: CircleDotIcon    },
]

// Dữ liệu mẫu nhiều option cho SelectWithSearch
const MOCK_CAMERAS: SearchableOption[] = Array.from({ length: 18 }, (_, i) => ({
  value: `cam-${String(i + 1).padStart(2, "0")}`,
  label: `Camera ${String(i + 1).padStart(2, "0")} – ${[
    "Nguyễn Văn Cừ", "Điện Biên Phủ", "Lê Hồng Phong",
    "Trần Hưng Đạo", "Cách Mạng Tháng 8", "Hai Bà Trưng",
    "Nam Kỳ Khởi Nghĩa", "Nguyễn Thị Minh Khai", "Phạm Văn Đồng",
    "Hoàng Diệu", "Lý Thường Kiệt", "Võ Thị Sáu",
    "Phan Đình Phùng", "Trường Sa", "Nguyễn Hữu Cảnh",
    "Đinh Tiên Hoàng", "Ngô Quyền", "Bùi Thị Xuân",
  ][i]}`,
}))

// ─── Props docs ────────────────────────────────────────────────────────────────
const SEARCH_PROPS = [
  { prop: "value",       type: "string",                  required: true,  desc: "Giá trị input hiện tại" },
  { prop: "onChange",    type: "(value: string) => void", required: true,  desc: "Callback khi người dùng gõ hoặc nhấn xoá" },
  { prop: "size",        type: '"sm" | "default" | "lg"', defaultVal: '"default"', desc: 'Kích thước: sm=h-8/text-xs, default=h-9/text-sm, lg=h-10/text-sm' },
  { prop: "placeholder", type: "string",                  defaultVal: '"Tìm kiếm..."', desc: "Placeholder text" },
  { prop: "className",   type: "string",                  desc: "Class bổ sung cho wrapper div" },
  { prop: "disabled",    type: "boolean",                 desc: "Khoá input" },
]

const SELECT_PROPS = [
  { prop: "value",       type: "T (extends string)",       required: true,  desc: "Giá trị option đang được chọn" },
  { prop: "onChange",    type: "(value: T) => void",        required: true,  desc: "Callback khi chọn option mới" },
  { prop: "options",     type: "SelectOption<T>[]",         required: true,  desc: "Danh sách options { value, label, icon? }" },
  { prop: "placeholder", type: "string",                    defaultVal: '"Chọn..."', desc: "Placeholder khi chưa chọn" },
  { prop: "icon",        type: "React.ComponentType",       desc: "Icon hiển thị bên trái trigger (dùng khi option không có icon riêng)" },
  { prop: "className",   type: "string",                    desc: "Class cho SelectTrigger (e.g. w-[160px])" },
  { prop: "disabled",    type: "boolean",                   desc: "Khoá select" },
]

const SELECT_SEARCH_PROPS = [
  { prop: "value",             type: "string",              required: true,  desc: "Giá trị option đang được chọn" },
  { prop: "onChange",          type: "(value: string) => void", required: true, desc: "Callback khi chọn option mới" },
  { prop: "options",           type: "SearchableOption[]",  required: true,  desc: "{ value, label, searchValue? } – danh sách option có thể lọc" },
  { prop: "defaultOption",     type: "SearchableOption",                     desc: "Option cố định ở đầu (không bị filter), ví dụ 'Tất cả camera'" },
  { prop: "placeholder",       type: "string",  defaultVal: '"Chọn..."',         desc: "Placeholder của trigger" },
  { prop: "searchPlaceholder", type: "string",  defaultVal: '"Tìm kiếm..."',     desc: "Placeholder của ô tìm kiếm bên trong dropdown" },
  { prop: "emptyText",         type: "string",  defaultVal: '"Không tìm thấy kết quả"', desc: "Text khi filter không có kết quả" },
  { prop: "size",              type: '"sm" | "default" | "lg"', defaultVal: '"default"', desc: 'Kích thước trigger: sm=h-7/xs | default=h-9/sm | lg=h-10/sm' },
  { prop: "triggerClassName",  type: "string",                               desc: "Class bổ sung cho trigger (ghi đè size nếu chứa h-* / text-*)" },
  { prop: "contentWidth",      type: "string",                               desc: "Chiều rộng cố định của dropdown (ví dụ: '280px'). Mặc định theo trigger." },
  { prop: "maxListHeight",     type: "string",  defaultVal: '"200px"',           desc: "max-h của danh sánh options (inline style)" },
  { prop: "ariaLabel",         type: "string",                               desc: "aria-label cho trigger" },
]

/** Sandbox tab – showcase SearchInput, CustomSelect và SelectWithSearch */
export function TabFormControls() {
  const [searchVal, setSearchVal]   = useState("")
  const [statusVal, setStatusVal]   = useState("all")
  const [trendVal, setTrendVal]     = useState("all")
  const [statusIcon, setStatusIcon] = useState("all")
  const [disabled, setDisabled]     = useState(false)
  const [camVal, setCamVal]         = useState("all")

  return (
    <div className="space-y-0">

      {/* ════════════ SearchInput ════════════ */}
      <ComponentName name="SearchInput" path="@/components/custom/search-input" />
      <PropTable rows={SEARCH_PROPS} />

      <SectionTitle>Demo – 3 kích thước</SectionTitle>
      <div className="flex flex-col gap-2 max-w-md">
        <SearchInput size="sm"      value={searchVal} onChange={setSearchVal} placeholder="size=sm (h-8)" />
        <SearchInput size="default" value={searchVal} onChange={setSearchVal} placeholder="size=default (h-9)" />
        <SearchInput size="lg"      value={searchVal} onChange={setSearchVal} placeholder="size=lg (h-10)" />
      </div>

      <SectionTitle>Demo – Mặc định</SectionTitle>
      <div className="flex flex-col gap-3 max-w-md">
        <SearchInput
          value={searchVal}
          onChange={setSearchVal}
          placeholder="Tìm kiếm theo tên đường..."
          disabled={disabled}
        />
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          Giá trị hiện tại:
          <Badge variant="secondary" className="font-mono">
            {searchVal || "(rỗng)"}
          </Badge>
        </div>
      </div>

      <SectionTitle>Demo – Full width trong filter bar</SectionTitle>
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput
          value={searchVal}
          onChange={setSearchVal}
          placeholder="Tìm kiếm theo tên đường..."
          disabled={disabled}
        />
        <CustomSelect
          value={statusVal}
          onChange={setStatusVal}
          options={STATUS_OPTIONS}
          icon={FilterIcon}
          placeholder="Trạng thái"
          className="w-full sm:w-[160px]"
          disabled={disabled}
        />
        <CustomSelect
          value={trendVal}
          onChange={setTrendVal}
          options={TREND_OPTIONS}
          placeholder="Xu hướng"
          className="w-full sm:w-[150px]"
          disabled={disabled}
        />
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
            className="rounded"
          />
          Khoá tất cả
        </label>
      </div>

      <SectionTitle>Cách dùng</SectionTitle>
      <CodeBlock>{`import { SearchInput } from "@/components/custom/search-input"

const [search, setSearch] = useState("")

// Kiểu mặc định (h-9)
<SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm..." />

// Nhỏ — dùng trong filter bar nhul, sheet (h-8)
<SearchInput size="sm" value={search} onChange={setSearch} />

// Lớn — form chính (h-10)
<SearchInput size="lg" value={search} onChange={setSearch} />`}</CodeBlock>

      {/* ════════════ CustomSelect ════════════ */}
      <div className="mt-8">
        <ComponentName name="CustomSelect" path="@/components/custom/custom-select" />
      </div>
      <PropTable rows={SELECT_PROPS} />

      <SectionTitle>Demo – Không có icon trong options</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        <CustomSelect
          value={statusVal}
          onChange={setStatusVal}
          options={STATUS_OPTIONS}
          placeholder="Trạng thái"
          icon={FilterIcon}
          className="w-[160px]"
        />
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          Chọn:
          <Badge variant="secondary" className="font-mono">{statusVal}</Badge>
        </div>
      </div>

      <SectionTitle>Demo – Icon trong mỗi option (tự hiển thị icon của option đang chọn)</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        <CustomSelect
          value={trendVal}
          onChange={setTrendVal}
          options={TREND_OPTIONS}
          placeholder="Xu hướng"
          className="w-[150px]"
        />
        <CustomSelect
          value={statusIcon}
          onChange={setStatusIcon}
          options={STATUS_WITH_ICONS}
          placeholder="Trạng thái"
          className="w-[170px]"
        />
      </div>

      <SectionTitle>Demo – Chỉ trigger icon, không icon trong options</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        <CustomSelect
          value={statusVal}
          onChange={setStatusVal}
          options={STATUS_OPTIONS}
          icon={FilterIcon}
          placeholder="Trạng thái"
          className="w-[160px]"
        />
        <span className="text-xs text-muted-foreground">icon chỉ hiện trên trigger, không hiện trong list</span>
      </div>

      <SectionTitle>Demo – Disabled</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        <CustomSelect
          value="moderate"
          onChange={() => {}}
          options={STATUS_OPTIONS}
          className="w-[160px]"
          disabled
        />
        <SearchInput value="tìm kiếm..." onChange={() => {}} className="max-w-[220px]" disabled />
      </div>

      <SectionTitle>Cách dùng</SectionTitle>
      <CodeBlock>{`import { CustomSelect, type SelectOption } from "@/components/custom/custom-select"
import { FilterIcon, TrendingUpIcon } from "lucide-react"

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all",       label: "Tất cả"      },
  { value: "free_flow", label: "Thông thoáng" },
  { value: "congested", label: "Ùn tắc"      },
]

const TREND_OPTIONS: SelectOption[] = [
  { value: "all",        label: "Tất cả", icon: ActivityIcon    },
  { value: "increasing", label: "Tăng",   icon: TrendingUpIcon  },
]

const [status, setStatus] = useState("all")
const [trend,  setTrend]  = useState("all")

// Chỉ trigger icon (không có icon trong option)
<CustomSelect
  value={status}
  onChange={setStatus}
  options={STATUS_OPTIONS}
  icon={FilterIcon}
  placeholder="Trạng thái"
  className="w-[160px]"
/>

// Icon trong mỗi option – trigger tự lấy icon của option đang chọn
<CustomSelect
  value={trend}
  onChange={setTrend}
  options={TREND_OPTIONS}
  placeholder="Xu hướng"
  className="w-[150px]"
/>`}</CodeBlock>

      {/* ════════════ SelectWithSearch ════════════ */}
      <div className="mt-8">
        <ComponentName name="SelectWithSearch" path="@/components/custom/select-with-search" />
      </div>
      <PropTable rows={SELECT_SEARCH_PROPS} />

      <SectionTitle>Demo – 3 size: sm | default | lg</SectionTitle>
      <div className="flex flex-wrap items-end gap-4">
        {(["sm", "default", "lg"] as const).map((s) => (
          <div key={s} className="flex flex-col gap-1.5 items-start">
            <span className="text-[10px] text-muted-foreground font-mono uppercase">{s}</span>
            <SelectWithSearch
              key={s}
              value={camVal}
              onChange={setCamVal}
              options={MOCK_CAMERAS}
              defaultOption={{ value: "all", label: "Tất cả camera" }}
              placeholder="Tất cả camera"
              searchPlaceholder="Tìm kiếm..."
              size={s}
              triggerClassName="w-[200px]"
            />
          </div>
        ))}
      </div>

      <SectionTitle>Demo – contentWidth cố định (dropdown rộng hơn trigger)</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        <SelectWithSearch
          value={camVal}
          onChange={setCamVal}
          options={MOCK_CAMERAS}
          defaultOption={{ value: "all", label: "Tất cả camera (trung bình)" }}
          placeholder="Tất cả camera"
          searchPlaceholder="Tìm tên, mã ID..."
          size="sm"
          triggerClassName="w-[160px]"
          contentWidth="280px"
          ariaLabel="Chọn camera"
        />
        <span className="text-xs text-muted-foreground">trigger 160px → dropdown 280px</span>
      </div>

      <SectionTitle>Demo – searchValue (tìm theo mã ngắn)</SectionTitle>
      <p className="text-xs text-muted-foreground mb-3">
        Gõ <span className="font-mono bg-muted px-1 rounded">cam-01</span> tìm theo <code>searchValue</code>,
        hoặc gõ tên đường để tìm theo <code>label</code>.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SelectWithSearch
          value={camVal}
          onChange={setCamVal}
          options={MOCK_CAMERAS.map((c) => ({
            ...c,
            searchValue: c.value, // ví dụ: "cam-01"
          }))}
          defaultOption={{ value: "all", label: "Tất cả camera" }}
          searchPlaceholder="Tìm tên hoặc mã (cam-01)..."
          size="default"
          triggerClassName="w-[220px]"
        />
        <Badge variant="secondary" className="font-mono text-xs">{camVal}</Badge>
      </div>

      <SectionTitle>Cách dùng</SectionTitle>
      <CodeBlock>{`import { SelectWithSearch, type SearchableOption } from "@/components/custom/select-with-search"

// searchValue cho phép tìm theo ID / shortId / aliases
const cameraOptions: SearchableOption[] = cameras.map(c => ({
  value:       c.id,
  label:       c.name,
  searchValue: \`\${c.shortId} \${c.id}\`,
}))

const [camera, setCamera] = useState("all")

// size sm + dropdown rộng hơn trigger
<SelectWithSearch
  value={camera}
  onChange={setCamera}
  options={cameraOptions}
  defaultOption={{ value: "all", label: "Tất cả camera" }}
  placeholder="Tất cả camera"
  searchPlaceholder="Tìm camera, mã ID..."
  size="sm"
  triggerClassName="w-[160px]"
  contentWidth="280px"
  ariaLabel="Chọn camera"
/>

// size default (mặc định)
<SelectWithSearch
  value={camera}
  onChange={setCamera}
  options={cameraOptions}
  defaultOption={{ value: "all", label: "Tất cả camera (trung bình)" }}
  size="default"
  triggerClassName="w-full sm:w-55"
/>`}</CodeBlock>

    </div>
  )
}
