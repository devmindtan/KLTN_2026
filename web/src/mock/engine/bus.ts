/**
 * Event bus nội bộ rất đơn giản — mô phỏng các sự kiện đẩy real-time mà bình thường
 * đến từ Socket.IO. Mock router (model train/activate...) publish, SocketContext ở
 * Mock Mode subscribe để cập nhật state giống hệt khi nhận socket event thật.
 */

export type MockEventName =
  | "TRAINING_JOB_UPDATED"
  | "MODEL_RELOAD_UPDATED"
  | "FORECAST_UPDATED"
  | "DECISION_UPDATED";

type Handler = (payload: unknown) => void;

const handlers = new Map<MockEventName, Set<Handler>>();

export function emitMockEvent(event: MockEventName, payload: unknown): void {
  handlers.get(event)?.forEach((h) => h(payload));
}

export function onMockEvent(event: MockEventName, handler: Handler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}
