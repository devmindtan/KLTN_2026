"""
Test SQL query logic để kiểm tra sự khác biệt giữa 2 loại capacity
Không cần chạy Python, chỉ cần copy SQL vào PostgreSQL client để test
"""

print("""
================================================================================
SQL QUERY ĐỂ TEST
================================================================================

1️⃣ REALTIME CAPACITY - MAX dòng lớn nhất (trực tiếp)
--------------------------------------------------------------------------------
SELECT
    camera_id,
    MAX(total_objects) AS capacity,
    COUNT(*) AS total_records
FROM camera_detections
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND total_objects > 5
GROUP BY camera_id
ORDER BY capacity DESC
LIMIT 10;

💡 Query này lấy giá trị CAO NHẤT từng ghi nhận (peak value)
   Ví dụ: Nếu có 1 dòng với 150 xe → capacity = 150


================================================================================
2️⃣ PREDICTION CAPACITY - MAX của trung bình 5 phút
--------------------------------------------------------------------------------
WITH base_data AS (
    SELECT
        camera_id,
        total_objects,
        to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket
    FROM camera_detections
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND total_objects > 5
),
aggregated_stats AS (
    SELECT
        camera_id,
        time_bucket,
        AVG(total_objects) AS avg_objects,
        COUNT(*) AS records_in_bucket
    FROM base_data
    GROUP BY camera_id, time_bucket
)
SELECT
    camera_id,
    MAX(avg_objects) AS capacity,
    COUNT(*) AS total_buckets,
    SUM(records_in_bucket) AS total_records
FROM aggregated_stats
GROUP BY camera_id
ORDER BY capacity DESC
LIMIT 10;

💡 Query này:
   - Nhóm detections thành bucket 5 phút
   - Tính AVG cho mỗi bucket
   - Lấy MAX của các AVG đó
   Ví dụ: Nhiều dòng 140-150 trong 5p → avg ≈ 145 → capacity = 145


================================================================================
3️⃣ SO SÁNH 2 LOẠI CAPACITY
--------------------------------------------------------------------------------
WITH realtime_cap AS (
    SELECT
        camera_id,
        MAX(total_objects) AS realtime_capacity
    FROM camera_detections
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND total_objects > 5
    GROUP BY camera_id
),
prediction_cap AS (
    SELECT
        camera_id,
        MAX(avg_objects) AS prediction_capacity
    FROM (
        SELECT
            camera_id,
            to_timestamp(floor(extract(epoch from created_at) / 300) * 300) AS time_bucket,
            AVG(total_objects) AS avg_objects
        FROM camera_detections
        WHERE created_at >= NOW() - INTERVAL '7 days'
          AND total_objects > 5
        GROUP BY camera_id, time_bucket
    ) buckets
    GROUP BY camera_id
)
SELECT
    r.camera_id,
    r.realtime_capacity,
    p.prediction_capacity,
    (r.realtime_capacity - p.prediction_capacity) AS difference,
    ROUND((r.realtime_capacity - p.prediction_capacity) / p.prediction_capacity * 100, 1) AS diff_percent
FROM realtime_cap r
JOIN prediction_cap p ON r.camera_id = p.camera_id
ORDER BY difference DESC
LIMIT 10;

💡 Query này cho thấy chênh lệch giữa 2 loại capacity
   - Realtime capacity thường cao hơn (peak values)
   - Prediction capacity là sustainable level (trung bình)

================================================================================
""")
