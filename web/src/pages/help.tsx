import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconBook, IconMessageCircle, IconMail, IconPhone } from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";

export default function Help() {
  const helpCategories = [
    {
      title: "Tài liệu hướng dẫn",
      description: "Hướng dẫn sử dụng hệ thống và các tính năng",
      icon: IconBook,
      items: [
        "Hướng dẫn sử dụng dashboard",
        "Cách đọc báo cáo dự đoán",
        "Quản lý mô hình ML",
        "Truy cập dữ liệu giao thông."
      ]
    },
    {
      title: "Câu hỏi thường gặp",
      description: "Giải đáp các thắc mắc phổ biến",
      icon: IconMessageCircle,
      items: [
        "Làm thế nào để dự đoán chính xác hơn?",
        "Tại sao có sự chênh lệch giữa dự đoán và thực tế?",
        "Cách xuất báo cáo?",
        "Độ chính xác của mô hình là bao nhiêu?"
      ]
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconBook className="w-5 h-5" />}
        title="Trung tâm hỗ trợ"
        description="Tài liệu, hướng dẫn và hỗ trợ kỹ thuật"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {helpCategories.map((category, idx) => {
          const Icon = category.icon;
          return (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{category.title}</CardTitle>
                    <CardDescription className="mt-1">{category.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <li key={itemIdx}>
                      <Button variant="link" className="h-auto p-0 text-sm font-normal">
                        {item}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liên hệ hỗ trợ</CardTitle>
          <CardDescription>Nếu bạn cần hỗ trợ trực tiếp, hãy liên hệ với chúng tôi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <IconMail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium">Email</div>
                <div className="text-sm text-muted-foreground">devmind.tan@gmail.com</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <IconPhone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium">Hotline</div>
                <div className="text-sm text-muted-foreground">+84 942 510 317</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <IconMessageCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-sm font-medium">Live Chat</div>
                <div className="text-sm text-muted-foreground">8:00 - 18:00 hàng ngày</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
