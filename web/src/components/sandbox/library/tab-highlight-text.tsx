import { useState } from "react"
import { Input } from "@/components/ui/input"
import { HighlightText } from "@/components/custom/highlight-text"
import { SectionTitle, PropTable, CodeBlock, ComponentName } from "./sandbox-helpers"

const PROPS = [
  { prop: "text",  type: "string", required: true, desc: "Chuỗi văn bản đầy đủ cần hiển thị" },
  { prop: "query", type: "string", required: true, desc: "Từ khoá tìm kiếm cần highlight — chuỗi rỗng = không highlight" },
]

const CAMERA_LIST = [
  "CAM-01 · Ngã tư Đinh Tiên Hoàng – Điện Biên Phủ",
  "CAM-03 · Nút giao Điện Biên Phủ – 3/2",
  "CAM-05 · Đường Lê Lợi – Cầu Bông",
  "CAM-07 · Ngã tư Cộng Hoà – Trường Chinh",
  "CAM-09 · Đại lộ Đông Tây – Hầm sông Sài Gòn",
  "CAM-11 · Ngã tư Bình Phước – QL13",
]

const REPORT_LIST = [
  "Báo cáo lưu lượng ngày 10/03/2026 – Nút giao Điện Biên Phủ",
  "Dự báo lưu lượng tuần 11 – Khu vực Quận 1",
  "Báo cáo hiệu suất mô hình RF – Tháng 2/2026",
  "Phân tích lưu lượng giờ cao điểm – Quận Bình Thạnh",
  "Báo cáo tổng hợp tháng 02 – Toàn mạng lưới TP.HCM",
]

/** Sandbox tab — tài liệu và ví dụ thực tế cho HighlightText */
export function TabHighlightText() {
  const [query, setQuery] = useState("")

  return (
    <div className="space-y-0">
      <ComponentName name="HighlightText" path="@/components/custom/highlight-text" />
      <PropTable rows={PROPS} />

      {/* ── 1. Demo tương tác ── */}
      <SectionTitle>Demo tương tác</SectionTitle>
      <p className="text-xs text-muted-foreground mb-2">
        Nhập từ khoá vào ô tìm kiếm để xem highlight hoạt động trong danh sách:
      </p>
      <Input
        placeholder="Nhập từ khoá tìm kiếm..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="max-w-xs h-8 text-sm mb-3"
      />

      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Danh sách Camera</p>
      <div className="rounded-md border divide-y">
        {CAMERA_LIST.map(name => (
          <div key={name} className="px-3 py-2 text-sm">
            <HighlightText text={name} query={query} />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mt-4 mb-1">Danh sách Báo cáo</p>
      <div className="rounded-md border divide-y">
        {REPORT_LIST.map(name => (
          <div key={name} className="px-3 py-2 text-sm">
            <HighlightText text={name} query={query} />
          </div>
        ))}
      </div>

      {/* ── 2. Cách dùng ── */}
      <SectionTitle>Cách dùng</SectionTitle>
      <CodeBlock>{`// BẮT BUỘC dùng HighlightText cho mọi filter/search list trong dự án
import { HighlightText } from "@/components/custom/highlight-text"

// Trong component list:
const [search, setSearch] = useState("")

{cameras.map(cam => (
  <div key={cam.id} className="px-3 py-2 text-sm">
    <HighlightText text={cam.name} query={search} />
  </div>
))}`}</CodeBlock>

      {/* ── 3. Trường hợp đặc biệt ── */}
      <SectionTitle>Trường hợp đặc biệt</SectionTitle>
      <div className="space-y-2 text-sm">
        <div className="flex gap-4 items-center rounded-md border px-3 py-2">
          <span className="text-[11px] text-muted-foreground w-32 shrink-0">query = "" (rỗng)</span>
          <HighlightText text="CAM-01 · Ngã tư Đinh Tiên Hoàng" query="" />
        </div>
        <div className="flex gap-4 items-center rounded-md border px-3 py-2">
          <span className="text-[11px] text-muted-foreground w-32 shrink-0">Không phân biệt hoa/thường</span>
          <HighlightText text="CAM-01 · Ngã tư Đinh Tiên Hoàng" query="đinh tiên" />
        </div>
        <div className="flex gap-4 items-center rounded-md border px-3 py-2">
          <span className="text-[11px] text-muted-foreground w-32 shrink-0">Ký tự đặc biệt regex</span>
          <HighlightText text="Lưu lượng (xe/h) tại CAM-03" query="(xe/h)" />
        </div>
      </div>
      <CodeBlock>{`// query rỗng → trả về text gốc (không render mark)
<HighlightText text="CAM-01 · ..." query="" />

// Không phân biệt hoa/thường — tự escape regex đặc biệt
<HighlightText text="Lưu lượng (xe/h) tại CAM-03" query="(xe/h)" />`}</CodeBlock>
    </div>
  )
}
