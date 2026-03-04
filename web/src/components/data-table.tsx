import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type VisibilityState,
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
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  GripVerticalIcon,
  LoaderIcon,
  MoreVerticalIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SearchIcon,
  FilterIcon,
  XIcon,
} from "lucide-react"
import { IconCar, IconMotorbike } from "@tabler/icons-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
// import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
  SheetTrigger,
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
  trend: z.string(),
  forecasts: z.object({
    "5m": z.number(),
    "10m": z.number(),
    "15m": z.number(),
    "30m": z.number(),
    "60m": z.number(),
  }),
  lastPredicted: z.string(),
  calculation: z.object({
    predicted_volume: z.number(),
    capacity: z.number(),
    vc_ratio: z.number(),
  }).optional(),
})

// Helper function to get trend explanation
const getTrendExplanation = (trend: string) => {
  switch (trend) {
    case "increasing":
      return "Lưu lượng dự báo tăng >10% so với hiện tại";
    case "decreasing":
      return "Lưu lượng dự báo giảm >10% so với hiện tại";
    case "stable":
      return "Lưu lượng dự báo thay đổi <10% (ổn định)";
    default:
      return "Không có dữ liệu xu hướng";
  }
};

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: "drag",
    header: () => <div className="hidden lg:block" />,
    cell: ({ row }) => <div className="hidden lg:block"><DragHandle id={row.original.id} /></div>,
  },
  {
    accessorKey: "shortId",
    header: () => <div className="hidden sm:block">Mã Camera</div>,
    cell: ({ row }) => (
      <div className="hidden sm:block">
        <TableCellViewer item={row.original} />
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Vị Trí",
    cell: ({ row }) => (
      <div className="max-w-[250px] text-sm">
        <div className="font-medium">{row.original.name}</div>
        <div className="text-xs text-muted-foreground sm:hidden">ID: {row.original.shortId}</div>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "totalObjects",
    header: () => <div className="hidden xl:block">Tổng Số Xe</div>,
    cell: ({ row }) => (
      <div className="hidden xl:flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {row.original.totalObjects}
        </span>
        <Badge variant="outline" className="px-1.5 text-xs flex items-center gap-1">
          <IconCar className="size-3 text-blue-500 shrink-0" />{row.original.carCount}
          <span className="mx-1 text-muted-foreground/50">•</span>
          <IconMotorbike className="size-3 text-orange-500 shrink-0" />{row.original.motorbikeCount}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Trạng Thái",
    cell: ({ row }) => {
      const statusObj = row.original.status;
      
      // Helper function để render badge
      const renderStatusBadge = (status: string, label: string) => {
        let badgeClass = "bg-gray-500/10 text-gray-600";
        let statusText = "Không rõ";
        let icon = <LoaderIcon className="size-3" />;

        switch (status) {
          case "free_flow":
            badgeClass = "bg-green-500/10 text-green-600";
            statusText = "Thông thoáng";
            icon = <CheckCircle2Icon className="size-3" />;
            break;
          case "smooth":
            badgeClass = "bg-blue-500/10 text-blue-600";
            statusText = "Ổn định";
            icon = <CheckCircle2Icon className="size-3" />;
            break;
          case "moderate":
            badgeClass = "bg-yellow-500/10 text-yellow-600";
            statusText = "Trung bình";
            icon = <LoaderIcon className="size-3" />;
            break;
          case "heavy":
            badgeClass = "bg-orange-500/10 text-orange-600";
            statusText = "Nặng";
            icon = <LoaderIcon className="size-3" />;
            break;
          case "congested":
            badgeClass = "bg-red-500/10 text-red-600";
            statusText = "Ùn tắc";
            icon = <LoaderIcon className="size-3" />;
            break;
        }

        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">{label}</span>
            <Badge
              variant="outline"
              className={`flex gap-1 px-2 py-1 ${badgeClass}`}
            >
              {icon}
              {statusText}
            </Badge>
          </div>
        );
      };

      return (
        <div className="flex flex-col gap-2">
          {renderStatusBadge(statusObj.current, "Hiện tại")}
          {renderStatusBadge(statusObj.forecast, "Dự báo 5p")}
        </div>
      );
    },
  },
  {
    accessorKey: "trend",
    header: "Xu Hướng",
    cell: ({ row }) => {
      const trend = row.original.trend;
      let trendText = "Ổn định";
      let trendClass = "text-gray-600";
      let icon = null;

      if (trend === "increasing") {
        trendText = "Tăng";
        trendClass = "text-orange-600";
        icon = <TrendingUpIcon className="size-3" />;
      } else if (trend === "decreasing") {
        trendText = "Giảm";
        trendClass = "text-green-600";
        icon = <TrendingDownIcon className="size-3" />;
      }

      return (
        <Badge
          variant="outline"
          className={`flex gap-1 px-2 ${trendClass}`}
        >
          {icon}
          {trendText}
        </Badge>
      );
    },
  },
  {
    accessorKey: "forecasts.5m",
    header: () => <div className="w-full text-center">Dự Báo 5'</div>,
    cell: ({ row }) => (
      <div className="text-center font-semibold tabular-nums">
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
  {
    id: "actions",
    header: () => <div className="hidden lg:block" />,
    cell: () => (
      <div className="hidden lg:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
              size="icon"
            >
              <MoreVerticalIcon />
              <span className="sr-only">Mở menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem>Xem Chi Tiết</DropdownMenuItem>
            <DropdownMenuItem>Xem Lịch Sử</DropdownMenuItem>
            <DropdownMenuItem>Tải Ảnh</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">Đặt Lại</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
]

function DraggableRow({ row, onRowClick }: { row: Row<z.infer<typeof schema>>, onRowClick: (item: z.infer<typeof schema>) => void }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 cursor-pointer hover:bg-muted/50"
      onClick={() => onRowClick(row.original)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} onClick={(e) => {
          // Ngăn trigger row click khi click vào checkbox, actions, shortId, hoặc drag handle
          if (cell.column.id === 'select' || cell.column.id === 'actions' || cell.column.id === 'shortId' || cell.column.id === 'drag') {
            e.stopPropagation();
          }
        }}>
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
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
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
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  // Sync data với initialData khi props thay đổi (từ socket updates)
  React.useEffect(() => {
    setData(initialData)
  }, [initialData])

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs
      defaultValue="cameras"
      className="flex w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Nguồn camera trực tiếp</h2>
          <Badge variant="secondary" className="flex h-5 items-center justify-center rounded-full px-2">
            {table.getFilteredRowModel().rows.length} camera
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">Tùy chỉnh cột</span>
                <span className="lg:hidden">Cột</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="px-4 lg:px-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search by name */}
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên hoặc vị trí..."
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
                <SelectItem value="smooth">Ổn định</SelectItem>
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
      </div>      
      
      <TabsContent
        value="cameras"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
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
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow 
                        key={row.id} 
                        row={row} 
                        onRowClick={(item) => setSelectedItem(item)}
                      />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      Không có kết quả.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
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

const forecastChartConfig = {
  vehicles: {
    label: "Vehicles",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile()

  // Transform forecasts to chart data
  const forecastData = [
    { time: "5 min", vehicles: Math.round(item.forecasts["5m"]) },
    { time: "10 min", vehicles: Math.round(item.forecasts["10m"]) },
    { time: "15 min", vehicles: Math.round(item.forecasts["15m"]) },
    { time: "30 min", vehicles: Math.round(item.forecasts["30m"]) },
    { time: "60 min", vehicles: Math.round(item.forecasts["60m"]) },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left font-mono text-sm text-foreground">
          {item.shortId}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col overflow-y-auto">
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
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tổng Phương Tiện</Label>
              <div className="text-2xl font-bold tabular-nums">{item.totalObjects}</div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Trạng Thái</Label>
              <div className="flex flex-col gap-1.5">
                <Badge
                  variant="outline"
                  className={`w-fit ${
                    item.status.current === "free_flow" ? "bg-green-500/10 text-green-600" :
                    item.status.current === "smooth" ? "bg-blue-500/10 text-blue-600" :
                    item.status.current === "moderate" ? "bg-yellow-500/10 text-yellow-600" :
                    item.status.current === "heavy" ? "bg-orange-500/10 text-orange-600" :
                    item.status.current === "congested" ? "bg-red-500/10 text-red-600" :
                    "bg-gray-500/10 text-gray-600"
                  }`}
                >
                  {
                    item.status.current === "free_flow" ? "Thông thoáng" :
                    item.status.current === "smooth" ? "Ổn định" :
                    item.status.current === "moderate" ? "Trung bình" :
                    item.status.current === "heavy" ? "Nặng" :
                    item.status.current === "congested" ? "Ùn tắc" : item.status.current
                  }
                </Badge>
                <div className="text-[10px] text-muted-foreground border-t pt-1">Dự báo 5p:</div>
                <Badge
                  variant="outline"
                  className={`w-fit ${
                    item.status.forecast === "free_flow" ? "bg-green-500/10 text-green-600" :
                    item.status.forecast === "smooth" ? "bg-blue-500/10 text-blue-600" :
                    item.status.forecast === "moderate" ? "bg-yellow-500/10 text-yellow-600" :
                    item.status.forecast === "heavy" ? "bg-orange-500/10 text-orange-600" :
                    item.status.forecast === "congested" ? "bg-red-500/10 text-red-600" :
                    "bg-gray-500/10 text-gray-600"
                  }`}
                >
                  {
                    item.status.forecast === "free_flow" ? "Thông thoáng" :
                    item.status.forecast === "smooth" ? "Ổn định" :
                    item.status.forecast === "moderate" ? "Trung bình" :
                    item.status.forecast === "heavy" ? "Nặng" :
                    item.status.forecast === "congested" ? "Ùn tắc" : item.status.forecast
                  }
                </Badge>
                {item.calculation && (
                  <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-1">
                    <div className="font-mono">
                      {Math.round(item.calculation.predicted_volume)} / {Math.round(item.calculation.capacity)} xe
                      <span className="ml-1">({Math.round(item.calculation.vc_ratio * 100)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Ô tô</Label>
              <div className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <IconCar className="size-5 text-blue-500 shrink-0" />
                {item.carCount}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Xe máy</Label>
              <div className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <IconMotorbike className="size-5 text-orange-500 shrink-0" />
                {item.motorbikeCount}
              </div>
            </div>
          </div>

          <Separator />

          {/* Forecast Chart */}
          {!isMobile && forecastData.some(d => d.vehicles > 0) && (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Dự báo luồng giao thông</Label>
                <ChartContainer config={forecastChartConfig} className="h-[200px]">
                  <AreaChart
                    accessibilityLayer
                    data={forecastData}
                    margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Area
                      dataKey="vehicles"
                      type="monotone"
                      fill="var(--color-vehicles)"
                      fillOpacity={0.4}
                      stroke="var(--color-vehicles)"
                    />
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
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["5m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">15 phút</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["15m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">60 phút</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["60m"])}</span>
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
                  {item.trend === "increasing" ? (
                    <TrendingUpIcon className="size-3 text-orange-500" />
                  ) : item.trend === "decreasing" ? (
                    <TrendingDownIcon className="size-3 text-green-500" />
                  ) : null}
                  {item.trend === "increasing" ? "Tăng" : item.trend === "decreasing" ? "Giảm" : "Ổn định"}
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
              <Label className="text-xs text-muted-foreground">Vị trí</Label>
              <span className="text-xs">{item.name}</span>
            </div>
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

// Separate controlled modal component for row click
function TableCellViewerModal({ item, open, onOpenChange }: { item: z.infer<typeof schema>, open: boolean, onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile()

  // Transform forecasts to chart data
  const forecastData = [
    { time: "5 phút", vehicles: Math.round(item.forecasts["5m"]) },
    { time: "10 phút", vehicles: Math.round(item.forecasts["10m"]) },
    { time: "15 phút", vehicles: Math.round(item.forecasts["15m"]) },
    { time: "30 phút", vehicles: Math.round(item.forecasts["30m"]) },
    { time: "60 phút", vehicles: Math.round(item.forecasts["60m"]) },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto">
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
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tổng Phương Tiện</Label>
              <div className="text-2xl font-bold tabular-nums">{item.totalObjects}</div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Trạng Thái</Label>
              <div className="flex flex-col gap-1.5">
                <Badge
                  variant="outline"
                  className={`w-fit ${
                    item.status.current === "free_flow" ? "bg-green-500/10 text-green-600" :
                    item.status.current === "smooth" ? "bg-blue-500/10 text-blue-600" :
                    item.status.current === "moderate" ? "bg-yellow-500/10 text-yellow-600" :
                    item.status.current === "heavy" ? "bg-orange-500/10 text-orange-600" :
                    item.status.current === "congested" ? "bg-red-500/10 text-red-600" :
                    "bg-gray-500/10 text-gray-600"
                  }`}
                >
                  {
                    item.status.current === "free_flow" ? "Thông thoáng" :
                    item.status.current === "smooth" ? "Ổn định" :
                    item.status.current === "moderate" ? "Trung bình" :
                    item.status.current === "heavy" ? "Nặng" :
                    item.status.current === "congested" ? "Ùn tắc" : item.status.current
                  }
                </Badge>
                <div className="text-[10px] text-muted-foreground border-t pt-1">Dự báo 5p:</div>
                <Badge
                  variant="outline"
                  className={`w-fit ${
                    item.status.forecast === "free_flow" ? "bg-green-500/10 text-green-600" :
                    item.status.forecast === "smooth" ? "bg-blue-500/10 text-blue-600" :
                    item.status.forecast === "moderate" ? "bg-yellow-500/10 text-yellow-600" :
                    item.status.forecast === "heavy" ? "bg-orange-500/10 text-orange-600" :
                    item.status.forecast === "congested" ? "bg-red-500/10 text-red-600" :
                    "bg-gray-500/10 text-gray-600"
                  }`}
                >
                  {
                    item.status.forecast === "free_flow" ? "Thông thoáng" :
                    item.status.forecast === "smooth" ? "Ổn định" :
                    item.status.forecast === "moderate" ? "Trung bình" :
                    item.status.forecast === "heavy" ? "Nặng" :
                    item.status.forecast === "congested" ? "Ùn tắc" : item.status.forecast
                  }
                </Badge>
                {item.calculation && (
                  <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-1">
                    <div className="font-mono">
                      {Math.round(item.calculation.predicted_volume)} / {Math.round(item.calculation.capacity)} xe
                      <span className="ml-1">({Math.round(item.calculation.vc_ratio * 100)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Ô tô</Label>
              <div className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <IconCar className="size-5 text-blue-500 shrink-0" />
                {item.carCount}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Xe máy</Label>
              <div className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <IconMotorbike className="size-5 text-orange-500 shrink-0" />
                {item.motorbikeCount}
              </div>
            </div>
          </div>

          <Separator />

          {/* Forecast Chart */}
          {!isMobile && forecastData.some(d => d.vehicles > 0) && (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Dự báo luồng giao thông</Label>
                <ChartContainer config={forecastChartConfig} className="h-[200px]">
                  <AreaChart
                    accessibilityLayer
                    data={forecastData}
                    margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Area
                      dataKey="vehicles"
                      type="monotone"
                      fill="var(--color-vehicles)"
                      fillOpacity={0.4}
                      stroke="var(--color-vehicles)"
                    />
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
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["5m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">15 phút</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["15m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">60 phút</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["60m"])}</span>
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
                  {item.trend === "increasing" ? (
                    <TrendingUpIcon className="size-3 text-orange-500" />
                  ) : item.trend === "decreasing" ? (
                    <TrendingDownIcon className="size-3 text-green-500" />
                  ) : null}
                  {item.trend === "increasing" ? "Tăng" : item.trend === "decreasing" ? "Giảm" : "Ổn định"}
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
              <Label className="text-xs text-muted-foreground">Vị trí</Label>
              <span className="text-xs">{item.name}</span>
            </div>
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
