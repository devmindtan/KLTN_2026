# Bảng tổng hợp chức năng đã xây dựng

> Nguồn tổng hợp: `reports/DATA_FLOW.md`, `reports/Functional Decomposition.md` + quét nhanh code thực tế ở `backend/server/src/routes`, `backend/services/*/app`, `web/src/App.tsx`, `web/src/services`, `web/src/contexts`.

| STT | Tên chức năng                                | Diễn giải tổng quan                                                                           | Loại                                   |
| --: | -------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------- |
|   1 | Camera detection realtime (20 camera)        | Tự động theo dõi hình ảnh từ nhiều camera để luôn có số liệu giao thông mới nhất.             | Backend Service (Realtime)             |
|   2 | Lưu detection vào PostgreSQL                 | Lưu lịch sử kết quả quan sát để phục vụ tra cứu, phân tích và đối soát sau này.               | Backend Service (Database Write)       |
|   3 | Upload ảnh detection lên MinIO               | Lưu trữ ảnh đã xử lý để có thể xem lại bằng chứng trực quan theo thời điểm.                   | Backend Service (Storage)              |
|   4 | Tính LOS realtime                            | Xác định mức độ thông thoáng/ùn tắc hiện tại tại từng camera.                                 | Backend Service (Traffic Logic)        |
|   5 | Đồng bộ trạng thái camera lên FIWARE         | Cập nhật trạng thái giao thông lên hệ thống trung gian để các màn hình nhận dữ liệu đồng bộ.  | Backend Service (FIWARE Integration)   |
|   6 | Forecast scheduler nội bộ 5 phút             | Tự động kích hoạt dự báo định kỳ để luôn có dữ liệu ngắn hạn mới.                             | Backend Service (Scheduler)            |
|   7 | Nạp model active từ MinIO khi khởi động      | Bảo đảm hệ thống luôn dùng đúng phiên bản mô hình đang được chọn.                             | Backend Service (Model Management)     |
|   8 | Dự báo 5 horizon (5/10/15/30/60m)            | Cung cấp dự báo lưu lượng cho nhiều mốc thời gian để hỗ trợ ra quyết định sớm.                | Backend Service (ML Inference)         |
|   9 | UPSERT forecast vào DB                       | Lưu kết quả dự báo theo từng camera và từng mốc thời gian để sử dụng nhất quán toàn hệ thống. | Backend Service (Database Write)       |
|  10 | Refresh materialized views forecast          | Làm mới các tập dữ liệu tổng hợp để API trả kết quả nhanh và ổn định.                         | Backend Service (Database Maintenance) |
|  11 | Tính GTI trend                               | Đưa ra xu hướng giao thông đang tăng, giảm hay ổn định để cảnh báo sớm.                       | Backend Service (Traffic Logic)        |
|  12 | Phát tín hiệu ForecastReady                  | Báo cho giao diện biết đã có đợt dự báo mới để tự cập nhật kịp thời.                          | Backend Service (Realtime Signal)      |
|  13 | Đồng bộ actual cho forecast                  | Bổ sung số liệu thực tế vào bản ghi dự báo để có thể so sánh độ chính xác.                    | Backend Service (CronJob)              |
|  14 | Đánh giá model performance hằng ngày         | Tổng hợp chất lượng dự báo mỗi ngày để theo dõi sức khỏe mô hình.                             | Backend Service (CronJob Analytics)    |
|  15 | Lưu lịch sử metrics model                    | Lưu lại các mốc đánh giá để xem xu hướng chất lượng theo thời gian.                           | Backend Service (Database Write)       |
|  16 | Push ModelMetrics lên FIWARE                 | Đồng bộ chỉ số chất lượng mô hình để trang phân tích cập nhật ngay.                           | Backend Service (FIWARE Integration)   |
|  17 | Huấn luyện model theo yêu cầu                | Cho phép tạo mô hình mới theo giai đoạn dữ liệu mong muốn.                                    | Backend Service (On-demand Job)        |
|  18 | Upload artifact model lên MinIO              | Lưu phiên bản mô hình đã huấn luyện để quản lý và tái sử dụng tập trung.                      | Backend Service (Storage)              |
|  19 | Lưu metadata model vào DB                    | Quản lý thông tin phiên bản mô hình để dễ tra cứu, so sánh và kích hoạt.                      | Backend Service (Database Write)       |
|  20 | Kích hoạt model phiên bản mới                | Chuyển hệ thống sang dùng phiên bản mô hình đã chọn.                                          | Backend Service (Model Lifecycle)      |
|  21 | Rollout restart image-predict sau activate   | Áp dụng nhanh phiên bản mô hình mới lên môi trường chạy thực tế.                              | Backend Service (K8s Integration)      |
|  22 | Hot reload model qua HTTP `/reload`          | Cập nhật mô hình đang chạy mà hạn chế gián đoạn dịch vụ.                                      | Backend Service (Model Lifecycle)      |
|  23 | Export dữ liệu D-1 hằng ngày                 | Tự động xuất dữ liệu ngày trước đó để lưu trữ và chia sẻ cho các bên liên quan.               | Backend Service (CronJob Export)       |
|  24 | Export CSV detections                        | Cung cấp tệp phát hiện phương tiện ở định dạng dễ mở và dễ phân tích.                         | Backend Service (Storage Export)       |
|  25 | Export CSV forecasts                         | Cung cấp tệp dự báo để đối chiếu và khai thác ngoài hệ thống.                                 | Backend Service (Storage Export)       |
|  26 | Export JSON summary                          | Tạo tệp tổng hợp nhanh để nắm bức tranh dữ liệu của mỗi lần xuất.                             | Backend Service (Storage Export)       |
|  27 | Quản lý metadata data library                | Quản lý danh mục và bản ghi dữ liệu để tìm lại snapshot thuận tiện.                           | Backend Service (Database Write)       |
|  28 | Sinh báo cáo on-demand (k8s Job)             | Tạo báo cáo theo yêu cầu người dùng cho từng giai đoạn quan tâm.                              | Backend Service (On-demand Job)        |
|  29 | Tạo PDF executive summary                    | Tạo bản báo cáo ngắn gọn cho cấp quản lý đọc nhanh.                                           | Backend Service (Document Generation)  |
|  30 | Tạo XLSX dữ liệu cấu trúc                    | Tạo dữ liệu chi tiết dạng bảng để phân tích sâu và làm việc liên phòng ban.                   | Backend Service (Document Generation)  |
|  31 | Upload file báo cáo lên MinIO                | Lưu và phát hành file báo cáo để người dùng có thể tải xuống khi hoàn tất.                    | Backend Service (Storage + Database)   |
|  32 | Backup PostgreSQL hằng ngày                  | Sao lưu dữ liệu định kỳ để giảm rủi ro mất dữ liệu vận hành.                                  | Backend Service (CronJob Backup)       |
|  33 | Upload backup lên Google Drive               | Đưa bản sao lưu lên kho ngoài để tăng an toàn và khả năng khôi phục.                          | Backend Service (External Integration) |
|  34 | FIWARE webhook router                        | Nhận thay đổi dữ liệu và phân phối thành thông báo realtime đúng loại.                        | Backend Service (Realtime Gateway)     |
|  35 | WebSocket CAMERA_UPDATED                     | Thông báo ngay khi trạng thái camera thay đổi để dashboard cập nhật tức thì.                  | Realtime Event                         |
|  36 | WebSocket FORECAST_UPDATED                   | Thông báo có đợt dự báo mới để các biểu đồ nạp dữ liệu mới nhất.                              | Realtime Event                         |
|  37 | WebSocket METRICS_UPDATED                    | Thông báo khi có đánh giá chất lượng mô hình mới.                                             | Realtime Event                         |
|  38 | WebSocket TRAINING_JOB_UPDATED               | Thông báo tiến độ huấn luyện để người dùng theo dõi trạng thái công việc.                     | Realtime Event                         |
|  39 | WebSocket MODEL_RELOAD_UPDATED               | Thông báo tiến trình cập nhật mô hình đang chạy.                                              | Realtime Event                         |
|  40 | GET `/api/cameras`                           | Cung cấp danh sách camera để hiển thị trên giao diện.                                         | Backend API                            |
|  41 | GET `/api/cameras/:cam_id`                   | Cung cấp thông tin chi tiết của một camera cụ thể.                                            | Backend API                            |
|  42 | GET `/api/cameras/nearby`                    | Gợi ý các camera ở khu vực lân cận theo vị trí người dùng quan tâm.                           | Backend API                            |
|  43 | GET `/api/forecast/rolling`                  | Cung cấp dòng dữ liệu dự báo liên tục cho màn hình theo dõi realtime.                         | Backend API                            |
|  44 | GET `/api/traffic-pattern/patterns`          | Cung cấp mẫu biến động giao thông theo kỳ để phục vụ phân tích xu hướng.                      | Backend API                            |
|  45 | GET `/api/model-metrics/latest`              | Cung cấp kết quả đánh giá mô hình mới nhất.                                                   | Backend API                            |
|  46 | GET `/api/model-metrics/history`             | Cung cấp lịch sử đánh giá mô hình để so sánh theo thời gian.                                  | Backend API                            |
|  47 | GET `/api/models`                            | Cung cấp danh sách mô hình đang được sử dụng hiện tại.                                        | Backend API                            |
|  48 | GET `/api/models/all`                        | Cung cấp toàn bộ phiên bản mô hình để quản trị vòng đời.                                      | Backend API                            |
|  49 | GET `/api/models/data-range`                 | Cung cấp khoảng dữ liệu có thể dùng để huấn luyện mô hình.                                    | Backend API                            |
|  50 | GET `/api/models/:id`                        | Cung cấp thông tin chi tiết của một phiên bản mô hình.                                        | Backend API                            |
|  51 | GET `/api/models/:id/history`                | Cung cấp lịch sử các phiên bản liên quan để theo dõi thay đổi.                                | Backend API                            |
|  52 | POST `/api/models/train`                     | Tiếp nhận yêu cầu huấn luyện mô hình mới từ người dùng kỹ thuật.                              | Backend API                            |
|  53 | POST `/api/models/:id/activate`              | Kích hoạt phiên bản mô hình đã chọn để đưa vào vận hành.                                      | Backend API                            |
|  54 | POST `/api/auth/guest-token`                 | Cấp quyền truy cập nhanh cho người xem không đăng nhập tài khoản kỹ thuật viên.               | Backend API                            |
|  55 | POST `/api/auth/login`                       | Xác thực tài khoản kỹ thuật viên để truy cập chức năng quản trị.                              | Backend API                            |
|  56 | POST `/api/auth/refresh`                     | Gia hạn phiên đăng nhập để người dùng làm việc liên tục.                                      | Backend API                            |
|  57 | POST `/api/auth/logout`                      | Kết thúc phiên làm việc an toàn.                                                              | Backend API                            |
|  58 | GET `/api/auth/me`                           | Trả thông tin hồ sơ của người dùng đang đăng nhập.                                            | Backend API                            |
|  59 | PUT `/api/auth/change-password`              | Cho phép người dùng đổi mật khẩu bảo mật tài khoản.                                           | Backend API                            |
|  60 | GET `/api/auth/activity-logs`                | Cung cấp lịch sử thao tác để kiểm tra và kiểm soát hoạt động tài khoản.                       | Backend API                            |
|  61 | GET `/api/help/articles`                     | Cung cấp danh sách bài viết trợ giúp để tra cứu nhanh.                                        | Backend API                            |
|  62 | POST `/api/help/articles`                    | Cho phép thêm nội dung hướng dẫn mới cho hệ thống.                                            | Backend API                            |
|  63 | PUT `/api/help/articles/:id`                 | Cho phép cập nhật nội dung hướng dẫn khi có thay đổi.                                         | Backend API                            |
|  64 | DELETE `/api/help/articles/:id`              | Cho phép xóa bài viết trợ giúp không còn phù hợp.                                             | Backend API                            |
|  65 | GET `/api/reports`                           | Cung cấp danh sách báo cáo để người dùng tìm và quản lý.                                      | Backend API                            |
|  66 | GET `/api/reports/history`                   | Cung cấp lịch sử thao tác báo cáo để theo dõi vòng đời xử lý.                                 | Backend API                            |
|  67 | GET `/api/reports/:id`                       | Cung cấp chi tiết của một báo cáo cụ thể.                                                     | Backend API                            |
|  68 | POST `/api/reports/generate`                 | Tiếp nhận yêu cầu tạo báo cáo mới theo khoảng thời gian và nhu cầu người dùng.                | Backend API                            |
|  69 | DELETE `/api/reports/:id`                    | Cho phép xóa báo cáo không còn sử dụng.                                                       | Backend API                            |
|  70 | GET `/api/reports/:id/download/zip`          | Cho phép tải toàn bộ file báo cáo trong một lần.                                              | Backend API                            |
|  71 | GET `/api/reports/:id/download/:format`      | Cho phép tải báo cáo theo định dạng mong muốn.                                                | Backend API                            |
|  72 | GET `/api/data-library/collections`          | Cung cấp danh sách kho dữ liệu để người dùng duyệt nhanh.                                     | Backend API                            |
|  73 | GET `/api/data-library/collections/:id`      | Cung cấp chi tiết kho dữ liệu và các bản ghi đi kèm.                                          | Backend API                            |
|  74 | POST `/api/data-library/collections`         | Cho phép tạo kho dữ liệu mới để tổ chức tài nguyên tốt hơn.                                   | Backend API                            |
|  75 | PUT `/api/data-library/collections/:id`      | Cho phép chỉnh sửa thông tin kho dữ liệu.                                                     | Backend API                            |
|  76 | DELETE `/api/data-library/collections/:id`   | Cho phép xóa kho dữ liệu theo chính sách quản trị.                                            | Backend API                            |
|  77 | GET `/api/data-library/entries/:id/download` | Cho phép tải dữ liệu của một bản ghi cụ thể trong thư viện.                                   | Backend API                            |
|  78 | POST `/api/data-library/entries`             | Cho phép đưa dữ liệu mới vào thư viện để dùng chung.                                          | Backend API                            |
|  79 | DELETE `/api/data-library/entries/:id`       | Cho phép xóa bản ghi dữ liệu không còn cần thiết.                                             | Backend API                            |
|  80 | GET `/api/test`                              | Cung cấp điểm kiểm tra nhanh trạng thái phản hồi của hệ thống.                                | Backend API                            |
|  81 | Trang Dashboard                              | Cung cấp màn hình tổng quan giao thông theo thời gian thực.                                   | Frontend Page                          |
|  82 | Trang Monitoring                             | Cung cấp màn hình theo dõi chi tiết trạng thái camera đang vận hành.                          | Frontend Page                          |
|  83 | Trang Analytics                              | Cung cấp màn hình phân tích chất lượng dự báo và xu hướng vận hành.                           | Frontend Page                          |
|  84 | Trang Models                                 | Cung cấp màn hình quản lý vòng đời mô hình từ huấn luyện đến kích hoạt.                       | Frontend Page                          |
|  85 | Trang Data Library                           | Cung cấp màn hình quản lý và khai thác kho dữ liệu tập trung.                                 | Frontend Page                          |
|  86 | Trang Reports                                | Cung cấp màn hình tạo, theo dõi và tải báo cáo.                                               | Frontend Page                          |
|  87 | Trang Team                                   | Cung cấp thông tin thành viên và tổ chức nhóm thực hiện.                                      | Frontend Page                          |
|  88 | Trang Settings                               | Cung cấp khu vực thiết lập tài khoản và tùy chọn người dùng.                                  | Frontend Page                          |
|  89 | Trang Help                                   | Cung cấp trung tâm trợ giúp để đọc và quản lý bài hướng dẫn theo quyền.                       | Frontend Page                          |
|  90 | Trang Documentation                          | Cung cấp khu vực tài liệu nội bộ để tra cứu tập trung.                                        | Frontend Page                          |
|  91 | Trang Search                                 | Cung cấp chức năng tìm kiếm nhanh để điều hướng đến nội dung liên quan.                       | Frontend Page                          |
|  92 | Trang Login                                  | Cung cấp điểm đăng nhập cho người dùng kỹ thuật viên.                                         | Frontend Page                          |
|  93 | Trang Sandbox (DEV)                          | Cung cấp không gian thử nghiệm giao diện/chức năng cho môi trường phát triển.                 | Frontend Page (DEV)                    |
|  94 | AuthContext                                  | Đảm bảo toàn ứng dụng dùng chung trạng thái đăng nhập và quyền truy cập.                      | Frontend Core                          |
|  95 | SocketContext                                | Đảm bảo toàn ứng dụng nhận và xử lý thông báo realtime tập trung.                             | Frontend Core                          |
|  96 | LoadingContext                               | Đảm bảo trải nghiệm tải dữ liệu nhất quán ở toàn bộ màn hình.                                 | Frontend Core                          |
|  97 | ThemeContext                                 | Đảm bảo giao diện hiển thị đồng nhất theo chế độ theme đã chọn.                               | Frontend Core                          |
|  98 | Route guard theo role/prefix                 | Đảm bảo người dùng luôn vào đúng nhánh chức năng theo quyền của mình.                         | Frontend Core                          |
|  99 | Top progress khi chuyển route                | Hiển thị phản hồi trực quan khi người dùng chuyển trang để tránh cảm giác chờ đợi.            | Frontend UX                            |

