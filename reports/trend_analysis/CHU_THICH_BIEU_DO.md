# Bảng chú thích & diễn giải ngắn cho các biểu đồ hiện có

Phạm vi dữ liệu: 15/02/2026 – 15/04/2026 (theo các script trend_analysis hiện tại).

## 1) Bảng chú thích nhanh

| Tên hình                          | Nhóm         | Chú thích ngắn (hình thể hiện gì)                     | Con số cần đọc                     | Ý nghĩa con số (diễn giải ngắn)                                                              |
| --------------------------------- | ------------ | ----------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `traffic_hourly_heatmap.png`      | Lưu lượng    | Heatmap lưu lượng trung bình theo **giờ x thứ**       | Giá trị số trong từng ô (TB/giờ)   | Ô càng nóng và số càng cao → khung giờ/ngày đó có mật độ giao thông lớn hơn                  |
| `traffic_hourly_avg.png`          | Lưu lượng    | Đường lưu lượng trung bình theo giờ (6h–23h)          | Nhãn “Cao điểm: ...” + đỉnh đường  | Cho biết giờ cao điểm điển hình và mức chênh so với các khung giờ khác                       |
| `traffic_dow_avg.png`             | Lưu lượng    | Cột lưu lượng trung bình theo ngày trong tuần         | Giá trị trên từng cột              | So sánh ngày nào có lưu lượng cao/thấp hơn theo mặt bằng tuần                                |
| `traffic_distribution.png`        | Lưu lượng    | Histogram phân phối tổng lưu lượng/ngày               | μ, σ, min, max                     | μ: mức trung bình; σ: độ dao động; min/max: biên thấp nhất/cao nhất để thấy mức biến thiên   |
| `forecast_error_boxplot.png`      | Dự báo       | Boxplot sai số tuyệt đối theo horizon (5–60 phút)     | Median mỗi box + độ rộng hộp/râu   | Median thấp hơn là tốt hơn; hộp/râu rộng cho thấy dự báo thiếu ổn định                       |
| `forecast_metrics_by_horizon.png` | Dự báo       | So sánh MAE/RMSE/MAPE theo từng horizon               | 3 cụm cột MAE, RMSE, MAPE          | Horizon càng xa thường sai số càng tăng; dùng để chọn mốc dự báo phù hợp vận hành            |
| `forecast_pred_vs_actual.png`     | Dự báo       | So sánh chuỗi dự báo và thực tế cho 2 camera đại diện | Khoảng cách 2 đường + vùng tô giữa | Hai đường càng bám sát, vùng tô càng hẹp → mô hình dự báo càng tốt                           |
| `forecast_scatter.png`            | Dự báo       | Hexbin predicted vs actual trên toàn bộ mẫu           | R², MAE, RMSE (hộp thống kê)       | R² gần 1 là tốt; MAE/RMSE càng thấp càng tốt; điểm gần đường y=x thể hiện dự báo sát thực tế |
| `camera_ranking.png`              | Model/Camera | Top 10 camera tốt nhất & kém nhất theo MAE            | MAE từng camera (2 panel)          | MAE thấp: camera dễ dự báo/ổn định; MAE cao: ưu tiên kiểm tra chất lượng dữ liệu/góc camera  |

---

## 2) Mẫu câu ngắn để đưa vào báo cáo

### Nhóm lưu lượng

- **Heatmap giờ x thứ** cho thấy các ô giờ cao điểm tập trung ở khung thời gian có màu nóng và giá trị TB/giờ cao.
- **Biểu đồ theo giờ** xác định rõ mốc cao điểm trong ngày, làm cơ sở so sánh trước/sau các biện pháp điều tiết.
- **Biểu đồ theo thứ** phản ánh chênh lệch nhu cầu giao thông giữa ngày thường và cuối tuần.
- **Histogram phân phối** cho thấy mức lưu lượng trung bình (μ), độ biến động (σ), và biên cực trị (min/max) của toàn kỳ.

### Nhóm dự báo

- **Boxplot sai số** cho thấy horizon ngắn (5–15 phút) ổn định hơn horizon dài (30–60 phút) khi median và độ phân tán nhỏ hơn.
- **MAE/RMSE/MAPE theo horizon** giúp định lượng mức đánh đổi độ chính xác khi kéo dài thời gian dự báo.
- **Predicted vs Actual theo camera** cho thấy chất lượng bám sát theo chuỗi thời gian và dễ nhìn các đoạn lệch lớn.
- **Hexbin scatter** cung cấp đánh giá tổng thể: R² phản ánh mức phù hợp, MAE/RMSE phản ánh độ lớn sai số tuyệt đối.

### Nhóm camera/model

- **Camera ranking** hỗ trợ ưu tiên vận hành: camera MAE cao cần kiểm tra dữ liệu đầu vào, điều kiện quan sát và tham số mô hình.

---

## 3) Gợi ý kết luận 2-3 dòng (dùng ngay)

- Hệ thống biểu đồ cho thấy lưu lượng có quy luật rõ theo khung giờ và ngày trong tuần, đồng thời tồn tại các camera có mức dao động sai số khác nhau.
- Chất lượng dự báo nhìn chung phù hợp cho mục tiêu ngắn hạn; tuy nhiên sai số tăng theo horizon, do đó cần ưu tiên khai thác dự báo gần thời điểm thực.
- Kết quả ranking camera là căn cứ thực tế để khoanh vùng điểm đo cần hiệu chỉnh dữ liệu hoặc tối ưu mô hình.
