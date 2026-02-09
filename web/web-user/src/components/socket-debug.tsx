"use client";
import { useSocket } from "@/contexts/SocketContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SocketDebug() {
  const { isConnected, cameras, processedCameras, socket } = useSocket();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm font-mono">🔍 Socket Debug Info</CardTitle>
        <CardDescription>Real-time connection and data status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Connection:</span>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "✅ Connected" : "❌ Disconnected"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Socket ID:</span>
          <code className="px-2 py-0.5 bg-muted rounded">{socket?.id || "N/A"}</code>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Transport:</span>
          <code className="px-2 py-0.5 bg-muted rounded">
            {socket?.io.engine.transport.name || "N/A"}
          </code>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Raw Cameras:</span>
          <Badge variant="outline">{Object.keys(cameras).length}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Processed Cameras:</span>
          <Badge variant="outline">{processedCameras.length}</Badge>
        </div>

        {processedCameras.length > 0 && (
          <div className="mt-2 p-2 bg-muted rounded space-y-1">
            <div className="font-semibold text-green-600">✅ Data Received:</div>
            {processedCameras.slice(0, 3).map((cam) => (
              <div key={cam.id} className="text-xs">
                • {cam.shortId}: {cam.totalObjects} vehicles
              </div>
            ))}
            {processedCameras.length > 3 && (
              <div className="text-muted-foreground">
                ... and {processedCameras.length - 3} more
              </div>
            )}
          </div>
        )}

        {!isConnected && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-red-600 dark:text-red-400">
            ⚠️ Socket not connected. Check VITE_SOCKET_URL in .env
          </div>
        )}

        {isConnected && processedCameras.length === 0 && (
          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-yellow-600 dark:text-yellow-400">
            ⏳ Connected but no data received yet. Waiting for CAMERA_UPDATED events...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
