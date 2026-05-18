import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  IconChevronDown, IconChevronUp, IconCurrentLocation, IconGps, IconMapPin,
  IconNavigation, IconRoute, IconX, IconCopy, IconCheck, IconAlertTriangle,
  IconArrowsUpDown, IconRefresh,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { geocode, reverseGeocode, fetchRoute } from "./api";
import { findCamerasOnRoute, hasCongestion } from "./helpers";
import { RouteResultMini } from "./route-result-mini";
import { AddressInput } from "./address-input";
import { TRAVEL_MODES } from "./constants";
import type { PickMode, EnrichedCamera, RouteAnalysis, GeoPoint, TravelMode } from "./types";

interface MapRouteOverlayProps {
  cameras: EnrichedCamera[];
  analysis: RouteAnalysis | null;
  onAnalysisChange: (a: RouteAnalysis | null) => void;
  selectedRoute: "primary" | "alt" | null;
  onRouteSelect: (r: "primary" | "alt") => void;
  pickMode: PickMode;
  onPickModeChange: (m: PickMode) => void;
  originCoords: [number, number] | null;
  destCoords: [number, number] | null;
  onClearCoords: () => void;
  onRequestLocate: () => void;
  /** Called to override coords externally (e.g. after GPS or map-pick while route exists) */
  onSetOriginCoords: (c: [number, number] | null) => void;
  onSetDestCoords: (c: [number, number] | null) => void;
}

/**
 * Panel kiểm tra tuyến đường — nổi góc trên-trái bản đồ.
 *
 * Nâng cấp:
 * - Autocomplete địa chỉ với debounce
 * - Chọn phương tiện (xe máy / ô tô / đi bộ-hẻm)
 * - Nút swap A↔B
 * - Pin "cập nhật vị trí" khi đã có route rồi muốn thay đổi điểm
 * - Hiển thị thời gian cập nhật cuối
 */
