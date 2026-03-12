import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LoaderIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SearchIcon,
  FilterIcon,
  XIcon,
  MonitorIcon,
} from "lucide-react"
import { IconCar, IconMotorbike } from "@tabler/icons-react"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { Area, AreaChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
// import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { HighlightText } from "@/components/custom/highlight-text"
import { useSocket } from "@/contexts/SocketContext"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  // TabsList,
  // TabsTrigger,
} from "@/components/ui/tabs"

// Camera data schema for traffic monitoring
// eslint-disable-next-line react-refresh/only-export-components
export const schema = z.object({
  id: z.string(),
  shortId: z.string(),
  name: z.string(), // Display name from database
  totalObjects: z.number(),
  carCount: z.number(),
  motorbikeCount: z.number(),
  imageUrl: z.string(),
  lastUpdated: z.string(),
  status: z.object({
    current: z.string(),
    forecast: z.string(),
  }),
  trend: z.object({
    direction: z.string(),
    gti_state: z.string(),
    gti: z.number(),
    current_ratio: z.number(),
    diff: z.number(),
  }),
  forecasts: z.object({
    "5m": z.number(),
    "10m": z.number(),
    "15m": z.number(),
    "30m": z.number(),
    "60m": z.number(),
  }),
  inputValue: z.number().optional(),
  lastPredicted: z.string(),
  calculation: z.object({
    predicted_volume: z.number(),
    capacity: z.number(),
    vc_ratio: z.number(),
  }).optional(),
})

/** Trả về Tailwind class cho badge LOS (Level of Service) */
const getLOSBadgeClass = (status: string): string => {
  switch (status) {
    case "free_flow": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400";
    case "smooth":   return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400";
    case "moderate": return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400";
    case "heavy":    return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400";
    case "congested":return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400";
    default:         return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400";
  }
};

/** Trả về nhãn tiếng Việt cho trạng thái LOS */
const getLOSLabel = (status: string): string => {
  switch (status) {
    case "free_flow": return "Thông thoáng";
    case "smooth":   return "Trôi chảy";
    case "moderate": return "Trung bình";
    case "heavy":    return "Nặng";
    case "congested":return "Ùn tắc";
    default:         return "Không rõ";
  }
};

