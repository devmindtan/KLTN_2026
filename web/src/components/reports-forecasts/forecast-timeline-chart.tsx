/**
 * ForecastTimelineChart – Zone 2: Card wrapper dự báo vs thực tế 24h
 * Chart thực tế được delegate sang ForecastTimelineChartZone
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect, type SelectOption } from "@/components/custom/custom-select";
import { IconChartAreaLine } from "@tabler/icons-react";
import { useState } from "react";
import type { TimelinePoint } from "./reports-types";
import { MOCK_TIMELINE } from "./reports-types";
import { ForecastTimelineChartZone } from "./forecast-timeline-chart-zone";

const CAMERA_OPTIONS: SelectOption[] = [
  { value: "all",    label: "Toàn mạng lưới" },
  { value: "cam-01", label: "Cầu Sài Gòn" },
  { value: "cam-02", label: "Ngã tư Đinh Tiên Hoàng" },
];

const NOW_HOUR = "17:00"; // thực tế: new Date() → format HH:00

interface Props {
  data?: TimelinePoint[];
}

/** Card wrapper cho biểu đồ dự báo lưu lượng 24h */
export function ForecastTimelineChart({ data = MOCK_TIMELINE }: Props) {
  const [selectedCam, setSelectedCam] = useState("all");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconChartAreaLine className="size-4 text-primary" />
            Dự báo lưu lượng theo giờ
          </CardTitle>
          <CustomSelect
            value={selectedCam}
            onChange={setSelectedCam}
            options={CAMERA_OPTIONS}
            className="h-7 w-[180px]"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ForecastTimelineChartZone
          data={data}
          nowHour={NOW_HOUR}
          height={240}
          showVcPct={true}
        />
      </CardContent>
    </Card>
  );
}