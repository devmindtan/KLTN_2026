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
      { name: "Auth", description: "Xác thực và phân quyền" },
      { name: "Cameras", description: "Quản lý camera giám sát" },
      { name: "Models", description: "Quản lý model ML" },
      { name: "Model Metrics", description: "Chỉ số hiệu suất model" },
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
    },
  },
  apis: [], // Không dùng JSDoc scan – spec đã khai báo đầy đủ ở trên
};

export const swaggerSpec = swaggerJsdoc(options);
