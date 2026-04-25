"""
chart_style.py — Style config dùng chung cho tất cả biểu đồ báo cáo khoá luận.
Chuẩn publication-grade: nền trắng, font rõ ràng, palette nhất quán.
"""
from __future__ import annotations
import matplotlib.pyplot as plt
import matplotlib as mpl
from matplotlib.ticker import MaxNLocator

# ── Palette ───────────────────────────────────────────────────────────────────
# Primary palette — dùng theo thứ tự cho multi-series
PALETTE = [
    "#1A56DB",  # Blue       — horizon 5'  / series 1
    "#7E3AF2",  # Purple     — horizon 10' / series 2
    "#0E9F6E",  # Green      — horizon 15' / series 3
    "#D97706",  # Amber      — horizon 30' / series 4
    "#E02424",  # Red        — horizon 60' / series 5
]

HORIZON_COLORS: dict[int, str] = {5: PALETTE[0], 10: PALETTE[1], 15: PALETTE[2], 30: PALETTE[3], 60: PALETTE[4]}

# Neutral tones
C_GRID    = "#E9ECEF"
C_SPINE   = "#CED4DA"
C_EVENT   = "#F59E0B"   # amber — model update marker
C_FILL    = "#EBF5FF"   # light blue fill

# Semantic
C_GOOD    = "#0E9F6E"
C_WARN    = "#D97706"
C_BAD     = "#E02424"

# ── Typography ────────────────────────────────────────────────────────────────
FONT_TITLE  = dict(fontsize=15, fontweight="bold", color="#111827")
FONT_LABEL  = dict(fontsize=12, color="#374151")
FONT_TICK   = dict(labelsize=10.5, colors="#6B7280")
FONT_ANNOT  = dict(fontsize=10, color="#374151")
FONT_LEGEND = dict(fontsize=10.5, framealpha=0.95, edgecolor=C_SPINE,
                   fancybox=False, borderpad=0.8)

# ── Figure sizes ──────────────────────────────────────────────────────────────
FIG_WIDE   = (14, 5.2)
FIG_SQUARE = (10, 7)
FIG_TALL   = (14, 9)
FIG_HALF   = (7,  5)

DPI = 180


# ── Apply global rcParams ─────────────────────────────────────────────────────
def apply_global_style() -> None:
    """Gọi một lần ở đầu mỗi script để thiết lập toàn bộ default."""
    mpl.rcParams.update({
        # Font
        "font.family":       "DejaVu Sans",
        "font.size":         11,
        "axes.titlesize":    15,
        "axes.labelsize":    12,
        "xtick.labelsize":   10.5,
        "ytick.labelsize":   10.5,
        "legend.fontsize":   10.5,
        # Colors
        "axes.facecolor":    "white",
        "figure.facecolor":  "white",
        "axes.edgecolor":    C_SPINE,
        "axes.linewidth":    0.9,
        "grid.color":        C_GRID,
        "grid.linewidth":    0.8,
        "grid.alpha":        0.8,
        # Lines & markers
        "lines.linewidth":   2.2,
        "lines.markersize":  6,
        "patch.edgecolor":   "white",
        "patch.linewidth":   0.5,
        # Figure
        "figure.dpi":        DPI,
        "savefig.dpi":       DPI,
        "savefig.bbox":      "tight",
        "savefig.facecolor": "white",
        # Layout
        "figure.constrained_layout.use": False,
    })


# ── Axes helpers ──────────────────────────────────────────────────────────────
def clean_axes(ax: plt.Axes, grid: str = "y", yticks_int: bool = False) -> None:
    """Xoá spine top/right, bật grid, chuẩn hóa tick."""
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(C_SPINE)
    ax.spines["bottom"].set_color(C_SPINE)
    if grid in ("y", "both"):
        ax.yaxis.grid(True, color=C_GRID, linewidth=0.8, zorder=0)
    if grid in ("x", "both"):
        ax.xaxis.grid(True, color=C_GRID, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(axis="both", which="both", length=0, colors="#6B7280")
    if yticks_int:
        ax.yaxis.set_major_locator(MaxNLocator(integer=True))


def set_labels(ax: plt.Axes, title: str = "", xlabel: str = "", ylabel: str = "",
               subtitle: str = "") -> None:
    if title:
        ax.set_title(title, pad=14, **FONT_TITLE)
    if subtitle:
        ax.set_title(f"{title}\n{subtitle}", pad=14,
                     fontsize=FONT_TITLE["fontsize"], fontweight="bold", color="#111827")
    if xlabel:
        ax.set_xlabel(xlabel, labelpad=8, **FONT_LABEL)
    if ylabel:
        ax.set_ylabel(ylabel, labelpad=8, **FONT_LABEL)


def add_bar_labels(ax: plt.Axes, bars, fmt: str = "{:.1f}",
                   offset_frac: float = 0.012) -> None:
    """Thêm số lên đỉnh mỗi bar."""
    ymax = ax.get_ylim()[1]
    for bar in bars:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h + ymax * offset_frac,
                fmt.format(h), ha="center", va="bottom",
                fontsize=9.5, fontweight="600", color="#374151")


def save(fig: plt.Figure, path) -> None:
    fig.tight_layout(pad=1.6)
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  ✓ {path.name}")
