# Model Performance Metrics — Giải thích Schema

> Source: `app/analyze_metrics.py` | Dữ liệu lấy từ bảng `camera_forecasts` trong 7 ngày gần nhất.

---

## Root

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | string | ID của snapshot trong bảng `model_metrics_history` |
| `generated_at` | ISO datetime | Thời điểm snapshot được tạo |
| `period_days` | int | Số ngày lịch sử được phân tích (mặc định 7) |
| `created_at` | ISO datetime | Thời điểm ghi vào DB |

---

## `overall` — Chỉ số tổng quan

> Tính trên **toàn bộ camera × toàn bộ horizon**, chỉ bao gồm các dự đoán đã có `error_value` (đã sync actual).

| Trường | Ý nghĩa | Công thức |
|---|---|---|
| `total_predictions` | Tổng số bản ghi dự đoán trong kỳ | `COUNT(*)` |
| `verified_predictions` | Số dự đoán đã có `error_value` (đã sync actual) | `COUNT(*) WHERE error_value IS NOT NULL` |
| `verification_rate` | % dự đoán đã được xác minh | `verified / total * 100` |
| `mae` | **Mean Absolute Error** — Sai số tuyệt đối trung bình (đơn vị: xe) | `AVG(error_value)` |
| `rmse` | **Root Mean Square Error** — Phạt nặng hơn MAE với sai số lớn | `SQRT(AVG(error_value²))` |
| `mape` | **Mean Absolute Percentage Error** — Sai số % (bỏ qua actual < 5) | `AVG(error_value / actual_value * 100)` |
| `accuracy_5xe` | % dự đoán có sai số ≤ 5 xe | `COUNT(error≤5) / verified * 100` |
| `accuracy_10xe` | % dự đoán có sai số ≤ 10 xe | `COUNT(error≤10) / verified * 100` |
| `accuracy_15xe` | % dự đoán có sai số ≤ 15 xe | `COUNT(error≤15) / verified * 100` |
| `avg_input_samples` | Trung bình số ảnh trong bucket thời điểm predict | `AVG(input_sample_count)` |
| `avg_lag_samples` | Trung bình số ảnh trong bucket LAG tương ứng | `AVG(lag_sample_count)` |
| `avg_sync_samples` | Trung bình số ảnh khi sync actual | `AVG(sync_sample_count)` |
| `low_sample_forecasts` | Số dự đoán có input < 10 HOẶC lag < 10 (chất lượng thấp) | `COUNT WHERE input<10 OR lag<10` |
| `mismatched_syncs` | Số dự đoán mà \|input - sync\| > 5 (data lúc predict và lúc sync không khớp) | `COUNT WHERE ABS(input-sync) > 5` |

### `overall.prediction_confidence` — Độ tin cậy dự đoán

> Đánh giá **input_sample_count vs lag_sample_count** — dữ liệu đầu vào có nhất quán với dữ liệu LAG không?

| Trường | Ý nghĩa |
|---|---|
| `score` | Điểm tin cậy 0–1. Công thức: `1 - (diff% / 100)`, clamp [0,1] |
| `level` | `High` / `Medium` / `Low` (xem bảng phân loại bên dưới) |
| `avg_input_samples` | Trung bình số mẫu đầu vào |
| `avg_lag_samples` | Trung bình số mẫu LAG |
| `low_sample_count` | Số dự đoán thiếu mẫu (input < 10 hoặc lag < 10) |

**Quy tắc phân loại level:**

| Điều kiện | Level | Score |
|---|---|---|
| input < 10 hoặc lag < 10 | Low | 0.3 (cố định) |
| Cả hai ≥ 30 VÀ diff% < 20% | High | `1 - diff%/100` |
| diff% < 40% | Medium | `1 - diff%/100` |
| diff% ≥ 40% | Low | `1 - diff%/100` |

> Ví dụ thực tế: avg_input=25.4, avg_lag=25.6 → diff% = |25.4-25.6|/25.6 × 100 ≈ 0.8% → score ≈ 0.992 ≈ 1.0. Nhưng vì cả hai < 30 → level = **Medium**.

