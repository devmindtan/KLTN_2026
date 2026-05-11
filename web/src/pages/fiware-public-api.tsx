import { PageHeader } from "@/components/custom/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Lock,
  Play,
  Server,
  Shield,
  Terminal,
  Wifi,
} from "lucide-react";
import { FIWARE_PUBLIC_API_TERM } from "@/lib/app-constants";
import { useCallback, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = "https://fiware.devmindtan.uk";

const publicEndpoints = [
  {
    method: "GET",
    path: "/version",
    purpose: "Kiểm tra sức khoẻ và phiên bản Orion",
    note: "Không cần header FIWARE",
    example: "/version",
  },
  {
    method: "GET",
    path: "/v2/entities",
    purpose: "Danh sách entities, lọc theo type và phân trang",
    note: "Bắt buộc header fiware-service + fiware-servicepath",
    example: "/v2/entities?type=Camera&limit=10&options=keyValues",
  },
  {
    method: "GET",
    path: "/v2/entities/{entityId}",
    purpose: "Toàn bộ dữ liệu một Camera entity",
    note: "entityId dạng urn:ngsi-ld:Camera:<id>",
    example: "/v2/entities/urn:ngsi-ld:Camera:<id>",
  },
  {
    method: "GET",
    path: "/v2/entities/{entityId}/attrs",
    purpose: "Lấy riêng phần attributes của entity",
    note: "Trả về object attrs thuần, không có _id/creDate",
    example: "/v2/entities/urn:ngsi-ld:Camera:<id>/attrs",
  },
  {
    method: "GET",
    path: "/v2/types",
    purpose: "Liệt kê tất cả entity types đang tồn tại",
    note: "Bắt buộc header fiware-service + fiware-servicepath",
    example: "/v2/types",
  },
];

const curlExamples = [
  {
    label: "Lấy phiên bản Orion",
    code: `curl -X GET '${BASE_URL}/version'`,
  },
  {
    label: "Lấy danh sách 10 Camera (keyValues)",
    code: `curl -X GET '${BASE_URL}/v2/entities?type=Camera&limit=10&options=keyValues' \\
  -H 'fiware-service: traffic_monitor' \\
  -H 'fiware-servicepath: /'`,
  },
  {
    label: "Lấy chi tiết một Camera",
    code: `curl -X GET '${BASE_URL}/v2/entities/urn:ngsi-ld:Camera:<id>' \\
  -H 'fiware-service: traffic_monitor' \\
  -H 'fiware-servicepath: /'`,
  },
  {
    label: "Lấy attributes của Camera",
    code: `curl -X GET '${BASE_URL}/v2/entities/urn:ngsi-ld:Camera:<id>/attrs' \\
  -H 'fiware-service: traffic_monitor' \\
  -H 'fiware-servicepath: /'`,
  },
];

const schemaFields = [
  {
    field: "total_objects",
    type: "Integer",
    desc: "Tổng phương tiện phát hiện trong khung hình",
  },
  {
    field: "detections",
    type: "StructuredValue",
    desc: "Chi tiết theo loại xe: { car, motorbike }",
  },
  {
    field: "status.current",
    type: "Text",
    desc: "Trạng thái giao thông hiện tại (LOS A–F)",
  },
  {
    field: "status.realtime.vc_ratio",
    type: "Number",
    desc: "V/C ratio thời gian thực (0–1)",
  },
  {
    field: "prediction.forecasts",
    type: "StructuredValue",
    desc: "Dự báo: { 5m, 10m, 15m, 30m, 60m }",
  },
  {
    field: "prediction.trend.direction",
    type: "Text",
    desc: "Xu hướng: increasing | decreasing | stable",
  },
  {
    field: "minio_key",
    type: "Text",
    desc: "Key ảnh lưu trên MinIO (traffic snapshot)",
  },
  {
    field: "last_updated",
    type: "DateTime",
    desc: "Thời điểm cập nhật cuối từ camera",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Nút sao chép code vào clipboard */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <CheckCircle2 className="size-3.5 text-green-500" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}

/** Mini API Playground – gọi GET endpoint thực */
function ApiPlayground() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Play className="size-4 text-primary" />
          API Testing Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                ⚠️ CORS Policy Block
              </p>
              <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                Browser không thể gọi trực tiếp{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">
                  https://fiware.devmindtan.uk
                </code>{" "}
                do CORS policy. Thay vào đó, hãy dùng một trong các công cụ dưới
                đây:
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-medium text-sm mb-2">
              📌 Cách 1: cURL (Terminal/Command Prompt)
            </p>
            <div className="rounded-md border bg-muted/40 p-3">
              <pre className="text-xs overflow-x-auto">
                {`curl -X GET 'https://fiware.devmindtan.uk/version'

curl -X GET 'https://fiware.devmindtan.uk/v2/entities?type=Camera&limit=5' \\
  -H 'fiware-service: traffic_monitor' \\
  -H 'fiware-servicepath: /'`}
              </pre>
            </div>
          </div>

          <div>
            <p className="font-medium text-sm mb-2">
              📌 Cách 2: Postman / Insomnia / Thunder Client
            </p>
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <p>1. Mở ứng dụng REST client</p>
              <p>
                2. Method: <code className="bg-muted px-1">GET</code>
              </p>
              <p>
                3. URL:{" "}
                <code className="bg-muted px-1">
                  https://fiware.devmindtan.uk/v2/entities
                </code>
              </p>
              <p>4. Headers:</p>
              <div className="ml-3 space-y-1">
                <p>
                  <code className="bg-muted px-1">
                    fiware-service: traffic_monitor
                  </code>
                </p>
                <p>
                  <code className="bg-muted px-1">fiware-servicepath: /</code>
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="font-medium text-sm mb-2">
              📌 Cách 3: Backend Proxy (Node.js)
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tạo endpoint `/api/fiware/*` trong backend để proxy requests (sẽ
              không bị CORS). Frontend gọi{" "}
              <code className="bg-muted px-1 rounded">/api/fiware/version</code>{" "}
              thay vì direct URL.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FiwarePublicApiPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<Globe className="size-5" />}
        title={FIWARE_PUBLIC_API_TERM.page_header.title}
        description={FIWARE_PUBLIC_API_TERM.page_header.description}
      ></PageHeader>

      {/* Thông báo truy cập công khai */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/20">
        <Wifi className="mt-0.5 size-4 shrink-0 text-blue-500" />
        <div className="space-y-1">
          <p className="font-medium text-blue-800 dark:text-blue-300">
            Truy cập công khai — Không cần API key
          </p>
          <p className="text-blue-700 dark:text-blue-400">
            FIWARE Orion Context Broker hiện đang public read-only. Chỉ cần thêm{" "}
            <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/50">
              fiware-service: traffic_monitor
            </code>{" "}
            và{" "}
            <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/50">
              fiware-servicepath: /
            </code>{" "}
            khi gọi{" "}
            <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/50">
              /v2/...
            </code>
          </p>
        </div>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-primary" />
            Bắt đầu nhanh
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {[
            {
              step: 1,
              text: (
                <>
                  Gọi{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    {BASE_URL}/version
                  </code>{" "}
                  để kiểm tra Orion đang hoạt động.
                </>
              ),
            },
            {
              step: 2,
              text: (
                <>
                  Thêm header{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    fiware-service: traffic_monitor
                  </code>{" "}
                  và{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    fiware-servicepath: /
                  </code>{" "}
                  vào mọi request{" "}
                  <code className="rounded bg-muted px-1 text-xs">/v2/...</code>
                  .
                </>
              ),
            },
            {
              step: 3,
              text: (
                <>
                  Gọi{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    /v2/entities?type=Camera&limit=10
                  </code>{" "}
                  để xem danh sách camera.
                </>
              ),
            },
            {
              step: 4,
              text: (
                <>
                  Xử lý retry với exponential backoff khi gặp mã lỗi 429 hoặc
                  5xx.
                </>
              ),
            },
          ].map(({ step, text }) => (
            <div
              key={step}
              className="flex items-start gap-3 text-muted-foreground"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {step}
              </span>
              <p className="leading-relaxed">{text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Endpoint Catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="size-4 text-primary" />
            Endpoint Catalog — Chỉ đọc (Read-only)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Method</th>
                <th className="px-2 py-2 font-medium">Endpoint</th>
                <th className="px-2 py-2 font-medium">Mục đích</th>
                <th className="px-2 py-2 font-medium">Lưu ý</th>
              </tr>
            </thead>
            <tbody>
              {publicEndpoints.map((ep) => (
                <tr
                  key={ep.path}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-2 py-2.5">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {ep.method}
                    </Badge>
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs text-foreground">
                    {ep.path}
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    {ep.purpose}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-muted-foreground">
                    {ep.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* cURL Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4 text-primary" />
            Ví dụ cURL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {curlExamples.map((ex) => (
            <div key={ex.label} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {ex.label}
              </p>
              <div className="relative">
                <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-9 text-xs leading-relaxed">
                  {ex.code}
                </pre>
                <div className="absolute right-2 top-2">
                  <CopyButton text={ex.code} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* API Playground */}
      <ApiPlayground />

      {/* Schema Reference + Error Guide */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-primary" />
              Cấu trúc Camera Entity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {schemaFields.map(({ field, type, desc }) => (
              <div
                key={field}
                className="flex items-start gap-2 rounded-md py-1"
              >
                <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                  {field}
                </code>
                <div>
                  <Badge variant="outline" className="mr-1.5 text-[10px]">
                    {type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              </div>
            ))}
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              Xem đầy đủ schema tại{" "}
              <a
                href={`${BASE_URL}/v2/entities?type=Camera&limit=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
              >
                /v2/entities?type=Camera&limit=1
                <ExternalLink className="size-3" />
              </a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-primary" />
              Mã lỗi thường gặp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              {
                code: "200",
                color: "text-green-600 dark:text-green-400",
                desc: "Thành công, body là JSON",
              },
              {
                code: "404",
                color: "text-yellow-600 dark:text-yellow-400",
                desc: "Entity không tồn tại hoặc path sai",
              },
              {
                code: "422",
                color: "text-orange-500",
                desc: "Query param không hợp lệ",
              },
              {
                code: "429",
                color: "text-red-500",
                desc: "Vượt rate limit — retry với exponential backoff",
              },
              {
                code: "5xx",
                color: "text-red-600",
                desc: "Lỗi upstream Orion, thường là thoáng qua",
              },
            ].map(({ code, color, desc }) => (
              <div
                key={code}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <span className={`shrink-0 font-mono font-bold ${color}`}>
                  {code}
                </span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Base URL reference */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Globe className="size-4 shrink-0" />
          <span>Base URL:</span>
          <code className="font-mono text-foreground">{BASE_URL}</code>
        </div>
        <a
          href={`${BASE_URL}/version`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Mở trong tab mới <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}
