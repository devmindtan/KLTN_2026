# Tài Liệu Kỹ Thuật Tổng Quan - Hệ Thống Giám Sát Giao Thông Thông Minh

> **Cập nhật**: 24/03/2026  
> **Mục đích**: Giải thích các khái niệm, thuật ngữ và kỹ thuật trong hệ thống giám sát giao thông

---

## 📋 1. TỔNG QUAN HỆ THỐNG

### Giới thiệu

Hệ thống Giám sát Giao thông Thông minh là một giải pháp sử dụng trí tuệ nhân tạo (AI) và học máy (Machine Learning) để:

- **Phân tích**: Phát hiện và đếm phương tiện giao thông qua camera
- **Dự đoán**: Dự báo lưu lượng giao thông tương lai (5-60 phút)
- **Cảnh báo**: Phát hiện xu hướng tắc nghẽn trước khi xảy ra
- **Báo cáo**: Tạo báo cáo phân tích hiệu suất hệ thống

### Kiến trúc Hệ thống

```
┌─────────────┐
│   Camera    │ → Ghi hình giao thông (5-30 giây/frame)
└──────┬──────┘
       ↓
┌─────────────┐
│  AI Vision  │ → Phát hiện & đếm xe (YOLO)
└──────┬──────┘
       ↓
┌─────────────┐
│  Database   │ → Lưu trữ dữ liệu lịch sử
└──────┬──────┘
       ↓
┌─────────────┐
│  ML Engine  │ → Dự đoán lưu lượng (RandomForest)
└──────┬──────┘
       ↓
┌─────────────┐
│  Dashboard  │ → Hiển thị thời gian thực cho người dùng
└─────────────┘
```

### Quy trình Hoạt động

1. **Thu thập dữ liệu**: Camera ghi hình mỗi 5-30 giây
2. **Phân tích hình ảnh**: AI phát hiện và phân loại xe (car, motorbike)
3. **Tính toán trạng thái**: Đánh giá mức độ tắc nghẽn (LOS)
4. **Dự đoán xu hướng**: ML model dự báo 5 mốc thời gian trong tương lai
5. **Hiển thị dashboard**: Cập nhật realtime cho người dùng

---

## 📊 2. THUẬT NGỮ VÀ CÔNG THỨC

### 2.1 Mức Tải (Capacity)

#### Tổng quan

**Mức tải** là khả năng tối đa mà một đoạn đường có thể xử lý trong khoảng thời gian 5 phút, dựa trên dữ liệu lịch sử.

#### Nội dung

Hệ thống tính toán mức tải theo 2 cách:

- **Dự báo**: Lấy trung bình lưu lượng cao nhất trong 7 ngày gần nhất
  - Chia dữ liệu thành các khung 5 phút
  - Tính trung bình mỗi khung
  - Chọn giá trị cao nhất
- **Thời gian thực**: Lấy giá trị đỉnh từng ghi nhận
  - Tìm giá trị lớn nhất trong 7 ngày
  - Phản ánh khả năng quan sát tối đa

#### Ví dụ

Camera A trong 7 ngày có các giá trị trung bình 5 phút: 10, 15, 20, 80, 25 xe...  
→ **Mức tải = 80 xe/5 phút**

---

### 2.2 Dự Báo Đa Mốc (Multi-Horizon Forecasting)

#### Tổng quan

Hệ thống dự đoán lưu lượng giao thông tương lai tại **5 mốc thời gian**: 5, 10, 15, 30, 60 phút.

#### Nội dung

**Tại sao cần 5 mốc?**

- **5-10 phút**: Dự báo ngắn hạn, độ chính xác cao
- **15-30 phút**: Dự báo trung hạn, giúp lên kế hoạch di chuyển
- **60 phút**: Dự báo dài hạn, phát hiện xu hướng tổng thể

**Đặc trưng dự đoán**:

Mỗi dự đoán dựa trên:

- **Thời gian**: Giờ, phút, ngày trong tuần (giờ cao điểm vs giờ thấp điểm)
- **Lịch sử gần**: Lưu lượng 5-60 phút trước
- **Xu hướng**: Tốc độ thay đổi so với các mốc trước

