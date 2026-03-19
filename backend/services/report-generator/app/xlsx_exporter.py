"""
XLSX Exporter - Tạo structured Excel files cho AI processing
"""
import logging
import pandas as pd
from typing import Dict, Any, List
from datetime import datetime
import json

logger = logging.getLogger(__name__)

def create_structured_data_xlsx(summary: Dict[str, Any], raw_data: pd.DataFrame, report_meta: Dict[str, str]) -> bytes:
    """
    Tạo XLSX với cấu trúc chuẩn cho AI processing
    
    Args:
        summary: AnalyzedSummary dict từ analytics_engine
        raw_data: Raw traffic data DataFrame 
        report_meta: {title, period_from, period_to, generated_at}
        
    Returns:
        XLSX bytes ready for upload
    """
    try:
        # Create Excel writer object
        output = pd.io.common.BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            
            # Sheet 1: Overview Summary
            _write_overview_sheet(writer, summary, report_meta)
            
            # Sheet 2: Time Series Data
            _write_timeseries_sheet(writer, raw_data)
            
            # Sheet 3: Camera Analysis
            _write_cameras_sheet(writer, summary.get("camerasAnalysis", []))
            
            # Sheet 4: Performance Metrics
            _write_metrics_sheet(writer, summary.get("performance", {}))
            
            # Sheet 5: Metadata & Schema
            _write_metadata_sheet(writer, summary, report_meta)
        
        xlsx_bytes = output.getvalue()
        logger.info(f"✅ XLSX generated successfully, size: {len(xlsx_bytes)} bytes")
        
        return xlsx_bytes
        
    except Exception as e:
        logger.error(f"❌ XLSX generation failed: {e}")
        raise

def _write_overview_sheet(writer: pd.ExcelWriter, summary: Dict[str, Any], meta: Dict[str, str]) -> None:
    """Write overview summary to first sheet"""
    overview = summary.get("overview", {})
    
    data = {
        "Metric": [
            "Report Title",
            "Period From", 
            "Period To",
            "Generated At",
            "Total Vehicles",
            "Average Density Score", 
            "Peak Hours Count",
            "Incident Count",
            "Weather Impact"
        ],
        "Value": [
            meta.get("title", ""),
            meta.get("period_from", ""),
            meta.get("period_to", ""),
            meta.get("generated_at", ""),
            overview.get("totalVehicles", 0),
            overview.get("avgDensityScore", 0),
            len(overview.get("peakHours", [])),
            overview.get("incidentCount", 0),
            overview.get("weatherImpact", "none")
        ],
        "Data_Type": [
            "string", "date", "date", "datetime",
            "integer", "float", "integer", "integer", "string"
        ]
    }
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="Overview", index=False)

def _write_timeseries_sheet(writer: pd.ExcelWriter, raw_data: pd.DataFrame) -> None:
    """
    Ghi dữ liệu chuỗi thời gian vào sheet TimeSeries.
    Aggregate theo giờ (group by camera_id + hour_bucket) để tránh vượt giới hạn Excel 1,048,576 rows.
    Raw data 5-phút → ~288 buckets/ngày/camera → phù hợp cho báo cáo.
    """
    if raw_data.empty:
        df = pd.DataFrame(columns=[
            "hour_bucket", "camera_id", "total_objects_sum",
            "avg_objects", "max_objects", "record_count",
            "hour", "day_of_week", "is_weekend"
        ])
    else:
        df = raw_data.copy()
        df['created_at'] = pd.to_datetime(df['created_at'])

        # Truncate về hour bucket (floor về giờ)
        df['hour_bucket'] = df['created_at'].dt.floor('h')
        df['hour']        = df['hour_bucket'].dt.hour
        df['day_of_week'] = df['hour_bucket'].dt.dayofweek
        df['is_weekend']  = (df['day_of_week'] >= 5)

        # Aggregate: mỗi camera × mỗi giờ → 1 row
        df = (
            df.groupby(['hour_bucket', 'camera_id', 'hour', 'day_of_week', 'is_weekend'], as_index=False)
            .agg(
                total_objects_sum=('total_objects', 'sum'),
                avg_objects=('total_objects', 'mean'),
                max_objects=('total_objects', 'max'),
                record_count=('total_objects', 'count'),
            )
        )
        df['avg_objects'] = df['avg_objects'].round(2)
        df = df.sort_values(['hour_bucket', 'camera_id']).reset_index(drop=True)

    logger.info(f"📊 TimeSeries sheet: {len(df)} aggregated rows (hourly buckets)")
    df.to_excel(writer, sheet_name="TimeSeries", index=False)

