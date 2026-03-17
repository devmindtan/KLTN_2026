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
  FilterIcon,
  XIcon,
  MonitorIcon,
} from "lucide-react"
import { IconCar, IconMotorbike } from "@tabler/icons-react"
import { CardSectionHeader } from "@/components/custom/card-section-header"
import { CameraDetailSheet } from "@/components/custom/camera-detail-sheet"
// import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/custom/search-input"
import { HighlightText } from "@/components/custom/highlight-text"
import { type CameraData } from "@/contexts/SocketContext"
import { getLOSLabel, DASHBOARD_TERM } from "@/lib/app-constants"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  realtimeData: z.object({
    current_volume: z.number(),
    detections: z.object({ car: z.number(), motorbike: z.number() }),
    capacity: z.number(),
    vc_ratio: z.number(),
    timestamp: z.number(),
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

// getLOSLabel imported từ @/lib/los-config (single source of truth)

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
  // Detail modal state: lưu ID thay vì snapshot để tự nhận socket updates
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)
  // Derive live item từ data state theo ID
  const selectedItem = React.useMemo(
    () => selectedItemId ? data.find((d) => d.id === selectedItemId) ?? null : null,
    [selectedItemId, data]
  )

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
          title={DASHBOARD_TERM.table1.title}
          iconBg="bg-teal-500/10"
          iconColor="text-teal-600"
          description={DASHBOARD_TERM.table1.description}
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
            <SearchInput
              placeholder="Tìm kiếm theo tên đường..."
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(value) =>
                table.getColumn("name")?.setFilterValue(value || undefined)
              }
            />
            
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
                        onRowClick={(item) => setSelectedItemId(item.id)}
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
        <CameraDetailSheet
          camera={selectedItem as unknown as CameraData}
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItemId(null)}
        />
      )}
    </Tabs>
  )
}
