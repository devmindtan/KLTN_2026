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
  PlusIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// import { Input } from "@/components/ui/input"
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
  totalObjects: z.number(),
  carCount: z.number(),
  motorbikeCount: z.number(),
  imageUrl: z.string(),
  lastUpdated: z.string(),
  status: z.string(),
  trend: z.string(),
  forecasts: z.object({
    "5m": z.number(),
    "10m": z.number(),
    "15m": z.number(),
    "30m": z.number(),
    "60m": z.number(),
  }),
  lastPredicted: z.string(),
})

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
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "shortId",
    header: "Camera ID",
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  },
  {
    accessorKey: "totalObjects",
    header: "Total Vehicles",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {row.original.totalObjects}
        </span>
        <Badge variant="outline" className="px-1.5 text-xs">
          🚗 {row.original.carCount} • 🏍️ {row.original.motorbikeCount}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={`flex gap-1 px-2 py-1 ${row.original.status === "clear"
          ? "bg-green-500/10 text-green-600"
          : row.original.status === "congestion"
            ? "bg-red-500/10 text-red-600"
            : "bg-gray-500/10 text-gray-600"
          }`}
      >
        {row.original.status === "clear" ? (
          <CheckCircle2Icon className="size-3" />
        ) : (
          <LoaderIcon className="size-3" />
        )}
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "trend",
    header: "Trend",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={`flex gap-1 px-2 ${row.original.trend === "increasing"
          ? "text-orange-600"
          : row.original.trend === "decreasing"
            ? "text-green-600"
            : "text-gray-600"
          }`}
      >
        {row.original.trend === "increasing" ? (
          <TrendingUpIcon className="size-3" />
        ) : row.original.trend === "decreasing" ? (
          <TrendingDownIcon className="size-3" />
        ) : null}
        {row.original.trend}
      </Badge>
    ),
  },
  {
    accessorKey: "forecasts.5m",
    header: () => <div className="w-full text-center">5min Forecast</div>,
    cell: ({ row }) => (
      <div className="text-center font-semibold tabular-nums">
        {Math.round(row.original.forecasts["5m"])}
      </div>
    ),
  },
  {
    accessorKey: "lastUpdated",
    header: "Last Updated",
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground">
        {row.original.lastUpdated
          ? new Date(row.original.lastUpdated).toLocaleString()
          : "N/A"}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
            size="icon"
          >
            <MoreVerticalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>View History</DropdownMenuItem>
          <DropdownMenuItem>Download Image</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600">Reset Data</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
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
  const [rowSelection, setRowSelection] = React.useState({})
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
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

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
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
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
          <h2 className="text-lg font-semibold">Live Camera Feed</h2>
          <Badge variant="secondary" className="flex h-5 items-center justify-center rounded-full px-2">
            {table.getFilteredRowModel().rows.length} cameras
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
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
          <Button variant="outline" size="sm">
            <PlusIcon />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
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
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
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
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
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
          Camera {item.shortId}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col overflow-y-auto">
        <SheetHeader className="gap-1">
          <SheetTitle>Camera {item.shortId}</SheetTitle>
          <SheetDescription>
            Detailed traffic information and predictions
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
              <Label className="text-xs text-muted-foreground">Total Vehicles</Label>
              <div className="text-2xl font-bold tabular-nums">{item.totalObjects}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Badge
                variant="outline"
                className={`w-fit ${item.status === "clear"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
                  }`}
              >
                {item.status}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Cars</Label>
              <div className="text-xl font-semibold tabular-nums">🚗 {item.carCount}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Motorbikes</Label>
              <div className="text-xl font-semibold tabular-nums">🏍️ {item.motorbikeCount}</div>
            </div>
          </div>

          <Separator />

          {/* Forecast Chart */}
          {!isMobile && forecastData.some(d => d.vehicles > 0) && (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Traffic Forecast</Label>
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
            <Label className="text-sm font-medium">Predicted Vehicle Count</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">5 min</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["5m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">15 min</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["15m"])}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">60 min</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(item.forecasts["60m"])}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Additional Info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Trend</Label>
              <Badge variant="outline" className="flex gap-1">
                {item.trend === "increasing" ? (
                  <TrendingUpIcon className="size-3 text-orange-500" />
                ) : item.trend === "decreasing" ? (
                  <TrendingDownIcon className="size-3 text-green-500" />
                ) : null}
                {item.trend}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Last Updated</Label>
              <span className="text-xs">
                {item.lastUpdated
                  ? new Date(item.lastUpdated).toLocaleString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Last Predicted</Label>
              <span className="text-xs">
                {item.lastPredicted
                  ? new Date(item.lastPredicted).toLocaleString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Camera ID</Label>
              <span className="font-mono text-xs">{item.id}</span>
            </div>
          </div>
        </div>
        <SheetFooter className="mt-auto">
          <SheetClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
