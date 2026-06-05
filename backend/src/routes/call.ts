import { Hono } from "hono";
import { config } from "../config.js";
import { generateToken } from "../lib/token.js";
import { callVolcAPI } from "../lib/volcengine-api.js";

const callRouter = new Hono();

// 内存中维护活跃任务
const activeTasks = new Map<string, { roomId: string; userId: string }>();

function generateId(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

callRouter.post("/api/start", async (c) => {
  const roomId = generateId("room");
  const userId = generateId("user");
  const taskId = generateId("task");
  const agentUserId = `ai_bot_${taskId}`;

  // 生成 RTC Token
  const token = generateToken({
    appId: config.rtcAppId,
    appKey: config.rtcAppKey,
    roomId,
    userId,
  });

  // 调用 StartVoiceChat
  const body = {
    AppId: config.rtcAppId,
    RoomId: roomId,
    TaskId: taskId,
    Config: {
      ASRConfig: {
        Provider: "volcano",
        ProviderParams: {
          Mode: "bigmodel",
          ApiResourceId: "volc.bigasr.sauc.duration",
        },
        VADConfig: { SilenceTime: 600 },
        InterruptConfig: {},
      },
      LLMConfig: {
        Mode: "CustomLLM",
        Url: config.agentUrl,
        APIKey: config.agentApiKey,
        ModelName: config.agentModel,
        Feature: '{"Http":true}',
        SystemMessages: [],
        HistoryLength: 10,
        Temperature: 0.1,
        TopP: 0,
        MaxTokens: 1024,
      },
      TTSConfig: {
        Provider: "volcano_bidirection",
        ProviderParams: {
          Credential: { ResourceId: "seed-tts-1.0" },
          VolcanoTTSParameters:
            '{"req_params":{"speaker":"zh_female_kailangjiejie_moon_bigtts","audio_params":{"speech_rate":0,"loudness_rate":0},"additions":{"post_process":{"pitch":0}}}}',
        },
      },
      InterruptMode: 0,
      SubtitleConfig: { DisableRTSSubtitle: false, SubtitleMode: 0 },
      FunctionCallingConfig: {},
      WebSearchAgentConfig: {},
      MemoryConfig: {},
      MusicAgentConfig: {},
    },
    AgentConfig: {
      TargetUserId: [userId],
      UserId: agentUserId,
      WelcomeMessage: "你好，我是你的 AI 助手，有什么可以帮你的吗？",
      EnableConversationStateCallback: false,
      VoicePrint: { MetaList: null, VoicePrintList: null },
    },
  };

  const result = await callVolcAPI({
    ak: config.volcAccessKey,
    sk: config.volcSecretKey,
    action: "StartVoiceChat",
    body,
  });

  // 检查返回是否成功
  if ((result as any).ResponseMetadata?.Error) {
    return c.json({ error: (result as any).ResponseMetadata.Error }, 500);
  }

  // 记录活跃任务
  activeTasks.set(taskId, { roomId, userId });

  return c.json({
    appId: config.rtcAppId,
    roomId,
    userId,
    taskId,
    token,
  });
});

callRouter.post("/api/stop", async (c) => {
  const { taskId, roomId } = await c.req.json<{ taskId: string; roomId: string }>();

  const result = await callVolcAPI({
    ak: config.volcAccessKey,
    sk: config.volcSecretKey,
    action: "StopVoiceChat",
    body: {
      AppId: config.rtcAppId,
      RoomId: roomId,
      TaskId: taskId,
    },
  });

  activeTasks.delete(taskId);

  if ((result as any).ResponseMetadata?.Error) {
    return c.json({ error: (result as any).ResponseMetadata.Error }, 500);
  }

  return c.json({ ok: true });
});

export { callRouter };
