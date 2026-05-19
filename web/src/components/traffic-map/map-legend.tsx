import { useState } from "react";
import { LOS_MARKER_COLOR, GTI_COLORS, GTI_LABELS, GTI_RANGES } from "./constants";
import { getLosLabel } from "./helpers";

/**
 * Legend hợp nhất: chú thích LOS + bảng GTI — góc dưới bên phải bản đồ.
 * Click header "Bảng GTI" để mở/đóng phần GTI.
 */
export function MapLegend() {
  const [gtiOpen, setGtiOpen] = useState(false);

  return (
    <div className="absolute bottom-3 right-3 z-[1000] bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg pointer-events-auto overflow-hidden">
      {/* ── LOS legend (luôn hiển thị) ── */}
      <div className="px-3 pt-2.5 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
          Chú thích LOS
        </p>
        <ul className="space-y-1">
          {(["free_flow", "smooth", "moderate", "heavy", "congested"] as const).map((los) => (
            <li key={los} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: LOS_MARKER_COLOR[los] }}
              />
              <span className="text-[11px] text-foreground">{getLosLabel(los)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Divider + GTI toggle ── */}
      <div className="border-t">
        <button
          onClick={() => setGtiOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/60 transition-colors"
        >
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Bảng GTI
          </span>
          <svg
            className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${gtiOpen ? "rotate-180" : ""}`}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {gtiOpen && (
          <div className="px-3 pb-2.5 flex flex-col gap-1.5">
            {GTI_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: GTI_COLORS[i] }}
                />
                <span
                  className="text-[10px] font-semibold px-1.5 py-0 rounded-sm border shrink-0"
                  style={{
                    color: GTI_COLORS[i],
                    borderColor: GTI_COLORS[i] + "55",
                    background: GTI_COLORS[i] + "18",
                  }}
                >
                  {GTI_RANGES[i]}
                </span>
                <span className="text-[11px] text-muted-foreground leading-snug">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}