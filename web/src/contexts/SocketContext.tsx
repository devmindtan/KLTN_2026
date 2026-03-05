"use client";
import * as React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import { getAllCameras, type CameraInfo } from "@/services/camera.service";
import { useAuth } from "@/contexts/AuthContext";
import logger from "@/lib/logger";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const MINIO_URL = import.meta.env.VITE_MINIO_URL;

if (!SOCKET_URL) {
  throw new Error("VITE_SOCKET_URL is not configured in environment variables");
}

if (!MINIO_URL) {
  throw new Error("VITE_MINIO_URL is not configured in environment variables");
}

// Interface cho NGSI-LD Camera payload từ Orion Context Broker
interface NGSILDCamera {
  _id: {
    id: string;
    type: string;
    servicePath: string;
  };
  attrs: {
    total_objects?: {
      value: number;
      type: string;
      modDate: number;
    };
    detections?: {
      value: {
        car: number;
        motorbike: number;
      };
      type: string;
      modDate: number;
    };
    minio_key?: {
      value: string;
      type: string;
      modDate: number;
    };
    last_updated?: {
      value: number;
      type: string;
      modDate: number;
    };
    status?: {
      value: {
        current: string;  // Trạng thái hiện tại từ image-process (real-time)
        realtime?: {  // Thông tin chi tiết real-time detection
          current_volume: number;  // Số phương tiện thực tế phát hiện
          detections: {  // Chi tiết theo loại xe
            car: number;
            motorbike: number;
          };
          capacity: number;  // Capacity camera (MAX 7 ngày)
          vc_ratio: number;  // Tỉ lệ volume/capacity
          timestamp: number;  // Unix timestamp của detection
        };
      };
      type: string;
      modDate: number;
    };
    prediction?: {
      value: {
        forecasts: {
          "5m": number;
          "10m": number;
          "15m": number;
          "30m": number;
          "60m": number;
        };
        status: {
          forecast: string; // Trạng thái dự báo 5p sau từ predict_realtime (cronjob 5 phút)
          calculation?: {   // Thông tin tính toán để hiển thị công thức
            predicted_volume: number;  // Giá trị dự đoán 5p (vehicles/5min)
            capacity: number;          // Capacity camera (MAX 7 ngày)
            vc_ratio: number;          // Tỉ lệ V/C (0.00-1.00+)
          };
        };
        trend: string;
      };
      type: string;
      modDate: number;
    };
    last_predicted?: {
      value: string;
      type: string;
      modDate: number;
    };
  };
  modDate: number;
}

// Interface cho processed camera data
export interface CameraData {
  id: string;
  shortId: string;
  name: string; // Display name from database
  totalObjects: number;
  carCount: number;
  motorbikeCount: number;
  imageUrl: string;
  lastUpdated: string;
  status: {
    current: string;  // Trạng thái hiện tại
    forecast: string; // Trạng thái dự báo 5 phút sau
  };
  trend: string;
  forecasts: {
    "5m": number;
    "10m": number;
    "15m": number;
    "30m": number;
    "60m": number;
  };
  lastPredicted: string;
  calculation?: {   // Thông tin tính toán prediction (dự báo 5p)
    predicted_volume: number;  // Giá trị dự đoán 5p (vehicles/5min)
    capacity: number;          // Capacity camera (MAX 7 ngày)
    vc_ratio: number;          // Tỉ lệ V/C (0.00-1.00+)
  };
  realtimeData?: {  // Thông tin chi tiết real-time detection
    current_volume: number;  // Số phương tiện thực tế phát hiện
    detections: {  // Chi tiết theo loại xe
      car: number;
      motorbike: number;
    };
    capacity: number;  // Capacity camera (MAX 7 ngày)
    vc_ratio: number;  // Tỉ lệ volume/capacity
    timestamp: number;  // Unix timestamp của detection
  };
}

// ============================================================
// TRAINING JOB (FIWARE entity: TrainingJob)
// ============================================================

/** Phân giải từ FIWARE entity attr format {type, value} */
interface FIWAREAttr<T> {
  type: string;
  value: T;
}