export function MapRouteOverlay({
  cameras, analysis, onAnalysisChange, selectedRoute, onRouteSelect, pickMode, onPickModeChange,
  originCoords, destCoords, onClearCoords, onRequestLocate, onSetOriginCoords, onSetDestCoords,
}: MapRouteOverlayProps) {
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedDest, setCopiedDest] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("cycling");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Cached GeoPoints khi user chọn từ autocomplete
  const [originGeo, setOriginGeo] = useState<GeoPoint | null>(null);
  const [destGeo, setDestGeo] = useState<GeoPoint | null>(null);

  // Auto-fill text khi coords được set từ bên ngoài (pick/GPS)
  useEffect(() => {
    if (originCoords) reverseGeocode(originCoords[0], originCoords[1]).then(setOriginText);
  }, [originCoords]);

  useEffect(() => {
    if (destCoords) reverseGeocode(destCoords[0], destCoords[1]).then(setDestText);
  }, [destCoords]);

  const copyCoords = useCallback((coords: [number, number], setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(`${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  /** Tìm tuyến đường */
  const handleSearch = useCallback(async () => {
    if (!originText.trim() || !destText.trim()) return;
    setLoading(true); setError(null); onAnalysisChange(null);
    try {
      let oGeo: GeoPoint | null = null;
      let dGeo: GeoPoint | null = null;

      if (originCoords) {
        oGeo = { lat: originCoords[0], lng: originCoords[1], label: originText };
      } else if (originGeo && originGeo.label === originText) {
        oGeo = originGeo;
      } else {
        oGeo = await geocode(originText);
      }
      if (!oGeo) { setError(`Không tìm thấy: "${originText}"`); return; }

      if (destCoords) {
        dGeo = { lat: destCoords[0], lng: destCoords[1], label: destText };
      } else if (destGeo && destGeo.label === destText) {
        dGeo = destGeo;
      } else {
        dGeo = await geocode(destText);
      }
      if (!dGeo) { setError(`Không tìm thấy: "${destText}"`); return; }

      const { primary, alt } = await fetchRoute(oGeo, dGeo, travelMode);
      onAnalysisChange({
        origin: oGeo, destination: dGeo, primary, alt,
        camerasOnPrimary: findCamerasOnRoute(cameras, primary.coords),
        camerasOnAlt: alt ? findCamerasOnRoute(cameras, alt.coords) : null,
        travelMode,
      });
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally { setLoading(false); }
  }, [originText, destText, originCoords, destCoords, originGeo, destGeo, cameras, onAnalysisChange, travelMode]);

  /** Xoá tuyến và reset form */
  const handleClear = useCallback(() => {
    setOriginText(""); setDestText(""); setError(null); setLastUpdated(null);
    setOriginGeo(null); setDestGeo(null);
    onAnalysisChange(null); onPickModeChange(null); onClearCoords();
  }, [onAnalysisChange, onPickModeChange, onClearCoords]);

  /** Swap A ↔ B */
  const handleSwap = useCallback(() => {
    const tmpText = originText;
    const tmpGeo = originGeo;
    const tmpCoords = originCoords;
    setOriginText(destText);
    setOriginGeo(destGeo);
    onSetOriginCoords(destCoords);
    setDestText(tmpText);
    setDestGeo(tmpGeo);
    onSetDestCoords(tmpCoords);
  }, [originText, destText, originGeo, destGeo, originCoords, destCoords, onSetOriginCoords, onSetDestCoords]);

  const primaryHasCong = analysis ? hasCongestion(analysis.camerasOnPrimary) : false;
  const altHasCong = analysis?.camerasOnAlt ? hasCongestion(analysis.camerasOnAlt) : false;

  /** Đang pick điểm trong khi route đã tồn tại (update mode) */
  const isUpdateMode = !!analysis;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      style={{ position: "absolute", top: 10, left: 10, zIndex: 1000, width: 316, maxHeight: "calc(100% - 20px)", display: "flex", flexDirection: "column", minHeight: 0 }}
      className="rounded-lg border bg-background/96 backdrop-blur shadow-lg overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/96 shrink-0">
        <div className="flex items-center gap-1.5">
          <IconRoute className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold">Kiểm tra tuyến đường</span>
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground ml-0.5">
              · {formatTime(lastUpdated)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {analysis && (
            <button
              onClick={handleSearch}
              disabled={loading}
              className="p-1 rounded hover:bg-muted"
              title="Tính lại tuyến đường"
            >
              <IconRefresh className={cn("w-3 h-3 text-muted-foreground", loading && "animate-spin")} />
            </button>
          )}
          {(analysis !== null || error !== null || originText || destText) && (
            <button onClick={handleClear} className="p-1 rounded hover:bg-muted" title="Xóa">
              <IconX className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          <button onClick={() => setCollapsed((v) => !v)} className="p-1 rounded hover:bg-muted">
            {collapsed
              ? <IconChevronDown className="w-3 h-3 text-muted-foreground" />
              : <IconChevronUp className="w-3 h-3 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div data-route-panel className="flex flex-col gap-2 p-3 overflow-y-auto flex-1 min-h-0">

          {/* ── Phương tiện ── */}
          <div className="flex gap-1 rounded-md border overflow-hidden shrink-0">
            {TRAVEL_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setTravelMode(m.key as TravelMode)}
                className={cn(
                  "flex-1 py-1 text-[10px] font-medium flex items-center justify-center gap-0.5 transition-colors",
                  travelMode === m.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
                title={m.label}
              >
                <span>{m.icon}</span>
                <span className="hidden sm:inline">{m.label.split("/")[0].trim()}</span>
              </button>
            ))}
          </div>

          {/* ── Điểm xuất phát (A) ── */}
          <div className="flex flex-col gap-1">
            <div className="flex gap-1.5 items-center">
              <span className="text-[11px] font-bold text-green-700 dark:text-green-400 w-4 shrink-0 text-center">A</span>
              <AddressInput
                placeholder="Điểm xuất phát..."
                value={originText}
                onChange={(v) => { setOriginText(v); if (originGeo?.label !== v) setOriginGeo(null); }}
                onSelect={(pt) => { setOriginGeo(pt); onSetOriginCoords([pt.lat, pt.lng]); }}
                onEnter={handleSearch}
                hasCoords={!!originCoords}
                coordsDot="bg-green-500"
              />
              <button onClick={onRequestLocate} title="Vị trí hiện tại"
                className="shrink-0 w-8 h-8 rounded border flex items-center justify-center hover:bg-muted">
                <IconCurrentLocation className="w-3.5 h-3.5 text-primary" />
              </button>
              <button
                onClick={() => onPickModeChange(pickMode === "origin" ? null : "origin")}
                title={isUpdateMode ? "Cập nhật điểm A trên bản đồ" : "Click trên bản đồ"}
                className={cn(
                  "shrink-0 w-8 h-8 rounded border flex items-center justify-center",
                  pickMode === "origin"
                    ? "bg-primary text-primary-foreground"
                    : isUpdateMode
                      ? "border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                      : "hover:bg-muted"
                )}>
                <IconMapPin className="w-3.5 h-3.5" />
              </button>
            </div>

            {originCoords && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1 border border-border/50 ml-6">
                <span className="font-mono text-[10px] text-muted-foreground flex-1 tabular-nums select-all">
                  {originCoords[0].toFixed(6)}, {originCoords[1].toFixed(6)}
                </span>
                <button onClick={() => copyCoords(originCoords, setCopiedOrigin)} title="Sao chép toạ độ"
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {copiedOrigin ? <IconCheck className="w-3 h-3 text-green-500" /> : <IconCopy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          {/* ── Nút swap A↔B ── */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleSwap}
              title="Đổi điểm xuất phát và điểm đến"
              className="w-6 h-6 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <IconArrowsUpDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>

          {/* ── Điểm đến (B) ── */}
          <div className="flex flex-col gap-1">
            <div className="flex gap-1.5 items-center">
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 w-4 shrink-0 text-center">B</span>
              <AddressInput
                placeholder="Điểm đến..."
                value={destText}
                onChange={(v) => { setDestText(v); if (destGeo?.label !== v) setDestGeo(null); }}
                onSelect={(pt) => { setDestGeo(pt); onSetDestCoords([pt.lat, pt.lng]); }}
                onEnter={handleSearch}
                hasCoords={!!destCoords}
                coordsDot="bg-red-500"
              />
              <button
                onClick={() => onPickModeChange(pickMode === "dest" ? null : "dest")}
                title={isUpdateMode ? "Cập nhật điểm B trên bản đồ" : "Click trên bản đồ"}
                className={cn(
                  "shrink-0 w-8 h-8 rounded border flex items-center justify-center",
                  pickMode === "dest"
                    ? "bg-primary text-primary-foreground"
                    : isUpdateMode
                      ? "border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      : "hover:bg-muted"
                )}>
                <IconGps className="w-3.5 h-3.5" />
              </button>
            </div>

            {destCoords && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1 border border-border/50 ml-6">
                <span className="font-mono text-[10px] text-muted-foreground flex-1 tabular-nums select-all">
                  {destCoords[0].toFixed(6)}, {destCoords[1].toFixed(6)}
                </span>
                <button onClick={() => copyCoords(destCoords, setCopiedDest)} title="Sao chép toạ độ"
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {copiedDest ? <IconCheck className="w-3 h-3 text-green-500" /> : <IconCopy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          {/* ── Hint pick mode ── */}
          {pickMode && (
            <p className={cn(
              "text-[11px] text-center rounded px-2 py-1.5",
              isUpdateMode
                ? "text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400"
                : "text-primary bg-primary/10"
            )}>
              {isUpdateMode ? "⚠ " : ""}
              Click trực tiếp trên bản đồ để
              {isUpdateMode ? " cập nhật " : " đặt "}
              {pickMode === "origin" ? "điểm xuất phát (A)" : "điểm đến (B)"}
              {isUpdateMode ? " — tuyến sẽ được tính lại" : ""}
            </p>
          )}

          <Button size="sm" className="h-7 text-[12px] gap-1.5 w-full"
            onClick={handleSearch}
            disabled={loading || !originText.trim() || !destText.trim()}>
            {loading
              ? <span className="inline-block w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
              : <IconNavigation className="w-3 h-3" />}
            {analysis ? "Tính lại tuyến đường" : "Tìm đường"}
          </Button>

          {error && (
            <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1">
              <IconAlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{error}
            </p>
          )}

          {analysis && (
            <div className="flex flex-col gap-2">
              {primaryHasCong && !analysis.alt && (
                <p className="text-[11px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 rounded px-2 py-1 flex items-start gap-1">
                  <IconAlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  Tuyến bị ùn nhưng không tìm được tuyến thay thế.
                </p>
              )}
              <RouteResultMini
                label="Tuyến chính" result={analysis.primary}
                cameras={analysis.camerasOnPrimary} hasCong={primaryHasCong}
                lineColor="#3b82f6" recommended={!primaryHasCong || altHasCong}
                selected={selectedRoute === "primary"}
                onSelect={() => onRouteSelect("primary")}
              />
              {analysis.alt && analysis.camerasOnAlt && (
                <RouteResultMini
                  label="Tuyến thay thế" result={analysis.alt}
                  cameras={analysis.camerasOnAlt} hasCong={altHasCong}
                  lineColor="#22c55e" recommended={primaryHasCong && !altHasCong}
                  selected={selectedRoute === "alt"}
                  onSelect={() => onRouteSelect("alt")}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}