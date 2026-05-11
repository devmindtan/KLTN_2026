import { ActivityIcon, CameraIcon, ShieldIcon } from "lucide-react"
import { InfoTooltip, TermTooltip } from "@/components/custom/info-tooltip"
import { StatCard } from "@/components/custom/stat-card"
import { SectionTitle, PropTable, CodeBlock, ComponentName } from "./sandbox-helpers"

const INFO_PROPS = [
  { prop: "content",       type: "ReactNode", required: true,  desc: "Nội dung tooltip — string hoặc JSX" },
  { prop: "trigger",       type: "ReactNode", defaultVal: "icon ?", desc: "Element kích hoạt tooltip — mặc định icon ? nhỏ" },
  { prop: "side",          type: '"top"|"right"|"bottom"|"left"', defaultVal: '"top"', desc: "Vị trí hiển thị tooltip" },
  { prop: "className",     type: "string",    defaultVal: "—", desc: "Class bổ sung cho content box (max-w-xs mặc định)" },
  { prop: "delayDuration", type: "number",    defaultVal: "200", desc: "Delay trước khi hiện (ms)" },
]

const TERM_PROPS = [
  { prop: "term",        type: "string", required: true,  desc: "Thuật ngữ hiển thị inline — có gạch chân nét đứt" },
  { prop: "description", type: "string", required: true,  desc: "Mô tả giải thích thuật ngữ" },
  { prop: "side",        type: '"top"|"right"|"bottom"|"left"', defaultVal: '"top"', desc: "Vị trí hiển thị tooltip" },
]

/** Sandbox tab — tài liệu và ví dụ thực tế cho InfoTooltip + TermTooltip */
export function TabTooltips() {
  return (
    <div className="space-y-0">

      {/* ════════════ InfoTooltip ════════════ */}
      <ComponentName name="InfoTooltip" path="@/components/custom/info-tooltip" />
      <PropTable rows={INFO_PROPS} />

      {/* ── 1. Default trigger (icon ?) ── */}
      <SectionTitle>Default trigger — icon ?</SectionTitle>
      <div className="flex flex-wrap gap-6 text-sm">
        <span className="flex items-center gap-1">
          Lưu lượng (xe/h) <InfoTooltip content="Số lượng phương tiện đi qua điểm đo trong 1 giờ" />
        </span>
        <span className="flex items-center gap-1">
          V/C Ratio <InfoTooltip content="Volume/Capacity — tỉ lệ xe thực tế / năng lực thiết kế. Trên 0.9 là quá tải." />
        </span>
        <span className="flex items-center gap-1">
          MAE <InfoTooltip content="Mean Absolute Error — sai số tuyệt đối trung bình của mô hình dự báo" />
        </span>
      </div>
      <CodeBlock>{`<span className="flex items-center gap-1">
  Lưu lượng (xe/h)
  <InfoTooltip content="Số lượng phương tiện đi qua điểm đo trong 1 giờ" />
</span>`}</CodeBlock>

      {/* ── 2. side variants ── */}
      <SectionTitle>Vị trí — side prop</SectionTitle>
      <div className="flex flex-wrap gap-6 text-sm">
        {(["top", "right", "bottom", "left"] as const).map(s => (
          <span key={s} className="flex items-center gap-1">
            side="{s}" <InfoTooltip content={`Tooltip hiện ở phía ${s}`} side={s} />
          </span>
        ))}
      </div>
      <CodeBlock>{`<InfoTooltip content="Tooltip hiện ở phía phải" side="right" />
<InfoTooltip content="Tooltip hiện ở phía dưới" side="bottom" />`}</CodeBlock>

      {/* ── 3. Custom trigger ── */}
      <SectionTitle>Custom trigger</SectionTitle>
      <div className="flex flex-wrap gap-6 text-sm">
        <InfoTooltip
          content="Đây là icon Activity làm trigger thay thế"
          trigger={<ActivityIcon className="size-4 text-blue-500 cursor-help" />}
        />
        <InfoTooltip
          content="Camera offline — kiểm tra kết nối mạng và nguồn điện"
          trigger={<CameraIcon className="size-4 text-red-500 cursor-help" />}
        />
        <InfoTooltip
          content="Hệ thống hoạt động bình thường"
          trigger={
            <span className="text-xs text-green-600 border border-green-300 rounded px-1.5 py-0.5 cursor-help bg-green-50 dark:bg-green-950/30">
              Online
            </span>
          }
        />
      </div>
      <CodeBlock>{`<InfoTooltip
  content="Camera offline — kiểm tra kết nối mạng và nguồn điện"
  trigger={<CameraIcon className="size-4 text-red-500 cursor-help" />}
/>`}</CodeBlock>

      {/* ── 4. Trong StatCard ── */}
      <SectionTitle>Dùng qua StatCard.tooltip prop</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          title="MAE"
          value="42.3"
          headerRight={<ActivityIcon className="size-3.5 text-blue-500" />}
          tooltip="Mean Absolute Error — sai số tuyệt đối trung bình (phương tiện/giờ)"
        />
        <StatCard
          title="MAPE"
          value="6.8%"
          headerRight={<ShieldIcon className="size-3.5 text-green-500" />}
          tooltip="Mean Absolute Percentage Error — sai số tương đối. < 10% là tốt."
        />
        <StatCard
          title="V/C Ratio"
          value="0.81"
          tooltip="Volume/Capacity — tỉ lệ lưu lượng thực tế / năng lực thiết kế"
        />
      </div>
      <CodeBlock>{`// StatCard tự render InfoTooltip khi truyền tooltip prop
<StatCard
  title="MAE"
  value="42.3"
  tooltip="Mean Absolute Error — sai số tuyệt đối trung bình"
/>`}</CodeBlock>

      {/* ════════════ TermTooltip ════════════ */}
      <div className="mt-8">
        <ComponentName name="TermTooltip" path="@/components/custom/info-tooltip" />
        <PropTable rows={TERM_PROPS} />
      </div>

      {/* ── 5. TermTooltip ── */}
      <SectionTitle>TermTooltip — thuật ngữ chuyên ngành inline</SectionTitle>
      <p className="text-sm leading-relaxed">
        Mô hình sử dụng thuật toán{" "}
        <TermTooltip term="Random Forest" description="Tập hợp nhiều cây quyết định, mỗi cây được huấn luyện trên tập con ngẫu nhiên." />{" "}
        với cửa sổ thời gian{" "}
        <TermTooltip term="LAG window" description="Khoảng thời gian nhìn lại để tạo đặc trưng — mặc định 24 giờ trước." />{" "}
        để tối thiểu hoá{" "}
        <TermTooltip term="MAPE" description="Mean Absolute Percentage Error — sai số tương đối. Dưới 10% được coi là tốt." />.
      </p>
      <CodeBlock>{`// Dùng inline trong đoạn văn mô tả thuật toán / kết quả
<p className="text-sm">
  Mô hình sử dụng{" "}
  <TermTooltip
    term="Random Forest"
    description="Tập hợp nhiều cây quyết định, mỗi cây huấn luyện trên tập con ngẫu nhiên."
  />{" "}
  để dự báo lưu lượng.
</p>`}</CodeBlock>
    </div>
  )
}
