# 🎯 Decision-Making System Plan (Hệ thống Ra Quyết định)

**Author:** AI Agent  
**Date:** 18/05/2026  
**Status:** Planning & Architecture Design  
**Related:** `/web/src/pages/reports.tsx` → New `DecisionMaker` Tab

---

## 📋 Executive Summary

Tạo hệ thống **Decision-Making** độc lập giúp quản lý giao thông ra quyết định xử lý các cung đường dựa **100% trên dữ liệu thực tế** từ hệ thống. Hệ thống sẽ phân tích lịch sử, dự báo, và hiệu suất model để đề xuất **nhiều khuyến nghị cụ thể** cho từng camera/route.

**Mục tiêu:**
- ✅ Tách biệt khỏi map component  
- ✅ Đặt ở trang Reports (Decision-Making Tab)
- ✅ Phân tích dữ liệu hệ thống (lịch sử, dự báo, model performance)
- ✅ Cung cấp nhiều quyết định có thể hành động được (actionable decisions)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ReportsPage                                 │
├─────────────────────────────────────────────────────────────────┤
│  Tabs: [Reports] [History] [Decision-Making] ←← NEW             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  DecisionMaker Component (NEW)                            │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  1. Data Layer                                            │  │
│  │     ├─ Fetch HistoricalMetrics (past 30 days)           │  │
│  │     ├─ Fetch ForecastAccuracy (model performance)        │  │
│  │     ├─ Fetch CameraStatus (current + trends)            │  │
│  │     └─ Fetch RouteStats (if route selected)             │  │
│  │                                                           │  │
│  │  2. Analysis Engine                                       │  │
│  │     ├─ CongestionAnalyzer (identify bottlenecks)         │  │
│  │     ├─ TrendAnalyzer (detect patterns)                   │  │
│  │     ├─ ForecastAnalyzer (predict issues)                 │  │
│  │     ├─ ModelQualityAnalyzer (assess prediction quality)  │  │
│  │     └─ RouteOptimizer (recommend routing changes)        │  │
│  │                                                           │  │
│  │  3. Decision Generator                                    │  │
│  │     ├─ GenerateRecommendations()                          │  │
│  │     └─ PrioritizeDecisions()                              │  │
│  │                                                           │  │
│  │  4. UI Layer                                              │  │
│  │     ├─ Filter Panel (by camera, severity, type)          │  │
│  │     ├─ DecisionCard[] (each with score + actionable)     │  │
│  │     └─ RationalePanel (explain why + evidence)           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Sources & Inputs

### 1. **Existing System Data**

| Data Type | Source | Purpose | Frequency |
|-----------|--------|---------|-----------|
| **Traffic History** | `camera_traffic_history` table | Analyze historical patterns (peak hours, anomalies) | Daily
| **Forecast Data** | `camera_forecasts` table | Detect predicted bottlenecks | Every 5 min
| **Actual Values** | `camera_forecasts` (sync_value) | Compare vs. predictions for model accuracy | Every 5 min
| **Model Metrics** | `model_metrics_history` table | Assess model quality per camera/horizon | Hourly
| **Camera Status** | WebSocket `processedCameras` | Current LOS + trend + confidence | Real-time
| **Route Analysis** | `traffic-map` RouteAnalysis | Evaluate route performance metrics | On-demand

### 2. **Frontend Services to Use**

```typescript
// web/src/services/
├─ camera.service.ts          // Get camera metadata + history
├─ forecast.service.ts        // Get forecast data
├─ model-metrics.service.ts   // Get model performance
└─ reports.service.ts         // Get report historical data
```

### 3. **Time Windows for Analysis**

| Analysis Type | Window | Rationale |
|---|---|---|
| Daily Patterns | Last 7 days | Identify weekly cycle (weekday vs. weekend) |
| Seasonal Trends | Last 30 days | Detect monthly patterns |
| Model Quality | Last 24 hours | Recent prediction accuracy |
| Prediction Confidence | Last 48 hours | Trend of confidence scores |
| Anomalies | Last 7 days | Unusual events needing investigation |

---

## 🎨 Decision Types & Recommendation Categories

### Category 1: **Congestion Management** (Quản lý ùn tắc)

**When:** Current status is `heavy` or `congested` for >10 min continuously

