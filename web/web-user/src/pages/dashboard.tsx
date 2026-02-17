"use client";
import { useMemo } from "react";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
// import { SocketDebug } from "@/components/socket-debug";
import { useSocket } from "@/contexts/SocketContext";

export default function Dashboard() {
  // Lấy dữ liệu từ Global Socket Context
  const { processedCameras, isConnected } = useSocket();

  // Calculate aggregate metrics từ processedCameras
  const metrics = useMemo(() => {
    if (processedCameras.length === 0) {
      return {
        totalVehicles: 0,
        totalCars: 0,
        totalMotorbikes: 0,
        avgVehiclesPerCamera: 0,
        activeCameras: 0,
        goodStatus: 0,        // free_flow + smooth
        moderateStatus: 0,    // moderate
        badStatus: 0,         // heavy + congested
        trendingUp: 0,
        trendingDown: 0,
      };
    }

    const totalVehicles = processedCameras.reduce(
      (sum, cam) => sum + cam.totalObjects,
      0
    );
    const totalCars = processedCameras.reduce((sum, cam) => sum + cam.carCount, 0);
    const totalMotorbikes = processedCameras.reduce(
      (sum, cam) => sum + cam.motorbikeCount,
      0
    );
    const activeCameras = processedCameras.length;
    const avgVehiclesPerCamera =
      activeCameras > 0 ? Math.round(totalVehicles / activeCameras) : 0;

    // Level of Service (LOS) status grouping - Dựa trên HIỆN TẠI (current)
    const goodStatus = processedCameras.filter(
      (cam) => cam.status.current === "free_flow" || cam.status.current === "smooth"
    ).length;
    const moderateStatus = processedCameras.filter(
      (cam) => cam.status.current === "moderate"
    ).length;
    const badStatus = processedCameras.filter(
      (cam) => cam.status.current === "heavy" || cam.status.current === "congested"
    ).length;

    const trendingUp = processedCameras.filter(
      (cam) => cam.trend === "increasing"
    ).length;
    const trendingDown = processedCameras.filter(
      (cam) => cam.trend === "decreasing"
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
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Debug Panel - Remove this after debugging */}
          {/* <div className="px-4 lg:px-6"> */}
          {/*   <SocketDebug /> */}
          {/* </div> */}

          <SectionCards metrics={metrics} isConnected={isConnected} />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive cameras={processedCameras} />
          </div>
          <DataTable data={processedCameras} />
        </div>
      </div>
    </div>
  );
}
