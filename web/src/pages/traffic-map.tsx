"use client";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSocket } from "@/contexts/SocketContext";
import { PageHeader } from "@/components/custom/page-header";
import { IconMapPins } from "@tabler/icons-react";
import { PAGE_TITLES } from "@/lib/app-constants";
import { useLoading } from "@/contexts/LoadingContext";

// ─── Component imports ────────────────────────────────────────────────────────
import { MapInteractionHandler }  from "@/components/traffic-map/map-interaction-handler";
import { CameraPopupContent }    from "@/components/traffic-map/camera-popup-content";
import { StatCard }               from "@/components/traffic-map/stat-card";
import { AlertPanel }             from "@/components/traffic-map/alert-panel";
import { ForecastWarningPanel }   from "@/components/traffic-map/forecast-warning-panel";
import { MapLegend }              from "@/components/traffic-map/map-legend";
import { MapRouteOverlay }        from "@/components/traffic-map/map-route-overlay";
// RulesCard đã được merge vào MapLegend — không cần import riêng nữa
import {
  createLosMarker,
//   createWaypointMarker,
  createPickPreviewMarker,
  createUpdateWaypointMarker,
  findCamerasOnRoute,
} from "@/components/traffic-map/helpers";
import { fetchRoute } from "@/components/traffic-map/api";
import { LOS_PRIORITY } from "@/components/traffic-map/constants";
import type { EnrichedCamera, RouteAnalysis, PickMode } from "@/components/traffic-map/types";

