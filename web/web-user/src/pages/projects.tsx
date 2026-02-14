import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBrain, IconChartLine, IconDatabase, IconSettings } from "@tabler/icons-react";

export default function TrafficModels() {
  const models = [
    {
      name: "LSTM Traffic Predictor",
      type: "Deep Learning",
      accuracy: 92.5,
      status: "active",
      lastTrained: "2 ngày trước",
      icon: IconBrain,
      description: "Mô hình LSTM dự đoán lưu lượng theo chuỗi thời gian"
    },
    {
      name: "Random Forest Classifier",
      type: "Machine Learning",
      accuracy: 88.3,
      status: "active",
      lastTrained: "1 tuần trước",
      icon: IconChartLine,
      description: "Phân loại mức độ ùn tắc dựa trên nhiều yếu tố"
    },
    {
      name: "XGBoost Congestion Detector",
      type: "Machine Learning",
      accuracy: 90.1,
      status: "training",
      lastTrained: "Đang huấn luyện",
      icon: IconDatabase,
      description: "Phát hiện điểm ùn tắc tiềm năng"
    },
    {
      name: "CNN Image Analysis",
      type: "Computer Vision",
      accuracy: 85.7,
      status: "inactive",
      lastTrained: "1 tháng trước",
      icon: IconSettings,
      description: "Phân tích hình ảnh camera giao thông"
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Đang hoạt động</Badge>;
      case "training":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Đang huấn luyện</Badge>;
      case "inactive":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Không hoạt động</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mô Hình Machine Learning</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý và theo dõi các mô hình dự đoán lưu lượng giao thông</p>
        </div>
        <Button>Thêm mô hình mới</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {models.map((model, idx) => {
          const Icon = model.icon;
          return (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{model.name}</CardTitle>
                      <CardDescription className="mt-1">{model.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Loại mô hình:</span>
                    <Badge variant="secondary">{model.type}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Độ chính xác:</span>
                    <span className="font-semibold">{model.accuracy}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Trạng thái:</span>
                    {getStatusBadge(model.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Huấn luyện lần cuối:</span>
                    <span className="text-sm">{model.lastTrained}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1">Xem chi tiết</Button>
                    <Button size="sm" className="flex-1">Huấn luyện lại</Button>
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