| Mốc dự đoán | Dữ liệu sử dụng  | Độ chính xác |
| ----------- | ---------------- | ------------ |
| 5 phút      | 5-15 phút trước  | Cao nhất     |
| 10 phút     | 5-15 phút trước  | Cao          |
| 15 phút     | 10-30 phút trước | Trung bình   |
| 30 phút     | 15-60 phút trước | Trung bình   |
| 60 phút     | 30-60 phút trước | Thấp hơn     |

#### Kỹ thuật

Hệ thống sử dụng **5 mô hình riêng biệt** (một cho mỗi mốc) để tối ưu độ chính xác:

- Mỗi model được huấn luyện với features phù hợp cho horizon của nó
- Model 5 phút tập trung vào LAG features ngắn (5-15 phút)
- Model 60 phút sử dụng LAG features dài (30-60 phút)
- Tất cả model đều tính toán trend features (tốc độ thay đổi)

---

### 2.3 Độ Phủ Mẫu (Sample Coverage)

#### Tổng quan

**Độ phủ mẫu** là số lượng hình ảnh được xử lý trong một khoảng thời gian, quyết định độ tin cậy của dự đoán.

#### Nội dung

**Tiêu chuẩn lý tưởng**: 360 hình ảnh/giờ (6 FPS × 60 phút)

- Mỗi 5 phút: **30 hình ảnh**
- Cho phép dự đoán đáng tin cậy

**Quy tắc đánh giá**:

| Số hình ảnh | Độ tin cậy    | Ý nghĩa                          |
| ----------- | ------------- | -------------------------------- |
| < 10        | ⚠️ Thấp       | Dữ liệu thiếu nghiêm trọng       |
| 10-30       | 🟡 Trung bình | Chấp nhận được nhưng chưa tối ưu |
| ≥ 30        | ✅ Cao        | Đủ dữ liệu để dự đoán chính xác  |

**Ứng dụng**:

- Đánh giá chất lượng dự đoán
- Phát hiện camera bị lỗi (ít hình ảnh)
- Xác định độ tin cậy của báo cáo

#### Kỹ thuật

Hệ thống theo dõi 3 loại sample count:

1. **Input samples**: Số hình trong khung thời gian hiện tại
2. **LAG samples**: Số hình trong khung thời gian lịch sử
3. **Sync samples**: Số hình khi so sánh dự đoán vs thực tế

---

### 2.4 Mức Tải Hiện Tại & Dự Báo

#### Tổng quan

Hệ thống hiển thị **2 loại trạng thái song song**: Hiện tại (real-time) và Dự báo (5 phút sau).

#### Nội dung

**A. Mức Tải Hiện Tại**

- **Nguồn**: Phân tích hình ảnh trực tiếp
- **Cập nhật**: Mỗi 5-30 giây (tùy camera)
- **Công thức**: `Lưu lượng hiện tại / Mức tải`
- **Ý nghĩa**: Phản ánh tình trạng giao thông ĐANG diễn ra

**B. Mức Tải Dự Báo**

- **Nguồn**: Mô hình học máy
- **Cập nhật**: Mỗi 5 phút
- **Công thức**: `Lưu lượng dự đoán / Mức tải`
- **Ý nghĩa**: Dự báo tình trạng giao thông trong 5-60 phút tới

**Tại sao cần cả 2?**

- **Hiện tại**: "Bây giờ đang thế nào?"
- **Dự báo**: "Sắp tới sẽ thế nào?"
- **Kết hợp**: Giúp người dùng lên kế hoạch tốt hơn

#### Ví dụ

```
Thời điểm 10:00:
- Trạng thái hiện tại: "Trôi chảy" (17/120 xe = 14%)
- Dự báo 10:05: "Vừa phải" (85/120 xe = 71%)
→ Cảnh báo: Giao thông sắp đông đúc, nên di chuyển sớm
```

---

### 2.5 Trạng Thái Giao Thông (LOS - Level of Service)

#### Tổng quan

**LOS** là thang đánh giá mức độ tắc nghẽn giao thông, dựa trên tỉ lệ Lưu lượng/Mức tải (V/C Ratio).

#### Nội dung

**Bảng phân loại 5 mức độ**:

| Mức | Trạng thái       | V/C Ratio | Mô tả                                   | Icon |
| --- | ---------------- | --------- | --------------------------------------- | ---- |
| 1   | **Thông thoáng** | < 60%     | Xe ít, di chuyển tự do                  | 🟢   |
| 2   | **Trôi chảy**    | 60-75%    | Lưu lượng trung bình, vẫn lưu thông tốt | 🔵   |
| 3   | **Vừa phải**     | 75-85%    | Lưu lượng cao, bắt đầu chậm lại         | 🟡   |
| 4   | **Đông đúc**     | 85-95%    | Sắp tắc nghẽn, di chuyển chậm           | 🟠   |
| 5   | **Tắc nghẽn**    | ≥ 95%     | Tắc nghẽn nghiêm trọng                  | 🔴   |

**Cách tính**:

```
V/C Ratio = (Số xe đếm được / Mức tải tối đa) × 100%
```

**Ví dụ**:

- Camera đếm được **75 xe** trong 5 phút
- Mức tải tối đa: **120 xe/5 phút**
- V/C Ratio = 75/120 = **62.5%**
- → Trạng thái: **Trôi chảy** 🔵

#### Kỹ thuật

Hệ thống tự động phân loại dựa trên ngưỡng:

- < 0.60 → Thông thoáng
- 0.60-0.75 → Trôi chảy
- 0.75-0.85 → Vừa phải
- 0.85-0.95 → Đông đúc
- ≥ 0.95 → Tắc nghẽn

---

### 2.6 Xu Hướng (GTI - General Trend Index)

#### Tổng quan

**GTI (General Trend Index)** là chỉ số đánh giá xu hướng tổng hợp dựa trên **tất cả 5 mốc dự đoán** thay vì chỉ so sánh đơn giản 2 giá trị.

#### Nội dung

**Công Thức GTI**:

**Bước 1: Tính Weighted Sum**

```
Weighted_Sum = (P_5m × 0.35) + (P_10m × 0.25) + (P_15m × 0.20)
               + (P_30m × 0.15) + (P_60m × 0.05)
```

**Bước 2: Chuẩn hóa theo Capacity**

```
GTI (%) = (Weighted_Sum / Capacity) × 100
```

**Trọng số (Weights)**:

- `5m`: **35%** (ưu tiên cao nhất - tác động gần nhất)
- `10m`: **25%**
- `15m`: **20%**
- `30m`: **15%**
- `60m`: **5%** (ảnh hưởng ít hơn - xa trong tương lai)

#### Phân Loại Xu Hướng

**So sánh GTI với Current Ratio**:

```
Current_Ratio (%) = (Current_Volume / Capacity) × 100
Diff = GTI - Current_Ratio
```

| Điều kiện          | Kết quả               | Icon |
| ------------------ | --------------------- | ---- |
| `Diff > +5%`       | **Tăng** (increasing) | ⬆️   |
| `Diff < -5%`       | **Giảm** (decreasing) | ⬇️   |
| `-5% ≤ Diff ≤ +5%` | **Ổn định** (stable)  | ➡️   |

#### Trạng Thái GTI (GTI State)

| GTI (%) | Trạng thái       | Mô tả          |
| ------- | ---------------- | -------------- |
| 0-30%   | `thong_thoang`   | Thông thoáng   |
| 31-60%  | `binh_thuong`    | Bình thường    |
| 61-85%  | `bat_dau_ket_xe` | Bắt đầu kẹt xe |
| > 85%   | `nguy_co_ket_xe` | Nguy cơ kẹt xe |

**Ví dụ thực tế**:

```python
# Camera có forecasts (vehicles/5min):
forecasts = {"5m": 80, "10m": 85, "15m": 90, "30m": 95, "60m": 100}
capacity = 120
current_volume = 75

# Tính Weighted Sum
weighted = (80×0.35) + (85×0.25) + (90×0.20) + (95×0.15) + (100×0.05)
         = 28 + 21.25 + 18 + 14.25 + 5
         = 86.5

# Tính GTI
GTI = (86.5 / 120) × 100 = 72.08%

# Tính Current Ratio
Current_Ratio = (75 / 120) × 100 = 62.5%

# So sánh
Diff = 72.08 - 62.5 = +9.58% > +5% → Xu hướng TĂNG ⬆️

# GTI State
72.08% nằm trong [61-85%] → bat_dau_ket_xe (Bắt đầu kẹt xe)
```