// ─── MapRefSetter ────────────────────────────────────────────────────────────
function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; return () => { mapRef.current = null; }; }, [map, mapRef]);
  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TrafficMapPage() {
  const { processedCameras, cameraInfoMap } = useSocket();
  const { startLoading, stopLoading } = useLoading();
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"primary" | "alt" | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const handleAnalysisChange = useCallback((a: RouteAnalysis | null) => {
    setRouteAnalysis(a);
    setSelectedRoute(null);
  }, []);

  const handleRouteSelect = useCallback((r: "primary" | "alt") => {
    setSelectedRoute((prev) => prev === r ? null : r);
  }, []);

  useEffect(() => {
    startLoading();
    const t = setTimeout(() => stopLoading(), 500);
    return () => { clearTimeout(t); stopLoading(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFocusCamera = useCallback((camId: string, lat: number, lng: number) => {
    mapRef.current?.closePopup();
    mapRef.current?.flyTo([lat, lng], 17, { duration: 0.8 });
    setTimeout(() => { markerRefs.current[camId]?.openPopup(); }, 850);
  }, []);

  /**
   * Xử lý click-to-pick trên bản đồ.
   * Nếu đang ở update mode (đã có route), tính lại route ngay sau khi pick.
   */
  const handleMapPick = useCallback(async (lat: number, lng: number) => {
    const isUpdateMode = !!routeAnalysis;

    if (pickMode === "origin") {
      setOriginCoords([lat, lng]);
      setPickMode(null);
      // Nếu đã có route → tính lại ngay với điểm A mới
      if (isUpdateMode && routeAnalysis) {
        try {
          const newOrigin = { lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
          const { primary, alt } = await fetchRoute(newOrigin, routeAnalysis.destination, routeAnalysis.travelMode);
          setRouteAnalysis((prev) => prev ? {
            ...prev,
            origin: newOrigin,
            primary, alt,
            camerasOnPrimary: findCamerasOnRoute([], primary.coords),
            camerasOnAlt: alt ? findCamerasOnRoute([], alt.coords) : null,
          } : null);
        } catch { /* lỗi im lặng — user có thể nhấn "Tính lại" */ }
      }
    } else if (pickMode === "dest") {
      setDestCoords([lat, lng]);
      setPickMode(null);
      if (isUpdateMode && routeAnalysis) {
        try {
          const newDest = { lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
          const { primary, alt } = await fetchRoute(routeAnalysis.origin, newDest, routeAnalysis.travelMode);
          setRouteAnalysis((prev) => prev ? {
            ...prev,
            destination: newDest,
            primary, alt,
            camerasOnPrimary: findCamerasOnRoute([], primary.coords),
            camerasOnAlt: alt ? findCamerasOnRoute([], alt.coords) : null,
          } : null);
        } catch { /* lỗi im lặng */ }
      }
    }
  }, [pickMode, routeAnalysis]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserLocation(c);
      setOriginCoords(c);
    });
  }, []);

  const handleClearCoords = useCallback(() => {
    setOriginCoords(null);
    setDestCoords(null);
  }, []);

  const enrichedCameras = useMemo<EnrichedCamera[]>(() => {
    return processedCameras.map((cam) => {
      const info = cameraInfoMap[cam.shortId] ?? cameraInfoMap[cam.shortId.toLowerCase()];
      if (!info?.location) return null;
      try {
        const parsed = JSON.parse(info.location) as unknown;
        if (!Array.isArray(parsed) || parsed.length < 2) return null;
        const [lat, lng] = parsed as [number, number];
        if (typeof lat !== "number" || typeof lng !== "number") return null;
        return { ...cam, lat, lng };
      } catch { return null; }
    }).filter((c): c is EnrichedCamera => c !== null);
  }, [processedCameras, cameraInfoMap]);

  const stats = useMemo(() => {
    const c: Record<string, number> = {
      free_flow: 0, smooth: 0, moderate: 0, heavy: 0, congested: 0, unknown: 0,
    };
    enrichedCameras.forEach((cam) => {
      const k = cam.status.current in c ? cam.status.current : "unknown";
      c[k]++;
    });
    return c;
  }, [enrichedCameras]);

  const alertCameras = useMemo(
    () =>
      enrichedCameras
        .filter((c) => c.status.current === "congested" || c.status.current === "heavy")
        .sort((a, b) => (LOS_PRIORITY[b.status.current] ?? 0) - (LOS_PRIORITY[a.status.current] ?? 0)),
    [enrichedCameras]
  );

  /** Cập nhật camera trên tuyến theo dữ liệu thực tế WebSocket */
  const realtimeRouteAnalysis = useMemo<RouteAnalysis | null>(() => {
    if (!routeAnalysis) return null;
    return {
      ...routeAnalysis,
      camerasOnPrimary: findCamerasOnRoute(enrichedCameras, routeAnalysis.primary.coords),
      camerasOnAlt: routeAnalysis.alt
        ? findCamerasOnRoute(enrichedCameras, routeAnalysis.alt.coords)
        : null,
    };
  }, [routeAnalysis, enrichedCameras]);

  const camsOnPrimaryIds = useMemo(
    () => new Set(realtimeRouteAnalysis?.camerasOnPrimary.map((c) => c.id) ?? []),
    [realtimeRouteAnalysis]
  );

  const routeBounds = useMemo<L.LatLngBounds | null>(() => {
    if (!routeAnalysis) return null;
    const coords = [...routeAnalysis.primary.coords, ...(routeAnalysis.alt?.coords ?? [])];
    return coords.length ? L.latLngBounds(coords as L.LatLngTuple[]) : null;
  }, [routeAnalysis]);

  const total = enrichedCameras.length || 1;

  // Xác định icon cho waypoint A/B: update mode vs preview mode
//   const isUpdateMode = !!routeAnalysis;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 min-h-0">
      <PageHeader
        icon={<IconMapPins className="w-5 h-5" />}
        title={PAGE_TITLES.TRAFFIC_MAP}
        description={`${enrichedCameras.length} camera · Hỗ trợ ra quyết định điều phối giao thông`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        {(["free_flow", "smooth", "moderate", "heavy", "congested", "unknown"] as const).map((los) => (
          <StatCard key={los} los={los} count={stats[los] ?? 0} total={total} />
        ))}
      </div>

      {/* Map + side panel */}
      <div className="flex flex-1 gap-4 min-h-0" style={{ minHeight: 620 }}>

        {/* Bản đồ */}
        <div className="flex-1 relative rounded-lg border overflow-hidden">
          <MapContainer
            center={[10.7769, 106.7009]}
            zoom={13}
            style={{ height: "100%", width: "100%", minHeight: 520 }}
            scrollWheelZoom
            zoomControl={false}
          >
            <ZoomControl position="topright" />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Tuyến thay thế */}
            {routeAnalysis?.alt && (
              <Polyline
                positions={routeAnalysis.alt.coords as L.LatLngTuple[]}
                pathOptions={{
                  color: "#22c55e",
                  weight: selectedRoute === "alt" ? 7 : selectedRoute === "primary" ? 3 : 4,
                  opacity: selectedRoute === "primary" ? 0.25 : 0.7,
                  dashArray: selectedRoute === "alt" ? undefined : "8 5",
                }}
              />
            )}

            {/* Tuyến chính */}
            {routeAnalysis?.primary && (
              <Polyline
                positions={routeAnalysis.primary.coords as L.LatLngTuple[]}
                pathOptions={{
                  color: "#3b82f6",
                  weight: selectedRoute === "primary" ? 7 : selectedRoute === "alt" ? 3 : 5,
                  opacity: selectedRoute === "alt" ? 0.25 : 0.9,
                }}
              />
            )}

            {/* ── Waypoints A/B sau khi có route (update mode) ── */}
            {routeAnalysis?.origin && (
              <Marker
                position={[routeAnalysis.origin.lat, routeAnalysis.origin.lng]}
                icon={createUpdateWaypointMarker("origin", pickMode === "origin")}
              >
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <strong>Điểm xuất phát (A)</strong><br />
                    {routeAnalysis.origin.label.split(",")[0]}
                    {pickMode === "origin" && (
                      <><br /><span style={{ color: "#d97706", fontSize: 11 }}>⚠ Click bản đồ để cập nhật vị trí</span></>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
            {routeAnalysis?.destination && (
              <Marker
                position={[routeAnalysis.destination.lat, routeAnalysis.destination.lng]}
                icon={createUpdateWaypointMarker("dest", pickMode === "dest")}
              >
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <strong>Điểm đến (B)</strong><br />
                    {routeAnalysis.destination.label.split(",")[0]}
                    {pickMode === "dest" && (
                      <><br /><span style={{ color: "#d97706", fontSize: 11 }}>⚠ Click bản đồ để cập nhật vị trí</span></>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* ── Preview pins trước khi có route (pick preview mode) ── */}
            {originCoords && !routeAnalysis && (
              <Marker position={originCoords} icon={createPickPreviewMarker("origin", pickMode === "origin")}>
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <strong>{pickMode === "origin" ? "Click bản đồ để cập nhật A" : "Điểm xuất phát (A)"}</strong><br />
                    {originCoords[0].toFixed(5)}, {originCoords[1].toFixed(5)}
                  </div>
                </Popup>
              </Marker>
            )}
            {destCoords && !routeAnalysis && (
              <Marker position={destCoords} icon={createPickPreviewMarker("dest", pickMode === "dest")}>
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <strong>{pickMode === "dest" ? "Click bản đồ để cập nhật B" : "Điểm đến (B)"}</strong><br />
                    {destCoords[0].toFixed(5)}, {destCoords[1].toFixed(5)}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* GPS user location */}
            {userLocation && (
              <CircleMarker
                center={userLocation}
                radius={9}
                pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.85, weight: 2 }}
              >
                <Popup><div style={{ fontSize: 12 }}>Vị trí của bạn</div></Popup>
              </CircleMarker>
            )}

            {/* Camera markers */}
            {enrichedCameras.map((cam) => (
              <Marker
                key={cam.id}
                ref={(el) => { markerRefs.current[cam.id] = el; }}
                position={[cam.lat, cam.lng]}
                icon={createLosMarker(cam.status.current, camsOnPrimaryIds.has(cam.id))}
              >
                <Popup><CameraPopupContent cam={cam} /></Popup>
              </Marker>
            ))}

            <MapRefSetter mapRef={mapRef} />
            <MapInteractionHandler
              pickMode={pickMode}
              onPick={handleMapPick}
              bounds={routeBounds}
            />
          </MapContainer>

          <MapRouteOverlay
            cameras={enrichedCameras}
            analysis={realtimeRouteAnalysis}
            onAnalysisChange={handleAnalysisChange}
            selectedRoute={selectedRoute}
            onRouteSelect={handleRouteSelect}
            pickMode={pickMode}
            onPickModeChange={setPickMode}
            originCoords={originCoords}
            destCoords={destCoords}
            onClearCoords={handleClearCoords}
            onRequestLocate={handleLocate}
            onSetOriginCoords={setOriginCoords}
            onSetDestCoords={setDestCoords}
          />

          {/* Legend hợp nhất LOS + GTI (không còn RulesCard riêng) */}
          <MapLegend />
        </div>

        {/* Side panel */}
        <div className="w-[360px] shrink-0 flex flex-col gap-3 overflow-hidden min-h-0">
          <AlertPanel cameras={alertCameras} onFocusCamera={handleFocusCamera} />
          <ForecastWarningPanel cameras={enrichedCameras} onFocusCamera={handleFocusCamera} />
          {/* RulesCard đã được tích hợp vào MapLegend — không cần render ở đây nữa */}
        </div>
      </div>
    </div>
  );
}