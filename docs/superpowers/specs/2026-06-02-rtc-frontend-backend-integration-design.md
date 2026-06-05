# RTC 前后端集成设计文档

## 概述

在已有 Agent 端（Hono + LangGraph）基础上，集成前端和后端，实现真人用户与 AI 的实时语音对话。开发阶段三个服务全部本地启动：Agent :3000、Backend :3001、Frontend :3002。

## 架构

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│    Frontend     │     │    Backend      │     │   火山 RTC 平台   │
│  React + Vite   │     │  Hono + TS      │     │                  │
│                 │     │                 │     │                  │
│  POST /api/start├────>│  生成 IDs       │     │                  │
│                 │     │  生成 Token     │     │                  │
│                 │     │  StartVoiceChat ├────>│  AI Bot 进房     │
│  <── 返回 ──────┤<────┤  返回凭据       │     │                  │
│                 │     │                 │     │                  │
│  RTC SDK 进房   ├─────┼─────────────────┼────>│  用户进房        │
│  音频采集/对话   │     │                 │     │  实时语音对话     │
│                 │     │                 │     │                  │
│  POST /api/stop ├────>│  StopVoiceChat  ├────>│  AI Bot 退房     │
│  leaveRoom()    │     │                 │     │  用户退房        │
│  destroyEngine()│     │                 │     │                  │
└─────────────────┘     └─────────────────┘     └──────────────────┘
                                                        │
                                                        │ HTTP 调用
                                                        ▼
                                                ┌──────────────────┐
                                                │     Agent        │
                                                │  localhost:3000  │
                                                │  Hono + LangGraph│
                                                └──────────────────┘