interface RawTrainingJobEntity {
  id?: string;
  type?: string;
  job_id?:        FIWAREAttr<string>;
  model_type?:    FIWAREAttr<string>;
  status?:        FIWAREAttr<string>;
  progress_pct?:  FIWAREAttr<number>;
  current_stage?: FIWAREAttr<string>;
  start_date?:    FIWAREAttr<string>;
  end_date?:      FIWAREAttr<string>;
  total_samples?: FIWAREAttr<number>;
  started_at?:    FIWAREAttr<string>;
  finished_at?:   FIWAREAttr<string>;
  error_message?: FIWAREAttr<string>;
  result_metrics?: FIWAREAttr<{ mae?: number; rmse?: number; r2?: number }>;
}

export interface TrainingJobData {
  job_id:        string;
  model_type:    string;
  status:        "pending" | "running" | "succeeded" | "failed";
  progress_pct:  number;
  current_stage: string;
  start_date:    string;
  end_date:      string;
  total_samples: number;
  started_at:    string;
  finished_at:   string;
  error_message: string;
  result_metrics: { mae?: number; rmse?: number; r2?: number };
}

// ============================================================
// MODEL RELOAD (FIWARE entity: ModelReload)
// ============================================================
interface RawModelReloadEntity {
  id?: string;
  type?: string;
  reload_id?:     FIWAREAttr<string>;
  model_type?:    FIWAREAttr<string>;
  status?:        FIWAREAttr<string>;
  progress_pct?:  FIWAREAttr<number>;
  current_stage?: FIWAREAttr<string>;
  model_version?: FIWAREAttr<string>;
  started_at?:    FIWAREAttr<string>;
  finished_at?:   FIWAREAttr<string>;
  error_message?: FIWAREAttr<string>;
}

export interface ModelReloadData {
  reload_id:     string;
  model_type:    string;
  status:        "running" | "succeeded" | "failed";
  progress_pct:  number;
  current_stage: string;
  model_version: string;
  started_at:    string;
  finished_at:   string;
  error_message: string;
}

interface SocketContextType {
  cameras: Record<string, NGSILDCamera>;
  processedCameras: CameraData[];
  isConnected: boolean;
  socket: Socket | null;
  cameraInfoMap: Record<string, CameraInfo>; // Map cam_id -> camera info from database
  trainingJob: TrainingJobData | null;
  modelReload:  ModelReloadData | null; // Trạng thái realtime khi reload model sau activate
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [cameras, setCameras] = useState<Record<string, NGSILDCamera>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [cameraInfoMap, setCameraInfoMap] = useState<Record<string, CameraInfo>>({});
  const [trainingJob, setTrainingJob] = useState<TrainingJobData | null>(null);
  const [modelReload, setModelReload] = useState<ModelReloadData | null>(null);

  // Chờ AuthProvider hoàn tất khởi tạo (fetch guest token) trước khi gọi API
  const { isLoading: authLoading } = useAuth();

