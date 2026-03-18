import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import avatarImage from "@/assets/avatar.jpg";
import teachImage from "@/assets/teacher.jpeg"
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconMail, IconPhone, IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { TEAM_TERM } from "@/lib/app-constants";

export default function Team() {
  const getInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const teamMembers = [
    {
      name: "Nguyễn Khắc Minh Tân",
      role: "Fullstack",
      email: "devmind.tan@gmail.com",
      phone: "+84 942 510 317",
      specialty: "Sinh viên",
      avatarUrl: avatarImage
    },
    {
      name: "Võ Anh Tiến",
      role: "Giảng viên hướng dẫn",
      email: "tien.va@vlu.edu.vn",
      phone: "+84 906 112 514",
      specialty: "Giảng viên",
      avatarUrl: teachImage
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconUsers className="w-5 h-5" />}
        title={TEAM_TERM.page_header.title}
        description={TEAM_TERM.page_header.description}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teamMembers.map((member, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar >
                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(member.name)}
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
