"""
PDF Generator - Tạo executive summary PDF reports với charts và analysis
"""
import io
import logging
from typing import Dict, Any
from datetime import datetime

# PDF/HTML generation
from jinja2 import Template
from weasyprint import HTML, CSS

# Charts generation
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.figure import Figure
import base64

logger = logging.getLogger(__name__)

def create_executive_summary_pdf(summary: Dict[str, Any], report_meta: Dict[str, str]) -> bytes:
    """
    Tạo PDF báo cáo executive summary cho cấp quản lý
    
    Args:
        summary: AnalyzedSummary dict từ analytics_engine
        report_meta: {title, period_from, period_to, generated_at}
        
    Returns:
        PDF bytes ready for upload
    """
    try:
        # Generate charts
        charts_data = _generate_chart_images(summary)
        
        # Prepare template data
        template_data = {
            **report_meta,
            **summary,
            "charts": charts_data,
            "generated_date": datetime.now().strftime("%d/%m/%Y %H:%M")
        }
        
        # Render HTML
        html_content = _render_html_template(template_data)
        
        # Convert to PDF
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        logger.info(f"✅ PDF generated successfully, size: {len(pdf_bytes)} bytes")
        return pdf_bytes
        
    except Exception as e:
        logger.error(f"❌ PDF generation failed: {e}")
        raise

def _generate_chart_images(summary: Dict[str, Any]) -> Dict[str, str]:
    """Generate base64-encoded chart images for embedding in PDF"""
    charts = {}
    
    try:
        # Peak Hours Bar Chart
        if summary.get("overview", {}).get("peakHours"):
            charts["peak_hours"] = _create_peak_hours_chart(summary["overview"]["peakHours"])
        
        # Camera Analysis Pie Chart
        if summary.get("camerasAnalysis"):
            charts["cameras_distribution"] = _create_cameras_chart(summary["camerasAnalysis"])
            
    except Exception as e:
        logger.warning(f"Charts generation failed: {e}")
        charts = {"error": "Không thể tạo biểu đồ"}
    
    return charts

def _create_peak_hours_chart(peak_hours: list) -> str:
    """Create peak hours bar chart and return as base64 string"""
    fig, ax = plt.subplots(figsize=(8, 5))
    
    hours = [p["hour"] for p in peak_hours[:5]]  # Top 5 hours
    volumes = [p["volume"] for p in peak_hours[:5]]
    colors = ['#dc2626' if p["severity"] == "high" else '#f59e0b' if p["severity"] == "medium" else '#16a34a' for p in peak_hours[:5]]
    
    bars = ax.bar(hours, volumes, color=colors, alpha=0.8)
    ax.set_title("Giờ Cao Điểm Giao Thông", fontsize=14, fontweight='bold')
    ax.set_ylabel("Số Lượng Xe", fontsize=12)
    ax.set_xlabel("Khung Giờ", fontsize=12)
    
    # Add value labels on bars
    for bar, volume in zip(bars, volumes):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + height*0.01,
                f'{int(volume)}', ha='center', va='bottom', fontsize=10)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    
    return _fig_to_base64(fig)

def _create_cameras_chart(cameras_analysis: list) -> str:
    """Create camera distribution pie chart and return as base64 string"""
    if not cameras_analysis:
        return ""
    
    fig, ax = plt.subplots(figsize=(8, 6))
    
    # Get camera data
    names = [c["name"][:20] for c in cameras_analysis[:6]]  # Top 6 cameras, truncate names
    vehicles = [c["totalVehicles"] for c in cameras_analysis[:6]]
    
    colors = plt.cm.Set3(range(len(names)))  # Use colorful palette
    
    wedges, texts, autotexts = ax.pie(vehicles, labels=names, autopct='%1.1f%%', 
                                     colors=colors, startangle=90)
    
    ax.set_title("Phân Bố Lưu Lượng Theo Camera", fontsize=14, fontweight='bold')
    
    # Improve text readability
    for autotext in autotexts:
        autotext.set_fontsize(10)
        autotext.set_fontweight('bold')
    
    plt.tight_layout()
    
    return _fig_to_base64(fig)

def _fig_to_base64(fig: Figure) -> str:
    """Convert matplotlib figure to base64 string for embedding in HTML"""
    buffer = io.BytesIO()
    fig.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    plt.close(fig)  # Clean up memory
    return f"data:image/png;base64,{img_base64}"