**Decisions:**
```
D1.1: "Activate alternate route"
      Evidence: Route A avg_duration +25% vs Route B
      Action: Send SMS to drivers via navigation integration
      Priority: HIGH
      
D1.2: "Adjust signal timing"
      Evidence: Peak hour detection + forecast shows +40% increase
      Action: Recommend cycle time extension: 60s → 75s
      Priority: MEDIUM
      
D1.3: "Deploy traffic police"
      Evidence: Incident detected in historical data + manual verification needed
      Action: Coordinate with traffic police dispatch
      Priority: HIGH
      
D1.4: "Enable rush hour restrictions"
      Evidence: 5 consecutive days with congestion at 17:00-18:30
      Action: Consider 1-way lane reversal or parking restrictions
      Priority: MEDIUM
```

### Category 2: **Predictive Intervention** (Phòng chống trước)

**When:** Forecast shows `heavy`/`congested` status likely in next 10-30 min

**Decisions:**
```
D2.1: "Pre-clear junction"
      Evidence: Forecast confidence=85%, +35% volume in 15 min
      Action: Clear intersection preventively before congestion
      Priority: HIGH
      
D2.2: "Reroute incoming traffic"
      Evidence: Upcoming 30min forecast shows peak collision
      Action: Push notification to drivers: "Use alternate route"
      Priority: MEDIUM
      
D2.3: "Request traffic incident investigation"
      Evidence: Sudden volume drop detected in forecast vs history
      Action: Alert patrol to investigate potential accident
      Priority: HIGH
```

### Category 3: **Route Optimization** (Tối ưu hóa tuyến đường)

**When:** Route selection analysis shows significant performance gaps

**Decisions:**
```
D3.1: "Change default route recommendation"
      Evidence: Route B +15% faster on average (historical data)
      Action: Update OSRM weights or app routing logic
      Priority: LOW
      
D3.2: "Create time-dependent route"
      Evidence: Route A best before 10:00, Route B best after 16:00
      Action: Implement dynamic routing based on time window
      Priority: MEDIUM
      
D3.3: "Recommend infrastructure improvement"
      Evidence: Persistent bottleneck at camera_123, despite all mitigations
      Action: Suggest lane expansion or signal upgrade study
      Priority: LOW (Strategic)
```

### Category 4: **Model Quality & Maintenance** (Chất lượng mô hình)

**When:** Model performance degrades below threshold

**Decisions:**
```
D4.1: "Retrain model"
      Evidence: MAPE > 25% for last 24 hours, sample_count low
      Action: Schedule retraining with recent data (past 7-14 days)
      Priority: MEDIUM
      
D4.2: "Investigate data quality"
      Evidence: Prediction confidence <50% (sample counts too low)
      Action: Check camera frames/detections for hardware issues
      Priority: MEDIUM
      
D4.3: "Add manual feature"
      Evidence: Model residuals correlate with weather (not captured)
      Action: Collect weather data, retrain with seasonal feature
      Priority: LOW
      
D4.4: "Swap active model version"
      Evidence: Backup model v1.5.2 has better MAPE on validation set
      Action: Activate v1.5.2 as current model
      Priority: MEDIUM
```

### Category 5: **System Monitoring & Alerts** (Giám sát hệ thống)

**When:** System health indicators show issues

**Decisions:**
```
D5.1: "Investigate missing camera"
      Evidence: Camera_45 no detections for >30 min
      Action: Check camera stream + network connectivity
      Priority: HIGH
      
D5.2: "Verify camera calibration"
      Evidence: Vehicle count inconsistent with adjacent cameras
      Action: Field verification + recalibration if needed
      Priority: MEDIUM
      
D5.3: "Review data labeling"
      Evidence: Model struggles with night-time predictions
      Action: Check if training data includes night-time samples
      Priority: MEDIUM
```

---

## 🧮 Decision Scoring Algorithm

Each decision gets a **compound score** (0-100) based on:

```typescript
Score = (Impact × 0.4) + (Confidence × 0.35) + (Urgency × 0.25)

Where:
  Impact ∈ [0, 100]      // How much will this improve traffic?
  Confidence ∈ [0, 100]  // How sure are we about this recommendation?
  Urgency ∈ [0, 100]     // How time-critical is this action?
```

### Impact Calculation

```typescript
// For Congestion: How many cameras affected? How bad is it?
Impact_Congestion = 
  (affected_camera_count / total_cameras × 100) × 
  (current_los_severity × 0.8 + forecast_duration_minutes × 0.2)

// For Optimization: Time savings
Impact_Optimization = 
  ((old_avg_duration - new_avg_duration) / old_avg_duration) × 100

// For Model Quality: Improvement in prediction accuracy
Impact_Quality = 
  (current_mape - target_mape) / current_mape × 100
```

