export type CallStatus = "idle" | "connecting" | "connected";

export interface StartCallResponse {
  appId: string;
  roomId: string;
  userId: string;
  taskId: string;
  token: string;
}
