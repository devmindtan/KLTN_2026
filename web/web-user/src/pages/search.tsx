import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconSearch, IconMapPin, IconClock, IconFileText } from "@tabler/icons-react";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");

  const recentSearches = [
    "Lưu lượng Ngã tư Bến Thành",
    "Dự đoán giờ cao điểm",
    "Báo cáo tháng 1/2026",
    "Mô hình LSTM"
  ];

  const quickAccess = [
    {
      title: "Ngã tư Nguyễn Huệ - Lê Lợi",
      type: "location",
      description: "145 phương tiện/giờ - Bình thường",
      icon: IconMapPin,
      lastUpdate: "2 phút trước"
    },
    {
      title: "Dự đoán 17:00-18:00 hôm nay",
      type: "prediction",
      description: "Cầu Sài Gòn: 450 xe/giờ - Ùn tắc cao",
      icon: IconClock,
      lastUpdate: "Cập nhật 5 phút trước"
    },
    {
      title: "Báo cáo lưu lượng tháng 2",
      type: "report",
      description: "Báo cáo chi tiết về lưu lượng giao thông",
      icon: IconFileText,
      lastUpdate: "Hôm nay"
    },
  ];

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "location":
        return <Badge variant="secondary">Vị trí</Badge>;
      case "prediction":
        return <Badge variant="secondary">Dự đoán</Badge>;
      case "report":
        return <Badge variant="secondary">Báo cáo</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tìm Kiếm</h1>
          <p className="text-sm text-muted-foreground mt-1">Tìm kiếm dữ liệu, báo cáo và thông tin giao thông</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm điểm giám sát, báo cáo, mô hình..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button>Tìm kiếm</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tìm kiếm gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery(search)}
                >
                  <IconClock className="w-3 h-3 mr-1" />
                  {search}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Truy cập nhanh</CardTitle>
            <CardDescription>Các thông tin quan trọng và thường xuyên truy cập</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickAccess.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.title}</span>
                          {getTypeBadge(item.type)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.lastUpdate}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">Xem</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