### `overall.error_confidence` — Độ tin cậy sai số

> Đánh giá **input_sample_count vs sync_sample_count** — số ảnh lúc predict vs lúc sync có gần nhau không?

| Trường | Ý nghĩa |
|---|---|
| `score` | Điểm tin cậy 0–1 |
| `level` | `High` / `Medium` / `Low` |
| `avg_sync_samples` | Trung bình số mẫu sync |
| `mismatched_count` | Số dự đoán bị mismatch (|input-sync| > 5) |

**Quy tắc phân loại:**

| Điều kiện | Level | Score |
|---|---|---|
| input < 10 hoặc sync < 10 | Low | 0.3 |
| \|diff\| > 5 VÀ mismatch% > 30% | Low | 0.4 |
| \|diff\| > 5 VÀ mismatch% ≤ 30% | Medium | 0.6 |
| \|diff\| ≤ 5 VÀ cả hai ≥ 30 | High | 0.95 |
| \|diff\| ≤ 5 VÀ một trong hai < 30 | Medium | 0.75 |

> Ví dụ thực tế: avg_input=25.4, avg_sync=25.1 → diff=0.3 ≤ 5, nhưng cả hai < 30 → **Medium / 0.75**.

---

## `by_horizon` — Phân tích theo mốc thời gian

> Phân tách riêng từng horizon: 5m / 10m / 15m / 30m / 60m.

| Trường | Ý nghĩa |
|---|---|
| `horizon_minutes` | Mốc dự đoán (5/10/15/30/60 phút) |
| `total_predictions` | Tổng số dự đoán tại mốc này |
| `avg_error` | MAE tại mốc này |
| `median_error` | Median của sai số (ít bị ảnh hưởng bởi outlier hơn MAE) |
| `p95_error` | Percentile 95 — 95% dự đoán có sai số ≤ giá trị này |
| `min_error` / `max_error` | Sai số nhỏ nhất / lớn nhất |
| `accuracy_5xe` | % dự đoán sai ≤ 5 xe tại mốc này |
| `accuracy_10xe` | % dự đoán sai ≤ 10 xe tại mốc này |
| `avg_input_samples` | Trung bình input samples tại mốc này |
| `avg_lag_samples` | Trung bình lag samples tại mốc này |
| `avg_sync_samples` | Trung bình sync samples tại mốc này |
| `low_sample_count` | Số dự đoán thiếu mẫu tại mốc này |
| `mismatch_count` | Số dự đoán bị mismatch input vs sync tại mốc này |
| `recommendation` | `KEEP` / `OPTIONAL` / `DROP` |
| `status` | `good` / `fair` / `poor` |
| `prediction_confidence` | Confidence của dự đoán tại mốc (tương tự overall) |
| `error_confidence` | Confidence của sai số tại mốc (tương tự overall) |

**Quy tắc recommendation:**

| avg_error | recommendation | status |
|---|---|---|
| < 4 xe | KEEP | good |
| 4–6 xe | OPTIONAL | fair |
| > 6 xe | DROP | poor |

---

## `camera_ranking` — Xếp hạng camera

> Tính trên **tất cả horizon**, chỉ camera có ít nhất 50 dự đoán. Sắp xếp theo `avg_error ASC`.

### `camera_ranking.best` / `camera_ranking.worst`

| Trường | Ý nghĩa |
|---|---|
| `camera_id` | ID camera trong FIWARE/DB |
| `predictions_count` | Số dự đoán đã verified của camera |
| `avg_error` | MAE trung bình của camera |
| `median_error` | Median sai số |
| `accuracy_5xe` | % dự đoán ≤ 5 xe sai |
| `error_percentage` | `avg_error / avg_actual * 100` — sai số % so với lưu lượng thực tế |

> `best` = top 5 camera có MAE thấp nhất. `worst` = top 5 camera có MAE cao nhất (đảo ngược).

---

## `trend_accuracy` — Độ chính xác xu hướng (GTI-based)

> Tính trên **tất cả 5 horizon** (5m/10m/15m/30m/60m) gộp lại theo công thức GTI, trong 7 ngày gần nhất.

**Cách tính:**