// Helper function to get trend explanation
const getTrendExplanation = (trend: { direction: string; gti: number; current_ratio: number; diff: number }) => {
  const d = trend.diff?.toFixed(1) ?? "?";
  switch (trend.direction) {
    case "increasing":
      return `GTI (${trend.gti?.toFixed(1)}%) cao hơn hiện tại (${trend.current_ratio?.toFixed(1)}%) → chênh lệch +${d}%`;
    case "decreasing":
      return `GTI (${trend.gti?.toFixed(1)}%) thấp hơn hiện tại (${trend.current_ratio?.toFixed(1)}%) → chênh lệch ${d}%`;
    case "stable":
      return `GTI (${trend.gti?.toFixed(1)}%) ổn định so với hiện tại (${trend.current_ratio?.toFixed(1)}%)`;
    default:
      return "Không có dữ liệu xu hướng";
  }
};

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    accessorKey: "shortId",
    header: () => null,
    cell: () => null,
    enableHiding: true,
  },
  {
    accessorKey: "name",
    header: "Tên đường",
    cell: ({ row, column }) => (
      <div className="sm:max-w-[300px] text-[12px] min-w-0">
        <div className="font-medium">
          <HighlightText text={row.original.name} query={String(column.getFilterValue() ?? "")} />
        </div>
        <div className="text-sm text-muted-foreground sm:hidden">ID: {row.original.shortId}</div>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "totalObjects",
    header: () => <div className="hidden xl:block">Tổng Số Xe</div>,
    cell: ({ row }) => (
      <div className="hidden xl:flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {row.original.totalObjects}
        </span>
        <div className="flex items-center gap-1 text-[11px]">
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 flex items-center gap-0.5">
            <IconCar className="size-3 shrink-0" />{row.original.carCount}
          </Badge>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400 flex items-center gap-0.5">
            <IconMotorbike className="size-3 shrink-0" />{row.original.motorbikeCount}
          </Badge>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <div className="hidden sm:block">Trạng Thái</div>,
    cell: ({ row }) => {
      const status = row.original.status.current;
      const icon = status === "free_flow" || status === "smooth"
        ? <CheckCircle2Icon className="size-3" />
        : <LoaderIcon className="size-3" />;
      return (
        <div className="hidden sm:block">
          <Badge variant="outline" className={`flex gap-1 px-2 py-1 ${getLOSBadgeClass(status)}`}>
            {icon}{getLOSLabel(status)}
          </Badge>
        </div>
      );
    },
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue) return true;
      return row.original.status.current === filterValue;
    },
  },
  {
    id: "status_forecast",
    header: () => <div className="hidden sm:block">Dự Báo 5p</div>,
    cell: ({ row }) => {
      const status = row.original.status.forecast;
      const icon = status === "free_flow" || status === "smooth"
        ? <CheckCircle2Icon className="size-3" />
        : <LoaderIcon className="size-3" />;
      return (
        <div className="hidden sm:block">
          <Badge variant="outline" className={`flex gap-1 px-2 py-1 ${getLOSBadgeClass(status)}`}>
            {icon}{getLOSLabel(status)}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "trend",
    header: () => <div className="hidden sm:block">Xu Hướng</div>,
    cell: ({ row }) => {
      const trend = row.original.trend;
      let trendClass = "text-gray-700 bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400";
      let trendText = "Ổn định";
      let icon = null;

      if (trend.direction === "increasing") {
        trendText = "Tăng";
        trendClass = "text-orange-700 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400";
        icon = <TrendingUpIcon className="size-3" />;
      } else if (trend.direction === "decreasing") {
        trendText = "Giảm";
        trendClass = "text-green-700 bg-green-50 border-green-200 dark:bg-green-950/30 dark:text-green-400";
        icon = <TrendingDownIcon className="size-3" />;
      }

      const diffSign = trend.diff > 0 ? "+" : "";

      return (
        <div className="hidden sm:flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`flex gap-1 w-fit px-2 ${trendClass}`}
          >
            {icon}
            {trendText}
          </Badge>
          {typeof trend.diff === "number" && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {diffSign}{trend.diff.toFixed(1)}%
            </span>
          )}
        </div>
      );
    },
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue) return true;
      return row.original.trend.direction === filterValue;
    },
  },
  {
    accessorKey: "forecasts.5m",
    header: () => <div className="hidden sm:block w-full text-center">Dự Báo 5'</div>,
    cell: ({ row }) => (
      <div className="hidden sm:block text-center font-semibold tabular-nums">
        {Math.round(row.original.forecasts["5m"])}
      </div>
    ),
  },
  {
    accessorKey: "lastUpdated",
    header: () => <div className="hidden 2xl:block">Cập Nhật Cuối</div>,
    cell: ({ row }) => (
      <div className="hidden 2xl:block text-xs text-muted-foreground">
        {row.original.lastUpdated
          ? new Date(row.original.lastUpdated).toLocaleString("vi-VN")
          : "N/A"}
      </div>
    ),
  },
]

