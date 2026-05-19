import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { PickMode } from "./types";

interface Props {
  pickMode: PickMode;
  onPick: (lat: number, lng: number) => void;
  bounds: L.LatLngBounds | null;
}

/** Xử lý cursor crosshair, fitBounds sau route, click-to-pick — bên trong MapContainer */
export function MapInteractionHandler({ pickMode, onPick, bounds }: Props) {
  const map = useMap();

  useEffect(() => {
    map.getContainer().style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode, map]);

  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  }, [bounds, map]);

  useMapEvents({
    click: (e) => { if (pickMode) onPick(e.latlng.lat, e.latlng.lng); },
  });

  return null;
}