  // Fetch camera list từ database khi component mount
  // Tạo initial cameras với dữ liệu mặc định, socket sẽ update sau
  useEffect(() => {
    if (authLoading) return; // Token chưa sẵn sàng → bỏ qua, chờ re-render

    async function fetchCameraInfo() {
      const cameraList = await getAllCameras();
      const infoMap: Record<string, CameraInfo> = {};
      const initialCameras: Record<string, NGSILDCamera> = {};
      
      const now = Date.now() / 1000;
      
      cameraList.forEach((cam) => {
        // Normalize cam_id key để đảm bảo matching (trim + lowercase)
        const normalizedKey = cam.cam_id.trim().toLowerCase();
        infoMap[normalizedKey] = cam;
        // Giữ cả key gốc để backward compatibility
        if (normalizedKey !== cam.cam_id) {
          infoMap[cam.cam_id] = cam;
        }
        
        // Tạo initial camera data với format NGSI-LD
        const fullId = `urn:ngsi-ld:Camera:${cam.cam_id}`;
        initialCameras[fullId] = {
          _id: {
            id: fullId,
            type: "Camera",
            servicePath: "/",
          },
          attrs: {
            total_objects: {
              value: 0,
              type: "Integer",
              modDate: now,
            },
            detections: {
              value: {
                car: 0,
                motorbike: 0,
              },
              type: "StructuredValue",
              modDate: now,
            },
            minio_key: {
              value: "",
              type: "Text",
              modDate: now,
            },
            last_updated: {
              value: now,
              type: "DateTime",
              modDate: now,
            },
            status: {
              value: {
                current: "unknown"
              },
              type: "StructuredValue",
              modDate: now,
            },
            prediction: {
              value: {
                forecasts: {
                  "5m": 0,
                  "10m": 0,
                  "15m": 0,
                  "30m": 0,
                  "60m": 0,
                },
                status: {
                  forecast: "unknown"
                },
                trend: "stable",
              },
              type: "StructuredValue",
              modDate: now,
            },
            last_predicted: {
              value: "",
              type: "Text",
              modDate: now,
            },
          },
          modDate: now,
        };
      });
      
      setCameraInfoMap(infoMap);
      setCameras(initialCameras); // Set initial cameras với dữ liệu mặc định
      logger.log(`📍 Loaded ${cameraList.length} cameras from database`);
      logger.log(`✅ Initialized ${Object.keys(initialCameras).length} cameras with default data`);
      // console.log(`🗺️ CameraInfoMap keys:`, Object.keys(infoMap));
      
      // Debug: Show first 3 entries với full detail
      // console.log(`\n📋 First 3 camera entries from DB:`);
      // cameraList.slice(0, 3).forEach((cam, idx) => {
      //   console.log(`  ${idx + 1}. cam_id: "${cam.cam_id}"`);
      //   console.log(`     display_name: "${cam.display_name}"`);
      //   console.log(`     normalized: "${cam.cam_id.trim().toLowerCase()}"`);
      // });
    }
    
    fetchCameraInfo();
  }, [authLoading]); // re-run khi auth sẵn sàng (authLoading false → có token)