function ClickableRow({ row, onRowClick }: { row: Row<z.infer<typeof schema>>, onRowClick: (item: z.infer<typeof schema>) => void }) {
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      className="cursor-pointer hover:bg-accent/40 transition-colors"
      onClick={() => onRowClick(row.original)}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[]
}) {
  const [data, setData] = React.useState(() => initialData)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  // Filter states
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [trendFilter, setTrendFilter] = React.useState("all")
  // Detail modal state
  const [selectedItem, setSelectedItem] = React.useState<z.infer<typeof schema> | null>(null)

  // Sync data với initialData khi props thay đổi (từ socket updates)
  React.useEffect(() => {
    setData(initialData)
  }, [initialData])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    // Ngăn tự động reset khi data update từ socket
    autoResetPageIndex: false, // Giữ nguyên trang hiện tại
    autoResetExpanded: false, // Giữ nguyên expanded state
  })

  return (
    <Tabs
      defaultValue="cameras"
      className="flex w-full flex-col justify-start gap-4 rounded-xl border bg-card py-4"
    >
      <div className="px-4 lg:px-6">
        <CardSectionHeader
          icon={MonitorIcon}
          title="Nguồn camera trực tiếp"
          iconBg="bg-teal-500/10"
          iconColor="text-teal-600"
          description="Giám sát luồng giao thông thời gian thực"
          className="w-full"
          badge={
            <Badge variant="secondary" className="flex h-5 items-center justify-center rounded-full px-2 ml-0.5">
              {table.getFilteredRowModel().rows.length} camera
            </Badge>
          }

        />
      </div>
      
      {/* Search and Filters */}
      <div className="px-4 lg:px-6">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search by name */}
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên đường..."
                value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn("name")?.setFilterValue(event.target.value)
                }
                className="pl-9"
              />
            </div>
            
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <FilterIcon className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="free_flow">Thông thoáng</SelectItem>
                <SelectItem value="smooth">Trôi chảy</SelectItem>
                <SelectItem value="moderate">Trung bình</SelectItem>
                <SelectItem value="heavy">Nặng</SelectItem>
                <SelectItem value="congested">Ùn tắc</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Trend Filter */}
            <Select
              value={trendFilter}
              onValueChange={(value) => {
                setTrendFilter(value);
                table.getColumn("trend")?.setFilterValue(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Xu hướng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="increasing">Tăng</SelectItem>
                <SelectItem value="stable">Ổn định</SelectItem>
                <SelectItem value="decreasing">Giảm</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Clear filters */}
            {(table.getColumn("name")?.getFilterValue() ||
              statusFilter !== "all" ||
              trendFilter !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  table.getColumn("name")?.setFilterValue(undefined);
                  setStatusFilter("all");
                  setTrendFilter("all");
                  table.getColumn("status")?.setFilterValue(undefined);
                  table.getColumn("trend")?.setFilterValue(undefined);
                }}
                size="sm"
              >
                <XIcon className="w-4 h-4 mr-1" />
                Xóa
              </Button>
            )}
          </div>
      </div>      
      
      <TabsContent
        value="cameras"
        className="relative flex flex-col gap-4 overflow-auto scrollbar px-4 lg:px-6"
      >
        <div>
            <Table>
              <TableHeader className="sticky top-0 z-[1] bg-muted/80 backdrop-blur-sm">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                      <ClickableRow
                        key={row.id}
                        row={row}
                        onRowClick={(item) => setSelectedItem(item)}
                      />
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center"
                    >
                      <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                        <MonitorIcon className="size-8 mb-2 opacity-25" />
                        <p className="text-sm font-medium">Không có kết quả</p>
                        <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 lg:flex" />
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Dòng mỗi trang
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Trang {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      
      {/* Detail Modal - Controlled by selectedItem state */}
      {selectedItem && (
        <TableCellViewerModal 
          item={selectedItem} 
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
        />
      )}
    </Tabs>
  )
}

// Separate controlled modal component for row click

/** Nhãn % thay đổi so với baseline – module-level để tránh Recharts re-mount */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PctForecastLabel = (props: any) => {
  const { x, y, value } = props;
  if (value === null || value === undefined) return null;
  const pct = value as number;
  const color = pct > 0 ? "#f97316" : pct < 0 ? "#22c55e" : "#9ca3af";
  const sign = pct > 0 ? "+" : "";
  return (
    <text x={Number(x)} y={Math.max(Number(y) - 8, 14)} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>
      {sign}{pct}%
    </text>
  );
};

