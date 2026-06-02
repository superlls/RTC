# CLAUDE.md

## 项目概述

火山引擎 AI 音视频互动方案的完整实现，包含三个子项目。

## 目录结构

```
RTC/
├── agent/       # Agent 服务 — 接收火山 RTC 转发的文本请求，调用 Kimi 大模型，SSE 流式返回
├── backend/     # 业务后端 — 签发 RTC Token、调用 StartVoiceChat/StopVoiceChat 管理任务
├── frontend/    # 前端客户端 — 集成火山 RTC Web SDK，用户语音对话界面
└── CLAUDE.md    # 本文件
```

## 完整链路

```
前端(RTC SDK) → 进房
     ↓
业务后端 → 调用 StartVoiceChat → 火山 RTC 启动 AI Bot
     ↓
用户说话 → 火山 RTC 做 ASR → POST 到 agent 服务 → SSE 返回 → 火山 RTC 做 TTS → 用户听到回复
```

## 各子项目技术栈

- **agent**: Hono + LangGraph TS + Kimi（月之暗面）
- **backend**: Node.js + TypeScript + Hono
- **frontend**: React + TypeScript + Vite + @volcengine/rtc
