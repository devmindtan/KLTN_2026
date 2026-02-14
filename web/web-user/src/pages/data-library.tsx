import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconDatabase, IconFileSpreadsheet, IconCloud, IconRefresh } from "@tabler/icons-react";

export default function TrafficDataLibrary() {
  const datasets = [
    {
      name: "Dữ liệu giao thông thời gian thực",
      type: "Streaming Data",
      source: "Camera & Sensors",
      size: "~500 GB",
      records: "15M+ records/ngày",
      lastUpdated: "1 phút trước",
      status: "active",
      icon: IconDatabase
    },
    {
      name: "Lịch sử lưu lượng 2025",
      type: "Historical Data",
      source: "Traffic Archive",
      size: "2.3 TB",
      records: "365 ngày dữ liệu",
      lastUpdated: "Hôm qua",
      status: "archived",
      icon: IconFileSpreadsheet
    },
    {
      name: "Dữ liệu thời tiết",
      type: "External Data",
      source: "Weather API",
      size: "150 GB",
      records: "3 năm dữ liệu",
      lastUpdated: "15 phút trước",
      status: "active",
      icon: IconCloud
    },
    {
      name: "Dữ liệu sự kiện đặc biệt",
      type: "Event Data",
      source: "Manual Input",
      size: "5 GB",
      records: "200+ sự kiện",
      lastUpdated: "3 ngày trước",
      status: "active",
      icon: IconDatabase
    },
    {
      name: "Dữ liệu huấn luyện ML",
      type: "Training Data",
      source: "Processed Data",
      size: "800 GB",
      records: "10M samples",
      lastUpdated: "1 tuần trước",
      status: "processing",
      icon: IconRefresh
    },
    {
      name: "Dữ liệu định danh xe",
      type: "Computer Vision",
      source: "Labeled Images",
      size: "350 GB",
      records: "500K+ hình ảnh",
      lastUpdated: "2 tuần trước",
      status: "archived",
      icon: IconFileSpreadsheet
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Hoạt động</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Đang xử lý</Badge>;
      case "archived":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Lưu trữ</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Thư Viện Dữ Liệu Giao Thông</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý và truy cập dữ liệu giao thông đô thị</p>
        </div>
        <Button>Import dữ liệu mới</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {datasets.map((dataset, idx) => {
          const Icon = dataset.icon;
          return (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{dataset.name}</CardTitle>
                      <CardDescription className="mt-1">
                        <Badge variant="secondary" className="text-xs">{dataset.type}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(dataset.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nguồn:</span>
                    <span className="font-medium">{dataset.source}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kích thước:</span>
                    <span className="font-medium">{dataset.size}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bản ghi:</span>
                    <span className="font-medium">{dataset.records}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cập nhật:</span>
                    <span className="font-medium">{dataset.lastUpdated}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1">Xem chi tiết</Button>
                    <Button size="sm" className="flex-1">Truy xuất</Button>
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