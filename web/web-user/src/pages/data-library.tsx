"use client";
import { useSocket } from "@/contexts/SocketContext";

export default function DataLibrary() {
  // Lấy dữ liệu từ Global Socket Context
  const { processedCameras, isConnected } = useSocket();

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">DATA LIBRARY (REALTIME)</h1>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {processedCameras.length === 0 ? (
        <div className="animate-pulse text-gray-500">
          Đang chờ dữ liệu từ Orion Context Broker...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processedCameras.map((cam) => (
            <div
              key={cam.id}
              className="p-4 border rounded-lg shadow-sm bg-white"
            >
              <h3 className="font-mono text-sm text-blue-600 truncate">
                ID: {cam.shortId}
              </h3>
              <div className="mt-2">
                <span className="text-2xl font-bold">
                  {cam.totalObjects}
                </span>
                <span className="ml-2 text-gray-500">vật thể</span>
              </div>

              <div className="flex gap-2 mt-1 text-sm text-gray-600">
                <span>🚗 {cam.carCount}</span>
                <span>🏍️ {cam.motorbikeCount}</span>
              </div>

              {cam.imageUrl ? (
                <img
                  src={`${cam.imageUrl}?t=${Date.now()}`}
                  className="rounded-lg shadow-md mt-2 w-full object-cover h-48"
                  alt="Giao thông thực tế"
                  onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'%3EImage Error%3C/text%3E%3C/svg%3E";
                  }}
                />
              ) : (
                <div className="h-48 mt-2 bg-gray-200 flex items-center justify-center rounded-lg text-gray-500">
                  Chưa có ảnh
                </div>
              )}

              <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                <span>
                  Cập nhật:{" "}
                  {cam.lastUpdated 
                    ? new Date(cam.lastUpdated).toLocaleTimeString() 
                    : "N/A"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    cam.status === "clear"
                      ? "bg-green-100 text-green-700"
                      : cam.status === "congestion"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {cam.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
