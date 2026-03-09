## Bản vá
- Chỉnh sửa lại bar chart giá trị cao nhất hiển thị bên trong bar giống như giá trị trung bình luôn không nằm ở trên
- Còn samples được dùng để tính độ uy tính và ổn định của avg_vehicles. Hiện tại với dữ liệu được cấp là 10s/ảnh/cam thì 1 tiếng sẽ là 360 record được lưu vào database nên là 1 ngày từ 6-24 giờ là bao nhiêu, 1 tuần là bao nhiêu, 1 tháng là bao nhiêu và 1 năm là bao nhiêu hãy lấy đó làm thước đo cố định cho lượng sample được lấy để tính ra lượng sample có đạt chỉ tiêu không theo (%). Tức là sẽ hiển thị thêm đạt bao nhiêu % lượng sample quy định (ví dụ: 9 - 10 giờ đạt 300 samples / 360 samples -> ?? % / 100%). Lưu ý hiển thị ở giữa bên trên 2 cột VD: (70%) và khi xong nhớ xem xét nó có bị đè nếu dữ liệu lớn hơn không. Mục tiêu của thay đổi này là: 
  - Giúp nhìn thấy độ ổn định của logic trích xuất hình ảnh
  - Giúp cho thấy được độ tin cậy của các môc thời gian là tương đương với nhau -> độ ổn định cao
  - Và còn nhiều lý do khác 


## Không đụng

- Chuyển đổi tiếng anh và tiếng việt
- Bổ sung chatbot thông minh có khả năng tổng hợp những dữ liệu báo cáo và đưa ra những đề xuất về quyết định


