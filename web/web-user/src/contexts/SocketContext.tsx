"use client";
import * as React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import { getAllCameras, type CameraInfo } from "@/services/camera.service";

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
    prediction?: {
      value: {
        forecasts: {
          "5m": number;
          "10m": number;
          "15m": number;
          "30m": number;
          "60m": number;
        };
        status: string;
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
  status: string;
  trend: string;
  forecasts: {
    "5m": number;
    "10m": number;
    "15m": number;
    "30m": number;
    "60m": number;
  };
  lastPredicted: string;
}

interface SocketContextType {
  cameras: Record<string, NGSILDCamera>;
  processedCameras: CameraData[];
  isConnected: boolean;
  socket: Socket | null;
  cameraInfoMap: Record<string, CameraInfo>; // Map cam_id -> camera info from database
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [cameras, setCameras] = useState<Record<string, NGSILDCamera>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [cameraInfoMap, setCameraInfoMap] = useState<Record<string, CameraInfo>>({});

  // Fetch camera list từ database khi component mount
  // Tạo initial cameras với dữ liệu mặc định, socket sẽ update sau
  useEffect(() => {
    async function fetchCameraInfo() {
      const cameraList = await getAllCameras();
      const infoMap: Record<string, CameraInfo> = {};
      const initialCameras: Record<string, NGSILDCamera> = {};
      
      const now = Date.now() / 1000;
      
      cameraList.forEach((cam) => {
        infoMap[cam.cam_id] = cam;
        
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
            prediction: {
              value: {
                forecasts: {
                  "5m": 0,
                  "10m": 0,
                  "15m": 0,
                  "30m": 0,
                  "60m": 0,
                },
                status: "unknown",
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
      console.log(`📍 Loaded ${cameraList.length} cameras from database`);
      console.log(`✅ Initialized ${Object.keys(initialCameras).length} cameras with default data`);
    }
    
    fetchCameraInfo();
  }, []);

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
      console.log("✅ Socket connected to", SOCKET_URL);
      // console.log("🔌 Socket ID:", socketInstance.id);
      // console.log("🎯 Socket transport:", socketInstance.io.engine.transport.name);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
    });

    socketInstance.on("CAMERA_UPDATED", (data: any) => {
      // console.log("📡 Raw CAMERA_UPDATED event received:", data);

      // Xử lý cả 2 trường hợp: data._id.id và data.id
      let cameraId: string | null = null;
      let cameraData: NGSILDCamera | null = null;

      // Case 1: Data đã có cấu trúc NGSI-LD đầy đủ (data._id.id)
      if (data && data._id && data._id.id) {
        cameraId = data._id.id;
        cameraData = data as NGSILDCamera;
        // console.log("✅ [Format 1] Camera ID:", cameraId);
      }
      // Case 2: Data có id ở top level (data.id) - format cũ
      else if (data && data.id) {
        cameraId = data.id;
        // Transform to NGSI-LD format
        cameraData = {
          _id: {
            id: data.id,
            type: data.type || "Camera",
            servicePath: data.servicePath || "/",
          },
          attrs: data.attrs || data,
          modDate: data.modDate || Date.now() / 1000,
        } as NGSILDCamera;
        // console.log("✅ [Format 2] Camera ID:", cameraId);
      }
      else {
        console.error("❌ Invalid camera data structure:", data);
        return;
      }

      if (cameraId && cameraData) {
        // console.log("💾 Storing camera data:", cameraId);
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
    socketInstance.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      setIsConnected(false);
    });

    socketInstance.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
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
    const processed = Object.values(cameras).map((cam) => {
      // Ép kiểu an toàn: nếu là số thì giữ nguyên, nếu không có thì trả về chuỗi rỗng
      const rawLastUpdated = cam.attrs.last_updated?.value;
      const rawLastPredicted = cam.attrs.last_predicted?.value;
      const predictionAttr = cam.attrs.prediction?.value;
      
      // Extract cam_id từ NGSI-LD format: "urn:ngsi-ld:Camera:5d9dde1f766c880017188c98"
      const fullId = cam._id.id;
      const shortId = fullId.split(":").pop() || fullId;
      
      // Lấy camera info từ database (name, location)
      const cameraInfo = cameraInfoMap[shortId];
      const displayName = cameraInfo?.display_name || shortId;

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
        status: cam.attrs.prediction?.value?.status ?? "unknown",
        trend: cam.attrs.prediction?.value?.trend ?? "stable",
        forecasts: predictionAttr?.forecasts ?? {
          "5m": 0,
          "10m": 0,
          "15m": 0,
          "30m": 0,
          "60m": 0,
        },
        lastPredicted: rawLastPredicted ? String(rawLastPredicted) : "",
      };
    });

    return processed;
  }, [cameras, cameraInfoMap]);

  // useEffect(() => {
  //   if (processedCameras.length > 0) {
  //     console.group("🔍 Kiểm tra dữ liệu Dự báo (Forecasts)");
  //     processedCameras.forEach((cam) => {
  //       console.log(`Camera: ${cam.shortId}`);
  //       console.log("- Forecasts:", cam.forecasts);
  //       console.log("- Last Predicted:", cam.lastPredicted === "" ? "❌ Trống" : cam.lastPredicted);
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
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// Custom hook để sử dụng Socket Context
export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}

// Export MINIO_URL để các component khác có thể sử dụng
export { MINIO_URL };
