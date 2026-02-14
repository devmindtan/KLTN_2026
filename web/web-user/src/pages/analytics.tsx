import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTrendingUp, IconBrain, IconChartBar, IconClock } from "@tabler/icons-react";

export default function PredictiveAnalytics() {
  const predictions = [
    { time: "08:00 - 09:00", location: "Ngã tư Nguyễn Huệ", predicted: 320, confidence: 94, trend: "up" },
    { time: "17:00 - 18:00", location: "Cầu Sài Gòn", predicted: 450, confidence: 91, trend: "up" },
    { time: "12:00 - 13:00", location: "Đường Trần Hưng Đạo", predicted: 180, confidence: 88, trend: "down" },
    { time: "19:00 - 20:00", location: "Ngã tư Bến Thành", predicted: 280, confidence: 92, trend: "up" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phân Tích Dự Đoán Lưu Lượng</h1>
          <p className="text-sm text-muted-foreground mt-1">Dự đoán lưu lượng giao thông dựa trên mô hình Machine Learning</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Độ chính xác trung bình</CardTitle>
            <IconBrain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">91.2%</div>
            <p className="text-xs text-muted-foreground">Mô hình LSTM + Random Forest</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dự đoán hôm nay</CardTitle>
            <IconChartBar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">Thời điểm được phân tích</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cảnh báo ùn tắc</CardTitle>
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Điểm dự báo ùn tắc cao</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dự Đoán Lưu Lượng Theo Khung Giờ</CardTitle>
          <CardDescription>Các dự đoán có độ tin cậy cao cho hôm nay</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictions.map((pred, idx) => (
              <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconClock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{pred.time}</span>
                    <Badge variant="outline">{pred.location}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Độ tin cậy: {pred.confidence}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{pred.predicted}</div>
                  <div className="text-xs text-muted-foreground">phương tiện/giờ</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
