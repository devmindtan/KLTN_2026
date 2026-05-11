import { PageHeader } from "@/components/custom/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Globe,
  Lock,
  Shield,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { FIWARE_PUBLIC_API_TERM } from "@/lib/app-constants";

const publicEndpoints = [
  {
    method: "GET",
    path: "/v2/entities",
    purpose: "Danh sách entities theo type + phân trang",
    requiredParams: "type",
    status: "Public",
  },
  {
    method: "GET",
    path: "/v2/entities/{entityId}",
    purpose: "Chi tiết một entity",
    requiredParams: "entityId",
    status: "Public",
  },
  {
    method: "GET",
    path: "/v2/entities/{entityId}/attrs",
    purpose: "Lấy toàn bộ attributes",
    requiredParams: "entityId",
    status: "Public",
  },
  {
    method: "GET",
    path: "/v2/types",
    purpose: "Liệt kê entity types",
    requiredParams: "Không",
    status: "Public",
  },
  {
    method: "GET",
    path: "/version",
    purpose: "Health/version endpoint",
    requiredParams: "Không",
    status: "Public",
  },
];

const curlExample = `curl -X GET 'https://fiware-api.<domain>/v2/entities?type=Camera&limit=20' \\
  -H 'x-api-key: <YOUR_KEY>' \\
  -H 'fiware-service: traffic_monitor' \\
  -H 'fiware-servicepath: /'`;

export default function FiwarePublicApiPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<Globe className="size-5" />}
        title={FIWARE_PUBLIC_API_TERM.page_header.title}
        description={FIWARE_PUBLIC_API_TERM.page_header.description}
      >
        <Badge variant="outline">Preview UI</Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-primary" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-500" />
            Bước 1: Lấy API key từ đội vận hành.
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-500" />
            Bước 2: Thiết lập headers bắt buộc (`x-api-key`, `fiware-service`,
            `fiware-servicepath`).
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-500" />
            Bước 3: Test `GET /version`, sau đó gọi `GET /v2/entities`.
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-500" />
            Bước 4: Tích hợp retry/backoff cho mã lỗi 429 hoặc 5xx.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4 text-primary" />
            Endpoint Catalog (Read-only)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Method</th>
                <th className="px-2 py-2 font-medium">Endpoint</th>
                <th className="px-2 py-2 font-medium">Mục đích</th>
                <th className="px-2 py-2 font-medium">Params bắt buộc</th>
                <th className="px-2 py-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {publicEndpoints.map((endpoint) => (
                <tr
                  key={`${endpoint.method}-${endpoint.path}`}
                  className="border-b last:border-0"
                >
                  <td className="px-2 py-2">
                    <Badge variant="secondary" className="text-xs">
                      {endpoint.method}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {endpoint.path}
                  </td>
                  <td className="px-2 py-2">{endpoint.purpose}</td>
                  <td className="px-2 py-2">{endpoint.requiredParams}</td>
                  <td className="px-2 py-2">
                    <Badge variant="outline">{endpoint.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-primary" />
              Headers bắt buộc
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs">
              x-api-key: &lt;YOUR_KEY&gt;
            </div>
            <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs">
              fiware-service: traffic_monitor
            </div>
            <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs">
              fiware-servicepath: /
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              Preview UI: phần cấp key/rotate key và policy auth sẽ nối logic ở
              phase sau.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-primary" />
              Error Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-md border p-3">
              <div className="font-medium">401 / 403</div>
              <div className="text-muted-foreground">
                Thiếu key hoặc key không hợp lệ/quá hạn.
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="font-medium">429</div>
              <div className="text-muted-foreground">
                Vượt quota, cần retry với exponential backoff.
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="font-medium">5xx</div>
              <div className="text-muted-foreground">
                Lỗi upstream hoặc gateway, nên retry theo policy.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4 text-primary" />
            cURL Example
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            {curlExample}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              Sao chép lệnh (preview)
            </Button>
            <Button variant="outline" size="sm" disabled>
              <ExternalLink className="mr-1 size-3.5" />
              Gửi thử request (preview)
            </Button>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <TriangleAlert className="size-3.5" />
              Bản này chỉ là mock giao diện, chưa có logic gọi API.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