#### Kỹ thuật

Hệ thống tính toán GTI theo 3 bước:

1. **Tính weighted sum**: Nhân mỗi forecast với trọng số tương ứng
2. **Chuẩn hóa**: Chia cho capacity để được GTI percentage
3. **So sánh với current**: Tính diff để xác định direction (tăng/giảm/ổn định)

Kết quả bao gồm: GTI value, GTI state, trend direction, và sự chênh lệch so với hiện tại.

---

## 🎯 2. ĐÁNH GIÁ MÔ HÌNH (Model Evaluation)

### 2.7 MAE (Mean Absolute Error)

#### Tổng quan

**MAE** là chỉ số đo sai số trung bình tuyệt đối giữa giá trị dự đoán và thực tế.

#### Nội dung

**Công thức**:

```
MAE = (1/n) × Σ|y_predicted - y_actual|
```

**Ý nghĩa**: Đơn vị là số xe/5 phút. Giá trị thấp hơn = model tốt hơn.

**Ví dụ**: MAE = 5.2 xe → Dự đoán sai lệch trung bình 5.2 xe so với thực tế.

---

### 2.8 MAPE (Mean Absolute Percentage Error)

#### Tổng quan

**MAPE** là phần trăm sai số trung bình, giúp so sánh chất lượng model giữa các cameras khác nhau.

#### Nội dung

**Công thức**:

```
MAPE = (100/n) × Σ|(y_actual - y_predicted) / y_actual|
```

**Phân loại chất lượng**:

| MAPE   | Đánh giá  |
| ------ | --------- |
| < 10%  | Xuất sắc  |
| 10-20% | Tốt       |
| 20-50% | Chấp nhận |
| > 50%  | Kém       |

---

### 2.9 Accuracy Thresholds

#### Tổng quan

Đo tỉ lệ dự đoán có sai số nằm trong ngưỡng chấp nhận được (≤5 xe hoặc ≤10 xe).

#### Nội dung

**Công thức**:

```
Accuracy_≤5xe = (Số predictions có |error| ≤ 5) / Tổng số predictions × 100%
Accuracy_≤10xe = (Số predictions có |error| ≤ 10) / Tổng số predictions × 100%
```

**Ý nghĩa**: Accuracy cao → model ổn định, phù hợp cho ứng dụng thực tế.

---

### 2.10 Độ Chính Xác Xu Hướng (Trend Accuracy)

#### Tổng quan

Đánh giá khả năng model dự đoán đúng **hướng thay đổi** (tăng/giảm/ổn định) của lưu lượng.

#### Nội dung

**Phương pháp**:

1. Xác định xu hướng thực tế: So sánh giá trị actual với input (dựa vào threshold)
2. Xác định xu hướng dự đoán: So sánh giá trị predicted với input
3. Kiểm tra khớp: `is_correct = (actual_trend == predicted_trend)`
4. Tính tỉ lệ: `trend_accuracy = (correct_predictions / total) × 100%`

**Ví dụ**: Trend Accuracy = 85% → Model dự đoán đúng hướng trong 85% trường hợp.

---

### 2.11 Độ Tin Cậy Dự Đoán (Prediction Confidence)

#### Tổng quan

Đánh giá chất lượng **dữ liệu đầu vào** khi tạo dự đoán.

#### Nội dung

**Công thức**:

```
Prediction_Confidence = Average(input_sample_count) / Ideal_Samples × 100%

Ideal_Samples = 30 (cho 5-minute window)
```

**Phân loại**:

- `< 33%`: Low confidence (dữ liệu thiếu nghiêm trọng)
- `33-66%`: Medium confidence
- `> 66%`: High confidence

---

### 2.12 Độ Tin Cậy Sai Số (Error Confidence)

#### Tổng quan

Đánh giá độ chính xác của việc **so sánh predicted vs actual**.

#### Nội dung

**Công thức**:

```
Error_Confidence = Average(sync_sample_count) / Average(input_sample_count) × 100%
```

