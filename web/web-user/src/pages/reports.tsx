import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconFileText, IconDownload, IconCalendar } from "@tabler/icons-react";

export default function TrafficReports() {
  const reports = [
    {
      title: "Báo cáo lưu lượng tháng 2/2026",
      type: "Báo cáo hàng tháng",
      date: "01/02/2026 - 13/02/2026",
      status: "completed",
      size: "2.4 MB"
    },
    {
      title: "Phân tích ùn tắc tuần 6",
      type: "Báo cáo hàng tuần",
      date: "03/02/2026 - 09/02/2026",
      status: "completed",
      size: "1.8 MB"
    },
    {
      title: "Đánh giá mô hình ML Q4/2025",
      type: "Báo cáo kỹ thuật",
      date: "01/10/2025 - 31/12/2025",
      status: "completed",
      size: "5.6 MB"
    },
    {
      title: "Dự đoán tết Nguyên Đán 2026",
      type: "Báo cáo đặc biệt",
      date: "20/01/2026 - 05/02/2026",
      status: "completed",
      size: "3.2 MB"
    },
    {
      title: "Báo cáo hiệu suất hệ thống",
      type: "Báo cáo kỹ thuật",
      date: "01/02/2026 - 13/02/2026",
      status: "processing",
      size: "Đang xử lý"
    },
    {
      title: "Thống kê giao thông giờ cao điểm",
      type: "Báo cáo phân tích",
      date: "01/01/2026 - 31/01/2026",
      status: "completed",
      size: "4.1 MB"
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Hoàn thành</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Đang xử lý</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Báo Cáo Giao Thông</h1>
          <p className="text-sm text-muted-foreground mt-1">Báo cáo và phân tích lưu lượng giao thông đô thị</p>
        </div>
        <Button>Tạo báo cáo mới</Button>
      </div>

      <div className="grid gap-4">
        {reports.map((report, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <IconFileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{report.type}</Badge>
                      <span className="flex items-center gap-1 text-xs">
                        <IconCalendar className="w-3 h-3" />
                        {report.date}
                      </span>
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(report.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Kích thước: <span className="font-medium text-foreground">{report.size}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Xem trước
                  </Button>
                  <Button size="sm" disabled={report.status !== "completed"}>
                    <IconDownload className="w-4 h-4 mr-1" />
                    Tải xuống
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
