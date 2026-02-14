import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBulb, IconAlertCircle, IconArrowRight, IconCircle } from "@tabler/icons-react";

export default function DecisionSupport() {
  const recommendations = [
    {
      priority: "high",
      title: "Điều chỉnh đèn tín hiệu tại Ngã tư Bến Thành",
      description: "Dự đoán ùn tắc cao vào 17:30. Khuyến nghị tăng thời gian xanh hướng Đông-Tây lên 45 giây.",
      impact: "Giảm 25% thời gian chờ",
      confidence: 94
    },
    {
      priority: "high",
      title: "Cảnh báo lưu lượng cao tại Cầu Sài Gòn",
      description: "Lưu lượng dự kiến đạt 450 xe/giờ vào khung giờ 18:00-19:00. Cần hướng dẫn phân luồng.",
      impact: "Tránh ùn tắc kéo dài",
      confidence: 91
    },
    {
      priority: "medium",
      title: "Tối ưu hóa luồng giao thông Đường Trần Hưng Đạo",
      description: "Phát hiện thời gian đèn vàng không tối ưu. Khuyến nghị giảm xuống 3 giây.",
      impact: "Tăng 10% thông lượng",
      confidence: 88
    },
    {
      priority: "low",
      title: "Bảo trì camera giám sát Ngã tư Nguyễn Huệ",
      description: "Camera #3 có tín hiệu yếu, ảnh hưởng đến độ chính xác dự đoán.",
      impact: "Cải thiện độ tin cậy",
      confidence: 85
    },
  ];

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "high":
        return {
          badge: <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Ưu tiên cao</Badge>,
          icon: <IconAlertCircle className="w-5 h-5 text-red-600" />,
          color: "red"
        };
      case "medium":
        return {
          badge: <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Ưu tiên trung bình</Badge>,
          icon: <IconBulb className="w-5 h-5 text-yellow-600" />,
          color: "yellow"
        };
      case "low":
        return {
          badge: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Ưu tiên thấp</Badge>,
          icon: <IconCircle className="w-5 h-5 text-blue-600" />,
          color: "blue"
        };
      default:
        return {
          badge: null,
          icon: null,
          color: "gray"
        };
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hỗ Trợ Ra Quyết Định</h1>
          <p className="text-sm text-muted-foreground mt-1">Khuyến nghị tự động dựa trên phân tích AI và dự đoán lưu lượng</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Khuyến nghị hôm nay</CardTitle>
            <IconBulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">2 ưu tiên cao, 1 trung bình, 1 thấp</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã áp dụng</CardTitle>
            <IconCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Trong tuần này</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hiệu quả trung bình</CardTitle>
            <IconArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+18%</div>
            <p className="text-xs text-muted-foreground">Cải thiện lưu lượng</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {recommendations.map((rec, idx) => {
          const config = getPriorityConfig(rec.priority);
          return (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {config.icon}
                    <div className="flex-1">
                      <CardTitle className="text-base">{rec.title}</CardTitle>
                      <CardDescription className="mt-2">{rec.description}</CardDescription>
                    </div>
                  </div>
                  {config.badge}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tác động dự kiến: </span>
                      <span className="font-medium">{rec.impact}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Độ tin cậy: </span>
                      <span className="font-medium">{rec.confidence}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Bỏ qua</Button>
                    <Button size="sm">Áp dụng</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