**Bước 1 — Tính max capacity:**
$$\text{max\_capacity}_{cam} = \max(\text{actual\_value}) \text{ trong kỳ, theo từng camera}$$

**Bước 2 — Pivot 5 horizons thành 1 row per (camera\_id, forecast\_for\_time).**
Các row thiếu bất kỳ horizon nào trong 5 mốc sẽ bị loại.

**Bước 3 — Tính GTI với trọng số chuẩn hóa (normalized weights):**

Thay vì loại bỏ các nhóm thiếu horizon, trọng số được phân phối lại cho các horizon có sẵn:

$$W_{eff} = \sum_{i \in \text{available}} w_i$$

$$GTI = \frac{\sum_{i \in \text{available}} P_i \times w_i}{W_{eff} \times \text{max\_capacity}} \times 100 \quad (\%)$$

> Khi đủ 5 horizon: $W_{eff} = 1.0$ → công thức gốc. Khi thiếu: trọng số tự động chuẩn hóa, tránh GTI bị kéo về 0 sai lệch.

$$\text{current\_ratio} = \frac{\text{input\_value}}{\text{max\_capacity}} \times 100 \quad (\%)$$

**Bước 4 — Yêu cầu tối thiểu:** Chỉ cần `pred_5m IS NOT NULL` (horizon quan trọng nhất, weight 0.35) và `input_value IS NOT NULL`. Các horizon còn lại nếu thiếu sẽ được bù bằng cách chuẩn hóa.

**Bước 5 — Phân loại xu hướng:**

| Điều kiện | Predicted trend |
|---|---|
| GTI > current\_ratio + 5% | `increasing` |
| GTI < current\_ratio − 5% | `decreasing` |
| Chênh lệch trong ±5% | `stable` |

Actual trend: `actual_value` (horizon=5m) so với `prev_actual` (LAG cùng camera theo thời gian).

**Bước 6:** "Đúng xu hướng" = `predicted_trend == actual_trend`

| Trường | Ý nghĩa |
|---|---|
| `trend_accuracy` | % dự đoán đúng xu hướng = `correct_predictions / total_checks * 100` |
| `total_checks` | Tổng số nhóm (camera, time) có `pred_5m` + `prev_actual` |
| `correct_predictions` | Số lần đúng xu hướng |
| `correct_increasing` | Số lần đúng khi xu hướng là tăng |
| `correct_decreasing` | Số lần đúng khi xu hướng là giảm |
| `correct_stable` | Số lần đúng khi xu hướng là ổn định |
| `incomplete_groups` | Số nhóm có < 5 horizon (GTI tính từ trọng số chuẩn hóa, ít chính xác hơn) |
| `horizon_coverage_pct` | Trung bình % horizon có sẵn trên tổng nhóm (`avg(available) / 5 * 100`). 100% = tất cả nhóm đủ 5 horizon |
| `method` | `"gti_normalized"` — identifier cho biết dùng GTI với weight normalization |

> **Lưu ý:**
> - `correct_stable` thường thấp vì `actual_value` liên tiếp hiếm khi bằng nhau chính xác.
> - `incomplete_groups > 0` chỉ ra những nhóm GTI kém tin cậy hơn (trọng số được chuẩn hóa thay vì đủ 5 mốc). Nếu `horizon_coverage_pct < 80%` thì `trend_accuracy` cần xem xét thêm.
> - Yêu cầu tối thiểu chỉ là `pred_5m` (thay vì bắt buộc đủ 5 như trước), giúp `total_checks` lớn hơn và kết quả đại diện hơn.

---

## `data_coverage` — Mức bao phủ dữ liệu

| Trường | Ý nghĩa |
|---|---|
| `total_predictions` | Tổng dự đoán trong kỳ (bao gồm chưa sync) |
| `verified` | Số đã có `error_value` (đã sync actual) |
| `pending` | Số chưa có `error_value` (chờ sync hoặc chưa đến thời điểm) |
| `verification_rate` | `verified / total * 100` |
| `last_verification_time` | Timestamp của lần sync gần nhất |
| `minutes_since_update` | Số phút từ lần sync cuối đến lúc tạo snapshot |
