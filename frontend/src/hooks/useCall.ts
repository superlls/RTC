import { useState, useCallback, useRef } from "react";
import { useRTC } from "./useRTC";
import type { CallStatus, StartCallResponse } from "../types";

export function useCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [duration, setDuration] = useState(0);
  const callInfoRef = useRef<StartCallResponse | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtc = useRTC();

  const startCall = useCallback(async () => {
    try {
      setStatus("connecting");

      // 调用后端开始通话
      const res = await fetch("/api/start", { method: "POST" });
      if (!res.ok) throw new Error("启动通话失败");
      const data: StartCallResponse = await res.json();
      callInfoRef.current = data;

      // 加入 RTC 房间
      await rtc.join({
        appId: data.appId,
        token: data.token,
        roomId: data.roomId,
        userId: data.userId,
      });

      // 开始计时
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      setStatus("connected");
    } catch (err) {
      console.error("通话启动失败:", err);
      setStatus("idle");
    }
  }, [rtc]);

  const stopCall = useCallback(async () => {
    try {
      const info = callInfoRef.current;
      if (info) {
        // 调用后端停止通话
        await fetch("/api/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: info.taskId, roomId: info.roomId }),
        });
      }

      // 离开 RTC 房间
      await rtc.leave();
    } catch (err) {
      console.error("停止通话出错:", err);
    } finally {
      // 清理计时器和状态
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      callInfoRef.current = null;
      setDuration(0);
      setStatus("idle");
    }
  }, [rtc]);

  return { status, duration, startCall, stopCall };
}