**Ý nghĩa**:

- **≈ 100%**: Input và sync bucket có cùng số lượng samples → so sánh công bằng
- **<< 100%**: Sync bucket thiếu data → sai số có thể không phản ánh chính xác

---

## 🔧 3. CÁC TÍNH NĂNG & KỸ THUẬT QUAN TRỌNG

### 3.1 Tìm Kiếm Nhanh

**Kỹ thuật**: Fuzzy search + Highlight matching text.

**Implementation**:

- **Frontend**: `web/src/components/highlight-text.tsx`

  ```tsx
  // Component HighlightText để highlight các từ khóa trong kết quả
  // Dùng regex với flag 'gi' (global, case-insensitive)
  ```

- **Backend**: Database indexes
  ```sql
  CREATE INDEX idx_camera_id ON camera_detections(camera_id);
  CREATE INDEX idx_location_gin ON camera_data USING gin(to_tsvector('simple', location));
  ```

**Features**:

- Search theo `location`, `display_name`, `cam_id`
- Highlight từ khóa trong UI (màu vàng)
- Filter theo status/trend real-time

---

### 3.2 WebSocket - FIWARE Orion - Flask

**Kiến trúc**: Real-time data flow từ Backend → Frontend.

```
┌──────────────────┐
│  FIWARE Orion    │ ← Context Broker (NGSI-LD)
│ Context Broker   │
└────────┬─────────┘
         │ HTTP subscription callback
         ↓
┌──────────────────┐
│  Flask Service   │ ← Nhận FIWARE notifications
│  (app-route)     │
└────────┬─────────┘
         │ Socket.IO emit events
         ↓
┌──────────────────┐
│  Node.js Server  │ ← Socket.IO hub
│  Socket.IO Hub   │
└────────┬─────────┘
         │ WebSocket connection
         ↓
┌──────────────────┐
│  React Frontend  │ ← Real-time updates
│  (Dashboard)     │
└──────────────────┘
```

**Events**:

1. **CAMERA_UPDATED**: Cập nhật detection + forecast
2. **TRAINING_PROGRESS**: Tiến độ training model
3. **MODEL_RELOAD**: Load model mới

#### Kỹ thuật

- **FIWARE Orion**: Quản lý entities theo chuẩn NGSI-LD
- **Flask Bridge**: Transform NGSI-LD → JSON đơn giản
- **Socket.IO**: Bidirectional WebSocket với auto-reconnect
- **React Context**: Quản lý state và subscribe events

---

### 3.3 Data Library Collections

#### Tổng quan

Hệ thống lưu trữ và quản lý snapshot dữ liệu hàng ngày.

#### Nội dung

**Mục đích**:

- Phân tích AI/ML offline
- Tạo báo cáo định kỳ
- Audit trail
- Backup dữ liệu

**Collection Types**:

- **detections**: Camera detection history
- **forecasts**: Prediction history
- **metrics**: Model performance history

**Workflow**:

1. **Export**: CronJob chạy mỗi ngày lúc 01:00 UTC
2. **Compression**: CSV → gzip để tiết kiệm storage
3. **Storage**: Upload lên MinIO (object storage)
4. **Metadata**: Lưu thông tin vào PostgreSQL
5. **Download**: API hỗ trợ download single file hoặc batch zip

#### Kỹ thuật

**Materialized Views**:

- **mv_latest_traffic**: Cache 30 ngày dữ liệu gần nhất (refresh mỗi 5 phút)
- **mv_forecast_capacity**: Tính capacity rolling 7 ngày (refresh mỗi giờ)

**Benefits**: Giảm query time từ ~10s xuống <100ms cho dashboard queries.

---

### 3.4 Train Dự Đoán Bằng RandomForestRegressor

#### Tổng quan

**RandomForestRegressor** là thuật toán Ensemble Learning kết hợp nhiều decision trees để giảm overfitting và tăng độ chính xác.

#### Nội dung

**Training Pipeline**:

1. **Query & Preprocess**: Truy vấn dữ liệu lịch sử, tạo LAG features (1-12 steps), LEAD features (targets), temporal features (hour, minute, day_of_week), và trend features

