/**
 * Tab Thư viện: Tables & Bảng dữ liệu – mẫu bảng dự báo vs thực tế
 */
import { SectionTitle } from "@/components/sandbox/library/sandbox-helpers"
import { ForecastHistoryTable } from "@/components/dashboard/forecast/forecast-history-table"

/** Tab Tables & Bảng dữ liệu – tham khảo bảng dự báo */
export function TabTables() {
  return (
    <div className="space-y-1">
      <SectionTitle>Bảng Lịch sử Dự báo vs Thực tế</SectionTitle>
      <ForecastHistoryTable />
    </div>
  )
}