  useEffect(() => {
    // Khởi tạo socket connection một lần duy nhất
    const socketInstance = io(SOCKET_URL, {
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    setSocket(socketInstance);
    socketInstance.on("connect", () => {
      logger.log("✅ Socket connected to", SOCKET_URL);
      // console.log("🔌 Socket ID:", socketInstance.id);
      // console.log("🎯 Socket transport:", socketInstance.io.engine.transport.name);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason) => {
      logger.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
    });

    socketInstance.on("CAMERA_UPDATED", (data: NGSILDCamera | Record<string, unknown>) => {
      // console.log("📡 Raw CAMERA_UPDATED event received:", data);

      // Xử lý cả 2 trường hợp: data._id.id và data.id
      let cameraId: string | null = null;
      let cameraData: NGSILDCamera | null = null;

      // Case 1: Data đã có cấu trúc NGSI-LD đầy đủ (data._id.id)
      if (data && typeof data === 'object' && '_id' in data && 
          data._id && typeof data._id === 'object' && 'id' in data._id && 
          typeof data._id.id === 'string') {
        cameraId = data._id.id;
        cameraData = data as NGSILDCamera;
        // console.log("✅ [Format 1] Camera ID:", cameraId);
      }
      // Case 2: Data có id ở top level (data.id) - format cũ
      else if (data && typeof data === 'object' && 'id' in data && typeof data.id === 'string') {
        cameraId = data.id;
        // Transform to NGSI-LD format
        cameraData = {
          _id: {
            id: data.id,
            type: ('type' in data && typeof data.type === 'string') ? data.type : "Camera",
            servicePath: ('servicePath' in data && typeof data.servicePath === 'string') ? data.servicePath : "/",
          },
          attrs: ('attrs' in data ? data.attrs : data) as NGSILDCamera['attrs'],
          modDate: ('modDate' in data && typeof data.modDate === 'number') ? data.modDate : Date.now() / 1000,
        } as NGSILDCamera;
        // console.log("✅ [Format 2] Camera ID:", cameraId);
      }
      else {
        logger.error("❌ Invalid camera data structure:", data);
        return;
      }

      if (cameraId && cameraData) {
        // console.log("💾 Storing camera data:", cameraId);
        // console.log(`🔍 [${cameraId.split(':').pop()}] Status Debug:`, {
        //   hasStatusAttr: !!cameraData.attrs.status,
        //   statusCurrent: cameraData.attrs.status?.value?.current,
        //   hasPredictionAttr: !!cameraData.attrs.prediction,
        //   predictionForecast: cameraData.attrs.prediction?.value?.status?.forecast
        // });
        setCameras((prev) => {
          const updated = {
            ...prev,
            [cameraId!]: cameraData!,
          };
          // console.log("📊 Total cameras in state:", Object.keys(updated).length);
          return updated;
        });
      }
    });

    socketInstance.on("TRAINING_JOB_UPDATED", (raw: RawTrainingJobEntity) => {
      const job: TrainingJobData = {
        job_id:        raw.job_id?.value        ?? "",
        model_type:    raw.model_type?.value    ?? "",
        status:        (raw.status?.value as TrainingJobData["status"]) ?? "pending",
        progress_pct:  raw.progress_pct?.value  ?? 0,
        current_stage: raw.current_stage?.value ?? "",
        start_date:    raw.start_date?.value    ?? "",
        end_date:      raw.end_date?.value      ?? "",
        total_samples: raw.total_samples?.value ?? 0,
        started_at:    raw.started_at?.value    ?? "",
        finished_at:   raw.finished_at?.value   ?? "",
        error_message: raw.error_message?.value ?? "",
        result_metrics: raw.result_metrics?.value ?? {},
      };
      setTrainingJob(job);
      logger.log(`🤖 TrainingJob update: ${job.model_type} [${job.status}] ${job.progress_pct}%`);
    });

    socketInstance.on("MODEL_RELOAD_UPDATED", (raw: RawModelReloadEntity) => {
      const reload: ModelReloadData = {
        reload_id:     raw.reload_id?.value     ?? "",
        model_type:    raw.model_type?.value    ?? "",
        status:        (raw.status?.value as ModelReloadData["status"]) ?? "running",
        progress_pct:  raw.progress_pct?.value  ?? 0,
        current_stage: raw.current_stage?.value ?? "",
        model_version: raw.model_version?.value ?? "",
        started_at:    raw.started_at?.value    ?? "",
        finished_at:   raw.finished_at?.value   ?? "",
        error_message: raw.error_message?.value ?? "",
      };
      setModelReload(reload);
      logger.log(`🔄 ModelReload update: ${reload.model_type} [${reload.status}] ${reload.progress_pct}%`);
    });

    socketInstance.on("connect_error", (err) => {
      logger.error("❌ Socket connection error:", err.message);
      setIsConnected(false);
    });

    socketInstance.on("reconnect", (attemptNumber) => {
      logger.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      setIsConnected(true);
    });

    // socketInstance.on("reconnect_attempt", (attemptNumber) => {
    //   console.log("🔄 Reconnection attempt", attemptNumber);
    // });
    //
    // socketInstance.on("reconnect_error", (err) => {
    //   console.error("❌ Reconnection error:", err.message);
    // });
    //
    // socketInstance.on("reconnect_failed", () => {
    //   console.error("❌ Reconnection failed after all attempts");
    // });
    //
    // // Debug: Log tất cả events
    // socketInstance.onAny((eventName, ...args) => {
    //   console.log("🔔 Socket event:", eventName, args);
    // });

    // Cleanup khi component unmount
    return () => {
      console.log("🧹 Cleaning up socket connection");
      socketInstance.off("connect");
      socketInstance.off("disconnect");
      socketInstance.off("CAMERA_UPDATED");
      socketInstance.off("TRAINING_JOB_UPDATED");
      socketInstance.off("MODEL_RELOAD_UPDATED");
      socketInstance.off("connect_error");
      socketInstance.off("reconnect");
      socketInstance.off("reconnect_attempt");
      socketInstance.off("reconnect_error");
      socketInstance.off("reconnect_failed");
      socketInstance.offAny(); // Remove wildcard listener
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    };
  }, []); // Empty dependency array đảm bảo chỉ chạy một lần

  // Transform NGSI-LD data to processed camera data với Optional Chaining
  // Merge với camera info từ database
  const processedCameras: CameraData[] = React.useMemo(() => {
    // Debug: Log cameraInfoMap status
    // console.log(`🔍 [ProcessedCameras] cameraInfoMap has ${Object.keys(cameraInfoMap).length} entries`);
    // console.log(`🔍 [ProcessedCameras] cameras object has ${Object.keys(cameras).length} entries`);
    
    const processed = Object.values(cameras).map((cam) => {
      // Ép kiểu an toàn: nếu là số thì giữ nguyên, nếu không có thì trả về chuỗi rỗng
      const rawLastUpdated = cam.attrs.last_updated?.value;
      const rawLastPredicted = cam.attrs.last_predicted?.value;
      const predictionAttr = cam.attrs.prediction?.value;
      
      // Extract cam_id từ NGSI-LD format: "urn:ngsi-ld:Camera:5d9dde1f766c880017188c98"
      const fullId = cam._id.id;
      const shortId = fullId.split(":").pop() || fullId;
      
      // Lấy camera info từ database (name, location)
      // Normalize shortId để tránh mismatch (trim, lowercase)
      const normalizedShortId = shortId.trim().toLowerCase();
      const cameraInfo = cameraInfoMap[normalizedShortId] || cameraInfoMap[shortId];
      const displayName = cameraInfo?.display_name?.trim() || shortId;
      
      // Debug: Cảnh báo khi fallback về shortId (ID thay vì tên) - Uncomment if needed
      // if (!cameraInfo) {
      //   console.warn(`⚠️ Camera info not found for shortId: "${shortId}" (normalized: "${normalizedShortId}")`);
      //   console.log(`Available keys in cameraInfoMap:`, Object.keys(cameraInfoMap).slice(0, 5));
      // } else if (!cameraInfo.display_name || !cameraInfo.display_name.trim()) {
      //   console.warn(`⚠️ display_name is empty for camera: ${shortId}`);
      // }

      return {
        id: fullId,
        shortId: shortId,
        name: displayName, // From database
        totalObjects: cam.attrs.total_objects?.value ?? 0,
        carCount: cam.attrs.detections?.value?.car ?? 0,
        motorbikeCount: cam.attrs.detections?.value?.motorbike ?? 0,
        imageUrl: cam.attrs.minio_key?.value
          ? `${MINIO_URL}/images/${cam.attrs.minio_key.value}`
          : "",
        // Ép kiểu về string để khớp với Interface CameraData
        lastUpdated: rawLastUpdated ? String(rawLastUpdated) : "",
        status: {
          current: cam.attrs.status?.value?.current ?? "unknown",  // Từ image-process (real-time)
          forecast: cam.attrs.prediction?.value?.status?.forecast ?? "unknown"  // Từ predict_realtime (cronjob 5p)
        },
        trend: cam.attrs.prediction?.value?.trend ?? "stable",
        forecasts: predictionAttr?.forecasts ?? {
          "5m": 0,
          "10m": 0,
          "15m": 0,
          "30m": 0,
          "60m": 0,
        },
        lastPredicted: rawLastPredicted ? String(rawLastPredicted) : "",
        calculation: cam.attrs.prediction?.value?.status?.calculation,  // Thông tin tính toán prediction (dự báo 5p)
        realtimeData: cam.attrs.status?.value?.realtime,  // Thông tin chi tiết real-time detection
      };
    });
    
    return processed;
  }, [cameras, cameraInfoMap]);

  // useEffect(() => {
  //   if (processedCameras.length > 0) {
  //     console.group("🔍 Debug Status (Current + Forecast)");
  //     processedCameras.slice(0, 3).forEach((cam) => {
  //       console.log(`Camera: ${cam.shortId} (${cam.name})`);
  //       console.log("- Status Current:", cam.status.current);
  //       console.log("- Status Forecast:", cam.status.forecast);
  //       console.log("- Trend:", cam.trend);
  //       console.log("-----------------------------------");
  //     });
  //     console.groupEnd();
  //   }
  // }, [processedCameras]);
  // console.table(processedCameras);
  const value: SocketContextType = {
    cameras,
    processedCameras,
    isConnected,
    socket,
    cameraInfoMap,
    trainingJob,
    modelReload,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// Custom hook để sử dụng Socket Context
// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}

// Export MINIO_URL để các component khác có thể sử dụng
// eslint-disable-next-line react-refresh/only-export-components
export { MINIO_URL };
