import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconMail, IconPhone } from "@tabler/icons-react";

export default function Team() {
  const teamMembers = [
    {
      name: "Nguyễn Văn A",
      role: "ML Engineer",
      email: "nguyenvana@example.com",
      phone: "+84 901 234 567",
      specialty: "Deep Learning",
      avatar: "NA"
    },
    {
      name: "Trần Thị B",
      role: "Data Scientist",
      email: "tranthib@example.com",
      phone: "+84 902 345 678",
      specialty: "Traffic Analysis",
      avatar: "TB"
    },
    {
      name: "Lê Văn C",
      role: "Backend Developer",
      email: "levanc@example.com",
      phone: "+84 903 456 789",
      specialty: "API Development",
      avatar: "LC"
    },
    {
      name: "Phạm Thị D",
      role: "Frontend Developer",
      email: "phamthid@example.com",
      phone: "+84 904 567 890",
      specialty: "UI/UX Design",
      avatar: "PD"
    },
    {
      name: "Hoàng Văn E",
      role: "DevOps Engineer",
      email: "hoangvane@example.com",
      phone: "+84 905 678 901",
      specialty: "Infrastructure",
      avatar: "HE"
    },
    {
      name: "Vũ Thị F",
      role: "Project Manager",
      email: "vuthif@example.com",
      phone: "+84 906 789 012",
      specialty: "Agile Management",
      avatar: "VF"
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Đội Ngũ Phát Triển</h1>
          <p className="text-sm text-muted-foreground mt-1">Thành viên tham gia dự án dự đoán lưu lượng giao thông</p>
        </div>
        <Button>Thêm thành viên</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teamMembers.map((member, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {member.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{member.name}</CardTitle>
                  <CardDescription>{member.role}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Badge variant="secondary" className="w-full justify-center">
                  {member.specialty}
                </Badge>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconMail className="w-4 h-4" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconPhone className="w-4 h-4" />
                    <span>{member.phone}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-3">Liên hệ</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
