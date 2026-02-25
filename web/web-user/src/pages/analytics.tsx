import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getLatestModelMetrics,
  getModelMetricsHistory,
  type CameraRankingItem,
  type ModelMetricsHistoryRow,
} from "@/services/model-metrics.service";
import { getAllCameras } from "@/services/camera.service";
import { IconBrain, IconChartBar, IconClock, IconTrendingUp } from "@tabler/icons-react";

/**
 * Định dạng thời gian cho giao diện
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Trả badge theo chất lượng error metric
 */
function getQualityBadge(value: number, type: "mae" | "mape" | "accuracy") {
  if (type === "accuracy") {
    if (value >= 75) return <Badge variant="outline">Tốt</Badge>;
    if (value >= 60) return <Badge variant="outline">Trung bình</Badge>;
    return <Badge variant="destructive">Cần cải thiện</Badge>;
  }

  if (type === "mae") {
    if (value < 5) return <Badge variant="outline">Tốt</Badge>;
    if (value <= 10) return <Badge variant="outline">Trung bình</Badge>;
    return <Badge variant="destructive">Kém</Badge>;
  }

  if (value < 10) return <Badge variant="outline">Xuất sắc</Badge>;
  if (value <= 20) return <Badge variant="outline">Tốt</Badge>;
  return <Badge variant="destructive">Cần cải thiện</Badge>;
}

/**
 * Render danh sách camera ranking
 */