### Confidence Calculation

```typescript
// Depends on data availability & historical accuracy
Confidence = 
  (historical_sample_count / 1000) × 0.4 +  // Data volume
  (model_accuracy_percent / 100) × 0.4 +     // Prediction quality
  (time_series_consistency / 100) × 0.2      // Pattern stability
```

### Urgency Calculation

```typescript
// Based on severity & time criticality
Urgency = 
  (current_severity / 5) × 0.5 +              // Current state (0-5 scale)
  (time_until_peak_minutes / 60) × 0.3 +      // How soon until problem?
  (previous_incident_frequency × 10) × 0.2   // Historical frequency
```

---

## 📈 UI Components (Frontend)

### Component: `DecisionMaker.tsx` (New)

```typescript
interface Decision {
  id: string;
  category: 'congestion' | 'predictive' | 'optimization' | 'quality' | 'monitoring';
  title: string;                    // e.g., "Activate alternate route"
  score: number;                    // 0-100 compound score
  impact: number;                   // % improvement expected
  confidence: number;               // 0-100 how sure
  urgency: number;                  // 0-100 how time-critical
  cameras: string[];                // Affected camera IDs
  recommendation: string;           // Actionable step
  rationale: string;                // Why? Evidence
  evidence: {
    historicalData?: string;
    forecastData?: string;
    modelMetrics?: string;
    currentStatus?: string;
  };
  actionItems: {
    action: string;
    actor: string;                  // 'technician' | 'driver' | 'system'
    timeToAction: 'immediate' | 'soon' | 'planned';
  }[];
  status: 'new' | 'reviewed' | 'implemented' | 'dismissed';
  createdAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  feedback?: string;
}
```

### Subcomponents

1. **FilterPanel** - Filter by category, severity, camera, status
2. **DecisionCard** - Display single decision with score badge
3. **DecisionDetail** - Full details with rationale + evidence
4. **RationalePanel** - Explain the decision logic (expand/collapse)
5. **DecisionHistory** - Track reviewed & implemented decisions

---

## 🔄 Data Flow & API Endpoints

### New Backend Endpoints Required

```typescript
// GET /api/decisions/analyze
// Query params: ?cameras=cam1,cam2&time_window=24h&category=congestion
// Returns: Decision[]

// GET /api/decisions/history/:cameraId
// Returns: Decision[] for specific camera

// POST /api/decisions/:id/review
// Body: { status, feedback, reviewedBy }
// Returns: { success, updatedDecision }

// POST /api/decisions/:id/implement
// Body: { implementation_details }
// Returns: { success, message }
```

### Analysis Jobs (Batch Processing)

```python
# backend/services/decision-analyzer/app/main.py
# CronJob chạy mỗi 15 min
# 1. Fetch data từ DB (HistoricalMetrics + ForecastData + ModelMetrics)
# 2. Run 5 analyzers song song
# 3. Generate decisions + scores
# 4. Store vào PostgreSQL table `decisions`
# 5. Push notifications qua WebSocket
```

---

## 💾 Database Schema

### New Table: `decisions`

```sql
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  category VARCHAR(50) NOT NULL,      -- congestion/predictive/optimization/quality/monitoring
  title VARCHAR(255) NOT NULL,
  recommendation TEXT NOT NULL,
  rationale TEXT NOT NULL,
  
  -- Scoring
  score_impact NUMERIC(5,2),          -- 0-100
  score_confidence NUMERIC(5,2),      -- 0-100
  score_urgency NUMERIC(5,2),         -- 0-100
  score_compound NUMERIC(5,2),        -- 0-100 (weighted average)
  
  -- Affected entities
  camera_ids JSON,                    -- string[] (affected cameras)
  route_id UUID,                      -- if route-specific
  
  -- Evidence
  evidence JSONB,                     -- {historicalData, forecastData, ...}
  action_items JSONB,                 -- [{action, actor, timeToAction}]
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'new',   -- new/reviewed/implemented/dismissed
  reviewed_by UUID,                   -- technician user_id
  reviewed_at TIMESTAMP,
  feedback TEXT,
  
  -- Metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  effective_until TIMESTAMP,          -- When is this decision no longer valid?
  created_by VARCHAR(50) DEFAULT 'system'  -- 'system' or technician who created
);

CREATE INDEX idx_decisions_status ON decisions(status);
CREATE INDEX idx_decisions_camera_ids ON decisions USING GIN(camera_ids);
CREATE INDEX idx_decisions_generated_at ON decisions(generated_at DESC);
```

