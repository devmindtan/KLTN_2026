/**
 * Camera Service
 * API service để xử lý các request liên quan đến camera
 */

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_API_URL) {
  throw new Error("VITE_BACKEND_URL is not configured in environment variables");
}

// Interface cho camera data từ database
export interface CameraInfo {
  cam_id: string;
  location: string; // Format: '[lat, long]'
  display_name: string;
}

// Interface cho response từ API
export interface CamerasResponse {
  success: boolean;
  data: CameraInfo[];
  message?: string;
}

/**
 * Lấy danh sách tất cả camera từ database
 * API Endpoint: GET /api/cameras
 */
export async function getAllCameras(): Promise<CameraInfo[]> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/cameras`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: CamerasResponse = await response.json();
    
    if (result.success && Array.isArray(result.data)) {
      console.log(`✅ Fetched ${result.data.length} cameras from database`);
      return result.data;
    } else {
      console.error('❌ Invalid response format:', result);
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching cameras:', error);
    return [];
  }
}

/**
 * Lấy chi tiết một camera theo ID
 * API Endpoint: GET /api/cameras/:cam_id
 */
export async function getCameraById(camId: string): Promise<CameraInfo | null> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/cameras/${camId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: CamerasResponse = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    } else {
      console.warn(`⚠️ Camera not found: ${camId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching camera ${camId}:`, error);
    return null;
  }
}

/**
 * Tìm camera gần vị trí hiện tại
 * API Endpoint: GET /api/cameras/nearby?lat=<lat>&lng=<lng>&radius=<radius>
 */
export async function getNearbyCameras(
  lat: number,
  lng: number,
  radius: number = 1000
): Promise<CameraInfo[]> {
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/cameras/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: CamerasResponse = await response.json();
    
    if (result.success && Array.isArray(result.data)) {
      console.log(`✅ Found ${result.data.length} nearby cameras`);
      return result.data;
    } else {
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching nearby cameras:', error);
    return [];
  }
}

export default {
  getAllCameras,
  getCameraById,
  getNearbyCameras,
};
