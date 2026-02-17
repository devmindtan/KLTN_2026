# Image Predict Service Context

**Last Updated**: 16/02/2026

## Chủ đề:
Ứng dụng Học máy trong Dự đoán Lưu lượng và Phát triển Giao diện Ra quyết định Hỗ trợ Giao thông Đô thị

## Mô tả Service:
Python ML service sử dụng **Random Forest Regressor** để dự đoán lưu lượng giao thông tại các camera trong tương lai (5m, 10m, 15m, 30m, 60m).

### Kiến trúc hệ thống:
```
┌───────────────────────────────────────────────┐
│  PostgreSQL Database                          │
│  - Table: camera_detections (historical)      │
│  - Table: camera_forecasts (predictions)      │
└──────────────┬────────────────────────────────┘
               │ SQL Query (LAG/LEAD features)
               ▼
┌───────────────────────────────────────────────┐
│  Image Predict Service                        │  ← You are here
│  ├─ train.py: Train Random Forest model      │
│  ├─ predict_realtime.py: Live predictions     │
│  ├─ predict_total.py: Batch evaluation        │
│  ├─ query.py: SQL data extraction             │
│  └─ monitor_performance.py: Profiling         │
└──────────────┬────────────────────────────────┘
               │ Update predictions
               ▼
┌───────────────────────────────────────────────┐
│  FIWARE Orion Context Broker                  │
│  - Update Camera entities với forecast data   │
│  - Provide real-time status & trend           │
└───────────────────────────────────────────────┘
```

### Tech Stack:
- **Runtime**: Python 3.11+
- **ML Framework**: scikit-learn (Random Forest)
- **Data Processing**: pandas, numpy
- **Database**: PostgreSQL (via SQLAlchemy)
- **FIWARE Integration**: aiohttp (async HTTP client)
- **Model Persistence**: joblib
- **Profiling**: Custom decorator `@monitor_performance`

### Files:
- `train.py`: Model training
- `predict_realtime.py`: Real-time predictions (CronJob)
- `predict_total.py`: Batch evaluation
- `query.py`: SQL utilities
- `*.joblib`: Model artifacts

### Chức năng chính:

#### 1. Training Pipeline (`train.py`):
- **Input**: Historical data từ `camera_detections` (tối thiểu 100 records)
- **Features**: 
  - Time: hour, minute, day_of_week
  - Current: avg_objects
  - LAG: 5m, 10m, 15m, 30m, 60m (quá khứ)
  - TREND: 5m, 30m, 60m (xu hướng)
- **Targets**: 
  - target_5m, target_10m, target_15m, target_30m, target_60m (tương lai)
- **Model**: RandomForestRegressor (n_estimators=100, max_depth=20)
- **Output**: 
  - `camera_rf_model.joblib`
  - `camera_label_encoder.joblib`
- **Metrics**: MAE, R2 Score

#### 2. Real-time Prediction (`predict_realtime.py`):
- **Trigger**: CronJob/Manual execution
- **Data Source**: Last 2 hours từ `camera_detections`
- **Process**:
  1. Query realtime data với LAG features
  2. Predict với trained model
  3. Save predictions vào `camera_forecasts` table
  4. Update FIWARE Orion với forecast data
  5. Sync actual values để tính error
- **FIWARE Update**:
  - Entity: `urn:ngsi-ld:Camera:{camera_id}`
  - Attributes: `prediction.forecasts`, `prediction.status`, `prediction.trend`
  - Headers: `fiware-service: traffic_monitor`, `fiware-servicepath: /`

#### 3. Batch Evaluation (`predict_total.py`):
- **Purpose**: Đánh giá độ chính xác model trên historical data
- **Input**: Date range (start_date, end_date)
- **Output**: Comparison DataFrame với columns:
  - Camera, Time_Now, Now
  - Cur_5p, Cur_10p, Cur_15p, Cur_30p, Cur_60p (actual)
  - AI_5p, AI_10p, AI_15p, AI_30p, AI_60p (predicted)
- **Metrics**: MAE cho từng horizon (5m, 10m, 15m, 30m, 60m)

#### 4. Query Utilities (`query.py`):
- **`query_from_db_total(start_date, end_date)`**:
  - SQL với LAG/LEAD window functions
  - Tạo features và targets cho training
  - 5-minute bucketing
- **`query_from_db_realtime()`**:
  - Lấy 2 giờ gần nhất
  - Chỉ features (không có targets)
  - Dùng cho prediction
- **`forecast_and_save_to_db(...)`**:
  - Bulk insert predictions vào `camera_forecasts`
  - ON CONFLICT handling
- **`sync_actual_values()`**:
  - Cập nhật `actual_value` và `error_value`
  - Join với `camera_detections`

### Database Schema:

#### Table: `camera_forecasts`
```sql
CREATE TABLE camera_forecasts (
    camera_id           VARCHAR(100) NOT NULL,
    forecast_for_time   TIMESTAMPTZ NOT NULL,
    horizon_minutes     INTEGER NOT NULL,
    predicted_value     DOUBLE PRECISION NOT NULL,
    actual_value        DOUBLE PRECISION DEFAULT NULL,
    error_value         DOUBLE PRECISION DEFAULT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (camera_id, forecast_for_time, horizon_minutes)
);

CREATE INDEX idx_forecast_time_desc ON camera_forecasts (forecast_for_time DESC);
CREATE INDEX idx_sync_null_values ON camera_forecasts (camera_id, forecast_for_time) 
WHERE actual_value IS NULL;
```

### Environment Variables:
**Reference**: `.env.example`

**Key vars**: `POSTGRES_*`, `FIWARE_ORION_BASE`

### ML Model Details:

#### Random Forest Configuration:
- **n_estimators**: 100 (số cây quyết định)
- **max_depth**: 20 (độ sâu tối đa mỗi cây)
- **random_state**: 42 (reproducibility)
- **n_jobs**: -1 (sử dụng tất cả CPU cores)

#### Feature Engineering:
- **LAG Features**: Giá trị quá khứ (5m, 10m, 15m, 30m, 60m)
- **TREND Features**: Thay đổi so với quá khứ
- **Time Features**: hour, minute, day_of_week
- **Camera Encoding**: LabelEncoder cho camera_id

#### Multi-horizon Prediction:
Model predict cùng lúc 5 horizons (Multi-output Regression):
- 5 minutes ahead
- 10 minutes ahead
- 15 minutes ahead
- 30 minutes ahead
- 60 minutes ahead

### Performance Monitoring:
- Decorator `@monitor_performance` track execution time và memory
- Log format: `[PERF] function_name: X.XXs, Memory: Y.YYMB`

### Deployment:

#### CronJob Configuration:
```yaml
# predict_realtime.py
schedule: "*/5 * * * *"  # Mỗi 5 phút
restartPolicy: OnFailure
```

#### Resource Requirements:
- **CPU**: 1-2 cores
- **Memory**: 512MB-1GB
- **Storage**: ~50MB (model files)

### Known Limitations:
- Model cần ít nhất 100 records để train
- LAG features yêu cầu continuous data (gap sẽ gây NaN)
- LabelEncoder chỉ hỗ trợ cameras đã train (new camera sẽ fail)
- Không có model versioning
- Không có A/B testing framework

### Future Enhancements:
- LSTM/GRU models for better time series handling
- AutoML framework (Hyperparameter tuning)
- Model versioning và rollback mechanism
- Online learning (incremental updates)
- Ensemble methods (RF + LSTM + XGBoost)
- Confidence intervals cho predictions