```

三个服务各自独立，开发阶段全部本地启动：
- **Frontend :3002** — 用户界面 + RTC SDK
- **Backend :3001** — Token 生成 + 火山 OpenAPI 签名调用
- **Agent :3000** — 本地启动（`cd agent && npm run dev`），火山平台通过 CustomLLM 模式调用

> **启动前先杀端口：** `lsof -ti:<端口> | xargs kill -9 2>/dev/null`

## 通话流程

```
1. 前端请求后端 POST /api/start
2. 后端生成 RoomId、UserId、TaskId
3. 后端用 AppId + AppKey + RoomId + UserId 生成 RTC Token
4. 后端用 AK/SK 签名调用 StartVoiceChat（把 AI 拉进房间）
5. 后端返回给前端：{ token, roomId, userId, taskId, appId }
6. 前端用 createEngine(appId) 创建引擎
7. 前端用 joinRoom(token, roomId, userId) 加入房间
8. 前端 startAudioCapture() 开始音频采集
9. 双方在房间里实时语音对话
10. 前端请求后端 POST /api/stop
11. 后端调用 StopVoiceChat 结束 AI 任务
12. 前端 leaveRoom() 离开房间
13. 前端 destroyEngine() 销毁引擎
```

## 后端设计

### 技术栈

Hono + TypeScript（与 Agent 端一致）

### API 接口

#### `POST /api/start`

请求体：无（后端自动生成所有 ID）

响应：
```json
{
  "roomId": "room_1717300000",
  "userId": "user_abc123",
  "taskId": "task_xyz789",
  "token": "001xxxxxxx...",
  "appId": "YOUR_RTC_APP_ID"
}
```

内部逻辑：
1. 生成 roomId（时间戳）、userId（随机）、taskId（随机）
2. 用 AppId + AppKey + roomId + userId 生成 RTC Token（火山官方 TS SDK）
3. 用 AK/SK 签名调用 StartVoiceChat（携带智能体 Config JSON）
4. 内存中存一份 `{ taskId, roomId }` 映射，供 stop 使用
5. 返回凭据给前端

#### `POST /api/stop`

请求体：
```json
{
  "taskId": "task_xyz789",
  "roomId": "room_1717300000"
}
```

响应：
```json
{ "ok": true }
```

内部逻辑：
1. 用 AK/SK 签名调用 StopVoiceChat（AppId + RoomId + TaskId）
2. 从内存中移除该任务记录

### 模块结构

```
backend/src/
├── index.ts              # Hono 入口
├── routes/call.ts        # /api/start 和 /api/stop
├── lib/token.ts          # RTC Token 生成（火山官方 TS SDK）
├── lib/volcengine-api.ts # OpenAPI 签名 + StartVoiceChat/StopVoiceChat
└── config.ts             # 环境变量
```

### 环境变量

```
RTC_APP_ID=YOUR_RTC_APP_ID
RTC_APP_KEY=YOUR_RTC_APP_KEY
VOLC_ACCESS_KEY=YOUR_VOLC_ACCESS_KEY
VOLC_SECRET_KEY=YOUR_VOLC_SECRET_KEY
# 开发阶段用本地 Agent
AGENT_URL=http://localhost:3000/v1/chat-stream
AGENT_API_KEY=YOUR_AGENT_API_KEY
AGENT_MODEL=kimi-k2.6
PORT=3001
```

### OpenAPI 签名

采用火山引擎标准 HMAC-SHA256 V4 签名：
- Service: `rtc`
- Region: `cn-north-1`
- Host: `rtc.volcengineapi.com`
- Version: `2025-06-01`
- Content-Type: `application/json`

签名流程：构造 CanonicalRequest → StringToSign → 派生签名密钥 → 计算 Signature → 拼装 Authorization Header

### StartVoiceChat 请求体

使用用户从控制台导出的智能体配置，动态填入 AppId、RoomId、TaskId、UserId、TargetUserId：

```json
{
  "AppId": "{RTC_APP_ID}",
  "RoomId": "{生成的 roomId}",
  "TaskId": "{生成的 taskId}",
  "Config": {
    "ASRConfig": {
      "Provider": "volcano",
      "ProviderParams": {
        "Mode": "bigmodel",
        "ApiResourceId": "volc.bigasr.sauc.duration"
      },
      "VADConfig": { "SilenceTime": 600 },
      "InterruptConfig": {}
    },
    "LLMConfig": {
      "Mode": "CustomLLM",
      "Url": "{AGENT_URL}",
      "APIKey": "{AGENT_API_KEY}",
      "ModelName": "{AGENT_MODEL}",
      "SystemMessages": [],
      "HistoryLength": 10,
      "Temperature": 0.1,
      "TopP": 0,
      "MaxTokens": 1024
    },
    "TTSConfig": {
      "Provider": "volcano_bidirection",
      "ProviderParams": {
        "Credential": { "ResourceId": "seed-tts-1.0" },
        "VolcanoTTSParameters": "{\"req_params\":{\"speaker\":\"zh_female_kailangjiejie_moon_bigtts\",\"audio_params\":{\"speech_rate\":0,\"loudness_rate\":0},\"additions\":{\"post_process\":{\"pitch\":0}}}}"
      }
    },
    "InterruptMode": 0,
    "SubtitleConfig": { "DisableRTSSubtitle": false, "SubtitleMode": 0 },
    "FunctionCallingConfig": {},
    "WebSearchAgentConfig": {},
    "MemoryConfig": {},
    "MusicAgentConfig": {}
  },
  "AgentConfig": {
    "TargetUserId": ["{生成的 userId}"],
    "UserId": "ai_bot_{taskId}",
    "EnableConversationStateCallback": false,
    "VoicePrint": { "MetaList": null, "VoicePrintList": null }
  }
}
```

## 前端设计

### 技术栈

React + Vite + TypeScript + @volcengine/rtc

### 页面

单页面，纯语音通话界面：
- 通话状态文字（"点击按钮开始通话" / "连接中..." / "通话中 00:23"）
- 一个通话按钮（开始 / 挂断）

### 三个状态

- `idle` — 显示"开始通话"按钮
- `connecting` — 按钮置灰，显示"连接中..."
- `connected` — 显示"挂断"按钮 + 通话计时

### 模块结构

```
frontend/src/
├── main.tsx
├── App.tsx              # 主页面，通话按钮 + 状态显示
├── hooks/useRTC.ts      # 封装 RTC SDK（createEngine, joinRoom, startAudioCapture, leaveRoom, destroyEngine）
├── hooks/useCall.ts     # 封装通话流程（调后端接口 + 调 useRTC + 状态管理）
└── types.ts             # 类型定义
```

### 核心流程

**开始通话（useCall）：**
```
setState('connecting')
POST /api/start → { token, roomId, userId, appId }
createEngine(appId)
joinRoom(token, roomId, { userId }, { isAutoPublish: true, isAutoSubscribeAudio: true })
startAudioCapture()
setState('connected')
```

**结束通话（useCall）：**
```
POST /api/stop({ taskId, roomId })
leaveRoom()
destroyEngine()
setState('idle')
```

## 待补充

- leaveRoom 和 destroyRTCEngine 的 Web SDK 详细文档（用户后续补充到 references）

## 凭据汇总

| 凭据 | 用途 | 存放位置 |
|------|------|---------|
| AppId | RTC 应用标识 | 后端 .env |
| AppKey | 生成 RTC Token | 后端 .env |
| AK/SK | 签名调用 OpenAPI | 后端 .env |
| Agent URL | StartVoiceChat 中 LLM 配置 | 后端 .env |
| Agent API Key | StartVoiceChat 中 LLM 配置 | 后端 .env |
| RTC Token | 前端进房鉴权 | 后端动态生成，返回给前端 |
