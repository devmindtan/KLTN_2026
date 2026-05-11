# Thiết kế Public trực tiếp FIWARE NGSI-v2 cho bên thứ ba

> Ngày cập nhật: 25/04/2026  
> Ý chính: Public **trực tiếp API FIWARE Orion NGSI-v2** để đối tác dùng luôn, không đi qua API proxy của Node.js app.

---

## 1) Làm rõ yêu cầu

- Public ra ngoài để bên khác gọi trực tiếp `FIWARE /v2/...`.
- Chỉ tập trung FIWARE NGSI-v2.
- Có thêm 1 trang trong web để hướng dẫn dùng public endpoint này.

---

## 2) Kiến trúc public đúng ý (direct FIWARE)

### 2.1 Luồng truy cập

1. Client bên ngoài gọi domain public FIWARE, ví dụ: `https://fiware-api.<domain>/v2/entities`.
2. Request đi qua Ingress/API Gateway (TLS + auth + rate-limit).
3. Gateway forward đến Orion nội bộ (`fiware-orion:1026`).
4. Orion trả response NGSI-v2 chuẩn về cho client.

### 2.2 Điểm khác với bản cũ

- **Không dùng** route kiểu `/api/public/fiware/*` của backend Node.js.
- Public endpoint chính là endpoint FIWARE NGSI-v2 (`/v2/...`).

---

## 3) Phạm vi endpoint nên public (Phase 1)

> Chỉ mở read-only để an toàn.

- `GET /v2/entities`
- `GET /v2/entities/{entityId}`
- `GET /v2/entities/{entityId}/attrs`
- `GET /v2/types`
- `GET /version`

### 3.1 Chưa public ở phase 1

- `POST/PUT/PATCH/DELETE /v2/entities...`
- `POST /v2/subscriptions`
- Mọi endpoint ghi dữ liệu.

---

## 4) Bảo mật bắt buộc khi public trực tiếp FIWARE

### 4.1 Auth

- Bắt buộc API Key hoặc JWT ở API Gateway.
- Key theo đối tác để audit/revoke riêng.

### 4.2 Rate limit

- Ví dụ mặc định: `120 req/min/key`, burst 30.
- Chặn IP khi vượt ngưỡng liên tục.

### 4.3 Header policy

- Bắt buộc hoặc inject cố định:
  - `fiware-service: traffic_monitor`
  - `fiware-servicepath: /`
- Không cho client tùy ý đổi service/servicepath ở phase 1.

### 4.4 Query guard

- `limit` max 100.
- Có thể ép bắt buộc `type` cho `/v2/entities` để tránh query quá nặng.

### 4.5 Network security

- TLS bắt buộc.
- CORS chỉ whitelist domain đối tác (nếu có browser usage).
- WAF/basic bot protection ở layer ingress.

---

## 5) Kế hoạch triển khai hạ tầng (K3s)

## 5.1 Thành phần cần thêm/sửa

- Ingress riêng cho FIWARE public (host `fiware-api.<domain>`).
- Middleware auth/rate-limit (theo ingress controller đang dùng).
- Optional: API Gateway nếu cần policy phức tạp.

### 5.2 K8s file đề xuất

- `k8s-configs/services/fiware-orion-public-ingress.yaml` (mới)
- Nếu dùng middleware CRD: file policy tương ứng (`*-middleware.yaml`).

### 5.3 Kiểm thử tối thiểu

- `GET /version` có auth key hợp lệ → 200.
- Thiếu auth → 401/403.
- Vượt quota → 429.
- `GET /v2/entities?type=Camera&limit=20` trả dữ liệu đúng.

---

## 6) Trang mới trong frontend (chỉ hướng dẫn + test)

### 6.1 Route đề xuất

- Route: `/fiware-public-api`
- File page: `web/src/pages/fiware-public-api.tsx`

### 6.2 Mục tiêu trang