---

## 📋 Implementation Roadmap

### Phase 1: Backend Analysis Engine (Week 1)

- [ ] Create `decision-analyzer` Python service
- [ ] Implement 5 analyzer modules (Congestion, Predictive, Optimization, Quality, Monitoring)
- [ ] Create `/api/decisions/*` endpoints
- [ ] Add `decisions` table to DB schema
- [ ] Deploy analyzer CronJob (every 15 min)

### Phase 2: Frontend UI (Week 2)

- [ ] Create `DecisionMaker.tsx` page component
- [ ] Build subcomponents (FilterPanel, DecisionCard, etc.)
- [ ] Add tab to `reports.tsx`
- [ ] Implement decision filtering & sorting
- [ ] Add decision review/feedback workflow

### Phase 3: Integration & Polish (Week 3)

- [ ] WebSocket push notifications for new decisions
- [ ] Decision history tracking
- [ ] Performance optimization (batch processing)
- [ ] Testing & refinement
- [ ] Documentation

---

## 🧪 Testing Strategy

### Unit Tests
- Decision score calculations
- Evidence generation logic
- Analyzer output validation

### Integration Tests
- API endpoints with real data
- Decision storage & retrieval
- Status update workflows

### Acceptance Tests
- Manager can view & filter decisions
- Evidence is clear & actionable
- Decisions help resolve actual traffic issues

---

## 📝 Scoring Examples

### Example 1: Congestion Decision

```
Decision: "Activate alternate route"
Data:
  - Current status: congested (lasted 12 min)
  - Forecast: continuing for +20 min
  - Route B avg_time: 15 min vs Route A: 22 min
  - 150 vehicles affected
  
Scores:
  Impact = (150/500 cameras × 0.3) + (5/5 severity × 0.8) + (20/60 duration) 
         = 0.09 + 0.8 + 0.33 = 42 + boost = 72%
  Confidence = (50000/1000 samples) × 0.4 + (85% model acc) × 0.4 + (0.95 consistency) × 0.2
            = 20 + 34 + 19 = 73%
  Urgency = (5/5 severity) × 0.5 + (5/60 min to peak) × 0.3 + (3 incidents/week) × 10 × 0.2
          = 50 + 2.5 + 6 = 58.5% ≈ 59%
          
Compound Score = (72 × 0.4) + (73 × 0.35) + (59 × 0.25) 
               = 28.8 + 25.55 + 14.75 = 69.1/100 ✅ HIGH PRIORITY
```

### Example 2: Model Quality Decision

```
Decision: "Retrain model for camera_42"
Data:
  - Current MAPE: 28% (threshold: 20%)
  - Sample count last 24h: 450 (low)
  - Previous MAPE: 18%
  - Model age: 15 days
  
Scores:
  Impact = (5% mape improvement potential) × 100 = 50%
  Confidence = (450/1000) × 0.4 + (70% historical acc) × 0.4 + (0.8 consistency) × 0.2
            = 18 + 28 + 16 = 62%
  Urgency = (3/5 severity) × 0.5 + (∞ always urgent) × 0.3 + (frequent issue) × 0.2
          = 30 + 30 + 10 = 70%
          
Compound Score = (50 × 0.4) + (62 × 0.35) + (70 × 0.25)
               = 20 + 21.7 + 17.5 = 59.2/100 ✅ MEDIUM PRIORITY
```

---

## 🚀 Next Steps

1. **Validate** this plan with stakeholders (traffic managers)
2. **Design** database schema in detail
3. **Implement** backend Python analysis engine
4. **Build** frontend UI components  
5. **Test** with real traffic data
6. **Deploy** to production

---

## 📚 References

- `reports/FUNCTION_LIST.md` - Existing backend functions
- `web/src/pages/reports.tsx` - Current reports page structure
- `backend/services/model-performance/app/analyze_metrics.py` - Similar analysis pattern
- `web/src/services/` - All service layer implementations

---

**Last Updated:** 18/05/2026  
**Status:** ✅ Planning Complete - Ready for Implementation
