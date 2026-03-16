import { ForecastMultiHorizonStackedDemo } from "@/components/sandbox/library/forecast-multihorizon-stacked-demo"
/**
 * Tab Thư viện: Charts & Biểu đồ – mẫu AreaChart dự báo vs thực tế
 */
import { SectionTitle } from "@/components/sandbox/library/sandbox-helpers"
import { ForecastRollingChart } from "@/components/dashboard/forecast/forecast-rolling-chart"

/** Tab Charts & Biểu đồ – tham khảo AreaChart dự báo */
export function TabCharts() {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Rolling Chart – Dự báo cuốn chiếu 5 mốc</SectionTitle>
        <ForecastRollingChart />
      </div>
      <div>
        <SectionTitle>Stacked Multi-Horizon Chart – 5 tầng dự báo + thực tế riêng biệt</SectionTitle>
        <ForecastMultiHorizonStackedDemo />
      </div>
    </div>
  )
}