- Làm portal tài liệu cho đối tác:
  - endpoint nào được public,
  - header bắt buộc,
  - curl mẫu,
  - lỗi thường gặp.

### 6.3 Bố cục MVP

1. **Quick Start** (4 bước): lấy API key → set header → gọi thử `/version` → gọi `/v2/entities`.
2. **Endpoint Catalog** (table).
3. **Header bắt buộc** (`fiware-service`, `fiware-servicepath`, `Authorization`/`x-api-key`).
4. **cURL Examples** (copy nhanh).
5. **Error Guide** (401/403/429/5xx).
6. **API Playground nhẹ** (optional phase 1.5, chỉ GET).

### 6.4 Chỗ cần nối vào app

- `web/src/App.tsx` thêm route.
- `web/src/components/layout/app-sidebar.tsx` thêm menu item.
- `web/src/lib/app-constants.ts` thêm title.

---

## 7) Hướng dẫn dùng cho đối tác (nội dung đưa lên trang)

### 7.1 Ví dụ cURL

```bash
curl -X GET 'https://fiware-api.<domain>/v2/entities?type=Camera&limit=20' \
  -H 'x-api-key: <YOUR_KEY>' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /'
```

### 7.2 Mẫu lấy 1 entity

```bash
curl -X GET 'https://fiware-api.<domain>/v2/entities/urn:ngsi-ld:Camera:<id>' \
  -H 'x-api-key: <YOUR_KEY>' \
  -H 'fiware-service: traffic_monitor' \
  -H 'fiware-servicepath: /'
```

### 7.3 Lưu ý tích hợp

- Client cần xử lý retry với backoff khi gặp 429/5xx.
- Không poll quá dày (khuyến nghị 3-10s tuỳ use-case).

---

## 8) Rollout plan

### Phase A — Internal public beta (1-2 ngày)

- Bật public ingress cho read-only endpoint.
- Bật auth + rate-limit.
- Trang hướng dẫn bản MVP.

### Phase B — Partner onboarding (1 ngày)

- Cấp key theo đối tác.
- Chạy checklist UAT với 1-2 đối tác thử nghiệm.

### Phase C — Production hardening (1 ngày)

- Theo dõi latency/error/rate-limit hit.
- Điều chỉnh quota theo partner profile.

---

## 9) Tiêu chí nghiệm thu

- [ ] Đối tác gọi trực tiếp `https://fiware-api.<domain>/v2/...` thành công.
- [ ] Không thể gọi write endpoint ở phase 1.
- [ ] Có auth bắt buộc và rate-limit hoạt động.
- [ ] Trang `/fiware-public-api` đủ hướng dẫn để đối tác tự tích hợp.

---

## 10) Task gợi ý (đúng mục tiêu “public trực tiếp FIWARE”)

- `INFRA: Publish FIWARE NGSI-v2 via Public Ingress`
- `SEC: Add API key auth + rate limit for fiware-api host`
- `FE: Build Fiware Public API Guide Page`
- `DOC: Partner Onboarding Guide for NGSI-v2`

---

## 11) Lệnh triển khai (bạn chạy trên máy k3s)

> Theo rule dự án: phần thao tác k3s bạn chạy, mình chỉ đưa lệnh.

```bash
# 1) Tạo/áp dụng ingress public cho FIWARE
kubectl apply -f k8s-configs/services/fiware-orion-public-ingress.yaml

# 2) Nếu có middleware auth/rate-limit thì apply thêm
kubectl apply -f k8s-configs/services/fiware-orion-public-middleware.yaml

# 3) Kiểm tra ingress
kubectl get ingress -n backend

# 4) Test endpoint
curl -I 'https://fiware-api.<domain>/version'
```

---

## 12) Quy ước bắt buộc đồng bộ

- `fiware-service: traffic_monitor`
- `fiware-servicepath: /`
- DateTime format dùng ISO 8601 UTC.
