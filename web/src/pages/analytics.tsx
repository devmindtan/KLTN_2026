import * as React from "react";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { IconBrain, IconChartBar, IconChevronDown, IconClock, IconInfoCircle, IconTrendingUp } from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";

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
 * Badge cho confidence level
 */
function getConfidenceBadge(level: string) {
  if (level === "High") return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">Cao</Badge>;
  if (level === "Medium") return <Badge variant="secondary">Trung bình</Badge>;
  return <Badge variant="destructive">Thấp</Badge>;
}

/**
 * Chuyển recommendation sang tiếng Việt
 */
function translateRecommendation(rec: string) {
  if (rec === "KEEP") return "Giữ lại";
  if (rec === "OPTIONAL") return "Tùy chọn";
  if (rec === "DROP") return "Loại bỏ";
  return rec;
}

/**
 * Tooltip cho thuật ngữ chuyên ngành
 */
function TermTooltip({ term, description }: { term: string; description: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help text-primary underline decoration-dotted underline-offset-2">
            {term}
            <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
  const [isExplanationOpen, setIsExplanationOpen] = React.useState<boolean>(false);
  const location = useLocation();

  // Scroll tới anchor khi data đã tải xong
  React.useEffect(() => {
    if (!isLoading && location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isLoading, location.hash]);

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
      <PageHeader
        icon={<IconChartBar className="w-5 h-5" />}
        title="Phân tích hiệu suất mô hình"
        description="Theo dõi độ chính xác dự đoán từ dữ liệu lịch sử"
      >
        <Badge variant="outline">Cập nhật gần nhất: {latestGeneratedAt}</Badge>
      </PageHeader>

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
          <Collapsible open={isExplanationOpen} onOpenChange={setIsExplanationOpen}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Giải thích nhanh các chỉ số chính</CardTitle>
                    <CardDescription>
                      Giúp đọc nhanh ý nghĩa và ngưỡng đánh giá của từng metric
                    </CardDescription>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <IconChevronDown className={`h-4 w-4 transition-transform ${isExplanationOpen ? 'rotate-180' : ''}`} />
                      <span className="ml-2">{isExplanationOpen ? 'Thu gọn' : 'Mở rộng'}</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
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
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-semibold">Sai số (Error value)</p>
                    <p className="text-xs text-muted-foreground">Chênh lệch giữa dữ liệu dự đoán và dữ liệu thực tế (actual).</p>
                    <p className="mt-1 text-xs text-muted-foreground">Dùng để đánh giá độ chính xác của từng lần dự đoán.</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-semibold">Dữ liệu đầu vào (Input)</p>
                    <p className="text-xs text-muted-foreground">Số lượng hình ảnh trong bucket thời gian hiện tại.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ít nhất 10 mẫu để dự đoán có độ tin cậy tốt.</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-semibold">Dữ liệu quá khứ (LAG)</p>
                    <p className="text-xs text-muted-foreground">Số lượng hình ảnh trong bucket quá khứ (mốc tương ứng).</p>
                    <p className="mt-1 text-xs text-muted-foreground">Dùng để so sánh với dữ liệu đầu vào, đánh giá tính nhất quán.</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-semibold">Dữ liệu thực tế (Actual)</p>
                    <p className="text-xs text-muted-foreground">Số lượng hình ảnh khi đồng bộ dữ liệu thực tế.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Chênh &gt;5 so với input → error value kém tin cậy.</p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <TermTooltip 
                    term="MAE" 
                    description="Mean Absolute Error - Sai số tuyệt đối trung bình. Đo lường chênh lệch trung bình giữa giá trị dự đoán và thực tế theo số xe." 
                  />
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  <TermTooltip 
                    term="MAPE" 
                    description="Mean Absolute Percentage Error - Sai số phần trăm tuyệt đối trung bình. Tiện ích để so sánh chất lượng dự đoán giữa các camera khác nhau." 
                  />
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  <TermTooltip 
                    term="Accuracy ≤5xe" 
                    description="Tỷ lệ % dự đoán có sai số trong phạm vi ±5 xe. Chiềm 75% trở lên được coi là tốt." 
                  />
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  <TermTooltip 
                    term="Trend Accuracy" 
                    description="Độ chính xác khi dự đoán xu hướng tăng/giảm/ổn định của lưu lượng giao thông. Hữu ích cho việc ra quyết định vận hành." 
                  />
                </CardTitle>
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

          {overall?.prediction_confidence && overall?.error_confidence && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    <TermTooltip 
                      term="Độ tin cậy dự đoán" 
                      description="Đánh giá chất lượng dữ liệu đầu vào (input samples) so với dữ liệu quá khứ (LAG samples) để xác định độ tin cậy của dự đoán." 
                    />
                  </CardTitle>
                  <CardDescription>
                    Đánh giá <TermTooltip term="chất lượng dữ liệu đầu vào" description="Số lượng và tính nhất quán của hình ảnh trong bucket hiện tại." /> so với <TermTooltip term="dữ liệu quá khứ" description="Dữ liệu từ các bucket thời gian trước đây (LAG window)." />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <TermTooltip term="Mức độ" description="Phân loại độ tin cậy: Cao (High), Trung bình (Medium), hoặc Thấp (Low) dựa trên chất lượng và số lượng dữ liệu." />
                    {getConfidenceBadge(overall.prediction_confidence.level)}
                  </div>
                  <div className="flex items-center justify-between">
                    <TermTooltip term="Điểm" description="Điểm số độ tin cậy từ 0-100%. Tính toán dựa trên sự chênh lệch giữa input và LAG samples." />
                    <span className="text-2xl font-bold">{(overall.prediction_confidence.score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <TermTooltip term="Trung bình số lượng dữ liệu đầu vào" description="Số lượng hình ảnh/dữ liệu trung bình trong bucket hiện tại được dùng để tính giá trị dự đoán." />
                      <span className="font-medium">{overall.prediction_confidence.avg_input_samples}</span>
                    </div>
                    <div className="flex justify-between">
                      <TermTooltip term="Trung bình số lượng dữ liệu quá khứ" description="Số lượng hình ảnh trung bình trong bucket quá khứ tương ứng với các mốc dự đoán." />
                      <span className="font-medium">{overall.prediction_confidence.avg_lag_samples}</span>
                    </div>
                    <div className="flex justify-between">
                      <TermTooltip term="Số dữ liệu dự đoán có chất lượng thấp" description="Số lượng dự đoán có dữ liệu đầu vào hoặc dữ liệu quá khứ < 10, dẫn đến độ tin cậy thấp." />
                      <span className="font-medium text-destructive">{overall.prediction_confidence.low_sample_count}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <TermTooltip 
                      term="Độ tin cậy sai số" 
                      description="Đánh giá độ khớp giữa dữ liệu đầu vào khi dự đoán và dữ liệu thực tế khi đồng bộ, ảnh hưởng đến độ tin cậy của error value." 
                    />
                  </CardTitle>
                  <CardDescription>
                    Đánh giá độ khớp dữ liệu khi đồng bộ <TermTooltip term="dữ liệu thực tế" description="Giá trị actual value được lấy từ cơ sở dữ liệu sau khi forecast_for_time đã qua." />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <TermTooltip term="Mức độ" description="Phân loại độ tin cậy của error value: Cao, Trung bình, hoặc Thấp dựa trên độ khớp dữ liệu." />
                    {getConfidenceBadge(overall.error_confidence.level)}
                  </div>
                  <div className="flex items-center justify-between">
                    <TermTooltip term="Điểm" description="Điểm số độ tin cậy từ 0-100%. Tính dựa trên chênh lệch giữa input và sync samples." />
                    <span className="text-2xl font-bold">{(overall.error_confidence.score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <TermTooltip term="Trung bình dữ liệu thực tế" description="Số lượng hình ảnh trung bình trong bucket khi đồng bộ dữ liệu thực tế (actual value) từ cơ sở dữ liệu." />
                      <span className="font-medium">{overall.error_confidence.avg_sync_samples}</span>
                    </div>
                    <div className="flex justify-between">
                      <TermTooltip term="Dữ liệu không khớp (chênh >5)" description="Số lượng dữ liệu có sự chênh lệch >5 mẫu giữa dữ liệu đầu vào và dữ liệu thực tế, dẫn đến sai số kém tin cậy." />
                      <span className="font-medium text-destructive">{overall.error_confidence.mismatched_count}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card id="horizon-comparison">
            <CardHeader>
              <CardTitle>So sánh theo các mốc</CardTitle>
              <CardDescription>
                Hiệu suất dự đoán theo các <TermTooltip term="mốc thời gian (Horizon)" description="Các khoảng thời gian dự đoán: 5, 10, 15, 30, 60 phút. Mỗi mốc có độ chính xác khác nhau." /> (bao gồm độ tin cậy)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <TermTooltip term="Mốc" description="Khoảng thời gian dự đoán tính từ hiện tại (5/10/15/30/60 phút)." />
                    </TableHead>
                    <TableHead>
                      <TermTooltip term="MAE" description="Mean Absolute Error - Sai số tuyệt đối trung bình theo số xe." />
                    </TableHead>
                    <TableHead>
                      <TermTooltip term="Accuracy ≤5xe" description="Tỷ lệ % dự đoán có sai số trong phạm vi ±5 xe." />
                    </TableHead>
                    <TableHead>
                      <TermTooltip term="Độ tin cậy dự đoán" description="Đánh giá chất lượng dữ liệu đầu vào cho mốc này dựa trên sample count." />
                    </TableHead>
                    <TableHead>
                      <TermTooltip term="Khuyến nghị" description="Đề xuất giữ lại (KEEP), tùy chọn (OPTIONAL), hoặc loại bỏ (DROP) mốc dự đoán này." />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestMetrics.by_horizon.map((row) => (
                    <TableRow key={row.horizon_minutes}>
                      <TableCell>{row.horizon_minutes} phút</TableCell>
                      <TableCell>{row.avg_error} xe</TableCell>
                      <TableCell>{row.accuracy_5xe}%</TableCell>
                      <TableCell>
                        {row.prediction_confidence ? (
                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(row.prediction_confidence.level)}
                            <span className="text-xs text-muted-foreground">({(row.prediction_confidence.score * 100).toFixed(0)}%)</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.recommendation === "KEEP" ? "outline" : row.recommendation === "OPTIONAL" ? "secondary" : "destructive"}>
                          {translateRecommendation(row.recommendation ?? "N/A")}
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
                <CardTitle>Top camera tốt nhất</CardTitle>
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
                <CardTitle>Camera cần cải thiện</CardTitle>
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
              <CardTitle>Lịch sử snapshot gần đây</CardTitle>
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
