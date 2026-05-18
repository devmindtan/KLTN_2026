import { FORECAST_KEYS, LOS_MARKER_COLOR } from "./constants";
import { getLosLabel, getGtiState, getForecastLos } from "./helpers";
import type { EnrichedCamera } from "./types";

interface Props {
  cam: EnrichedCamera;
}

/** Popup khi click camera marker: ảnh, LOS hiện tại, xe theo loại, bảng 5 mốc dự báo, V/C, GTI */
export function CameraPopupContent({ cam }: Props) {
  const gti = getGtiState(cam.trend.gti);
  return (
    <div style={{ minWidth: 230, fontFamily: "sans-serif", fontSize: 13 }}>
      {cam.imageUrl ? (
        <img
          src={cam.imageUrl}
          alt={cam.name}
          style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6, marginBottom: 8, display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div style={{ width: "100%", height: 72, borderRadius: 6, marginBottom: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>
          Chưa có hình ảnh
        </div>
      )}

      <p style={{ fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{cam.name}</p>

      {/* LOS hiện tại */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: LOS_MARKER_COLOR[cam.status.current] ?? "#94a3b8", flexShrink: 0 }} />
        <span style={{ color: "#374151", fontSize: 12, fontWeight: 600 }}>{getLosLabel(cam.status.current)}</span>
      </div>

      {/* Xe theo loại (nếu có) */}
      {cam.realtimeData?.detections != null && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Hiện tại</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 6, padding: "6px 8px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Xe lớn</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{cam.realtimeData.detections.car}</div>
            </div>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 6, padding: "6px 8px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Xe nhỏ</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{cam.realtimeData.detections.motorbike}</div>
            </div>
            <div style={{ flex: 1, background: "#eff6ff", borderRadius: 6, padding: "6px 8px", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Tổng</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1d4ed8" }}>
                {cam.realtimeData.detections.car + cam.realtimeData.detections.motorbike}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bảng 5 mốc dự báo */}
      <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Dự báo</p>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 8 }}>
        <tbody>
          {FORECAST_KEYS.map((key) => {
            const los = getForecastLos(cam, key);
            return (
              <tr key={key} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ paddingTop: 3, paddingBottom: 3, paddingRight: 6, color: "#9ca3af", whiteSpace: "nowrap", fontSize: 11 }}>+{key}</td>
                <td style={{ fontWeight: 500, color: "#1f2937" }}>{cam.forecasts[key]} xe</td>
                <td style={{ paddingLeft: 6 }}>
                  {los !== "unknown" && (
                    <span style={{ fontSize: 10, color: LOS_MARKER_COLOR[los] ?? "#94a3b8", fontWeight: 600 }}>
                      {getLosLabel(los)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* V/C + GTI */}
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 10, paddingTop: 2, paddingBottom: 2, color: "#9ca3af" }}>V/C ratio</td>
            <td style={{ fontWeight: 500, color: "#1f2937" }}>
              {cam.realtimeData?.vc_ratio != null
                ? `${(cam.realtimeData.vc_ratio * 100).toFixed(0)}%`
                : "—"}
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: 10, paddingTop: 2, paddingBottom: 2, color: "#9ca3af" }}>GTI</td>
            <td style={{ fontWeight: 500, color: "#1f2937" }}>
              {cam.trend.gti.toFixed(0)}%
              <span style={{ marginLeft: 5, color: gti.color, fontSize: 11 }}>{gti.label}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
