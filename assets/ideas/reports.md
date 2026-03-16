## Bản vá
- Tiếp tục chỉnh sửa
- Cần xác định lại flow để hiển thị dữ liệu lên chart dự báo nó hạn chế delay và chính xác nhât có thể:
  1. image-predict dự báo xong cập nhật fiware -> lưu vào db -> refesh mv -> và gửi thêm 1 notification nữa để cho giao diện nhận được và tiến hành request vào mv để lấy dữ liệu chứ không tự cập nhật nếu dữ liệu chưa có
  2. Chính sửa lại những dữ liệu mà api rolling gửi lên phải được format lại trước khi chart nhận dũ liệu không xử lí tại giao diện nữa làm rất rối giao diện chỉ tập trung xử lí về màu sắc và làm cho thật dễ nhìn không bị ảnh hưởng bởi các logic phức tạp
Hãy bắt đầu thực hiện những việc trên bằng cách lên kế hoạch chỉnh sửa vào ideas để tôi xem trước khi sửa đặc biệt các phần như tạo scrub thì cần cho tôi lệnh curl để tôi tự tạo và phần xử lí dữ liệu cho tôi cái output sau khi xử lí dữ liệu của mv thì data mà api gửi lên trông như thế nào

- Lên kế hoạch tiến hành refactor lại những từ chuyên ngành và nhiều từ được sử dụng đi sử dụng lại trên giao diện cần phải đặt env để mốt có gì dễ dàng sửa đổi hoặc là lấy nó làm biến global để có thể lấy và sử dụng trên tất cả các nơi nếu muốn không phải tạo lại trước tiên hãy thiết kế và liệt kê những từ đấy trên giao diện trước tôi xem là tiến hành chính sửa
## Không đụng
- Các trọng số để tính ra GTI sẽ được điều chỉnh liên tục dự trên độ chính xác của nó để đưa ra các trọng phù hợp với các thời điểm cố định luôn chứ không chỉ để mặc định là 0.35, 0.25,... 
- Chuyển đổi tiếng anh và tiếng việt
- Bổ sung chatbot thông minh có khả năng tổng hợp những dữ liệu báo cáo và đưa ra những đề xuất về quyết định