def _write_cameras_sheet(writer: pd.ExcelWriter, cameras_analysis: List[Dict]) -> None:
    """Write camera-level analysis data"""
    if not cameras_analysis:
        # Create empty template
        df = pd.DataFrame(columns=[
            "camera_id", "camera_name", "total_vehicles", "avg_vehicle_per_hour",
            "peak_density", "incident_count", "reliability_pct", "risk_level", "risk_score"
        ])
    else:
        # Convert to structured format
        data = []
        for cam in cameras_analysis:
            # Convert risk level to numeric score for ML
            risk_score = {"low": 1, "medium": 2, "high": 3}.get(cam.get("riskLevel", "low"), 1)
            
            data.append({
                "camera_id": cam.get("cameraId", ""),
                "camera_name": cam.get("name", ""),
                "total_vehicles": cam.get("totalVehicles", 0),
                "avg_vehicle_per_hour": cam.get("avgVehiclePerHour", 0),
                "peak_density": cam.get("peakDensity", 0),
                "incident_count": cam.get("incidentCount", 0),
                "reliability_pct": cam.get("reliability", 100),
                "risk_level": cam.get("riskLevel", "low"),
                "risk_score": risk_score
            })
        
        df = pd.DataFrame(data)
    
    df.to_excel(writer, sheet_name="Cameras", index=False)

def _write_metrics_sheet(writer: pd.ExcelWriter, performance: Dict[str, Any]) -> None:
    """Write performance metrics for model evaluation"""
    data = {
        "Metric_Name": [
            "model_accuracy",
            "prediction_confidence", 
            "data_quality_score",
            "coverage_percentage",
            "data_points_analyzed",
            "analysis_timestamp"
        ],
        "Value": [
            performance.get("modelAccuracy", 0),
            performance.get("predictionConfidence", 0),
            _quality_to_score(performance.get("dataQuality", "poor")),
            performance.get("coveragePercentage", 0),
            performance.get("dataPoints", 0),  # TODO: Add data point count
            datetime.now().isoformat()
        ],
        "Unit": [
            "percentage", "percentage", "score_1_to_4", 
            "percentage", "count", "iso_datetime"
        ],
        "Description": [
            "Overall ML model accuracy",
            "Average prediction confidence",
            "Data quality assessment (1=poor, 4=excellent)",
            "Percentage of time period with valid data",
            "Total number of data points analyzed",
            "Timestamp of this analysis"
        ]
    }
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="Metrics", index=False)

def _write_metadata_sheet(writer: pd.ExcelWriter, summary: Dict[str, Any], meta: Dict[str, str]) -> None:
    """Write schema and metadata information"""
    # Schema information
    schema_data = {
        "Sheet_Name": ["Overview", "TimeSeries", "Cameras", "Metrics", "Metadata"],
        "Description": [
            "Executive summary metrics and KPIs",
            "Time-series traffic data for ML training",  
            "Camera-level analysis and risk assessment",
            "Model performance and data quality metrics",
            "Schema documentation and metadata"
        ],
        "Primary_Key": ["Metric", "timestamp+camera_id", "camera_id", "Metric_Name", "Field_Name"],
        "Record_Count": [
            9,  # Fixed overview metrics
            meta.get("timeseries_count", 0), 
            len(summary.get("camerasAnalysis", [])),
            6,  # Fixed metrics count
            5   # Fixed schema count
        ]
    }
    
    # Additional metadata
    metadata_info = {
        "Field_Name": [
            "generation_timestamp",
            "report_version", 
            "data_source",
            "analysis_method",
            "quality_threshold"
        ],
        "Value": [
            datetime.now().isoformat(),
            "1.0",
            "camera_detections + camera_forecasts tables",
            "statistical_analysis + anomaly_detection",  
            "95%"
        ],
        "Notes": [
            "When this XLSX file was generated",
            "Smart Reports system version",
            "Source database tables",
            "Analysis algorithms used",
            "Data quality threshold for insights"
        ]
    }
    
    # Write both sections to the metadata sheet
    df_schema = pd.DataFrame(schema_data)
    df_meta = pd.DataFrame(metadata_info)
    
    df_schema.to_excel(writer, sheet_name="Metadata", index=False, startrow=0)
    df_meta.to_excel(writer, sheet_name="Metadata", index=False, startrow=len(df_schema) + 3)

def _quality_to_score(quality: str) -> int:
    """Convert quality string to numeric score for ML processing"""
    quality_map = {
        "poor": 1,
        "fair": 2, 
        "good": 3,
        "excellent": 4
    }
    return quality_map.get(quality.lower(), 1)