function CameraRankingList({
  items,
  emptyMessage,
  cameraNameMap,
}: {
  items: CameraRankingItem[];
  emptyMessage: string;
  cameraNameMap: Record<string, string>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.camera_id}-${index}`} className="flex items-center justify-between border-b pb-2 last:border-0">
          <div>
            <p className="text-sm font-medium">{cameraNameMap[item.camera_id] ?? `Camera ${item.camera_id.slice(-6)}`}</p>
            <p className="text-xs text-muted-foreground">ID: {item.camera_id.slice(-6)} • {item.predictions_count} lượt đánh giá</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">MAE: {item.avg_error}</p>
            <p className="text-xs text-muted-foreground">Acc≤5xe: {item.accuracy_5xe}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PredictiveAnalytics() {
  const [latestMetrics, setLatestMetrics] = React.useState<ModelMetricsHistoryRow | null>(null);
  const [historyMetrics, setHistoryMetrics] = React.useState<ModelMetricsHistoryRow[]>([]);
  const [cameraNameMap, setCameraNameMap] = React.useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  React.useEffect(() => {
    /**
     * Tải dữ liệu metrics mới nhất và lịch sử cho trang analytics
     */
    async function loadAnalyticsData() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const [latest, history, cameras] = await Promise.all([
          getLatestModelMetrics(),
          getModelMetricsHistory(20),
          getAllCameras(),
        ]);

        setLatestMetrics(latest);
        setHistoryMetrics(history);

        if (Array.isArray(cameras)) {
          const nextMap = cameras.reduce<Record<string, string>>((acc, camera) => {
            acc[camera.cam_id] = camera.display_name;
            return acc;
          }, {});
          setCameraNameMap(nextMap);
        }
      } catch {
        setErrorMessage("Không thể tải dữ liệu phân tích từ backend");
      } finally {
        setIsLoading(false);
      }
    }

    loadAnalyticsData();
  }, []);

  const overall = latestMetrics?.overall;
  const trendAccuracy = latestMetrics?.trend_accuracy?.trend_accuracy ?? 0;
  const latestGeneratedAt = latestMetrics ? formatDateTime(latestMetrics.generated_at) : "-";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phân Tích Hiệu Suất Mô Hình</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi độ chính xác dự đoán từ dữ liệu lịch sử
          </p>
        </div>
        <Badge variant="outline">Cập nhật gần nhất: {latestGeneratedAt}</Badge>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu phân tích...</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && errorMessage && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !errorMessage && !latestMetrics && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu metrics. Hãy chạy model-performance để tạo snapshot lịch sử.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !errorMessage && latestMetrics && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Giải thích nhanh các chỉ số chính</CardTitle>
              <CardDescription>
                Giúp đọc nhanh ý nghĩa và ngưỡng đánh giá của từng metric
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold">MAE (Mean Absolute Error)</p>
                <p className="text-xs text-muted-foreground">Sai số tuyệt đối trung bình theo số xe. Càng thấp càng tốt.</p>
                <p className="mt-1 text-xs text-muted-foreground">Ngưỡng: Tốt &lt; 5 xe • Trung bình 5-10 xe • Kém &gt; 10 xe</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold">MAPE (Mean Absolute Percentage Error)</p>
                <p className="text-xs text-muted-foreground">Sai số phần trăm trung bình. Dễ so sánh chất lượng giữa các camera.</p>
                <p className="mt-1 text-xs text-muted-foreground">Ngưỡng: Xuất sắc &lt; 10% • Tốt 10-20% • Cần cải thiện &gt; 20%</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold">Accuracy ≤5xe</p>
                <p className="text-xs text-muted-foreground">Tỷ lệ dự đoán có sai số trong phạm vi ±5 xe.</p>
                <p className="mt-1 text-xs text-muted-foreground">Ngưỡng: Tốt ≥ 75% • Trung bình 60-74% • Cần cải thiện &lt; 60%</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold">Trend Accuracy</p>
                <p className="text-xs text-muted-foreground">Độ đúng khi dự đoán xu hướng tăng/giảm/ổn định của lưu lượng.</p>
                <p className="mt-1 text-xs text-muted-foreground">Dùng để đánh giá mức tin cậy cho quyết định vận hành theo xu hướng.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MAE</CardTitle>
                <IconChartBar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overall?.mae ?? 0} xe</div>
                <div className="mt-2">{getQualityBadge(overall?.mae ?? 0, "mae")}</div>
                <p className="mt-2 text-xs text-muted-foreground">Sai số tuyệt đối trung bình</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MAPE</CardTitle>
                <IconBrain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overall?.mape ?? 0}%</div>
                <div className="mt-2">{getQualityBadge(overall?.mape ?? 0, "mape")}</div>
                <p className="mt-2 text-xs text-muted-foreground">Sai số phần trăm trung bình</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Accuracy ≤5xe</CardTitle>
                <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overall?.accuracy_5xe ?? 0}%</div>
                <div className="mt-2">{getQualityBadge(overall?.accuracy_5xe ?? 0, "accuracy")}</div>
                <p className="mt-2 text-xs text-muted-foreground">Tỷ lệ dự đoán trong ±5 xe</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trend Accuracy</CardTitle>
                <IconClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trendAccuracy}%</div>
                <p className="text-xs text-muted-foreground">
                  {latestMetrics.trend_accuracy.correct_predictions}/{latestMetrics.trend_accuracy.total_checks} lần đúng xu hướng
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Độ chính xác dự đoán xu hướng</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>So sánh theo Horizon</CardTitle>
              <CardDescription>
                Hiệu suất dự đoán theo các mốc 5/10/15/30/60 phút
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horizon</TableHead>
                    <TableHead>MAE</TableHead>
                    <TableHead>Accuracy ≤5xe</TableHead>
                    <TableHead>Khuyến nghị</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestMetrics.by_horizon.map((row) => (
                    <TableRow key={row.horizon_minutes}>
                      <TableCell>{row.horizon_minutes} phút</TableCell>
                      <TableCell>{row.avg_error} xe</TableCell>
                      <TableCell>{row.accuracy_5xe}%</TableCell>
                      <TableCell>
                        <Badge variant={row.recommendation === "KEEP" ? "outline" : row.recommendation === "OPTIONAL" ? "secondary" : "destructive"}>
                          {row.recommendation ?? "N/A"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Camera Tốt Nhất</CardTitle>
              </CardHeader>
              <CardContent>
                <CameraRankingList
                  items={latestMetrics.camera_ranking.best}
                  emptyMessage="Chưa có dữ liệu top camera tốt nhất"
                  cameraNameMap={cameraNameMap}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Camera Cần Cải Thiện</CardTitle>
              </CardHeader>
              <CardContent>
                <CameraRankingList
                  items={latestMetrics.camera_ranking.worst}
                  emptyMessage="Chưa có dữ liệu camera cần cải thiện"
                  cameraNameMap={cameraNameMap}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lịch sử Snapshot gần đây</CardTitle>
              <CardDescription>
                Dữ liệu được lưu định kỳ để hiển thị quá khứ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời điểm</TableHead>
                    <TableHead>MAE</TableHead>
                    <TableHead>MAPE</TableHead>
                    <TableHead>Accuracy ≤5xe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyMetrics.slice(0, 10).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDateTime(row.generated_at)}</TableCell>
                      <TableCell>{row.overall?.mae ?? 0} xe</TableCell>
                      <TableCell>{row.overall?.mape ?? 0}%</TableCell>
                      <TableCell>{row.overall?.accuracy_5xe ?? 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
