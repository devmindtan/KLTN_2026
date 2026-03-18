import swaggerJsdoc from "swagger-jsdoc";

/**
 * Cấu hình OpenAPI spec cho toàn bộ API server
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "KLTN 2026 – Traffic Monitoring API",
      version: "1.0.0",
      description:
        "API quản lý hệ thống giám sát giao thông đô thị. " +
        "Sử dụng Bearer JWT token cho mọi request (trừ /auth/guest-token và /auth/login).",
    },
    servers: [
      { url: "http://localhost:8080", description: "Development" },
      { url: "https://server.devmindtan.uk", description: "Production" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token từ /api/auth/guest-token hoặc /api/auth/login",
        },
      },
      schemas: {
        Camera: {
          type: "object",
          properties: {
            cam_id: { type: "string", example: "cam_001662b86c41afb9c00172dd31c" },
            name: { type: "string", example: "Trần Quang Khải - Trần Khắc Chân" },
            location: { type: "string" },
            latitude: { type: "number", example: 10.7769 },
            longitude: { type: "number", example: 106.7009 },
            stream_url: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        Model: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            model_type: { type: "string", example: "lstm" },
            version: { type: "string", example: "v3" },
            is_active: { type: "boolean" },
            metrics: { type: "object" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        AuthUser: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            full_name: { type: "string" },
            role: { type: "string", enum: ["viewer", "technician"] },
          },
        },
        ActivityLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            action: { type: "string", example: "TRAIN_MODEL" },
            resource: { type: "string", example: "model" },
            resource_id: { type: "string" },
            ip_address: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Collection: {
          type: "object",
          properties: {
            id:          { type: "string", format: "uuid" },
            title:       { type: "string" },
            data_type:   { type: "string" },
            description: { type: "string" },
            tags:        { type: "array", items: { type: "string" } },
            created_by:  { type: "string", format: "uuid" },
            created_at:  { type: "string", format: "date-time" },
            updated_at:  { type: "string", format: "date-time" },
            entries:     { type: "array", items: { $ref: "#/components/schemas/Entry" } },
          },
        },
        Entry: {
          type: "object",
          properties: {
            id:            { type: "string", format: "uuid" },
            collection_id: { type: "string", format: "uuid" },
            title:         { type: "string" },
            data_type:     { type: "string" },
            description:   { type: "string" },
            snapshot_date: { type: "string", format: "date" },
            file_size:     { type: "integer" },
            row_count:     { type: "integer" },
            minio_keys:    { type: "array", items: { type: "string" } },
            created_by:    { type: "string", format: "uuid" },
            created_at:    { type: "string", format: "date-time" },
          },
        },
        HelpArticle: {
          type: "object",
          properties: {
            id:           { type: "string", format: "uuid" },
            section_key:  { type: "string", example: "los-overview" },
            parent_key:   { type: "string", nullable: true, example: null },
            title:        { type: "string", example: "Cấp độ dịch vụ (LOS)" },
            summary:      { type: "string", example: "LOS là thang đo 5 cấp phân loại mức độ đông đúc của đoạn đường" },
            content:      { type: "string", example: "## Giải thích\n..." },
            tech_detail:  { type: "string", nullable: true, example: null },
            sort_order:   { type: "integer", example: 0 },
            is_published: { type: "boolean", example: true },
            created_at:   { type: "string", format: "date-time" },
            updated_at:   { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: "Auth",           description: "Xác thực và phân quyền" },
      { name: "Cameras",        description: "Quản lý camera giám sát" },
      { name: "Models",         description: "Quản lý model ML" },
      { name: "Model Metrics",  description: "Chỉ số hiệu suất model" },
      { name: "Data Library",   description: "Thư viện dữ liệu (collections & entries)" },
      { name: "Traffic",        description: "Phân tích mật độ giao thông" },
      { name: "Help",           description: "Tài liệu hướng dẫn (CMS bài viết)" },
    ],
    paths: {
      // ── AUTH ──────────────────────────────────────────────────────
      "/api/auth/guest-token": {
        post: {
          tags: ["Auth"],
          summary: "Cấp anonymous token cho viewer",
          security: [],
          responses: {
            200: {
              description: "Token JWT anonymous (24h)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { token: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Đăng nhập kỹ thuật viên",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email", example: "admin@traffic.local" },
                    password: { type: "string", format: "password", example: "Admin@123" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Đăng nhập thành công, trả về access token",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      user: { $ref: "#/components/schemas/AuthUser" },
                    },
                  },
                },
              },
            },
            401: { description: "Sai email hoặc mật khẩu" },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Làm mới access token (dùng refresh token từ cookie)",
          security: [],
          responses: {
            200: {
              description: "Access token mới",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { token: { type: "string" } },
                  },
                },
              },
            },
            401: { description: "Refresh token không hợp lệ hoặc hết hạn" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Đăng xuất – xóa refresh token cookie",
          responses: {
            200: { description: "Đăng xuất thành công" },
            401: { description: "Chưa xác thực" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Lấy thông tin tài khoản hiện tại (technician only)",
          responses: {
            200: {
              description: "Thông tin tài khoản",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthUser" },
                },
              },
            },
            403: { description: "Không đủ quyền" },
          },
        },
      },
      "/api/auth/change-password": {
        put: {
          tags: ["Auth"],
          summary: "Đổi mật khẩu (technician only)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["currentPassword", "newPassword"],
                  properties: {
                    currentPassword: { type: "string", format: "password" },
                    newPassword: { type: "string", format: "password", minLength: 8 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Đổi mật khẩu thành công" },
            400: { description: "Mật khẩu hiện tại không đúng" },
            403: { description: "Không đủ quyền" },
          },
        },
      },
      "/api/auth/activity-logs": {
        get: {
          tags: ["Auth"],
          summary: "Lịch sử hoạt động của tài khoản (technician only)",
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10 },
              description: "Số lượng log muốn lấy",
            },
          ],
          responses: {
            200: {
              description: "Danh sách activity logs",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ActivityLog" },
                  },
                },
              },
            },
            403: { description: "Không đủ quyền" },
          },
        },
      },

      // ── CAMERAS ───────────────────────────────────────────────────
      "/api/cameras": {
        get: {
          tags: ["Cameras"],
          summary: "Lấy danh sách tất cả camera",
          responses: {
            200: {
              description: "Danh sách camera",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Camera" },
                  },
                },
              },
            },
            401: { description: "Thiếu JWT token" },
          },
        },
      },
      "/api/cameras/nearby": {
        get: {
          tags: ["Cameras"],
          summary: "Tìm camera gần nhất theo tọa độ",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number" }, example: 10.7769 },
            { name: "lng", in: "query", required: true, schema: { type: "number" }, example: 106.7009 },
            { name: "radius", in: "query", schema: { type: "number", default: 500 }, description: "Bán kính tìm kiếm (mét)" },
          ],
          responses: {
            200: {
              description: "Camera gần nhất",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Camera" },
                },
              },
            },
          },
        },
      },
      "/api/cameras/{cam_id}": {
        get: {
          tags: ["Cameras"],
          summary: "Lấy chi tiết một camera theo ID",
          parameters: [
            { name: "cam_id", in: "path", required: true, schema: { type: "string" }, example: "cam_001" },
          ],
          responses: {
            200: {
              description: "Chi tiết camera",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Camera" },
                },
              },
            },
            404: { description: "Không tìm thấy camera" },
          },
        },
      },

      // ── MODELS ────────────────────────────────────────────────────
      "/api/models": {
        get: {
          tags: ["Models"],
          summary: "Lấy danh sách active models (1 per type)",
          responses: {
            200: {
              description: "Danh sách model đang active",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Model" } },
                },
              },
            },
          },
        },
      },
      "/api/models/all": {
        get: {
          tags: ["Models"],
          summary: "Lấy tất cả versions của tất cả model (grouped by type)",
          responses: {
            200: {
              description: "Tất cả model versions",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: { type: "array", items: { $ref: "#/components/schemas/Model" } } },
                },
              },
            },
          },
        },
      },
      "/api/models/data-range": {
        get: {
          tags: ["Models"],
          summary: "Lấy phạm vi ngày có dữ liệu huấn luyện",
          responses: {
            200: {
              description: "Min/max date của dữ liệu",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      min_date: { type: "string", format: "date" },
                      max_date: { type: "string", format: "date" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/models/train": {
        post: {
          tags: ["Models"],
          summary: "Kích hoạt job huấn luyện model mới (technician only)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["model_type", "start_date", "end_date"],
                  properties: {
                    model_type: { type: "string", example: "lstm" },
                    start_date: { type: "string", format: "date", example: "2024-01-01" },
                    end_date: { type: "string", format: "date", example: "2024-12-31" },
                  },
                },
              },
            },
          },
          responses: {
            202: { description: "Job huấn luyện đã được tạo" },
            403: { description: "Không đủ quyền" },
          },
        },
      },
      "/api/models/{id}": {
        get: {
          tags: ["Models"],
          summary: "Lấy chi tiết một model theo ID",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Chi tiết model", content: { "application/json": { schema: { $ref: "#/components/schemas/Model" } } } },
            404: { description: "Không tìm thấy" },
          },
        },
      },
      "/api/models/{id}/activate": {
        post: {
          tags: ["Models"],
          summary: "Kích hoạt một version model (technician only)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Model đã được kích hoạt" },
            403: { description: "Không đủ quyền" },
            404: { description: "Không tìm thấy model" },
          },
        },
      },
      "/api/models/{id}/history": {
        get: {
          tags: ["Models"],
          summary: "Lịch sử các versions của cùng model type",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: {
              description: "Danh sách versions",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Model" } } } },
            },
          },
        },
      },

      // ── MODEL METRICS ────────────────────────────────────────────
      "/api/model-metrics/latest": {
        get: {
          tags: ["Model Metrics"],
          summary: "Lấy snapshot metrics model mới nhất",
          responses: {
            200: {
              description: "Snapshot metrics mới nhất",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          id: { type: "integer" },
                          generated_at: { type: "string", format: "date-time" },
                          period_days: { type: "integer" },
                          overall: { type: "object" },
                          by_horizon: { type: "object" },
                          camera_ranking: { type: "object" },
                          data_coverage: { type: "object" },
                          trend_accuracy: { type: "object" },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { description: "Chưa có dữ liệu metrics" },
            401: { description: "Thiếu JWT token" },
          },
        },
      },
      "/api/model-metrics/history": {
        get: {
          tags: ["Model Metrics"],
          summary: "Lấy lịch sử metrics model theo thời gian",
          parameters: [
            { name: "limit",      in: "query", schema: { type: "integer", default: 50, minimum: 1, maximum: 500 } },
            { name: "offset",     in: "query", schema: { type: "integer", default: 0, minimum: 0 } },
            { name: "period_days",in: "query", schema: { type: "integer", minimum: 1, maximum: 365 }, description: "Lọc theo số ngày đánh giá" },
            { name: "from",       in: "query", schema: { type: "string", format: "date-time" }, description: "Lọc từ thời điểm (ISO 8601)" },
            { name: "to",         in: "query", schema: { type: "string", format: "date-time" }, description: "Lọc đến thời điểm (ISO 8601)" },
          ],
          responses: {
            200: {
              description: "Danh sách snapshot metrics",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      pagination: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          limit: { type: "integer" },
                          offset: { type: "integer" },
                        },
                      },
                      data: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
            400: { description: "Query params không hợp lệ" },
            401: { description: "Thiếu JWT token" },
          },
        },
      },

      // ── DATA LIBRARY ───────────────────────────────────────────
      "/api/data-library/collections": {
        get: {
          tags: ["Data Library"],
          summary: "Lấy danh sách collections",
          responses: {
            200: {
              description: "Danh sách collections",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "array", items: { $ref: "#/components/schemas/Collection" } },
                    },
                  },
                },
              },
            },
            401: { description: "Thiếu JWT token" },
          },
        },
        post: {
          tags: ["Data Library"],
          summary: "Tạo collection mới (technician only)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "data_type"],
                  properties: {
                    title:       { type: "string", maxLength: 255, example: "Dữ liệu phát hiện tốc độ" },
                    data_type:   { type: "string", maxLength: 50, example: "traffic_data" },
                    description: { type: "string" },
                    tags:        { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Collection đã được tạo" },
            400: { description: "Dữ liệu không hợp lệ" },
            403: { description: "Không đủ quyền" },
          },
        },
      },
      "/api/data-library/collections/{id}": {
        get: {
          tags: ["Data Library"],
          summary: "Lấy chi tiết collection kèm danh sách entries",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Chi tiết collection", content: { "application/json": { schema: { $ref: "#/components/schemas/Collection" } } } },
            404: { description: "Không tìm thấy" },
          },
        },
        put: {
          tags: ["Data Library"],
          summary: "Cập nhật thông tin collection (technician only)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title:       { type: "string" },
                    description: { type: "string" },
                    data_type:   { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Cập nhật thành công" },
            403: { description: "Không đủ quyền" },
            404: { description: "Không tìm thấy" },
          },
        },
        delete: {
          tags: ["Data Library"],
          summary: "Xóa collection và toàn bộ entries (technician only)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Xóa thành công" },
            403: { description: "Không đủ quyền" },
            404: { description: "Không tìm thấy" },
          },
        },
      },
      "/api/data-library/entries/{id}/download": {
        get: {
          tags: ["Data Library"],
          summary: "Tải file entry (CSV.gz hoặc ZIP nếu nhiều file)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Entry ID" },
            { name: "key", in: "query", schema: { type: "string" }, description: "MinIO key cụ thể — nếu bỏ qua thì ZIP toàn bộ" },
          ],
          responses: {
            200: { description: "File nhị phân (application/gzip hoặc application/zip)" },
            404: { description: "Không tìm thấy entry" },
          },
        },
      },
      "/api/data-library/entries": {
        post: {
          tags: ["Data Library"],
          summary: "Import entry từ file upload (technician only)",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file", "collection_id", "snapshot_date"],
                  properties: {
                    file:          { type: "string", format: "binary", description: "File .csv hoặc .json (tối đa 50MB)" },
                    collection_id: { type: "string", description: "UUID của collection nhân file, hoặc 'new' để tạo mới" },
                    snapshot_date: { type: "string", format: "date", example: "2026-03-06" },
                    new_title:     { type: "string", description: "Bắt buộc nếu collection_id='new'" },
                    data_type:     { type: "string", description: "Bắt buộc nếu collection_id='new'" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Entry đã được import" },
            400: { description: "Dữ liệu không hợp lệ" },
            403: { description: "Không đủ quyền" },
          },
        },
      },
      "/api/data-library/entries/{id}": {
        delete: {
          tags: ["Data Library"],
          summary: "Xóa entry và file trên MinIO (technician only)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Xóa thành công" },
            403: { description: "Không đủ quyền" },
            404: { description: "Không tìm thấy" },
          },
        },
      },

      // ── TRAFFIC PATTERN ───────────────────────────────────────────
      "/api/traffic/patterns": {
        get: {
          tags: ["Traffic"],
          summary: "Lấy phân bố mật độ giao thông theo chiều thời gian",
          parameters: [
            {
              name: "type", in: "query", required: true,
              schema: { type: "string", enum: ["hour", "dow", "week_of_month", "month"] },
              description: "Chiều thời gian: hour=theo giờ, dow=theo ngày trong tuần, week_of_month=theo tuần ISO, month=theo tháng",
            },
            {
              name: "camera_id", in: "query",
              schema: { type: "string", default: "all" },
              description: "Camera ID, hoặc 'all' để lấy trung bình toàn hệ thống",
            },
            {
              name: "tz", in: "query",
              schema: { type: "integer", default: 0 },
              description: "Timezone offset (phút) — luôn gửi 0 (UTC)",
            },
          ],
          responses: {
            200: {
              description: "Dữ liệu phân bố mật độ",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      type:     { type: "string" },
                      camera_id:{ type: "string" },
                      time_range: {
                        type: "object",
                        properties: {
                          from: { type: "string", example: "06:00 08/03/2026" },
                          to:   { type: "string", example: "24:00 08/03/2026" },
                        },
                      },
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label:        { type: "string", example: "06:00" },
                            avg_vehicles: { type: "number" },
                            max_vehicles: { type: "integer" },
                            sample_count: { type: "integer" },
                          },
                        },
                      },
                      meta: {
                        type: "object",
                        properties: { total_cameras: { type: "integer" } },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "type không hợp lệ" },
            401: { description: "Thiếu JWT token" },
          },
        },
      },

      // ── FORECAST ──────────────────────────────────────────────────
      "/api/forecast/summary": {
        get: {
          tags: ["Forecast"],
          summary: "[DEPRECATED] Tổng hợp độ chính xác dự báo trong ngày",
          deprecated: true,
          description: "⚠️ API này không còn hoạt động vì MV (mv_forecast_daily_stats) đã bị xóa. Sử dụng /api/forecast/rolling để lấy dữ liệu rolling forecast.",
          parameters: [
            {
              name: "date", in: "query", required: true,
              schema: { type: "string", example: "2026-03-13" },
              description: "Ngày cần tổng hợp (YYYY-MM-DD, giờ VN)",
            },
          ],
          responses: {
            200: {
              description: "Tổng hợp thống kê dự báo",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success:       { type: "boolean" },
                      date:          { type: "string" },
                      mae:           { type: "number", nullable: true },
                      mape:          { type: "number", nullable: true },
                      r2:            { type: "number", nullable: true },
                      totalSlots:    { type: "integer" },
                      coveredSlots:  { type: "integer" },
                      highRiskCount: { type: "integer" },
                      networkTrend:       { type: "string", nullable: true, enum: ["up", "down", "stable", null] },
                      networkChangePct:   { type: "number",  nullable: true },
                    },
                  },
                },
              },
            },
            400: { description: "Thiếu tham số date" },
            401: { description: "Thiếu JWT token" },
          },
        },
      },

      "/api/forecast/timeline": {
        get: {
          tags: ["Forecast"],
          summary: "[DEPRECATED] Chuỗi thời gian predicted vs actual theo giờ",
          deprecated: true,
          description: "⚠️ API này không còn hoạt động vì MV (mv_forecast_hourly) đã bị xóa. Sử dụng /api/forecast/rolling để lấy dữ liệu rolling forecast.",
          parameters: [
            {
              name: "date", in: "query", required: true,
              schema: { type: "string", example: "2026-03-13" },
              description: "Ngày cần lấy dữ liệu",
            },
            {
              name: "camId", in: "query",
              schema: { type: "string", default: "all" },
              description: "Camera ID hoặc 'all' để lấy tổng toàn mạng",
            },
          ],
          responses: {
            200: {
              description: "Danh sách điểm dữ liệu theo giờ",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      date:    { type: "string" },
                      camId:   { type: "string" },
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            hour:      { type: "integer", example: 7 },
                            predicted: { type: "number", nullable: true },
                            actual:    { type: "number", nullable: true },
                            vcPct:     { type: "number", nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "Thiếu tham số date" },
            401: { description: "Thiếu JWT token" },
          },
        },
      },

      "/api/forecast/slots": {
        get: {
          tags: ["Forecast"],
          summary: "[DEPRECATED] Danh sách slot dự báo per-camera với LOS và riskLevel",
          deprecated: true,
          description: "⚠️ API này không còn hoạt động vì MV (mv_forecast_slots_recent) đã bị xóa. Sử dụng /api/forecast/rolling để lấy dữ liệu rolling forecast.",
          parameters: [
            {
              name: "date", in: "query", required: true,
              schema: { type: "string", example: "2026-03-13" },
              description: "Ngày cần lấy slot",
            },
            {
              name: "horizon", in: "query",
              schema: { type: "integer", default: 5, enum: [5, 10, 15, 30, 60] },
              description: "Horizon dự báo (phút)",
            },
            {
              name: "limit", in: "query",
              schema: { type: "integer", default: 200 },
              description: "Số slot tối đa trả về",
            },
          ],
          responses: {
            200: {
              description: "Danh sách slot dự báo",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      total:   { type: "integer" },
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id:                { type: "string" },
                            timeSlot:          { type: "string", example: "07:00" },
                            duration:          { type: "integer", example: 5 },
                            camId:             { type: "string" },
                            camName:           { type: "string" },
                            predictedVehicles: { type: "number" },
                            actualVehicles:    { type: "number", nullable: true },
                            errorPct:          { type: "number", nullable: true },
                            inputValue:        { type: "number", nullable: true },
                            predictedLos:      { type: "string" },
                            actualLos:         { type: "string", nullable: true },
                            vcPct:             { type: "number", nullable: true },
                            riskLevel:         { type: "string", enum: ["low", "medium", "high", "critical"] },
                            deltaVsWeekAvg:    { type: "number", nullable: true },
                            confidence:        { type: "number", nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "Thiếu tham số date" },
            401: { description: "Thiếu JWT token" },
          },
        },
      },

      "/api/forecast/rolling": {
        get: {
          tags: ["Forecast"],
          summary: "Rolling forecast data cho Dashboard (ngày hiện tại, 5 horizons)",
          parameters: [
            {
              name: "cameraId", in: "query",
              schema: { type: "string", default: "all" },
              description: "Camera ID (all = tổng toàn mạng)",
            },
          ],
          responses: {
            200: {
              description: "Dữ liệu rolling forecast",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      metadata: {
                        type: "object",
                        properties: {
                          nowIndex:    { type: "integer", description: "Index của slot hiện tại" },
                          totalSlots:  { type: "integer", description: "Tổng số slots (07:00-23:55)" },
                          nowTime:     { type: "string", example: "14:30", description: "Giờ HCM hiện tại HH:MM" },
                          generatedAt: { type: "string", format: "date-time", description: "ISO timestamp khi response được tạo" },
                          timeRange:   {
                            type: "object",
                            properties: {
                              start: { type: "string", example: "07:00" },
                              end:   { type: "string", example: "23:55" },
                            },
                          },
                          description: { type: "string" },
                        },
                      },
                      capacities: {
                        type: "object",
                        description: "backward-compat: capacity từng camera (vehicle/5min). Xem cameras[id].capacity.",
                        additionalProperties: { type: "number" },
                      },
                      cameras: {
                        type: "object",
                        description: "Per-camera forecast data",
                        additionalProperties: {
                          type: "object",
                          properties: {
                            capacity: { type: "number", description: "Capacity camera (vehicle/5min)" },
                            slots: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  t:            { type: "string", example: "07:00" },
                                  actual:       { type: "number", nullable: true },
                                  actualRef:    { type: "number", nullable: true, description: "Baseline cho tương lai" },
                                  currentRatio: { type: "number", nullable: true, description: "V/C ratio %" },
                                  isFuture:     { type: "boolean", description: "true nếu slot >= nowTime" },
                                  los:          { type: "string", example: "A", description: "Level of Service: A–F" },
                                  losLabel:     { type: "string", example: "Thông thoáng", description: "Nhãn LOS tiếng Việt" },
                                  f5m:          { type: "number", nullable: true },
                                  f10m:         { type: "number", nullable: true },
                                  f15m:         { type: "number", nullable: true },
                                  f30m:         { type: "number", nullable: true },
                                  f60m:         { type: "number", nullable: true },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: "Thiếu JWT token" },
          },
        },
      },
    },
    "/api/help/articles": {
      get: {
        tags: ["Help"],
        summary: "Lấy danh sách bài viết tài liệu",
        description: "Viewer chỉ nhận bài đã publish. Technician nhận tất cả.",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { type: "array", items: { $ref: "#/components/schemas/HelpArticle" } },
                  },
                },
              },
            },
          },
          401: { description: "Thiếu JWT token" },
        },
      },
      post: {
        tags: ["Help"],
        summary: "Tạo bài viết mới [technician]",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["section_key", "title"],
                properties: {
                  section_key:  { type: "string" },
                  parent_key:   { type: "string", nullable: true },
                  title:        { type: "string" },
                  summary:      { type: "string" },
                  content:      { type: "string" },
                  tech_detail:  { type: "string", nullable: true },
                  sort_order:   { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Tạo thành công" },
          400: { description: "Dữ liệu đầu vào không hợp lệ" },
          401: { description: "Thiếu JWT token" },
          403: { description: "Không có quyền (cần technician)" },
          409: { description: "section_key đã tồn tại" },
        },
      },
    },
    "/api/help/articles/{id}": {
      put: {
        tags: ["Help"],
        summary: "Cập nhật bài viết [technician]",
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title:       { type: "string" },
                  summary:     { type: "string" },
                  content:     { type: "string" },
                  tech_detail: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Cập nhật thành công" },
          400: { description: "Không có trường nào để cập nhật" },
          401: { description: "Thiếu JWT token" },
          403: { description: "Không có quyền" },
          404: { description: "Không tìm thấy bài viết" },
        },
      },
      delete: {
        tags: ["Help"],
        summary: "Xóa bài viết [technician]",
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Xóa thành công" },
          401: { description: "Thiếu JWT token" },
          403: { description: "Không có quyền" },
          404: { description: "Không tìm thấy bài viết" },
        },
      },
    },
  },
},
  apis: [], // Không dùng JSDoc scan – spec đã khai báo đầy đủ ở trên
};

export const swaggerSpec = swaggerJsdoc(options);
