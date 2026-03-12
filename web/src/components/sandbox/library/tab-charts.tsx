/**
 * Tab Thư viện: Charts & Biểu đồ – mẫu AreaChart dự báo vs thực tế
 */
import { SectionTitle } from "@/components/sandbox/library/sandbox-helpers"
import { ForecastTimelineChart } from "@/components/reports-forecasts/forecast-timeline-chart"

/** Tab Charts & Biểu đồ – tham khảo AreaChart dự báo */
export function TabCharts() {
  return (
    <div className="space-y-1">
      <SectionTitle>Area Chart – Dự báo vs Thực tế</SectionTitle>
      <ForecastTimelineChart />
    </div>
  )
}