2. **Label Encoding**: Chuyển camera_id (string) → số để model xử lý

3. **Train 5 Models**: Mỗi horizon (5m, 10m, 15m, 30m, 60m) có 1 model riêng biệt
   - Split data: 80% train, 20% test
   - RandomForest config: 100 trees, max depth 20
   - Save model files (.joblib format)

4. **Upload & Metadata**: Upload models lên MinIO, lưu metadata vào DB (is_active=FALSE ban đầu)

**Prediction Pipeline**:

1. Load 5 models từ MinIO
2. Query current data với LAG features
3. Transform camera_id bằng LabelEncoder
4. Predict từng horizon
5. Tính LOS status & GTI trend
6. Save vào DB và update FIWARE Orion

#### Kỹ thuật

- **Schedule**: CronJob chạy mỗi 5 phút (phút 1, 6, 11, 16...)
- **Features**: LAG (1-12), temporal (hour, minute, dow), trend (rate of change)
- **Storage**: Models lưu MinIO, metadata PostgreSQL
- **Activation**: Admin kích hoạt model thông qua UI

---

### 3.5 Hiển Thị Dữ Liệu Dự Đoán Lên Biểu Đồ

#### Tổng quan

Biểu đồ real-time với rolling window hiển thị current và 5 forecast lines.

#### Nội dung

**Tính năng**:

1. **Multiple series**: Current (real-time) + 5 forecast lines (5m, 10m, 15m, 30m, 60m)
2. **Brush timeline**: Zoom/pan trên biểu đồ chính
3. **Tooltips**: Hiển thị tất cả giá trị tại timestamp
4. **Thresholds**: Horizontal lines cho LOS boundaries (60%, 75%, 85%, 95%)
5. **Legend**: Toggle visibility từng series
6. **Auto-scroll**: Cuộn theo giá trị mới nhất

**Data Source**:

- Real-time: WebSocket (CAMERA_UPDATED event)
- Forecast: WebSocket (prediction.forecasts object)
- History: API query cho initial load

#### Kỹ thuật

- **Library**: Recharts (React charting library)
- **Rolling Window**: Giữ 72 points (1 giờ với interval 5 phút)
- **Auto-update**: Mỗi 5 phút thêm data point mới, xóa oldest nếu vượt quá MAX_POINTS
- **Performance**: Virtualization cho large datasets

---

### 3.6 Chế Độ Hiển Thị Wall (Camera Wall View)

**Kỹ thuật**: CSS Grid + Real-time image stream.

**Component**: Có thể implement trong `web/src/pages/monitoring.tsx` (future feature).

**Layout**:

```css
.camera-wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.camera-tile {
  aspect-ratio: 16/9;
  position: relative;
  background: black;
  overflow: hidden;
}

.camera-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 0.5rem;
  color: white;
}
```

**Image Source**:

```typescript
// MinIO pre-signed URL (1 hour expiry)
const imageUrl = `${MINIO_URL}/images/${cameraData.minio_key}`;

// Auto-refresh khi có CAMERA_UPDATED event
useEffect(() => {
  socket.on("CAMERA_UPDATED", (data) => {
    if (data.attrs.minio_key) {
      setImageUrl(
        `${MINIO_URL}/images/${data.attrs.minio_key.value}?t=${Date.now()}`,
      );
    }
  });
}, []);
```

---

### 3.6 Chế Độ Hiển Thị Wall (Camera Wall View)

#### Tổng quan

Giao diện hiển thị nhiều camera đồng thời dạng lưới (grid layout).

#### Nội dung

**Tính năng**:

- Hiển thị nhiều camera feeds cùng lúc (1-4 columns)
- Auto-update khi có ảnh mới (5-30 giây)
- Status badge overlay (LOS color-coded)
- Click để xem full-screen
- Grid responsive (tự động điều chỉnh theo màn hình)

#### Kỹ thuật

- **Layout**: CSS Grid với auto-fit, minmax(300px, 1fr)
- **Aspect ratio**: 16:9 cho video frames
- **Image source**: MinIO pre-signed URLs (1 giờ expiry)
- **Update mechanism**: WebSocket CAMERA_UPDATED event
- **Overlay**: Gradient background với status info

