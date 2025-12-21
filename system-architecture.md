# 🗺️ Phác thảo các Sơ đồ Kiến trúc Cần Thiết

Tài liệu này mô tả các sơ đồ kiến trúc quan trọng của hệ thống, tập trung vào **luồng dữ liệu**, **bảo mật**, **DevOps & vận hành**, và **phân quyền ứng dụng**.

---

## 1. Sơ đồ Kiến trúc Tổng thể & Luồng Dữ liệu
*(Overall Architecture & Data Pipeline)*

### 🎯 Mục tiêu

- Thể hiện sự kiện và luồng dữ liệu trong toàn hệ thống
- Nhấn mạnh mối quan hệ **bất đồng bộ (asynchronous)** giữa các service

### 🔑 Điểm nhấn

- Giao tiếp bất đồng bộ thông qua **Pub/Sub** và **FIWARE**
- Các service được tách rời, dễ mở rộng và scale

### 🧩 Các thành phần chính

```text
Camera
  → Ingest Service
    → MinIO / PubSub
      → Processing Service (YOLO)
        → FIWARE / PostgreSQL
          → Predict Service
            → Backend API
              → Frontend
```

### 📝 Mô tả ngắn

- **Camera**: Nguồn phát sinh dữ liệu (video / image stream)
- **Ingest**: Thu nhận và chuẩn hóa dữ liệu
- **MinIO / PubSub**: Lưu trữ tạm và phát sự kiện
- **Processing (YOLO)**: Xử lý AI / Computer Vision
- **FIWARE / PostgreSQL**: Quản lý context & dữ liệu lâu dài
- **Predict**: Phân tích, suy luận dữ liệu
- **Backend API**: Cung cấp dữ liệu cho client
- **Frontend**: Hiển thị & tương tác người dùng

---

## 2. Sơ đồ Kiến trúc Bảo mật
*(Security Architecture)*

### 🎯 Mục tiêu

- Bảo vệ hệ thống theo mô hình **Defense-in-Depth**
- Kiểm soát truy cập từ biên mạng đến dữ liệu bên trong

### 🔑 Điểm nhấn

- Phân lớp bảo mật rõ ràng
- Kiểm soát truy cập theo **vai trò** và **ngữ cảnh**

### 🧩 Các lớp bảo mật chính

#### 🔐 1. Lớp Biên (Edge Layer)

- **Cloudflare Zero Trust / Cloudflare Access**
- Bảo vệ Frontend public
- Kiểm soát danh tính người dùng trước khi truy cập hệ thống

#### 🌐 2. Lớp Mạng Riêng (Private Network)

- **Tailscale**
- Kết nối an toàn giữa các server nội bộ
- Không public trực tiếp các service backend

#### 🔑 3. Lớp Ủy quyền Dữ liệu (Data Authorization)

```text
Keyrock → Wilma → FIWARE
```

- Bảo vệ quyền **READ / WRITE** dữ liệu
- Kiểm soát truy cập theo **OAuth2 / Policy**

#### 🧠 4. Lớp Ứng dụng (Application Layer)

- **Backend API**
- Kiểm tra:
    - JWT
    - RBAC (Role-Based Access Control)

---

## 3. Sơ đồ Kiến trúc DevOps & Vận hành
*(CI/CD & MLOps)*

### 🎯 Mục tiêu

Tự động hóa toàn bộ vòng đời hệ thống:

- Mã nguồn
- Hạ tầng
- Triển khai
- Giám sát

### 🔑 Điểm nhấn

- **Infrastructure as Code (Terraform)**
- **Orchestration với Kubernetes & Helm**

### 🧩 Luồng CI/CD chính

```text
Git
  → Jenkins (CI)
    → Terraform (Provision Infrastructure)
        - Pub/Sub
        - Kubernetes Cluster
    → Docker (Build Image)
    → Helm (Deploy lên K8s)
```

### 🧩 Vận hành & Giám sát

```text
Kubernetes Pods
  → Prometheus / ELK
    → Grafana
```

### 📝 Thành phần

- **Jenkins**: CI pipeline
- **Terraform**: Cung cấp & quản lý hạ tầng
- **Docker**: Đóng gói ứng dụng
- **Helm**: Quản lý deployment
- **Prometheus / ELK**: Metrics & logs
- **Grafana**: Visualization & monitoring

---

## 4. Sơ đồ Phân quyền Ứng dụng
*(Authorization Flow)*

### 🎯 Mục tiêu

Làm rõ cách người dùng đạt được quyền:

- **Management (READ)**
- **Technical (CRUD)**

### 🔑 Điểm nhấn

- Xác định **điểm ra quyết định phân quyền**
- Hai luồng quyền phải được thể hiện **rõ ràng và tách biệt**

### 🧩 Luồng tổng quát

```text
Frontend
  → Cloudflare / Tailscale
    → Backend API
      → JWT Validation
        → Database (RBAC / Permission)
          → Action (READ hoặc CRUD)
```

### 🧑‍💼 Luồng quyền Management (READ)

- Chỉ đọc dữ liệu
- Không thay đổi trạng thái hệ thống
- Phù hợp cho:
    - Giám sát
    - Báo cáo
    - Phân tích

### 🧑‍🔧 Luồng quyền Technical (CRUD)

- Toàn quyền thao tác dữ liệu
- Bao gồm:
    - Create
    - Read
    - Update
    - Delete
- Phù hợp cho:
    - Admin
    - Kỹ sư vận hành
    - MLOps / DevOps