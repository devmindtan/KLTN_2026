import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getLatestModelMetrics,
  getModelMetricsHistory,
  type ModelMetricsHistoryRow,
} from "@/services/model-metrics.service";
import { getAllCameras } from "@/services/camera.service";
import {
  IconChartBar,
  IconClock,
  IconRefresh,
  IconDashboard,
  IconChartLine,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { useLoading } from "@/contexts/LoadingContext";
import { clearApiCache } from "@/lib/apiFetch";
import { OverviewStats } from "@/components/analytics/overview-stats";
import { CameraRanking } from "@/components/analytics/camera-ranking";
import { HistoryTable } from "@/components/analytics/history-table";
import { DataCoverageCard } from "@/components/analytics/data-coverage-card";
import { ConfidenceCards } from "@/components/analytics/confidence-cards";
import { TrendAccuracyCard } from "@/components/analytics/trend-accuracy-card";
import { HorizonTableCard } from "@/components/analytics/horizon-table-card";
import { ConfidenceDistributionCard } from "@/components/analytics/confidence-distribution-card";

// ─── Helper ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

/**
 * Trang phân tích hiệu suất mô hình dự đoán lưu lượng
 */
export default function PredictiveAnalytics() {
  const [latestMetrics, setLatestMetrics] =
    React.useState<ModelMetricsHistoryRow | null>(null);
  const [historyMetrics, setHistoryMetrics] = React.useState<
    ModelMetricsHistoryRow[]
  >([]);
  const [cameraNameMap, setCameraNameMap] = React.useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState("overview");
  const location = useLocation();
  const navigate = useNavigate();
  const { startLoading, stopLoading } = useLoading();

  // Auto-switch tab khi được điều hướng từ nơi khác
  React.useEffect(() => {
    const state = location.state as { tab?: string } | null;
    if (state?.tab) {
      setActiveTab(state.tab);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Scroll tới anchor khi data đã tải xong
  React.useEffect(() => {
    if (!isLoading && location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isLoading, location.hash]);

  React.useEffect(() => {
    let isMounted = true;

    /**
     * Tải dữ liệu metrics mới nhất và lịch sử cho trang analytics
     */
    async function loadAnalyticsData() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        startLoading();

        const [latest, history, cameras] = await Promise.all([
          getLatestModelMetrics(),
          getModelMetricsHistory(20),
          getAllCameras(),
        ]);

        if (!isMounted) return;
        setLatestMetrics(latest);
        setHistoryMetrics(history);

        if (Array.isArray(cameras)) {
          const nextMap = cameras.reduce<Record<string, string>>(
            (acc, camera) => {
              acc[camera.cam_id] = camera.display_name;
              return acc;
            },
            {},
          );
          setCameraNameMap(nextMap);
        }
      } catch {
        if (isMounted)
          setErrorMessage("Không thể tải dữ liệu phân tích từ máy chủ");
      } finally {
        stopLoading();
        if (isMounted) setIsLoading(false);
      }
    }

    loadAnalyticsData();
    return () => {
      isMounted = false;
    };
  }, [startLoading, stopLoading, refreshKey]);

  const overall = latestMetrics?.overall;
  const trend = latestMetrics?.trend_accuracy;
  const dataCoverage = latestMetrics?.data_coverage;
  const dist = latestMetrics?.confidence_distribution;
  const latestGeneratedAt = latestMetrics
    ? fmtDate(latestMetrics.generated_at)
    : "-";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconChartBar className="w-5 h-5" />}
        title="Phân tích hiệu suất dự đoán"
        description="Đánh giá độ chính xác mô hình theo mốc thời gian, máy quay và xu hướng lưu lượng"
      >
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400"
        >
          <IconClock className="size-3 mr-1" />
          {latestGeneratedAt}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearApiCache(/\/api\/model-metrics|\/api\/cameras/);
            setRefreshKey((k) => k + 1);
          }}
          disabled={isLoading}
          className="gap-1.5"
        >
          <IconRefresh
            className={`size-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Làm mới
        </Button>
      </PageHeader>

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
              Chưa có dữ liệu metrics. Hãy chạy model-performance để tạo
              snapshot lịch sử.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !errorMessage && latestMetrics && overall && trend && (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col gap-4"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <IconDashboard className="size-3.5" />
              Số liệu tổng quan
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-1.5 text-xs">
              <IconChartLine className="size-3.5" />
              Số liệu chi tiết
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════
              TAB: TỔNG QUAN — Metrics chính + Top camera + Lịch sử
          ═══════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="mt-0 flex flex-col gap-6">
            <OverviewStats
              metrics={latestMetrics}
              dataCoverage={dataCoverage}
            />

            <CameraRanking
              bestCameras={latestMetrics.camera_ranking.best}
              worstCameras={latestMetrics.camera_ranking.worst}
              cameraNameMap={cameraNameMap}
            />

            <HistoryTable history={historyMetrics} />
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════
              TAB: CHI TIẾT — Breakdown metrics theo horizon + confidence
          ═══════════════════════════════════════════════════════ */}
          <TabsContent value="details" className="mt-0 flex flex-col gap-4">
            {dataCoverage && <DataCoverageCard dataCoverage={dataCoverage} />}

            {overall.prediction_confidence && overall.error_confidence && (
              <ConfidenceCards
                predictionConfidence={overall.prediction_confidence}
                errorConfidence={overall.error_confidence}
              />
            )}

            <TrendAccuracyCard
              trendAccuracy={trend}
              periodDays={latestMetrics.period_days}
            />

            <HorizonTableCard horizons={latestMetrics.by_horizon} />

            {dist && <ConfidenceDistributionCard distribution={dist} />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