---

### 3.7 CronJobs (Tác Vụ Định Kỳ)

#### Tổng quan

Kubernetes CronJobs để tự động hóa các tác vụ định kỳ.

#### Nội dung

**Danh sách CronJobs**:

| CronJob              | Schedule            | Purpose                            |
| -------------------- | ------------------- | ---------------------------------- |
| image-predict        | Mỗi 5 phút          | Dự đoán realtime                   |
| sync-actual          | Mỗi 5 phút (offset) | Sync giá trị thực tế               |
| model-performance    | 02:00 hàng ngày     | Đánh giá model                     |
| data-export          | 01:00 hàng ngày     | Export data library snapshots      |
| backup-postgres      | 03:00 hàng ngày     | Backup DB lên Google Drive         |
| traffic-mv-refresh   | Mỗi 5 phút          | Refresh mv_latest_traffic          |
| forecast-mv-capacity | Mỗi giờ             | Refresh mv_forecast_capacity       |
| report-generator     | On-demand           | Tạo PDF/XLSX reports (API trigger) |

**Timezone Handling**:

- Container ENV: Asia/Ho_Chi_Minh (display only)
- Storage: **ALWAYS UTC** trong database
- Format: TIMESTAMPTZ (auto convert UTC ↔ local)

#### Kỹ thuật

- **Scheduler**: Kubernetes native CronJob controller
- **Execution**: Spawn container Jobs, auto-cleanup sau 1 giờ
- **Monitoring**: Kubectl logs và Job status
- **Restart policy**: OnFailure (retry nếu lỗi)

---

### 3.8 RBAC của Kubernetes

#### Tổng quan

Role-Based Access Control để Node.js server có thể tạo/quản lý Kubernetes Jobs.

#### Nội dung

**Use Case**: Frontend trigger train model → Node.js API tạo Kubernetes Job.

**Các bước**:

1. **Tạo ServiceAccount**: Identity cho server pods
2. **Định nghĩa Role**: Quyền create/get/list/delete Jobs
3. **Bind Role**: Liên kết Role với ServiceAccount
4. **Apply ServiceAccount**: Gán cho Deployment

**Phạm vi quyền**:

- Resources: Jobs, Pods, Logs
- Verbs: create, get, list, delete
- Namespace: default only (không cluster-wide)

#### Kỹ thuật

- **In-cluster config**: Server pods load ServiceAccount tự động
- **API client**: @kubernetes/client-node (Node.js library)
- **Job creation**: Dynamic manifest generation với resources limits
- **Security**: Namespace-scoped, không access được cluster resources

---

### 3.9 Cấu Hình Tầng Network

#### Tổng quan

Kiến trúc network 2 layers: Cloudflare (public) + Tailscale (private).

#### Nội dung

**A. Cloudflare (External Layer)**:

1. **TLS/SSL**: Automatic HTTPS với Let's Encrypt
2. **Rate Limiting**: Chống DDoS (100 req/min per IP)
3. **CDN**: Cache static assets
4. **WAF**: Web Application Firewall rules
5. **DNS**: Quản lý domain records

**B. Tailscale (Mesh VPN)**:

- **Mục đích**: Private network cho services không cần expose public
- **Use cases**: PostgreSQL, MinIO Admin, Jenkins, Grafana, Longhorn
- **IP range**: 100.x.x.x (Tailscale network)
- **Access control**: Chỉ users trong Tailscale network

**Network Flow**:

```

User → Cloudflare CDN → Cloudflare Tunnel → k3s Ingress
↓
Node.js Server
↓
[Tailscale Network]
↓
PostgreSQL + MinIO (private)

```

#### Kỹ thuật

- **Cloudflare Tunnel**: DaemonSet connector cho zero-trust access
- **Tailscale**: Mesh VPN với WireGuard backend
- **Split routing**: Public traffic (web) vs private (admin/DB)

---

### 3.10 Phân Quyền & Authentication

#### Tổng quan

Hệ thống JWT-based authentication với 2-tier (Guest + Technician).

#### Nội dung

**A. JWT Token Strategy**:

