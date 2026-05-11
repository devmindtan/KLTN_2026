"use client";
import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChartAreaInteractive } from "@/components/dashboard/overview/chart-area-interactive";
import { DataTable } from "@/components/dashboard/overview/data-table";
import { ForecastAccuracyCard } from "@/components/dashboard/overview/forecast-accuracy-card";
import { SectionCards } from "@/components/dashboard/overview/section-cards";
import { TrafficDensityChart } from "@/components/dashboard/overview/traffic-density-chart";
import { ForecastStatCards } from "@/components/dashboard/forecast/forecast-stat-cards";
import { ForecastRollingChart } from "@/components/dashboard/forecast/forecast-rolling-chart";
import { getForecastRolling } from "@/services/forecast.service";
import type { ForecastRollingResponse } from "@/services/forecast.service";
import { PageHeader } from "@/components/custom/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconDashboard, IconChartBar } from "@tabler/icons-react";
import { DASHBOARD_TERM, CONNECTION_STATUS } from "@/lib/app-constants";
// import { SocketDebug } from "@/components/socket-debug";
import { useSocket } from "@/contexts/SocketContext";

export default function Dashboard() {
  // Lấy dữ liệu từ Global Socket Context
  const { processedCameras, isConnected, forecastVersion } = useSocket();
  const [activeTab, setActiveTab] = useState("overview");
  const [forecastCameraId, setForecastCameraId] = useState("all");

  // ── Shared rolling forecast data – fetch once, pass to cả StatCards + RollingChart ─
  // Đảm bảo cả 2 component dùng CÙNG snapshot data (tránh race condition + logic lệch)
  const [rollingData, setRollingData] =
    useState<ForecastRollingResponse | null>(null);
  useEffect(() => {
    getForecastRolling("all")
      .then(setRollingData)
      .catch((e) => console.error("[Dashboard] rollingData fetch error:", e));
  }, [forecastVersion]);
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-switch tab khi được điều hướng từ nơi khác (ví dụ: chart "Xem chi tiết →")
  // Dùng location.state làm dep để re-fire khi navigate với state mới từ cùng trang.
  useEffect(() => {
    const state = location.state as {
      tab?: string;
      forecastCameraId?: string;
    } | null;
    if (state?.tab) {
      setActiveTab(state.tab);
      if (state.forecastCameraId) {
        setForecastCameraId(state.forecastCameraId);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Calculate aggregate metrics từ processedCameras
  const metrics = useMemo(() => {
    if (processedCameras.length === 0) {
      return {
        totalVehicles: 0,
        totalCars: 0,
        totalMotorbikes: 0,
        avgVehiclesPerCamera: 0,
        activeCameras: 0,
        goodStatus: 0, // free_flow + smooth
        moderateStatus: 0, // moderate
        badStatus: 0, // heavy + congested
        trendingUp: 0,
        trendingDown: 0,
      };
    }

    const totalVehicles = processedCameras.reduce(
      (sum, cam) => sum + cam.totalObjects,
      0,
    );
    const totalCars = processedCameras.reduce(
      (sum, cam) => sum + cam.carCount,
      0,
    );
    const totalMotorbikes = processedCameras.reduce(
      (sum, cam) => sum + cam.motorbikeCount,
      0,
    );
    const activeCameras = processedCameras.length;
    const avgVehiclesPerCamera =
      activeCameras > 0 ? Math.round(totalVehicles / activeCameras) : 0;

    // Level of Service (LOS) status grouping - Dựa trên HIỆN TẠI (current)
    const goodStatus = processedCameras.filter(
      (cam) =>
        cam.status.current === "free_flow" || cam.status.current === "smooth",
    ).length;
    const moderateStatus = processedCameras.filter(
      (cam) => cam.status.current === "moderate",
    ).length;
    const badStatus = processedCameras.filter(
      (cam) =>
        cam.status.current === "heavy" || cam.status.current === "congested",
    ).length;

    const trendingUp = processedCameras.filter(
      (cam) => cam.trend.direction === "increasing",
    ).length;
    const trendingDown = processedCameras.filter(
      (cam) => cam.trend.direction === "decreasing",
    ).length;

    return {
      totalVehicles,
      totalCars,
      totalMotorbikes,
      avgVehiclesPerCamera,
      activeCameras,
      goodStatus,
      moderateStatus,
      badStatus,
      trendingUp,
      trendingDown,
    };
  }, [processedCameras]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconDashboard className="size-5" />}
        title={DASHBOARD_TERM.page_header.title}
        description={DASHBOARD_TERM.page_header.description}
      >
        <Badge
          variant="outline"
          className={
            isConnected
              ? CONNECTION_STATUS.connected.theme
              : CONNECTION_STATUS.disconnected.theme
          }
        >
          <span
            className={`${isConnected ? CONNECTION_STATUS.connected.color : CONNECTION_STATUS.disconnected.color}`}
          />
          {isConnected
            ? CONNECTION_STATUS.connected.label
            : CONNECTION_STATUS.connected.label}
        </Badge>
      </PageHeader>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col gap-4"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <IconDashboard className="size-3.5" />
            {DASHBOARD_TERM.tab1.title}
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5 text-xs">
            <IconChartBar className="size-3.5" />
            {DASHBOARD_TERM.tab2.title}
          </TabsTrigger>
        </TabsList>

        {/* ══════════════ TAB TỔNG QUAN ══════════════ */}
        <TabsContent value="overview" className="mt-0 flex flex-col gap-6">
          {/* Debug Panel - Remove this after debugging */}
          {/* <SocketDebug /> */}
          <SectionCards metrics={metrics} isConnected={isConnected} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartAreaInteractive cameras={processedCameras} />
            </div>
            <ForecastAccuracyCard />
          </div>

          <TrafficDensityChart />

          <DataTable data={processedCameras} />
        </TabsContent>

        {/* ══════════════ TAB DỰ BÁO ══════════════ */}
        <TabsContent value="forecast" className="mt-0 flex flex-col gap-4">
          <ForecastStatCards apiData={rollingData} />
          <ForecastRollingChart
            sharedAllData={rollingData}
            initialCameraId={forecastCameraId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
