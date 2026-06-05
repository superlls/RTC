import { useRef, useCallback } from "react";
import { createEngine, IRTCEngine } from "@volcengine/rtc";

export function useRTC() {
  const engineRef = useRef<IRTCEngine | null>(null);

  const join = useCallback(
    async (params: { appId: string; token: string; roomId: string; userId: string }) => {
      // 创建 RTC 引擎实例
      const engine = createEngine(params.appId);
      engineRef.current = engine;

      // 加入房间，自动发布音频，自动订阅音频，不订阅视频
      await engine.joinRoom(
        params.token,
        params.roomId,
        { userId: params.userId },
        {
          isAutoPublish: true,
          isAutoSubscribeAudio: true,
          isAutoSubscribeVideo: false,
        }
      );

      // 开启麦克风采集
      await engine.startAudioCapture();
    },
    []
  );

  const leave = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    // 离开房间并释放引擎引用
    await engine.leaveRoom();
    engineRef.current = null;
  }, []);

  return { join, leave };
}
