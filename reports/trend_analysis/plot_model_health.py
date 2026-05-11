"""
Biểu đồ sức khoẻ hệ thống ML từ model_metrics_history_flat.csv và ml_model_metadata.csv
Phạm vi: 15/02/2026 – 15/04/2026

Charts:
  1. model_mae_rmse_trend.png — MAE & RMSE hệ thống theo thời gian, đánh dấu thời điểm đổi model
  2. model_mape_trend.png     — MAPE % theo thời gian + rolling average
  3. model_timeline.png       — Timeline các phiên bản model (created_at)
  4. model_versions_compare.png — So sánh metrics giữa các phiên bản (bar chart)
  5. camera_ranking.png       — Camera ranking theo độ chính xác (horizontal bar)
  6. data_coverage.png        — Data coverage theo ngày (area chart)
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# ── Constants ─────────────────────────────────────────────────────────────────
DATE_FROM = pd.Timestamp("2026-02-15", tz="UTC")
DATE_TO   = pd.Timestamp("2026-04-16", tz="UTC")

BASE_DIR  = Path(__file__).resolve().parent
DATA_DIR  = BASE_DIR / "data"
OUT_DIR   = BASE_DIR / "outputs"

COLOR_MAE   = "#2563EB"
COLOR_RMSE  = "#DC2626"
COLOR_MAPE  = "#059669"
COLOR_GRID  = "#E5E7EB"
COLOR_EVENT = "#F59E0B"   # màu cho dấu đổi model


def _load_metrics() -> pd.DataFrame:
    """Đọc metrics history, lọc date range, group theo ngày (giữ 1 snapshot/ngày)."""
    df = pd.read_csv(DATA_DIR / "model_metrics_history_flat.csv")
    df["generated_at"] = pd.to_datetime(df["generated_at"], utc=True, errors="coerce")
    df = df.dropna(subset=["generated_at", "overall_mae"])
    mask = (df["generated_at"] >= DATE_FROM) & (df["generated_at"] < DATE_TO)
    df = df[mask].sort_values("generated_at").copy()
    # 1 điểm/ngày: lấy snapshot cuối ngày
    df["date"] = df["generated_at"].dt.tz_convert("Asia/Ho_Chi_Minh").dt.normalize().dt.tz_localize(None)
    daily = df.groupby("date", as_index=False).last()
    return daily


def _load_model_events() -> list[tuple[pd.Timestamp, str]]:
    """
    Đọc các mốc model mới được kích hoạt (is_active thay đổi hoặc model mới đăng ký).
    Trả về list [(date, label)] trong khoảng date range.
    """
    df = pd.read_csv(DATA_DIR / "ml_model_metadata.csv")
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True, errors="coerce")
    df = df.dropna(subset=["created_at"])
    active = df[df["is_active"] == True].copy()
    active["date"] = (
        active["created_at"]
        .dt.tz_convert("Asia/Ho_Chi_Minh")
        .dt.tz_localize(None)
        .dt.normalize()
    )
    mask = (active["created_at"] >= DATE_FROM) & (active["created_at"] < DATE_TO)
    events = []
    for _, row in active[mask].iterrows():
        label = row["model_version"][:12] if pd.notna(row["model_version"]) else "new"
        events.append((row["date"], label))
    return events


def _annotate_events(ax: plt.Axes, events: list, ymax: float) -> None:
    """Vẽ đường dọc vàng đánh dấu thời điểm cập nhật model."""
    for dt, label in events:
        ax.axvline(dt, color=COLOR_EVENT, linewidth=1.2, linestyle="--", alpha=0.7)
        ax.text(dt, ymax * 0.97, label, rotation=90, va="top", ha="right",
                fontsize=7.5, color=COLOR_EVENT, alpha=0.85)


# ── Chart 1: MAE & RMSE trend ─────────────────────────────────────────────────
def plot_mae_rmse_trend(df: pd.DataFrame, events: list, out_dir: Path) -> None:
    """
    Dual-line chart: MAE và RMSE hệ thống theo từng ngày.
    Đường đứt ngang = đánh dấu thời điểm deploy model mới (is_active).
    Cho thấy hệ thống ML cải thiện dần hay suy giảm theo thời gian.
    """
    fig, ax = plt.subplots(figsize=(13, 5))

    ax.plot(df["date"], df["overall_mae"], color=COLOR_MAE, linewidth=2.0,
            marker="o", markersize=2.5, label="MAE")
    ax.plot(df["date"], df["overall_rmse"], color=COLOR_RMSE, linewidth=2.0,
            marker="o", markersize=2.5, linestyle="--", label="RMSE")

    ymax = float(df[["overall_mae", "overall_rmse"]].max().max()) * 1.12
    _annotate_events(ax, events, ymax)

    ax.set_ylim(0, ymax)
    ax.set_title("MAE & RMSE hệ thống ML theo thời gian", fontsize=14,
                 fontweight="bold", pad=12)
    ax.set_xlabel("Ngày")
    ax.set_ylabel("Sai số (phương tiện)")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=30, ha="right")
    ax.grid(axis="y", color=COLOR_GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)

    legend_handles, legend_labels = ax.get_legend_handles_labels()
    # Thêm legend item cho event marker
    from matplotlib.lines import Line2D
    legend_handles.append(Line2D([0], [0], color=COLOR_EVENT, linewidth=1.2,
                                  linestyle="--", label="Cập nhật model"))
    legend_labels.append("Cập nhật model")
    ax.legend(handles=legend_handles, labels=legend_labels, fontsize=10)

    fig.tight_layout()
    out_path = out_dir / "model_mae_rmse_trend.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 2: MAPE trend ───────────────────────────────────────────────────────
def plot_mape_trend(df: pd.DataFrame, events: list, out_dir: Path) -> None:
    """
    Area chart MAPE % theo ngày với rolling average 7 ngày.
    MAPE dễ hiểu hơn đối với người đọc không chuyên vì nó là phần trăm.
    Vùng tô = mức sai số thực tế; đường đỏ = xu hướng làm mượt.
    """
    if "overall_mape" not in df.columns or df["overall_mape"].isna().all():
        print("  ! overall_mape không có dữ liệu, bỏ qua chart này.")
        return

    df = df.dropna(subset=["overall_mape"]).copy()
    df["rolling7"] = df["overall_mape"].rolling(7, min_periods=1, center=True).mean()

    fig, ax = plt.subplots(figsize=(13, 5))
    ax.fill_between(df["date"], df["overall_mape"], alpha=0.20, color=COLOR_MAPE)
    ax.plot(df["date"], df["overall_mape"], color=COLOR_MAPE, linewidth=1.2,
            alpha=0.6, label="MAPE ngày")
    ax.plot(df["date"], df["rolling7"], color="#065F46", linewidth=2.2,
            label="Trung bình 7 ngày")

    # Referential lines
    for level, label in [(10, "Tốt (<10%)"), (20, "Chấp nhận được (<20%)")]:
        ax.axhline(level, color="gray", linewidth=0.9, linestyle=":", alpha=0.7)
        ax.text(df["date"].iloc[-1], level + 0.3, label, va="bottom", ha="right",
                fontsize=8, color="gray")

    ymax = float(df["overall_mape"].max()) * 1.15
    _annotate_events(ax, events, ymax)

    ax.set_ylim(0, ymax)
    ax.set_title("MAPE hệ thống ML theo thời gian (%)", fontsize=14,
                 fontweight="bold", pad=12)
    ax.set_xlabel("Ngày")
    ax.set_ylabel("MAPE (%)")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=30, ha="right")
    ax.grid(axis="y", color=COLOR_GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(fontsize=10)

    fig.tight_layout()
    out_path = out_dir / "model_mape_trend.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 3: Timeline model versions ────────────────────────────────────────
def plot_model_timeline(out_dir: Path) -> None:
    """
    Dot plot theo timeline các model được kích hoạt.
    Thể hiện quá trình cải tiến mô hình qua từng version.
    """
    df = pd.read_csv(DATA_DIR / "ml_model_metadata.csv")
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True, errors="coerce")
    df = df.dropna(subset=["created_at"])
    
    mask = (df["created_at"] >= DATE_FROM) & (df["created_at"] < DATE_TO)
    df = df[mask].sort_values("created_at").copy()
    
    if df.empty:
        print("  ! model_timeline: Không có dữ liệu")
        return
    
    df["model_version_short"] = df["model_version"].str[:15]
    df["date"] = df["created_at"].dt.tz_convert("Asia/Ho_Chi_Minh").dt.normalize()
    
    fig, ax = plt.subplots(figsize=(12, 4))
    
    colors = ["#10B981" if x else "#94A3B8" for x in df["is_active"]]
    ax.scatter(df["date"], range(len(df)), s=150, c=colors, alpha=0.8, edgecolors="black", linewidth=1)
    
    for i, (date, version, is_active) in enumerate(zip(df["date"], df["model_version_short"], df["is_active"])):
        marker = "●" if is_active else "○"
        ax.text(date, i + 0.15, f" {marker} {version}", va="center", fontsize=8.5,
                fontweight="bold" if is_active else "normal")
    
    ax.set_yticks(range(len(df)))
    ax.set_yticklabels([f"v{len(df) - i}" for i in range(len(df))])
    ax.set_xlabel("Ngày tạo")
    ax.set_ylabel("Phiên bản")
    ax.set_title("Timeline các phiên bản model (● = Active)", fontsize=14,
                 fontweight="bold", pad=12)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=30, ha="right")
    ax.grid(axis="y", alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    
    fig.tight_layout()
    out_path = out_dir / "model_timeline.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 4: Model versions comparison ──────────────────────────────────────
def plot_versions_compare(out_dir: Path) -> None:
    """
    Bar chart so sánh MAE/RMSE/metrics giữa các phiên bản model.
    Cho thấy phiên bản nào cải thiện là tốt nhất.
    """
    df = pd.read_csv(DATA_DIR / "ml_model_metadata.csv")
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True, errors="coerce")
    df = df.dropna(subset=["created_at"])
    
    mask = (df["created_at"] >= DATE_FROM) & (df["created_at"] < DATE_TO)
    df = df[mask].sort_values("created_at").copy()
    
    # Cố gắng parse metrics từ JSON
    def extract_mae(metrics_json):
        if pd.isna(metrics_json):
            return None
        try:
            import json
            m = json.loads(metrics_json)
            return m.get("MAE", m.get("mae"))
        except:
            return None
    
    df["mae_val"] = df["metrics"].apply(extract_mae)
    df = df.dropna(subset=["mae_val"])
    
    if df.empty:
        print("  ! model_versions_compare: Không có metrics để so sánh")
        return
    
    df["model_version_short"] = df["model_version"].str[:10]
    
    fig, ax = plt.subplots(figsize=(10, 5))
    colors = ["#10B981" if x else "#3B82F6" for x in df["is_active"]]
    bars = ax.bar(range(len(df)), df["mae_val"], color=colors, alpha=0.8, edgecolor="black", linewidth=1)
    
    for i, (bar, val) in enumerate(zip(bars, df["mae_val"])):
        ax.text(bar.get_x() + bar.get_width() / 2.0, val,
                f"{val:.2f}", ha="center", va="bottom", fontsize=9, fontweight="bold")
    
    ax.set_xticks(range(len(df)))
    ax.set_xticklabels(df["model_version_short"], rotation=45, ha="right")
    ax.set_ylabel("MAE")
    ax.set_title("So sánh MAE giữa các phiên bản model (● = Active)", fontsize=14,
                 fontweight="bold", pad=12)
    ax.grid(axis="y", alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    
    fig.tight_layout()
    out_path = out_dir / "model_versions_compare.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 5: Camera ranking ────────────────────────────────────────────────
def plot_camera_ranking(out_dir: Path) -> None:
    """
    Horizontal bar chart ranking camera theo độ chính xác (MAE trung bình).
    Xác định camera nào dự báo tốt/kém nhất và nguyên nhân tiềm tàng.
    """
    df = pd.read_csv(DATA_DIR / "camera_forecasts.csv")
    df["forecast_for_time"] = pd.to_datetime(df["forecast_for_time"], utc=True, errors="coerce")
    df = df.dropna(subset=["forecast_for_time", "predicted_value", "actual_value"])
    
    mask = (df["forecast_for_time"] >= DATE_FROM) & (df["forecast_for_time"] < DATE_TO)
    df = df[mask].copy()
    
    df["abs_err"] = (df["predicted_value"] - df["actual_value"]).abs()
    camera_mae = df.groupby("camera_id", as_index=False)["abs_err"].mean().sort_values("abs_err")
    
    # Top 10 tốt + 10 kém
    top_good = camera_mae.head(10)
    top_bad = camera_mae.tail(10).iloc[::-1].reset_index(drop=True)
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 8))
    
    # Top 10 tốt nhất
    ax1.barh(range(len(top_good)), top_good["abs_err"], color="#10B981", alpha=0.8, edgecolor="black")
    ax1.set_yticks(range(len(top_good)))
    ax1.set_yticklabels(top_good["camera_id"], fontsize=9)
    ax1.set_xlabel("MAE (phương tiện)")
    ax1.set_title("Top 10 Camera Tốt Nhất", fontsize=12, fontweight="bold")
    ax1.spines[["top", "right"]].set_visible(False)
    ax1.invert_yaxis()
    ax1.grid(axis="x", alpha=0.3)
    
    # Top 10 kém nhất
    ax2.barh(range(len(top_bad)), top_bad["abs_err"], color="#DC2626", alpha=0.8, edgecolor="black")
    ax2.set_yticks(range(len(top_bad)))
    ax2.set_yticklabels(top_bad["camera_id"], fontsize=9)
    ax2.set_xlabel("MAE (phương tiện)")
    ax2.set_title("Top 10 Camera Kém Nhất", fontsize=12, fontweight="bold")
    ax2.spines[["top", "right"]].set_visible(False)
    ax2.invert_yaxis()
    ax2.grid(axis="x", alpha=0.3)
    
    fig.suptitle("Camera Ranking Theo Độ Chính Xác Dự Báo", fontsize=14,
                 fontweight="bold", y=1.00)
    fig.tight_layout()
    out_path = out_dir / "camera_ranking.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 6: Data coverage ─────────────────────────────────────────────────
def plot_data_coverage(out_dir: Path) -> None:
    """
    Area chart tỉ lệ data_coverage theo ngày từ model_metrics_history_flat.csv.
    Thể hiện chất lượng dữ liệu đầu vào theo thời gian (missing data impact).
    """
    df = pd.read_csv(DATA_DIR / "model_metrics_history_flat.csv")
    df["generated_at"] = pd.to_datetime(df["generated_at"], utc=True, errors="coerce")
    df = df.dropna(subset=["generated_at"])
    
    mask = (df["generated_at"] >= DATE_FROM) & (df["generated_at"] < DATE_TO)
    df = df[mask].copy()
    
    if "data_coverage" not in df.columns or df["data_coverage"].isna().all():
        print("  ! data_coverage không có dữ liệu")
        return
    
    df["date"] = df["generated_at"].dt.tz_convert("Asia/Ho_Chi_Minh").dt.normalize()
    daily = df.groupby("date", as_index=False)["data_coverage"].mean()
    
    fig, ax = plt.subplots(figsize=(13, 5))
    ax.fill_between(daily["date"], daily["data_coverage"], alpha=0.4, color="#3B82F6")
    ax.plot(daily["date"], daily["data_coverage"], color="#2563EB", linewidth=2.2, marker="o", markersize=3)
    
    # Threshold lines
    ax.axhline(95, color="green", linewidth=1.2, linestyle="--", alpha=0.6, label="Tốt (95%)")
    ax.axhline(80, color="orange", linewidth=1.2, linestyle="--", alpha=0.6, label="Bình thường (80%)")
    ax.axhline(70, color="red", linewidth=1.2, linestyle="--", alpha=0.6, label="Cảnh báo (70%)")
    
    ax.set_title("Data Coverage Theo Thời Gian", fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel("Ngày")
    ax.set_ylabel("Coverage (%)")
    ax.set_ylim(0, 105)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=30, ha="right")
    ax.grid(axis="y", color=COLOR_GRID, linewidth=0.6)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(fontsize=9)
    
    fig.tight_layout()
    out_path = out_dir / "data_coverage.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Entry point ───────────────────────────────────────────────────────────────
def main() -> None:
    """Chạy toàn bộ biểu đồ sức khoẻ hệ thống ML."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("[plot_model_health] Đang vẽ...")
    df     = _load_metrics()
    events = _load_model_events()
    if df.empty:
        print("  ! Không có dữ liệu trong khoảng thời gian chỉ định.")
        return
    print(f"  → {len(df)} snapshot ngày | {len(events)} sự kiện model trong range")
    plot_mae_rmse_trend(df, events, OUT_DIR)
    plot_mape_trend(df, events, OUT_DIR)
    plot_model_timeline(OUT_DIR)
    plot_versions_compare(OUT_DIR)
    plot_camera_ranking(OUT_DIR)
    plot_data_coverage(OUT_DIR)
    print("[plot_model_health] Hoàn tất.\n")


if __name__ == "__main__":
    main()
