/**
 * Trang Hỗ trợ Ra quyết định - Phân tích dữ liệu giao thông và đưa ra khuyến nghị
 */
import { useRef } from "react";
import { IconBrain } from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { DecisionMaker, type DecisionMakerRef } from "@/components/decisions";
import { PAGE_TITLES } from "@/lib/app-constants";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function DecisionMakingPage() {
  const makerRef = useRef<DecisionMakerRef>(null);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconBrain className="size-5" />}
        title={PAGE_TITLES.DECISION_MAKING}
        description="Phân tích dữ liệu giao thông, dự báo và hiệu suất mô hình để đưa ra khuyến nghị quản lý"
      >
        <Button
          size="sm"
          onClick={() => makerRef.current?.triggerAnalyze()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Phân tích ngay
        </Button>
      </PageHeader>
      <DecisionMaker ref={makerRef} pageSize={10} />
    </div>
  );
}