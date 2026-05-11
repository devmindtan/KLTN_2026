import { ArrowUpIcon } from "lucide-react"
import { SectionTitle, PropTable, CodeBlock, ComponentName } from "./sandbox-helpers"

const OVERLAY_PROPS = [
  { prop: "(none)", type: "—", desc: "Không nhận props. Đọc isLoading từ LoadingContext tự động." },
]
const SCROLL_PROPS = [
  { prop: "(none)", type: "—", desc: "Không nhận props. Lắng nghe scroll từ #main-scroll-container." },
]
const PROGRESSBAR_PROPS = [
  { prop: "(none)", type: "—", desc: "Không nhận props. Tự subscribe useNavigation() từ react-router-dom." },
]

/** Sandbox tab — tài liệu cho các utility component không có props */
export function TabUtilities() {
  return (
    <div className="space-y-0">

      {/* ════════════ PageLoadingOverlay ════════════ */}
      <ComponentName name="PageLoadingOverlay" path="@/components/custom/page-loading-overlay" />
      <PropTable rows={OVERLAY_PROPS} />
      <SectionTitle>Mô phỏng giao diện</SectionTitle>
      <div className="relative h-36 rounded-md border bg-background overflow-hidden">
        {/* mockup overlay */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm">
          <div className="h-9 w-9 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
        <div className="p-4 text-xs text-muted-foreground">Nội dung trang bên dưới overlay</div>
      </div>

      <SectionTitle>Cách dùng</SectionTitle>
      <CodeBlock>{`// 1. Bọc main bằng relative
// layout/main-content.tsx
<main className="relative overflow-auto ...">
  <PageLoadingOverlay />   {/* đặt đầu tiên bên trong main */}
  {children}
</main>

// 2. Trigger từ bất kỳ component con
import { useLoading } from "@/contexts/LoadingContext"

function MyPage() {
  const { startLoading, stopLoading } = useLoading()

  useEffect(() => {
    startLoading()
    fetchData().finally(stopLoading)
  }, [])
  // ...
}`}</CodeBlock>

      {/* ════════════ ScrollToTop ════════════ */}
      <div className="mt-8">
        <ComponentName name="ScrollToTop" path="@/components/custom/scroll-to-top" />
        <PropTable rows={SCROLL_PROPS} />
      </div>
      <SectionTitle>Mô phỏng nút</SectionTitle>
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 flex items-center justify-center rounded-full bg-background border shadow-md text-muted-foreground">
          <ArrowUpIcon className="size-4" />
        </div>
        <p className="text-xs text-muted-foreground">
          Nút hiện khi scroll &gt; 300px — fixed bottom-6 right-6 trên <span className="font-mono">#main-scroll-container</span>
        </p>
      </div>

      <SectionTitle>Cách dùng</SectionTitle>
      <CodeBlock>{`// Đặt trong Layout component, bên trong SidebarInset
// web/src/components/layout/main-layout.tsx

import { ScrollToTop } from "@/components/custom/scroll-to-top"

export function MainLayout() {
  return (
    <SidebarInset id="main-scroll-container" className="overflow-y-auto ...">
      <ScrollToTop />
      {/* ... */}
    </SidebarInset>
  )
}

// Yêu cầu: container scroll phải có id="main-scroll-container"
// Component tự ẩn khi scroll < 300px — không cần state bên ngoài`}</CodeBlock>

      {/* ════════════ TopProgressBar ════════════ */}
      <div className="mt-8">
        <ComponentName name="TopProgressBar" path="@/components/custom/top-progress-bar" />
        <PropTable rows={PROGRESSBAR_PROPS} />
      </div>
      <SectionTitle>Mô phỏng thanh tiến trình</SectionTitle>
      <div className="relative h-16 rounded-md border bg-background overflow-hidden">
        <div
          className="absolute top-0 left-0 h-[3px] rounded-full bg-primary"
          style={{ width: "65%", transition: "width 400ms ease-out" }}
        />
        <div className="pt-6 px-4 text-xs text-muted-foreground">
          Thanh 3px cố định đỉnh viewport — 0% → 85% (đang load) → 100% → fade out
        </div>
      </div>

      <SectionTitle>Cách dùng</SectionTitle>
      <CodeBlock>{`// Đặt 1 lần duy nhất trong App root — bên trong <Router>
// web/src/App.tsx

import { TopProgressBar } from "@/components/custom/top-progress-bar"

export default function App() {
  return (
    <Router>
      <TopProgressBar />   {/* ← đặt trước outlet, fixed z-50 */}
      <Routes>
        {/* ... */}
      </Routes>
    </Router>
  )
}

// Hoàn toàn tự động — không cần gọi start/stop
// Hoạt động dựa trên useNavigation().state từ react-router-dom`}</CodeBlock>
    </div>
  )
}