const forecastChartConfig = {
  vehicles: {
    label: "Dự báo",
    color: "var(--primary)",
  },
  vcPct: {
    label: "Mức tải (%)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function TableCellViewerModal({ item, open, onOpenChange }: { item: z.infer<typeof schema>, open: boolean, onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile()
  const { cameraInfoMap } = useSocket()
  const cameraInfo = cameraInfoMap[item.shortId]

  // Transform forecasts to chart data (pctChange vs baseline + vcPct V/C ratio)
  const capacity = item.calculation?.capacity ?? 0;
  const baseline = item.inputValue ?? item.totalObjects;
  const forecastData = [
    { time: "5 phút",  vehicles: Math.round(item.forecasts["5m"]),  vcPct: capacity > 0 ? Math.round(item.forecasts["5m"]  / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((item.forecasts["5m"]  - baseline) / baseline * 100) : null },
    { time: "10 phút", vehicles: Math.round(item.forecasts["10m"]), vcPct: capacity > 0 ? Math.round(item.forecasts["10m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((item.forecasts["10m"] - baseline) / baseline * 100) : null },
    { time: "15 phút", vehicles: Math.round(item.forecasts["15m"]), vcPct: capacity > 0 ? Math.round(item.forecasts["15m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((item.forecasts["15m"] - baseline) / baseline * 100) : null },
    { time: "30 phút", vehicles: Math.round(item.forecasts["30m"]), vcPct: capacity > 0 ? Math.round(item.forecasts["30m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((item.forecasts["30m"] - baseline) / baseline * 100) : null },
    { time: "60 phút", vehicles: Math.round(item.forecasts["60m"]), vcPct: capacity > 0 ? Math.round(item.forecasts["60m"] / capacity * 100) : 0, pctChange: baseline > 0 ? Math.round((item.forecasts["60m"] - baseline) / baseline * 100) : null },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto scrollbar">
        <SheetHeader className="gap-1">
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>
            Mã Camera: {item.shortId} • Thông tin chi tiết và dự đoán giao thông
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 py-4 text-sm">
          {/* Camera Image */}
          {item.imageUrl && (
            <div className="rounded-lg border overflow-hidden">
              <img
                src={item.imageUrl}
                alt={`Camera ${item.shortId}`}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'%3EImage Not Available%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
          )}

          <Separator />

          {/* Current Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">Tổng phương tiện</p>
              <p className="text-2xl font-bold tabular-nums">{item.totalObjects}</p>
              <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <IconCar className="size-3.5 text-blue-500 shrink-0" />
              <span className="text-sm font-semibold tabular-nums">{item.carCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <IconMotorbike className="size-3.5 text-orange-500 shrink-0" />
              <span className="text-sm font-semibold tabular-nums">{item.motorbikeCount}</span>
            </div>
          </div>
            </div>
            {item.inputValue !== undefined && (
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">Trung bình 5 phút trước</p>
                <p className="text-2xl font-bold tabular-nums">{Math.round(item.inputValue)}</p>
              </div>
            )}
          </div>
        
          <Separator />

          {/* Status Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Trạng Thái Hiện Tại</Label>
              <Badge variant="outline" className={`w-fit ${getLOSBadgeClass(item.status.current)}`}>
                {getLOSLabel(item.status.current)}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Dự Báo 5 Phút</Label>
              <Badge variant="outline" className={`w-fit ${getLOSBadgeClass(item.status.forecast)}`}>
                {getLOSLabel(item.status.forecast)}
              </Badge>
            </div>
          </div>
          <Separator />

          {item.calculation && (
            <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Mức tải V/C</span>
                <span className="text-xs font-semibold tabular-nums">
                  {Math.round(item.calculation.predicted_volume)} / {Math.round(item.calculation.capacity)} xe
                  <span className="ml-1 text-muted-foreground">({Math.round(item.calculation.vc_ratio * 100)}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${item.calculation.vc_ratio <= 0.5 ? "bg-green-500" : item.calculation.vc_ratio <= 0.8 ? "bg-yellow-400" : "bg-red-500"}`}
                  style={{ width: `${Math.min(item.calculation.vc_ratio * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Forecast Chart */}
          {!isMobile && forecastData.some(d => d.vehicles > 0) && (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Dự báo lưu lượng giao thông</Label>
                <ChartContainer config={forecastChartConfig} className="h-[200px]">
                  <AreaChart
                    accessibilityLayer
                    data={forecastData}
                    margin={{ left: -30, right: -18, top: 28, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const visibleRows = payload.filter((p) => p.value !== null && p.value !== undefined && p.value !== 0 || p.dataKey === "vehicles");
                        const labelMap: Record<string, string> = { vehicles: "Dự báo", vcPct: "Mức tải" };
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                            <p className="font-medium mb-1.5">{label}</p>
                            {visibleRows.map((p) => (
                              <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                                  <span className="text-muted-foreground">{labelMap[String(p.dataKey)] ?? String(p.dataKey)}</span>
                                </div>
                                <span className="font-semibold tabular-nums">
                                  {p.dataKey === "vcPct" ? `${p.value}%` : `${p.value} xe`}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Area
                      yAxisId="left"
                      dataKey="vehicles"
                      type="monotone"
                      fill="var(--color-vehicles)"
                      fillOpacity={0.4}
                      stroke="var(--color-vehicles)"
                    >
                      <LabelList dataKey="pctChange" content={PctForecastLabel} />
                    </Area>
                    {capacity > 0 && (
                      <Area
                        yAxisId="right"
                        dataKey="vcPct"
                        type="monotone"
                        fill="var(--color-vcPct)"
                        fillOpacity={0.15}
                        stroke="var(--color-vcPct)"
                        strokeDasharray="4 2"
                      />
                    )}
                  </AreaChart>
                </ChartContainer>
              </div>
              <Separator />
            </>
          )}

          {/* Forecast Values */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Dự đoán số lượng phương tiện</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">5 phút</span>
                <span className="text-sm font-semibold tabular-nums">{Math.round(item.forecasts["5m"])}</span>
                {capacity > 0 && <span className="text-xs text-muted-foreground">{Math.round(item.forecasts["5m"] / capacity * 100)}% mức tải</span>}
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">15 phút</span>
                <span className="text-sm font-semibold tabular-nums">{Math.round(item.forecasts["15m"])}</span>
                {capacity > 0 && <span className="text-xs text-muted-foreground">{Math.round(item.forecasts["15m"] / capacity * 100)}% mức tải</span>}
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">60 phút</span>
                <span className="text-sm font-semibold tabular-nums">{Math.round(item.forecasts["60m"])}</span>
                {capacity > 0 && <span className="text-xs text-muted-foreground">{Math.round(item.forecasts["60m"] / capacity * 100)}% mức tải</span>}
              </div>
            </div>
          </div>

          <Separator />

          {/* Additional Info */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Xu hướng</Label>
                <Badge variant="outline" className="flex gap-1">
                  {item.trend.direction === "increasing" ? (
                    <TrendingUpIcon className="size-3 text-orange-500" />
                  ) : item.trend.direction === "decreasing" ? (
                    <TrendingDownIcon className="size-3 text-green-500" />
                  ) : null}
                  {item.trend.direction === "increasing" ? "Tăng" : item.trend.direction === "decreasing" ? "Giảm" : "Ổn định"}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1.5 border border-blue-200 dark:border-blue-800">
                💡 {getTrendExplanation(item.trend)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Cập nhật cuối</Label>
              <span className="text-xs">
                {item.lastUpdated
                  ? new Date(item.lastUpdated).toLocaleString("vi-VN")
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Dự đoán cuối</Label>
              <span className="text-xs">
                {item.lastPredicted
                  ? new Date(item.lastPredicted).toLocaleString("vi-VN")
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Mã Camera</Label>
              <span className="font-mono text-xs">{item.shortId}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Tên đường</Label>
              <span className="text-xs text-right break-words max-w-[60%]">{item.name}</span>
            </div>
            {cameraInfo?.location && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tọa độ</Label>
                <span className="text-xs text-right break-all font-mono max-w-[60%]">{cameraInfo.location}</span>
              </div>
            )}
          </div>
        </div>
        <SheetFooter className="mt-auto">
          <SheetClose asChild>
            <Button variant="outline" className="w-full">
              Đóng
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
