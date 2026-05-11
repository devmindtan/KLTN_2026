##Hiện có
- Lấy ảnh realtime (camera-ingest)
- Xử lí ảnh realtime (image-process)
- Dự đoán (image-predict)

##Phát triển
- Dự án có 2 quyền chính 
  - Quản lí (management) | Tập trung vào đồ họa trực quan
  - Kỹ thuật (technical) | Cung cấp khả năng truy vấn dữ liệu chi tiết, chỉnh sửa tham số và hiển thị các số liệu thống kê chuyên sâu => Cải thiện độ chính xác và uy tín.
- Cải thiện
  - Dự đoán (image-predict) -> dự đoán đúng với các cột mốc 10 20 30 phút sau
  - Tốc độ => giảm tối đa độ trễ giữa realtime và xử lí ảnh
  - Tăng cường bảo mật
  - Cải thiện kiến trúc code
  - Chọn license phù hợp cho dự án (cùng với các dependencies)
- Phạm vi chức năng theo quyền
  - Quản lí (READ)
  - Kỹ thuật (CREATE-READ-UPDATE-DELETE)
- Các chức năng dự tính
  - Quản lí
    1. Xem các biểu đồ (realtime, predict)
    2. Xuất dữ liệu ra file để tiện phân tích hoặc sẽ cung cấp api để truy cập dữ liệu (chỉ đọc)
  - Kỹ thuật
    1. Cho phép truy vấn và chỉnh sửa trực tiếp dữ liệu của tất cả cơ sở dữ liệu đang có
    2. Hiển thị bảng kết quả so sánh giữa realtime và mô hình dự đoán => để xem được mức độ sai số là bao nhiêu
    3. Train lại mô hình, cập nhật đánh giá mô hình
- Công nghệ:
  - FE
    1. Ngôn ngữ: Typescript
    2. Framework: React, Tailwind (cùng các thư viện UI component khác như ShadCN)
    3. Quản lí phụ thuộc: npm (package.json)
    4. Triển khai: Cloudflare Public Server
  - BE
    1. Ngôn ngữ: Typescript, Python
    2. Framework: Nodejs (Express, JWT,...), Flask
    3. Machine Learning: Yolov11 (Computer Vision), Sklearn (RandomForestRegressor)
    4. Database: Postgres, MongoDB, Sqlite
    5. Cloud Services: Google Cloud (Pub/Sub)
    6. IoT Platform / Middleware: Fiware (Orion)
    7. Object Storage: Minio (S3)
    8. Security: Cloudflare Zero Trust, Tailscale, JWT, Keyrock & Wilma (PEP Proxy)
    9. Quản lí phụ thuộc: npm (package.json), pip (requirements.txt)
    10. CI/CD: Jenkins
    11. Triển khai: Cloudflare Private Server, Docker
  - Quản lí mã nguồn: * Git *