---

## Bổ sung tính năng cho Release v1.0.0 (append)

> Phần này chỉ bổ sung mới, không thay đổi nội dung bảng gốc phía trên.

| STT | Tên chức năng                                             | Diễn giải tổng quan                                                                                         | Loại                                  |
| --: | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 100 | Decision Analyzer (service)                               | Phân tích đa nguồn dữ liệu và sinh khuyến nghị điều phối theo 5 nhóm: congestion, predictive, optimization, quality, monitoring. | Backend Service (CronJob Analytics)   |
| 101 | Lọc quyết định theo ngưỡng compound score                 | Chỉ lưu các quyết định đạt ngưỡng ưu tiên tối thiểu để giảm nhiễu vận hành.                               | Backend Service (Decision Scoring)    |
| 102 | Dedup quyết định 24h                                      | Tránh lưu trùng quyết định còn hiệu lực theo category/camera/title-prefix.                                | Backend Service (Database Write Guard) |
| 103 | DecisionReady webhook signal                              | Sau khi lưu quyết định mới, phát tín hiệu để frontend cập nhật gần realtime.                              | Backend Service (Realtime Signal)     |
| 104 | WebSocket DECISION_UPDATED                                | app-route phát event cập nhật quyết định mới cho giao diện.                                                | Realtime Event                        |
| 105 | Trang Decision-Making                                     | Màn hình chuyên biệt để xem/xử lý quyết định theo trạng thái, mức ưu tiên và bằng chứng.                 | Frontend Page                         |
| 106 | Decision card v2 với confidence/evidence nâng cao         | Hiển thị confidence breakdown, freshness, model MAPE, mẫu dữ liệu và cảnh báo low-confidence.             | Frontend Component                    |
| 107 | API GET /api/decisions                                    | Truy vấn danh sách quyết định có filter/sort/pagination.                                                   | Backend API                           |
| 108 | API POST /api/decisions/analyze                           | Kích hoạt phân tích sinh quyết định theo ngữ cảnh hiện tại.                                                | Backend API                           |
| 109 | API POST /api/decisions/:id/review                        | Cập nhật quyết định sang trạng thái đã xem xét.                                                            | Backend API                           |
| 110 | API POST /api/decisions/:id/implement                     | Đánh dấu đã thực hiện quyết định.                                                                          | Backend API                           |
| 111 | API DELETE /api/decisions/:id                             | Bỏ qua quyết định khỏi luồng xử lý hiện tại.                                                               | Backend API                           |
| 112 | Hardening auth write-actions                              | Tăng độ bền xác thực cho các action review/implement/dismiss (header/cookie/refresh).                     | Backend API Security                  |
| 113 | Data Library chỉnh sửa collection (UI + API update flow)  | Cho phép sửa metadata collection trực tiếp từ giao diện quản trị.                                          | Frontend + Backend API                |
| 114 | Camera Wall mode                                           | Chế độ hiển thị nhiều camera theo lưới, fullscreen, auto-rotate, phím tắt vận hành.                       | Frontend Feature                      |
| 115 | Dashboard tab Lịch sử lưu lượng                            | Biểu đồ so sánh lịch sử đa mốc ngày (hôm nay, hôm qua, 7 ngày trước, 14 ngày trước) theo khung 5 phút.   | Frontend Feature (Dashboard)          |
| 116 | API GET /api/traffic/history                               | Cung cấp 252 slot lịch sử 5 phút (03:00-23:55) gồm actual và forecast để vẽ chart lịch sử lưu lượng.      | Backend API                           |
| 117 | Trang Bản đồ giao thông nâng cao                           | Bổ sung kiểm tra tuyến đường, chọn A/B trên bản đồ, cập nhật tuyến realtime theo mật độ camera.            | Frontend Feature (Traffic Map)        |
