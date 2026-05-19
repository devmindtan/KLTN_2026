import type { GeoPoint } from "./types";
import type { TravelMode } from "./constants";

/** Geocode địa chỉ → tọa độ (Nominatim) */
export async function geocode(query: string): Promise<GeoPoint | null> {
  const p = new URLSearchParams({ q: query, format: "json", limit: "1", countrycodes: "vn" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
    headers: { "Accept-Language": "vi", "User-Agent": "KLTN2026-TrafficMap/1.0" },
  });
  if (!res.ok) return null;
  const d = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!d.length) return null;
  return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), label: d[0].display_name };
}

/** Autocomplete địa chỉ (Nominatim) — trả về tối đa 5 gợi ý */
export async function geocodeAutocomplete(query: string): Promise<GeoPoint[]> {
  if (query.trim().length < 3) return [];
  const p = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    countrycodes: "vn",
    addressdetails: "0",
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
      headers: { "Accept-Language": "vi", "User-Agent": "KLTN2026-TrafficMap/1.0" },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    return d.map((r) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: r.display_name,
    }));
  } catch {
    return [];
  }
}

/** Reverse geocode tọa độ → tên địa điểm (Nominatim) */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "vi", "User-Agent": "KLTN2026-TrafficMap/1.0" } }
    );
    const d = (await res.json()) as { display_name?: string };
    return d.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

/**
 * Tìm tuyến đường qua OSRM với thuật toán tối ưu hẻm nhỏ.
 *
 * Chiến lược:
 * 1. Gọi OSRM với profile được chọn (cycling / driving / foot).
 * 2. Với mode "foot" và "cycling" — thêm `continue_straight=false` + `alternatives=3`
 *    để OSRM trả về nhiều phương án hơn, trong đó có các đường hẻm nhỏ.
 * 3. Chọn primary = tuyến nhanh nhất (duration thấp nhất).
 * 4. Chọn alt = tuyến ngắn nhất theo distance (thường đi qua hẻm hơn).
 * 5. Nếu duration và distance của primary & alt quá giống nhau (< 5% khác biệt),
 *    bỏ alt để tránh hiện thị thừa.
 */
export async function fetchRoute(
  o: GeoPoint,
  d: GeoPoint,
  mode: TravelMode = "cycling"
) {
  // OSRM public demo chỉ có 3 profile: driving / cycling / foot
  const profile = mode === "driving" ? "driving" : mode === "foot" ? "foot" : "cycling";

  const url =
    `https://router.project-osrm.org/route/v1/${profile}/${o.lng},${o.lat};${d.lng},${d.lat}` +
    `?geometries=geojson&overview=full&alternatives=3&continue_straight=false&steps=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Không thể kết nối dịch vụ tìm đường");

  const data = (await res.json()) as {
    code: string;
    routes: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
    }>;
  };

  if (data.code !== "Ok" || !data.routes.length)
    throw new Error("Không tìm thấy đường đi phù hợp");

  const flip = (c: [number, number][]): [number, number][] => c.map(([lng, lat]) => [lat, lng]);

  // Sắp xếp theo duration tăng dần, primary = nhanh nhất
  const sorted = [...data.routes].sort((a, b) => a.duration - b.duration);

  const primary = {
    coords: flip(sorted[0].geometry.coordinates),
    distance: sorted[0].distance,
    duration: sorted[0].duration,
  };

  // Tìm alt = tuyến có distance ngắn nhất trong những tuyến còn lại
  // (đường hẻm thường ngắn hơn về khoảng cách dù có thể không phải nhanh nhất)
  let alt: typeof primary | null = null;
  if (sorted.length > 1) {
    const altRoute = sorted
      .slice(1)
      .reduce((best, r) => (r.distance < best.distance ? r : best), sorted[1]);

    // Chỉ hiện alt nếu thực sự khác primary (> 3% khoảng cách hoặc > 5% thời gian)
    const distDiff = Math.abs(altRoute.distance - primary.distance) / primary.distance;
    const durDiff = Math.abs(altRoute.duration - primary.duration) / primary.duration;

    if (distDiff > 0.03 || durDiff > 0.05) {
      alt = {
        coords: flip(altRoute.geometry.coordinates),
        distance: altRoute.distance,
        duration: altRoute.duration,
      };
    }
  }

  return { primary, alt };
}