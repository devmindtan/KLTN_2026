"""
Biểu đồ chất lượng dự báo từ camera_forecasts.csv
Phạm vi: 15/02/2026 – 15/04/2026

Charts:
  1. forecast_mae_by_day.png     — MAE trung bình mỗi ngày theo từng horizon
  2. forecast_error_boxplot.png  — Phân phối sai số tuyệt đối theo horizon
  3. forecast_metrics_by_horizon.png — MAE/RMSE/MAPE grouped bar theo horizon
  4. forecast_pred_vs_actual.png — Predicted vs Actual (dual line, 1–2 cameras)
  5. forecast_scatter.png        — Scatter plot Predicted vs Actual
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# ── Constants ─────────────────────────────────────────────────────────────────
DATE_FROM = pd.Timestamp("2026-02-15", tz="UTC")
DATE_TO   = pd.Timestamp("2026-04-16", tz="UTC")   # exclusive

BASE_DIR  = Path(__file__).resolve().parent
DATA_DIR  = BASE_DIR / "data"
OUT_DIR   = BASE_DIR / "outputs"

# Màu cho mỗi horizon (5 horizons)
HORIZON_COLORS = {5: "#2563EB", 10: "#7C3AED", 15: "#059669", 30: "#D97706", 60: "#DC2626"}
GRID_COLOR     = "#E5E7EB"

# Cải tiến figsize cho 20+ camera
FIGSIZE_SINGLE = (16, 6)    # Tăng từ (13,5)
FIGSIZE_DUAL   = (16, 10)   # Tăng từ (14,5)
FIGSIZE_LARGE  = (14, 10)   # Scatter


def _load_forecasts() -> pd.DataFrame:
    """Đọc CSV dự báo, lọc date range, tính sai số tuyệt đối."""
    df = pd.read_csv(DATA_DIR / "camera_forecasts.csv")
    df["forecast_for_time"] = pd.to_datetime(df["forecast_for_time"], utc=True, errors="coerce")
    df = df.dropna(subset=["forecast_for_time", "predicted_value", "actual_value"])

    # Lọc date range
    mask = (df["forecast_for_time"] >= DATE_FROM) & (df["forecast_for_time"] < DATE_TO)
    df = df[mask].copy()

    df["abs_err"] = (df["predicted_value"] - df["actual_value"]).abs()
    # Chuyển sang local naive để hiển thị ngày
    df["date"] = (
        df["forecast_for_time"]
        .dt.tz_convert("Asia/Ho_Chi_Minh")
        .dt.tz_localize(None)
        .dt.normalize()
    )
    df["horizon_minutes"] = df["horizon_minutes"].astype(int)
    return df


# ── Chart 1: MAE theo ngày ──────────────────────────────────────────────────
def plot_mae_by_day(df: pd.DataFrame, out_dir: Path) -> None:
    """
    Line chart MAE trung bình mỗi ngày cho từng horizon.
    Cho thấy xu hướng độ chính xác theo thời gian và sự chênh lệch giữa các horizon.
    """
    daily = (
        df.groupby(["date", "horizon_minutes"], as_index=False)
        .agg(mae=("abs_err", "mean"))
    )

    fig, ax = plt.subplots(figsize=FIGSIZE_SINGLE)

    for horizon, color in HORIZON_COLORS.items():
        subset = daily[daily["horizon_minutes"] == horizon].sort_values("date")
        if subset.empty:
            continue
        # Rolling 3-day để mượt hơn
        smooth = subset["mae"].rolling(3, min_periods=1, center=True).mean()
        ax.plot(subset["date"], smooth, color=color, linewidth=2.8, marker="o",
                markersize=6, label=f"{horizon} phút", markerfacecolor="white",
                markeredgewidth=1.2)

    ax.set_title("MAE dự báo trung bình theo ngày (theo horizon)", fontsize=17,
                 fontweight="bold", pad=20)
    ax.set_xlabel("Ngày", fontsize=13)
    ax.set_ylabel("MAE (phương tiện)", fontsize=13)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=45, ha="right", fontsize=11)
    ax.tick_params(axis="y", labelsize=11)
    ax.grid(axis="y", color=GRID_COLOR, linewidth=1.0, alpha=0.7)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(title="Horizon", fontsize=12, title_fontsize=12, loc="upper left",
              framealpha=0.97, edgecolor="black", fancybox=True)

    fig.tight_layout()
    out_path = out_dir / "forecast_mae_by_day.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 2: Boxplot phân phối sai số theo horizon ───────────────────────────
def plot_error_boxplot(df: pd.DataFrame, out_dir: Path) -> None:
    """
    Boxplot sai số tuyệt đối theo từng horizon.
    Cho thấy phân phối sai số, outlier và độ ổn định của từng mức dự báo.
    Cắt bỏ tail cực đoan (>99th percentile) để biểu đồ đọc được.
    """
    cap = df["abs_err"].quantile(0.99)
    df_capped = df[df["abs_err"] <= cap].copy()

    horizons = sorted(HORIZON_COLORS.keys())
    data_by_horizon = [
        df_capped.loc[df_capped["horizon_minutes"] == h, "abs_err"].values
        for h in horizons
    ]
    colors = [HORIZON_COLORS[h] for h in horizons]

    fig, ax = plt.subplots(figsize=FIGSIZE_SINGLE)
    bp = ax.boxplot(
        data_by_horizon,
        patch_artist=True,
        medianprops=dict(color="darkred", linewidth=2.5),
        whiskerprops=dict(linewidth=1.5, color="gray"),
        capprops=dict(linewidth=1.5, color="gray"),
        flierprops=dict(marker=".", markersize=3, alpha=0.4),
        widths=0.5,
    )
    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.85)
        patch.set_linewidth(1.8)

    ax.set_xticklabels([f"{h} phút" for h in horizons], fontsize=12)
    ax.set_title("Phân phối sai số tuyệt đối theo horizon dự báo", fontsize=17,
                 fontweight="bold", pad=20)
    ax.set_xlabel("Horizon dự báo", fontsize=13)
    ax.set_ylabel("Sai số tuyệt đối (phương tiện)", fontsize=13)
    ax.tick_params(axis="y", labelsize=11)
    ax.grid(axis="y", color=GRID_COLOR, linewidth=1.0, alpha=0.7)
    ax.spines[["top", "right"]].set_visible(False)

    # Ghi median lên trên mỗi box
    for i, (h, data) in enumerate(zip(horizons, data_by_horizon)):
        if len(data):
            med = float(pd.Series(data).median())
            ax.text(i + 1, med + cap * 0.015, f"{med:.2f}", ha="center", va="bottom",
                    fontsize=11, fontweight="bold", color="darkred",
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.85, edgecolor="darkred", linewidth=1))

    fig.tight_layout()
    out_path = out_dir / "forecast_error_boxplot.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 3: MAE/RMSE/MAPE by horizon ──────────────────────────────────────
def plot_metrics_by_horizon(df: pd.DataFrame, out_dir: Path) -> None:
    """
    Grouped bar chart MAE, RMSE, MAPE tổng hợp theo từng horizon.
    Cho thấy sai số tăng dần theo horizon, hỗ trợ lựa chọn horizon phù hợp cho dự báo.
    """
    horizons = sorted(HORIZON_COLORS.keys())
    
    mae_list = []
    rmse_list = []
    mape_list = []
    
    for h in horizons:
        subset = df[df["horizon_minutes"] == h]
        if subset.empty:
            continue
        mae = subset["abs_err"].mean()
        actual_val = subset["actual_value"].values
        pred_val = subset["predicted_value"].values
        rmse = float(np.sqrt(((actual_val - pred_val) ** 2).mean()))
        mape = 100 * np.mean(np.abs((actual_val - pred_val) / (actual_val + 1e-6)))
        mae_list.append(mae)
        rmse_list.append(rmse)
        mape_list.append(mape)
    
    x = np.arange(len(horizons))
    width = 0.25
    
    fig, ax = plt.subplots(figsize=(15, 6))
    bars1 = ax.bar(x - width, mae_list, width, label="MAE", color="#3B82F6",
                   alpha=0.85, edgecolor="black", linewidth=1.5)
    bars2 = ax.bar(x, rmse_list, width, label="RMSE", color="#EF4444",
                   alpha=0.85, edgecolor="black", linewidth=1.5)
    bars3 = ax.bar(x + width, mape_list, width, label="MAPE (%)", color="#10B981",
                   alpha=0.85, edgecolor="black", linewidth=1.5)
    
    # Annotation cho từng bar
    for bars in [bars1, bars2, bars3]:
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2.0, height,
                    f"{height:.1f}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    ax.set_xlabel("Horizon dự báo", fontsize=13)
    ax.set_ylabel("Giá trị sai số", fontsize=13)
    ax.set_title("Tổng hợp MAE/RMSE/MAPE theo horizon", fontsize=17,
                 fontweight="bold", pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels([f"{h}'" for h in horizons], fontsize=12)
    ax.tick_params(axis="y", labelsize=11)
    ax.legend(fontsize=12, loc="upper left", framealpha=0.97, edgecolor="black", fancybox=True)
    ax.grid(axis="y", color=GRID_COLOR, linewidth=1.0, alpha=0.7)
    ax.spines[["top", "right"]].set_visible(False)
    
    fig.tight_layout()
    out_path = out_dir / "forecast_metrics_by_horizon.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 4: Predicted vs Actual ───────────────────────────────────────────
def plot_pred_vs_actual(df: pd.DataFrame, out_dir: Path) -> None:
    """
    Dual line chart Predicted vs Actual theo thời gian cho top 1–2 cameras.
    Cho thấy mô hình bám sát thực tế như thế nào, đặc biệt tại giờ cao điểm.
    """
    # Chọn 1–2 camera có forecast nhiều nhất
    top_cameras = df["camera_id"].value_counts().head(2).index.tolist()
    
    fig, axes = plt.subplots(len(top_cameras), 1, figsize=FIGSIZE_DUAL, sharex=True)
    if len(top_cameras) == 1:
        axes = [axes]
    
    for idx, cam_id in enumerate(top_cameras):
        subset = df[df["camera_id"] == cam_id].sort_values("forecast_for_time").head(100)
        if subset.empty:
            continue
        
        ax_obj = axes[idx]
        x_pos = np.arange(len(subset))
        ax_obj.plot(x_pos, subset["actual_value"], color="#2563EB", linewidth=2.8,
                    marker="o", markersize=7, label="Thực tế", alpha=0.88,
                    markerfacecolor="white", markeredgewidth=1.2)
        ax_obj.plot(x_pos, subset["predicted_value"], color="#DC2626", linewidth=2.8,
                    marker="s", markersize=6, linestyle="--", label="Dự báo", alpha=0.88,
                    markerfacecolor="white", markeredgewidth=1.2)
        ax_obj.fill_between(x_pos, subset["actual_value"], subset["predicted_value"],
                            alpha=0.15, color="gray")
        
        ax_obj.set_title(f"Dự báo vs Thực tế — {cam_id} (100 obs gần nhất)", fontsize=13,
                         fontweight="bold", pad=15)
        ax_obj.set_ylabel("Phương tiện", fontsize=12)
        ax_obj.tick_params(axis="y", labelsize=11)
        ax_obj.grid(axis="y", color=GRID_COLOR, linewidth=1.0, alpha=0.7)
        ax_obj.spines[["top", "right"]].set_visible(False)
        ax_obj.legend(fontsize=12, loc="upper left", framealpha=0.97, edgecolor="black", fancybox=True)
    
    axes[-1].set_xlabel("Thứ tự quan sát", fontsize=12)
    fig.suptitle("Chất lượng dự báo: So sánh dự báo với thực tế", fontsize=18,
                 fontweight="bold", y=0.995)
    fig.tight_layout()
    out_path = out_dir / "forecast_pred_vs_actual.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Chart 5: Scatter Predicted vs Actual ───────────────────────────────────
def plot_scatter(df: pd.DataFrame, out_dir: Path) -> None:
    """
    Scatter plot Predicted vs Actual với đường y=x (ideal).
    Điểm càng gần đường thẳng, mô hình càng tốt. Chạm vào bên phải được tốt hơn.
    """
    actual = df["actual_value"].values
    predicted = df["predicted_value"].values
    
    # Tính R²
    ss_res = np.sum((actual - predicted) ** 2)
    ss_tot = np.sum((actual - actual.mean()) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else -1
    
    mae = np.mean(np.abs(actual - predicted))
    rmse = float(np.sqrt(((actual - predicted) ** 2).mean()))
    
    fig, ax = plt.subplots(figsize=FIGSIZE_LARGE)
    
    # Scatter với hex density coloring
    hexbin = ax.hexbin(actual, predicted, gridsize=36, cmap="YlOrRd", mincnt=1,
                       alpha=0.88, edgecolors="white", linewidths=0.2)
    
    # Ideal line y=x
    lims = [
        min(actual.min(), predicted.min()),
        max(actual.max(), predicted.max()),
    ]
    ax.plot(lims, lims, "k--", linewidth=2.5, label="Dự báo hoàn hảo (y=x)", alpha=0.7)
    
    ax.set_xlabel("Giá trị thực tế (phương tiện)", fontsize=13)
    ax.set_ylabel("Dự báo (phương tiện)", fontsize=13)
    ax.set_title("Phân tích dự báo so với thực tế (Hexbin Density)", fontsize=17,
                 fontweight="bold", pad=20)
    
    # Performance box
    perf_text = f"R² = {r2:.4f}\nMAE = {mae:.2f}\nRMSE = {rmse:.2f}"
    ax.text(0.05, 0.95, perf_text, transform=ax.transAxes, fontsize=12,
            verticalalignment="top", fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.8", facecolor="white", alpha=0.92,
                      edgecolor="black", linewidth=1.8))
    
    ax.legend(fontsize=12, loc="lower right", framealpha=0.97, edgecolor="black", fancybox=True)
    ax.grid(axis="both", color=GRID_COLOR, linewidth=0.8, alpha=0.6)
    ax.tick_params(axis="both", labelsize=11)
    ax.spines[["top", "right"]].set_visible(False)
    
    cbar = fig.colorbar(hexbin, ax=ax, fraction=0.046, pad=0.06)
    cbar.set_label("Số dự báo", fontsize=12, fontweight="bold")
    cbar.ax.tick_params(labelsize=10)
    
    fig.tight_layout()
    out_path = out_dir / "forecast_scatter.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ── Entry point ───────────────────────────────────────────────────────────────
def main() -> None:
    """Chạy toàn bộ biểu đồ chất lượng dự báo."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("[plot_forecast_quality] Đang vẽ...")
    df = _load_forecasts()
    if df.empty:
        print("  ! Không có dữ liệu trong khoảng thời gian chỉ định.")
        return
    print(f"  → {len(df):,} bản ghi | {df['date'].nunique()} ngày | "
          f"{df['camera_id'].nunique()} camera")
    plot_mae_by_day(df, OUT_DIR)
    plot_error_boxplot(df, OUT_DIR)
    plot_metrics_by_horizon(df, OUT_DIR)
    plot_pred_vs_actual(df, OUT_DIR)
    plot_scatter(df, OUT_DIR)
    print("[plot_forecast_quality] Hoàn tất.\n")


if __name__ == "__main__":
    main()