| Token Type    | Role       | Expiry | Permissions          | Storage                |
| ------------- | ---------- | ------ | -------------------- | ---------------------- |
| Guest Token   | viewer     | 24h    | Chỉ đọc (GET)        | localStorage           |
| Access Token  | technician | 8h     | Full CRUD + training | Memory (React Context) |
| Refresh Token | technician | 30d    | Renew access token   | HttpOnly cookie        |

**B. Authentication Flows**:

1. **Guest Flow**: Frontend auto-request → Get viewer token → Lưu localStorage
2. **Technician Login**: Email + password → Bcrypt verify → Issue access + refresh tokens
3. **Token Refresh**: Access expired → Auto call /refresh endpoint → New access token

**C. Route Protection**:

- **Public**: Health check endpoints
- **Guest accessible**: Camera list, model metrics (GET only)
- **Technician only**: Train models, activate models, delete reports

#### Kỹ thuật

- **Middleware chain**: requireAuth → requireTechnician → logActivity
- **XSS Protection**: HttpOnly cookies (không access từ JavaScript)
- **CSRF Protection**: SameSite=Strict cookie attribute
- **Auto-refresh**: Frontend check token expiry mỗi 5 phút
- **Activity logging**: PostgreSQL activity_logs table cho audit trail

---

## 📚 4. TÀI LIỆU THAM KHẢO

### External Documentation

- **Scikit-learn RandomForest**: https://scikit-learn.org/stable/modules/ensemble.html#forests-of-randomized-trees
- **FIWARE Orion**: https://fiware-orion.readthedocs.io/
- **Socket.IO**: https://socket.io/docs/v4/
- **Kubernetes CronJob**: https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/
- **Recharts**: https://recharts.org/
- **ShadcnUI**: https://ui.shadcn.com/

---

## 🎓 5. GLOSSARY (Bảng Thuật Ngữ)

| Thuật ngữ             | Tiếng Anh                      | Giải thích                                                           |
| --------------------- | ------------------------------ | -------------------------------------------------------------------- |
| **Mức tải**           | Capacity                       | Số phương tiện tối đa camera quan sát được trong 5 phút (từ lịch sử) |
| **Dự báo**            | Forecast                       | Dự đoán lưu lượng tương lai bằng ML model                            |
| **Độ phủ mẫu**        | Sample Coverage                | Số lượng hình ảnh được xử lý trong time window                       |
| **Trạng thái**        | Status / LOS                   | Mức độ tắc nghẽn dựa trên V/C ratio                                  |
| **Xu hướng**          | Trend / GTI                    | Hướng thay đổi lưu lượng (tăng/giảm/ổn định)                         |
| **LAG features**      | Lagged Values                  | Giá trị lịch sử tại các mốc trước (5m, 10m, ...)                     |
| **LEAD features**     | Lead Values                    | Giá trị tương lai (chỉ dùng trong training)                          |
| **V/C ratio**         | Volume/Capacity Ratio          | Tỉ lệ lưu lượng hiện tại / mức tải                                   |
| **GTI**               | General Trend Index            | Chỉ số xu hướng tổng hợp từ 5 mốc dự đoán                            |
| **MAE**               | Mean Absolute Error            | Sai số trung bình tuyệt đối                                          |
| **MAPE**              | Mean Absolute Percentage Error | Phần trăm sai số trung bình                                          |
| **FIWARE Orion**      | Context Broker                 | Hệ thống quản lý dữ liệu real-time theo chuẩn NGSI-LD                |
| **CronJob**           | Scheduled Task                 | Tác vụ tự động chạy định kỳ (Kubernetes)                             |
| **RBAC**              | Role-Based Access Control      | Phân quyền dựa trên vai trò người dùng                               |
| **JWT**               | JSON Web Token                 | Token xác thực dạng JSON (stateless auth)                            |
| **Materialized View** | MV                             | Bảng cache kết quả query phức tạp (PostgreSQL)                       |
| **Dual Status**       | -                              | Hiển thị 2 status song song (real-time + forecast)                   |
| **ServiceAccount**    | -                              | Identity cho Pod trong Kubernetes RBAC                               |

---

**Tài liệu này là phiên bản công khai giải thích các khái niệm và kỹ thuật được sử dụng trong hệ thống.**

```

```
