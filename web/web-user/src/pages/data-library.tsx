"use client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const MINIO_URL = import.meta.env.VITE_MINIO_URL;

const socket = io(SOCKET_URL);

interface CameraData {
  id: string;
  total_objects?: { value: number };
  minio_key?: { value: string };
  last_updated?: { value: string };
}

export default function DataLibrary() {
  const [cameras, setCameras] = useState<Record<string, CameraData>>({});

  useEffect(() => {
    socket.on("CAMERA_UPDATED", (data) => {
      // console.log("Dữ liệu Socket nhận được:", data);

      if (data && data.id) {
        setCameras((prev) => {
          // Tạo một bản sao mới của state để React nhận diện sự thay đổi
          const nextState = { ...prev, [data.id]: data };
          return nextState;
        });
      }
    });

    // socket.on("connect", () => console.log("✅ Đã kết nối Socket!"));
    socket.on("connect_error", (err) => console.error("❌ Lỗi kết nối:", err));

    return () => {
      socket.off("CAMERA_UPDATED");
    };
  }, []);

  const cameraList = Object.values(cameras);

  return (
    <div className="flex flex-1 flex-col p-4">
      <h1 className="text-xl font-bold mb-4">DATA LIBRARY (REALTIME)</h1>

      {cameraList.length === 0 ? (
        <div className="animate-pulse text-gray-500">
          Đang chờ dữ liệu từ Orion Context Broker...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameraList.map((cam) => (
            <div
              key={cam.id}
              className="p-4 border rounded-lg shadow-sm bg-white"
            >
              <h3 className="font-mono text-sm text-blue-600 truncate">
                ID: {cam.id.split(":").pop()} {/* Rút gọn ID cho dễ nhìn */}
              </h3>

              <div className="mt-2">
                <span className="text-2xl font-bold">
                  {/* Dùng Optional Chaining ?. để không bị lỗi crash */}
                  {cam.total_objects?.value ?? 0}
                </span>
                <span className="ml-2 text-gray-500">vật thể</span>
              </div>
              {cam.minio_key?.value ? (
                <img
                  src={`${MINIO_URL}/images/${cam.minio_key.value}?t=${new Date().getTime()}`}
                  className="rounded-lg shadow-md mt-2 w-full object-cover h-48"
                  alt="Giao thông thực tế"
                />
              ) : (
                <div className="h-48 mt-2 bg-gray-200 flex items-center justify-center rounded-lg">
                  Chưa có ảnh
                </div>
              )}
              <div className="text-xs text-gray-400 mt-2">
                Cập nhật:{" "}
                {cam.last_updated?.value
                  ? new Date(cam.last_updated.value).toLocaleTimeString()
                  : "Đang cập nhật..."}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
