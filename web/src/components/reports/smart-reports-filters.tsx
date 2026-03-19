/**
 * SmartReportsFilters - Thanh filter và controls cho trang Smart Reports
 */
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/custom/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconList,
  IconLayoutGrid,
  IconRefresh,
} from "@tabler/icons-react";

type ViewMode = "list" | "grid";
type ReportType = "all" | "daily" | "weekly" | "monthly" | "quarterly" | "incident" | "custom";
type StatusFilter = "all" | "pending" | "generating" | "ready" | "failed";

interface SmartReportsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: ReportType;
  onTypeFilterChange: (type: ReportType) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
  refreshLoading?: boolean;
}

/** Filter bar và view controls cho Smart Reports */
export function SmartReportsFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  refreshLoading = false
}: SmartReportsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        size="sm"
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Tìm kiếm báo cáo..."
        className="flex-1 min-w-[200px] max-w-sm"
      />
      
      <Select value={typeFilter} onValueChange={v => onTypeFilterChange(v as ReportType)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue placeholder="Loại" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả</SelectItem>
          <SelectItem value="daily">Hàng ngày</SelectItem>
          <SelectItem value="weekly">Hàng tuần</SelectItem>
          <SelectItem value="monthly">Hàng tháng</SelectItem>
          <SelectItem value="incident">Sự cố</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={statusFilter} onValueChange={v => onStatusFilterChange(v as StatusFilter)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả</SelectItem>
          <SelectItem value="ready">Sẵn sàng</SelectItem>
          <SelectItem value="generating">Đang tạo</SelectItem>
          <SelectItem value="pending">Đang chờ</SelectItem>
          <SelectItem value="failed">Lỗi</SelectItem>
        </SelectContent>
      </Select>
      
      <div className="flex-1" />
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRefresh} 
        disabled={refreshLoading}
        className="gap-1.5"
      >
        <IconRefresh className={`size-4 ${refreshLoading ? 'animate-spin' : ''}`} />
        Làm mới
      </Button>
      
      {/* View mode toggle */}
      <div className="flex gap-0.5 border rounded-md p-0.5">
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7 text-xs"
          onClick={() => onViewModeChange("list")}
        >
          <IconList className="size-3.5" />
        </Button>
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7 text-xs"
          onClick={() => onViewModeChange("grid")}
        >
          <IconLayoutGrid className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}