Đăng ký đề tải cần các thông tin sau:
1. Tên đề tài: Ứng dụng Học máy trong Dự đoán Lưu lượng và Phát triển Giao diện Ra quyết định Hỗ trợ Giao thông Đô thị
2. Mục tiêu chính của đề tài:
   Có 2 mục tiêu chính:
      1. Mục tiêu về Công nghệ Lõi (Dự đoán và Hiệu suất)
         Đây là mục tiêu tập trung vào việc cải tiến mô hình và tối ưu hóa hiệu suất của luồng dữ liệu.
         - Mục tiêu 1.1: Phát triển Mô hình Dự đoán Chuỗi Thời gian:
           * Nội dung: Phát triển và triển khai một mô hình Học máy (như LSTM/GRU/ARIMA) có khả năng dự đoán chính xác mật độ và lưu lượng giao thông trong các mốc thời gian ngắn hạn (cụ thể là 10, 20, và 30 phút tiếp theo).
           * Đo lường: Đạt được độ chính xác dự đoán thỏa mãn (ví dụ: RMSE dưới ngưỡng alpha).
         - Mục tiêu 1.2: Tối ưu hóa Hiệu suất Xử lý Dữ liệu:
           * Nội dung: Tối ưu hóa kiến trúc luồng dữ liệu (pipeline) từ thu thập (Ingest) đến xử lý ảnh và dự đoán, nhằm giảm thiểu tối đa độ trễ (latency) giữa dữ liệu thời gian thực và kết quả xử lý.
           * Đo lường: Đạt được độ trễ xử lý toàn hệ thống (End-to-end latency) dưới ngưỡng beta giây.
      2. Mục tiêu về Hệ thống và Ứng dụng (Giao diện Ra quyết định)
         Đây là mục tiêu tập trung vào việc xây dựng hệ thống quản lý có phân quyền để hỗ trợ vận hành và cải tiến.
         - Mục tiêu 2.1: Xây dựng Kiến trúc Hệ thống Phân quyền Bảo mật:
           * Nội dung: Thiết kế và triển khai kiến trúc hệ thống (code module, API) có khả năng phân quyền rõ ràng cho người dùng Quản lý (READ-Only) và Kỹ thuật (CRUD), đồng thời áp dụng các biện pháp tăng cường bảo mật (xác thực, ủy quyền) cho các thao tác nhạy cảm.
         - Mục tiêu 2.2: Phát triển Giao diện Ra quyết định Hỗ trợ Đa vai trò:
           * Nội dung: Xây dựng giao diện người dùng trực quan, bao gồm:
           Dashboard Quản lý: Hiển thị biểu đồ mật độ thời gian thực, dự đoán và các cảnh báo vận hành.
           * Công cụ Kỹ thuật: Cung cấp khả năng truy vấn dữ liệu chi tiết, hiệu chỉnh trực tiếp các tham số thuật toán (để cải thiện) và giao diện quản lý vòng đời mô hình (Train/Update/Evaluate) để đảm bảo độ chính xác và uy tín của hệ thống.
3. Công nghệ và phương pháp thực hiện:
   I. Công nghệ
    - FE
      1. Ngôn ngữ: Typescript
      2. Framework: React, Tailwind (cùng các thư viện UI component khác như ShadCN)
      3. Quản lí phụ thuộc: npm (package.json)
      4. Triển khai: Cloudflare Public Server
    - BE
      1. Ngôn ngữ: Typescript, Python
      2. Framework: Nodejs (Express, JWT,...), Flask
      3. Machine Learning: Yolov11 (Computer Vision), Sklearn (RandomForestRegressor)
      4. Database: Postgres, MongoDB, Sqlite
      5. Cloud Services: Google Cloud (Pub/Sub)
      6. IoT Platform / Middleware: Fiware (Orion)
      7. Object Storage: Minio (S3)
      8. Security: Cloudflare Zero Trust, Tailscale, JWT, Keyrock & Wilma (PEP Proxy)
      9. Quản lí phụ thuộc: npm (package.json), pip (requirements.txt)
      10. CI/CD: Jenkins, Kubernetes (K8s) và Helm, Terraform
      11. Cache: Redis
      12. Alert Server: Grafana, Loki, Promtail
      13. Unit test: Jest, Pytest
      14. Triển khai: Cloudflare Private Server, Docker
    - Quản lí mã nguồn: * Git *

   II. Phương pháp thực hiện
    - Kiến trúc: Microservices
    - Phần cứng dùng: 
      1. Rasperberry pi 4 (4GB RAM, 4 Cores CPU, 64GB Memory Card) - UI Server
      2. PC (16GB RAM, 6 Cores / 12 Threads CPU, GTX 1660 SUPER 6G, 512GB SSD) - Logic Server
      3. Laptop (service) - Control Server, Demo and Develop Applications 
    - Chi tiết cách thực hiện:
      a. Giai đoạn chuẩn bị
        * Tiến hành pull, cấu hình và ảnh xạ cổng cho các docker image (Fiware, Postgres, MongoDB, Minio) lên server
        * Tạo database, schema cho Postgres
        * Tạo database, đăng kí Pub/Sub, tạo các entities cho mỗi camera_id mà mình quản lí lên Fiware/MongoDB
        * Tạo bucket cho Minio
        * Train model phân tích ảnh bằng Yolov11 bằng tập dữ liệu đã chuẩn bị
        * Train model dự đoán bằng RandomForestRegressor (Sklearn) bằng tập dữ liệu đã chuẩn bị
      b. Giai đoạn thực hiện 
        * Lấy dữ liệu các camera từ https://giaothong.hochiminhcity.gov.vn/Map.aspx
        * Tiến hành lấy ảnh 10s/ảnh/cam_id đã trích xuất từ trước bằng service camera-ingest (python) thêm vào minio (S3 API) và gửi message đến service image-process 
        * Nhận message từ camera-ingest và xử lí ảnh bằng model đã train bằng Yolov11 lưu dữ liệu vào postgres sau đó cập nhật trạng thái camera lên Fiware/MongoDB
        * Giao diện nhận trạng thái mới nhất và hiển thị từ Fiware/MongoDB và trả ra mà không cần polling liên tục
        * Service image-predict nhận notifications từ Fiware/MongoDB hoặc kiểm tra dữ liệu đã đủ và tiến hành dự đoán và cập nhật trạng thái dự đoán lên Fiware/MongoDB cùng lúc đó lưu lại dữ liệu dự đoán vào Postgres
        * Dữ liệu realtime sẽ được cập nhật và bổ sung vào bảng dự đoán để so sánh và đánh giá sai số
        * Xây dựng giao diện và lấy dữ liệu từ BE theo các quyền đã quy định
