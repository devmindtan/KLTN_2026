"""
Biểu đồ lưu lượng từ camera_detections_hourly.csv
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd

DATE_FROM = pd.Timestamp("2026-02-15")
DATE_TO = pd.Timestamp("2026-04-15")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "outputs"

PALETTE_MAIN = "#2563EB"
PALETTE_FILL = "#DBEAFE"
PALETTE_GRID = "#E5E7EB"
DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"]


def _load_detections() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "camera_detections_hourly.csv")
    df["hour_bucket"] = pd.to_datetime(df["hour_bucket"], utc=True, errors="coerce")
    df = df.dropna(subset=["hour_bucket", "sum_objects", "avg_objects"])
    df["hour_bucket"] = (
        df["hour_bucket"].dt.tz_convert("Asia/Ho_Chi_Minh").dt.tz_localize(None)
    )
    mask = (df["hour_bucket"] >= DATE_FROM) & (df["hour_bucket"] < DATE_TO + pd.Timedelta(days=1))
    return df[mask].copy()


def plot_daily_volume(df: pd.DataFrame, out_dir: Path) -> None:
    daily = df.groupby(df["hour_bucket"].dt.date, as_index=False)["sum_objects"].sum()
    daily.columns = ["date", "sum_objects"]
    daily["date"] = pd.to_datetime(daily["date"])
    daily = daily.sort_values("date")
    daily["rolling7"] = daily["sum_objects"].rolling(7, min_periods=1).mean()

    fig, ax = plt.subplots(figsize=(16, 6))
    ax.fill_between(daily["date"], daily["sum_objects"], alpha=0.25, color=PALETTE_MAIN)
    ax.plot(
        daily["date"],
        daily["sum_objects"],
        color=PALETTE_MAIN,
        linewidth=2.0,
        label="Tổng ngày",
        marker="o",
        markersize=4,
    )
    ax.plot(
        daily["date"],
        daily["rolling7"],
        color="#DC2626",
        linewidth=2.8,
        linestyle="--",
        label="Trung bình 7 ngày",
    )

    ax.set_title("Sản lượng phương tiện theo ngày", fontsize=17, fontweight="bold", pad=20)
    ax.set_xlabel("Ngày", fontsize=13)
    ax.set_ylabel("Tổng phương tiện", fontsize=13)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=45, ha="right", fontsize=11)
    ax.tick_params(axis="y", labelsize=11)
    ax.grid(axis="y", color=PALETTE_GRID, linewidth=1.0, alpha=0.7)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(fontsize=12, loc="upper left", framealpha=0.97, edgecolor="black", fancybox=True)

    fig.tight_layout()
    fig.savefig(out_dir / "traffic_daily_volume.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    print("  ✓ traffic_daily_volume.png")


def plot_hourly_heatmap(df: pd.DataFrame, out_dir: Path) -> None:
    tmp = df.copy()
    tmp["hour"] = tmp["hour_bucket"].dt.hour
    tmp["dow"] = tmp["hour_bucket"].dt.dayofweek
    pivot = (
        tmp.groupby(["dow", "hour"], as_index=False)["avg_objects"]
        .mean()
        .pivot(index="dow", columns="hour", values="avg_objects")
        .reindex(range(7))
        .fillna(0)
    )

    fig, ax = plt.subplots(figsize=(17, 6))
    im = ax.imshow(pivot.values, aspect="auto", cmap="YlOrRd", interpolation="nearest")
    vmax = pivot.values.max()

    for r in range(pivot.shape[0]):
        for c in range(pivot.shape[1]):
            val = pivot.values[r, c]
            color = "white" if val > vmax * 0.65 else "black"
            ax.text(c, r, f"{val:.1f}", ha="center", va="center", fontsize=8.5, color=color, fontweight="bold")

    ax.set_xticks(range(24))
    ax.set_xticklabels([f"{h:02d}h" for h in range(24)], fontsize=11)
    ax.set_yticks(range(7))
    ax.set_yticklabels(DAY_LABELS, fontsize=12, fontweight="bold")
    ax.set_title("Lưu lượng theo giờ × ngày", fontsize=17, fontweight="bold", pad=20)
    ax.set_xlabel("Giờ", fontsize=13)

    cbar = fig.colorbar(im, ax=ax, fraction=0.02, pad=0.04)
    cbar.set_label("TB/giờ", fontsize=12)
    cbar.ax.tick_params(labelsize=11)

    fig.tight_layout()
    fig.savefig(out_dir / "traffic_hourly_heatmap.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    print("  ✓ traffic_hourly_heatmap.png")


def plot_hourly_avg(df: pd.DataFrame, out_dir: Path) -> None:
    tmp = df.copy()
    tmp["hour"] = tmp["hour_bucket"].dt.hour
    hourly = tmp[(tmp["hour"] >= 6) & (tmp["hour"] <= 23)].groupby("hour", as_index=False)["avg_objects"].mean()

    fig, ax = plt.subplots(figsize=(14, 6))
    ax.plot(
        hourly["hour"],
        hourly["avg_objects"],
        color=PALETTE_MAIN,
        linewidth=3.0,
        marker="o",
        markersize=8,
        markerfacecolor="white",
        markeredgewidth=2.5,
        label="TB",
    )
    ax.fill_between(hourly["hour"], hourly["avg_objects"], alpha=0.15, color=PALETTE_MAIN)

    peak = hourly.loc[hourly["avg_objects"].idxmax()]
    ax.annotate(
        f"Cao điểm: {int(peak['avg_objects'])}",
        xy=(peak["hour"], peak["avg_objects"]),
        xytext=(peak["hour"] + 2, peak["avg_objects"] * 1.15),
        arrowprops=dict(arrowstyle="->", color=PALETTE_MAIN, lw=2.5),
        fontsize=11,
        fontweight="bold",
        color="white",
        bbox=dict(boxstyle="round,pad=0.7", facecolor=PALETTE_MAIN, alpha=0.85),
    )

    ax.set_xticks(range(6, 24, 2))
    ax.set_xticklabels([f"{h:02d}h" for h in range(6, 24, 2)], fontsize=11)
    ax.set_title("Lưu lượng theo giờ (6-23h)", fontsize=17, fontweight="bold", pad=20)
    ax.set_xlabel("Giờ", fontsize=13)
    ax.set_ylabel("TB", fontsize=13)
    ax.tick_params(axis="y", labelsize=11)
    ax.grid(axis="y", color=PALETTE_GRID, linewidth=1.0, alpha=0.7)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(fontsize=12, loc="upper left", framealpha=0.97)

    fig.tight_layout()
    fig.savefig(out_dir / "traffic_hourly_avg.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    print("  ✓ traffic_hourly_avg.png")


def plot_dow_avg(df: pd.DataFrame, out_dir: Path) -> None:
    tmp = df.copy()
    tmp["dow"] = tmp["hour_bucket"].dt.dayofweek
    dow = tmp.groupby("dow", as_index=False)["avg_objects"].mean()
    dow["label"] = dow["dow"].map(dict(enumerate(DAY_LABELS)))

    fig, ax = plt.subplots(figsize=(13, 6))
    colors = [PALETTE_FILL if x < 5 else PALETTE_MAIN for x in dow["dow"]]
    bars = ax.bar(dow["label"], dow["avg_objects"], color=colors, alpha=0.85, edgecolor="black", linewidth=1.8, width=0.6)

    for bar, val in zip(bars, dow["avg_objects"]):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(), f"{int(val)}", ha="center", va="bottom", fontsize=12, fontweight="bold")

    ax.set_title("Lưu lượng theo ngày tuần", fontsize=17, fontweight="bold", pad=20)
    ax.set_ylabel("TB", fontsize=13)
    ax.set_xlabel("Ngày", fontsize=13)
    ax.set_ylim(0, dow["avg_objects"].max() * 1.25)
    ax.tick_params(axis="x", labelsize=11)
    ax.tick_params(axis="y", labelsize=11)
    ax.grid(axis="y", color=PALETTE_GRID, linewidth=1.0, alpha=0.7)
    ax.spines[["top", "right"]].set_visible(False)

    fig.tight_layout()
    fig.savefig(out_dir / "traffic_dow_avg.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    print("  ✓ traffic_dow_avg.png")


def plot_distribution(df: pd.DataFrame, out_dir: Path) -> None:
    daily = df.groupby(df["hour_bucket"].dt.date)["sum_objects"].sum().values

    fig, ax = plt.subplots(figsize=(14, 6))
    ax.hist(daily, bins=48, color=PALETTE_MAIN, alpha=0.8, edgecolor="black", linewidth=1.0)
    ax.set_title("Phân phối lưu lượng ngày", fontsize=17, fontweight="bold", pad=20)
    ax.set_xlabel("Tổng/ngày", fontsize=13)
    ax.set_ylabel("Lần xuất hiện", fontsize=13)
    ax.tick_params(axis="both", labelsize=11)
    ax.grid(axis="y", color=PALETTE_GRID, linewidth=1.0, alpha=0.7)
    ax.spines[["top", "right"]].set_visible(False)

    stats_text = f"μ={daily.mean():.0f}\nσ={daily.std():.0f}\nmin={daily.min():.0f}\nmax={daily.max():.0f}"
    ax.text(
        0.98,
        0.98,
        stats_text,
        transform=ax.transAxes,
        fontsize=11,
        va="top",
        ha="right",
        bbox=dict(boxstyle="round,pad=0.8", facecolor="#FFE5B4", alpha=0.95, edgecolor="black"),
    )

    fig.tight_layout()
    fig.savefig(out_dir / "traffic_distribution.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    print("  ✓ traffic_distribution.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("[plot_traffic_overview] Đang vẽ...")
    df = _load_detections()
    if df.empty:
        print("  ! Không có dữ liệu.")
        return
    print(f"  → {len(df):,} records | {df['hour_bucket'].dt.date.nunique()} days")
    plot_daily_volume(df, OUT_DIR)
    plot_hourly_heatmap(df, OUT_DIR)
    plot_hourly_avg(df, OUT_DIR)
    plot_dow_avg(df, OUT_DIR)
    plot_distribution(df, OUT_DIR)
    print("[plot_traffic_overview] Hoàn tất.\n")


if __name__ == "__main__":
    main()
