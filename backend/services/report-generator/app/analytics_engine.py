"""
Analytics Engine - Chuyển raw traffic data thành analyzed insights
Core logic for traffic pattern analysis, anomaly detection, recommendations
"""
import logging
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np

logger = logging.getLogger(__name__)

def analyze_traffic_data(period_data: pd.DataFrame, cameras_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Chuyển raw data thành analyzed insights
    
    Args:
        period_data: DataFrame với columns [camera_id, created_at, total_objects, detections]
        cameras_df: DataFrame với camera metadata [id, name, location]
    
    Returns:
        AnalyzedSummary dict with overview, performance, insights, camerasAnalysis
    """
    if period_data.empty:
        return _empty_summary()
    
    # Convert timestamps  
    period_data['created_at'] = pd.to_datetime(period_data['created_at'])
    period_data['hour'] = period_data['created_at'].dt.hour
    
    # Overview calculations
    total_vehicles = int(period_data['total_objects'].sum())
    avg_density = round(period_data['total_objects'].mean(), 2)
    
    # Peak hours analysis
    hourly_volumes = period_data.groupby('hour')['total_objects'].sum().sort_values(ascending=False)
    peak_hours = []
    for hour, volume in hourly_volumes.head(3).items():
        severity = "high" if volume > avg_density * 2 else "medium" if volume > avg_density else "low"
        peak_hours.append({
            "hour": f"{hour:02d}:00–{hour+1:02d}:00",
            "volume": int(volume),
            "severity": severity
        })
    
    # Camera-level analysis
    cameras_analysis = []
    for camera_id in period_data['camera_id'].unique():
        camera_data = period_data[period_data['camera_id'] == camera_id]
        camera_info = cameras_df[cameras_df['cam_id'] == camera_id].iloc[0] if len(cameras_df[cameras_df['cam_id'] == camera_id]) > 0 else None
        
        camera_vehicles = int(camera_data['total_objects'].sum())
        avg_per_hour = round(camera_vehicles / max(1, len(camera_data)), 2)
        peak_density = int(camera_data['total_objects'].max()) if not camera_data.empty else 0
        
        # Basic risk assessment
        risk_level = "high" if peak_density > avg_density * 3 else "medium" if peak_density > avg_density * 1.5 else "low"
        
        cameras_analysis.append({
            "cameraId": camera_id,
            "name": camera_info['name'] if camera_info is not None else f"Camera {camera_id[:8]}",
            "totalVehicles": camera_vehicles,
            "avgVehiclePerHour": avg_per_hour,
            "peakDensity": peak_density,
            "incidentCount": 0,  # TODO: Calculate from incident data
            "reliability": 100,  # TODO: Calculate uptime %
            "riskLevel": risk_level
        })
    
    # Generate insights
    trends = _generate_trends(period_data)
    anomalies = _detect_anomalies(period_data)
    recommendations = _generate_recommendations(period_data, peak_hours)
    
    return {
        "overview": {
            "totalVehicles": total_vehicles,
            "avgDensityScore": min(5, max(0, round(avg_density / 100, 1))),  # Convert to 0-5 scale
            "peakHours": peak_hours,
            "incidentCount": 0,  # TODO: Calculate from incident data
            "weatherImpact": "none"  # TODO: Integrate weather data
        },
        "performance": {
            "modelAccuracy": 85.0,  # TODO: Calculate from model metrics
            "predictionConfidence": 78.0,  # TODO: Calculate from confidence scores
            "dataQuality": _assess_data_quality(period_data),
            "coveragePercentage": _calculate_coverage(period_data)
        },
        "insights": {
            "trends": trends,
            "anomalies": anomalies,
            "recommendations": recommendations
        },
        "camerasAnalysis": cameras_analysis
    }

def _empty_summary() -> Dict[str, Any]:
    """Return empty summary structure when no data available"""
    return {
        "overview": {"totalVehicles": 0, "avgDensityScore": 0, "peakHours": [], "incidentCount": 0, "weatherImpact": "none"},
        "performance": {"modelAccuracy": 0, "predictionConfidence": 0, "dataQuality": "poor", "coveragePercentage": 0},
        "insights": {"trends": [], "anomalies": [], "recommendations": ["Không có dữ liệu để phân tích"]},
        "camerasAnalysis": []
    }

def _generate_trends(data: pd.DataFrame) -> List[str]:
    """Generate trend insights from traffic data"""
    trends = []
    
    # Daily pattern
    if len(data) > 24:  # Need enough data points
        recent_avg = data.tail(12)['total_objects'].mean()
        earlier_avg = data.head(12)['total_objects'].mean()
        
        if recent_avg > earlier_avg * 1.1:
            trends.append(f"Lưu lượng tăng {((recent_avg/earlier_avg - 1) * 100):.1f}% trong giai đoạn gần đây")
        elif recent_avg < earlier_avg * 0.9:
            trends.append(f"Lưu lượng giảm {((1 - recent_avg/earlier_avg) * 100):.1f}% trong giai đoạn gần đây")
    
    # Peak time consistency
    peak_hour = data.groupby('hour')['total_objects'].sum().idxmax()
    trends.append(f"Giờ cao điểm ổn định vào {peak_hour:02d}:00")
    
    return trends

def _detect_anomalies(data: pd.DataFrame) -> List[str]:
    """Detect traffic anomalies using statistical methods"""
    anomalies = []
    
    if len(data) < 5:
        return anomalies
    
    # Statistical outlier detection
    Q1 = data['total_objects'].quantile(0.25)
    Q3 = data['total_objects'].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    
    outliers = data[(data['total_objects'] < lower_bound) | (data['total_objects'] > upper_bound)]
    
    for _, outlier in outliers.head(3).iterrows():  # Limit to 3 anomalies
        time_str = outlier['created_at'].strftime('%H:%M')
        camera_short = outlier['camera_id'][:8]
        if outlier['total_objects'] > upper_bound:
            anomalies.append(f"Ùn tắc bất thường {time_str} Camera-{camera_short} ({int(outlier['total_objects'])} xe)")
        else:
            anomalies.append(f"Lưu lượng thấp bất thường {time_str} Camera-{camera_short}")
    
    return anomalies

def _generate_recommendations(data: pd.DataFrame, peak_hours: List[Dict]) -> List[str]:
    """Generate actionable recommendations based on traffic patterns"""
    recommendations = []
    
    if not peak_hours:
        return ["Cần dữ liệu nhiều hơn để đưa ra khuyến nghị"]
    
    # Peak hour recommendations
    highest_peak = peak_hours[0]
    if highest_peak['severity'] == 'high':
        peak_time = highest_peak['hour']
        recommendations.append(f"Cân nhắc tăng cường tuần tra trong khung giờ {peak_time}")
    
    # Camera coverage recommendations
    camera_counts = data.groupby('camera_id').size()
    if len(camera_counts) < 5:
        recommendations.append("Xem xét bổ sung thêm camera giám sát để tăng độ phủ sóng")
    
    # Data quality recommendations
    if data['total_objects'].std() > data['total_objects'].mean():
        recommendations.append("Biến động lưu lượng cao - cần phân tích sâu hơn về nguyên nhân")
    
    return recommendations

def _assess_data_quality(data: pd.DataFrame) -> str:
    """Assess overall data quality based on completeness and consistency"""
    if data.empty:
        return "poor"
    
    # Check for missing values and consistency
    missing_ratio = data.isnull().sum().sum() / (len(data) * len(data.columns))
    
    if missing_ratio < 0.05:
        return "excellent"
    elif missing_ratio < 0.15:
        return "good"
    elif missing_ratio < 0.3:
        return "fair"
    else:
        return "poor"

def _calculate_coverage(data: pd.DataFrame) -> float:
    """Calculate data coverage percentage based on expected vs actual data points"""
    if data.empty:
        return 0.0
    
    # Simplified coverage calculation
    # In real implementation, this would compare against expected data collection frequency
    return min(100.0, len(data) / max(1, len(data)) * 100)

# ═════════════════════════════════════════════════════════════════════════════
# 🔀 Chunk Merging - Aggregate results from multiple chunks
# ═════════════════════════════════════════════════════════════════════════════

def merge_analyzed_chunks(chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    🔀 MERGE: Aggregate analyzed results from multiple chunks
    
    Args:
        chunks: List of {index, period_from, period_to, analysis{...}, record_count}
        
    Returns:
        Merged AnalyzedSummary dict (same structure as analyze_traffic_data output)
    """
    if not chunks:
        return _empty_summary()
    
    # Initialize accumulators
    total_vehicles = 0
    total_records = 0
    all_peak_hours = {}  # hour -> accumulated_volume
    all_cameras = {}     # camera_id -> aggregated metrics
    all_anomalies = []
    all_trends = []
    
    # ────────────────────────────────────────────────────────
    # 1️⃣ Aggregate overview metrics
    # ────────────────────────────────────────────────────────
    for chunk in chunks:
        analysis = chunk["analysis"]
        overview = analysis.get("overview", {})
        
        # Sum vehicles
        total_vehicles += overview.get("totalVehicles", 0)
        total_records += chunk.get("record_count", 0)
        
        # Collect peak hours (will recalculate weighted avg)
        for peak in overview.get("peakHours", []):
            hour_key = peak["hour"]  # e.g., "14:00–15:00"
            if hour_key not in all_peak_hours:
                all_peak_hours[hour_key] = {"volume": 0, "severity": "low"}
            all_peak_hours[hour_key]["volume"] += peak.get("volume", 0)
        
        # Collect anomalies and trends
        all_anomalies.extend(analysis.get("insights", {}).get("anomalies", []))
        all_trends.extend(analysis.get("insights", {}).get("trends", []))
        
        # Merge camera analyses
        for camera_data in analysis.get("camerasAnalysis", []):
            cam_id = camera_data["cameraId"]
            if cam_id not in all_cameras:
                all_cameras[cam_id] = {
                    "cameraId": cam_id,
                    "name": camera_data["name"],
                    "totalVehicles": 0,
                    "peakDensity": 0,
                    "recordCount": 0,
                    "chunkCount": 0
                }
            
            cam = all_cameras[cam_id]
            cam["totalVehicles"] += camera_data.get("totalVehicles", 0)
            cam["peakDensity"] = max(cam["peakDensity"], camera_data.get("peakDensity", 0))
            cam["recordCount"] += camera_data.get("totalVehicles", 0)
            cam["chunkCount"] += 1
    
    # ────────────────────────────────────────────────────────
    # 2️⃣ Recalculate peak hours
    # ────────────────────────────────────────────────────────
    avg_density = total_vehicles / max(1, len(chunks))
    peak_hours_list = []
    
    for hour_key in sorted(all_peak_hours.keys(), 
                           key=lambda h: all_peak_hours[h]["volume"], 
                           reverse=True)[:3]:  # Top 3
        volume = all_peak_hours[hour_key]["volume"]
        severity = "high" if volume > avg_density * 2 else "medium" if volume > avg_density else "low"
        peak_hours_list.append({
            "hour": hour_key,
            "volume": volume,
            "severity": severity
        })
    
    # ────────────────────────────────────────────────────────
    # 3️⃣ Calculate final camera metrics
    # ────────────────────────────────────────────────────────
    cameras_analysis = []
    for cam in all_cameras.values():
        avg_per_hour = round(cam["totalVehicles"] / max(1, cam["recordCount"]), 2) if cam["recordCount"] > 0 else 0
        risk_level = "high" if cam["peakDensity"] > avg_density * 3 else "medium" if cam["peakDensity"] > avg_density * 1.5 else "low"
        
        cameras_analysis.append({
            "cameraId": cam["cameraId"],
            "name": cam["name"],
            "totalVehicles": cam["totalVehicles"],
            "avgVehiclePerHour": avg_per_hour,
            "peakDensity": cam["peakDensity"],
            "incidentCount": 0,
            "reliability": 100,
            "riskLevel": risk_level,
            "processedChunks": cam["chunkCount"]
        })
    
    # ────────────────────────────────────────────────────────
    # 4️⃣ Deduplicate anomalies and trends
    # ────────────────────────────────────────────────────────
    unique_anomalies = list(dict.fromkeys(all_anomalies))[:10]  # Remove dupes, limit 10
    unique_trends = list(dict.fromkeys(all_trends))[:10]        # Remove dupes, limit 10
    
    # ────────────────────────────────────────────────────────
    # 5️⃣ Return merged summary
    # ────────────────────────────────────────────────────────
    return {
        "overview": {
            "totalVehicles": total_vehicles,
            "avgDensityScore": min(5, max(0, round(avg_density / 100, 1))),
            "peakHours": peak_hours_list,
            "incidentCount": 0,
            "weatherImpact": "none",
            "chunksProcessed": len(chunks)
        },
        "performance": {
            "modelAccuracy": 85.0,
            "predictionConfidence": 78.0,
            "dataQuality": "good" if total_records > 1000 else "fair",
            "coveragePercentage": min(100.0, len(all_cameras) / max(1, len(all_cameras)) * 100)
        },
        "insights": {
            "trends": unique_trends,
            "anomalies": unique_anomalies,
            "recommendations": _generate_recommendations_from_merged(
                total_vehicles, avg_density, peak_hours_list, len(chunks)
            )
        },
        "camerasAnalysis": cameras_analysis
    }

def _generate_recommendations_from_merged(
    total_vehicles: int,
    avg_density: float,
    peak_hours: List[Dict],
    chunk_count: int
) -> List[str]:
    """Generate recommendations based on merged chunk data"""
    recommendations = []
    
    if total_vehicles > 100000:
        recommendations.append("🚨 Lưu lượng rất cao - kiểm tra khả năng quản lý giao thông")
    elif total_vehicles > 50000:
        recommendations.append("⚠️ Lưu lượng cao - xem xét tăng cường giám sát")
    
    if peak_hours:
        peak_hour = peak_hours[0]["hour"]
        recommendations.append(f"📍 Tập trung vào giờ cao điểm {peak_hour}")
    
    recommendations.append(f"✅ Dữ liệu từ {chunk_count} chunks - năng lượng xử lý hiệu quả")
    
    return recommendations