def _render_html_template(data: Dict[str, Any]) -> str:
    """Render HTML template with data for PDF conversion"""
    
    template_content = """
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>{{ title }}</title>
    <style>
        body { font-family: 'DejaVu Sans', Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1e40af; margin: 0; font-size: 24px; }
        .header .meta { color: #6b7280; font-size: 14px; margin-top: 10px; }
        
        .section { margin: 30px 0; }
        .section h2 { color: #1f2937; border-left: 4px solid #3b82f6; padding-left: 15px; margin-bottom: 20px; }
        
        .overview-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; }
        .stat-card .value { font-size: 24px; font-weight: bold; color: #059669; }
        .stat-card .label { color: #6b7280; font-size: 14px; }
        
        .chart-container { text-align: center; margin: 20px 0; }
        .chart-container img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; }
        
        .insights ul { list-style: none; padding: 0; }
        .insights li { background: #fef3c7; padding: 10px; margin: 8px 0; border-radius: 6px; border-left: 4px solid #f59e0b; }
        
        .cameras-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .cameras-table th, .cameras-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .cameras-table th { background: #f9fafb; font-weight: 600; }
        
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <!-- Header Section -->
    <div class="header">
        <h1>{{ title }}</h1>
        <div class="meta">
            Kỳ báo cáo: {{ period_from }} đến {{ period_to }}<br>
            Tạo lúc: {{ generated_date }}
        </div>
    </div>
    
    <!-- Executive Summary -->
    <div class="section">
        <h2>📊 Tổng Quan</h2>
        <div class="overview-grid">
            <div class="stat-card">
                <div class="value">{{ "{:,}".format(overview.totalVehicles) }}</div>
                <div class="label">Tổng Số Xe</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ overview.avgDensityScore }}/5</div>
                <div class="label">Điểm Mật Độ Trung Bình</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ overview.incidentCount }}</div>
                <div class="label">Số Sự Cố</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ performance.modelAccuracy }}%</div>
                <div class="label">Độ Chính Xác Model</div>
            </div>
        </div>
    </div>
    
    <!-- Charts Section -->
    {% if charts.peak_hours %}
    <div class="section">
        <h2>📈 Biểu Đồ Phân Tích</h2>
        <div class="chart-container">
            <img src="{{ charts.peak_hours }}" alt="Giờ Cao Điểm">
        </div>
    </div>
    {% endif %}
    
    {% if charts.cameras_distribution %}
    <div class="chart-container">
        <img src="{{ charts.cameras_distribution }}" alt="Phân Bố Camera">
    </div>
    {% endif %}
    
    <!-- Insights Section -->
    <div class="section">
        <h2>💡 Nhận Định & Khuyến Nghị</h2>
        
        {% if insights.trends %}
        <h3>Xu Hướng</h3>
        <div class="insights">
            <ul>
                {% for trend in insights.trends %}
                <li>{{ trend }}</li>
                {% endfor %}
            </ul>
        </div>
        {% endif %}
        
        {% if insights.recommendations %}
        <h3>Khuyến Nghị</h3>
        <div class="insights">
            <ul>
                {% for rec in insights.recommendations %}
                <li>{{ rec }}</li>
                {% endfor %}
            </ul>
        </div>
        {% endif %}
    </div>
    
    <!-- Cameras Detail -->
    {% if camerasAnalysis %}
    <div class="section">
        <h2>📹 Chi Tiết Theo Camera</h2>
        <table class="cameras-table">
            <thead>
                <tr>
                    <th>Tên Camera</th>
                    <th>Tổng Xe</th>
                    <th>TB/Giờ</th>
                    <th>Mật Độ Peak</th>
                    <th>Risk Level</th>
                </tr>
            </thead>
            <tbody>
                {% for camera in camerasAnalysis[:10] %}
                <tr>
                    <td>{{ camera.name }}</td>
                    <td>{{ "{:,}".format(camera.totalVehicles) }}</td>
                    <td>{{ camera.avgVehiclePerHour }}</td>
                    <td>{{ camera.peakDensity }}</td>
                    <td>{{ camera.riskLevel.title() }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}
    
    <!-- Footer -->
    <div class="footer">
        <p>Báo cáo được tạo tự động bởi Hệ thống Giám sát Giao thông Thông minh</p>
        <p>Dữ liệu được phân tích từ {{ performance.coveragePercentage }}% thời gian trong kỳ báo cáo</p>
    </div>
</body>
</html>
    """
    
    template = Template(template_content)
    return template.render(**data)