4. Sản phầm/ kết qủa dự kiến:
   1. Hệ thống server chạy các services
   2. Giao diện cho cả hai quyền (Management và Technical)
    - Quản lí (READ)
        1. Xem các biểu đồ (realtime, predict)
        2. Xuất dữ liệu ra file để tiện phân tích hoặc sẽ cung cấp api để truy cập dữ liệu (chỉ đọc)
    - Kỹ thuật (CREATE-READ-UPDATE-DELETE)
        1. Cho phép truy vấn và chỉnh sửa trực tiếp dữ liệu của tất cả cơ sở dữ liệu đang có
        2. Hiển thị bảng kết quả so sánh giữa realtime và mô hình dự đoán => để xem được mức độ sai số là bao nhiêu
        3. Train lại mô hình, cập nhật đánh giá mô hình
5. Yêu cầu/ Tính mới:
   - Dự đoán (image-predict) -> dự đoán đúng với các cột mốc 10 20 30 phút sau
   - Tốc độ -> giảm tối đa độ trễ giữa realtime và xử lí ảnh
   - Tăng cường bảo mật -> server chạy ổn định tránh các tác nhân từ bên ngoài
   - Cải thiện kiến trúc code -> dễ debug, tăng khả năng mở rộng, giảm lỗi vặt, giảm kích thước mã nguồn,...
   - Giao diện -> dễ dàng theo dõi cho cả 2 quyền
   - Chọn license phù hợp cho dự án (cùng với các dependencies)
   
   
- Giải đáp:
Tôi không phải thiết kế cái này ra để khoe vì hiện tại tôi có tận 2 server trong đó 1 server logic (16g ram) và server ui (Raspi 4) nên tôi hiểu mình đang làm gì

Và việc triển khai nhiều như vậy đơn giản vì tôi muốn show khả năng của mình có thể làm được dù không nhất thiết phải làm vậy và cũng vì dự án này liên quan đến ai dự đoán và chạy server liên tục để phân tích ảnh bằng ai và dự đoán bằng model ai nên việc theo dõi cập nhật và bảo trì hết sức quan trọng

nếu không có 1 hệ thống quản lí tốt thì việc theo dõi độ chính xác của ai và các ván đề khác là vô cùng khó khăn, và khó khăn trong quá trình huấn luyện vì chất lượng hình ảnh kém đã không thể cho ra được 1 model dự đoán xác với thực tế nhất ngay từ đầu nên là buộc phải có 1 hệ thống vận hành và cải thiện chất lượng model từ từ qua thời gian.

còn 1 điều nữa là việc phát triển của ai đã làm thay đổi rất nhiều cách một dev làm việc (làm nhiều việc hơn, nhanh hơn, đa nhiệm hơn, tốt hơn, chất lượng hơn) và nên tôi mới tập trung vào việc thứ mà ai vẫn chưa thể nào thay thế được là ra quyết định biến ai là 1 công cụ giúp mình đạt được mục tiêu nhanh hơn.




Integration Test
