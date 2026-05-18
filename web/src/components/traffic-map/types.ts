import type { CameraData } from "@/contexts/SocketContext";
import type { FORECAST_KEYS, TravelMode } from "./constants";

export type EnrichedCamera = CameraData & { lat: number; lng: number };
export type ForecastKey = typeof FORECAST_KEYS[number];
export type PickMode = "origin" | "dest" | null;
export type { TravelMode };

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface RouteResult {
  coords: [number, number][];
  distance: number;
  duration: number;
}

export interface RouteAnalysis {
  origin: GeoPoint;
  destination: GeoPoint;
  primary: RouteResult;
  alt: RouteResult | null;
  camerasOnPrimary: EnrichedCamera[];
  camerasOnAlt: EnrichedCamera[] | null;
  travelMode: TravelMode;
}