# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

RTC 是一个三层 monorepo，用于接入火山引擎 AI 音视频互动方案，实现语音对话功能。

整体架构：**Frontend（React + Volcano RTC SDK）→ Backend（Token 生成 + 火山 OpenAPI）→ 火山引擎 RTC ← Agent（LangGraph + Kimi LLM）**

## Monorepo 结构

| 目录 | 状态 | 说明 |
|------|------|------|
| `agent/` | ✅ 已完成 | Agent 平台端服务，Hono + LangGraph + Kimi，公网部署于 `8.152.220.24:3000` |
| `backend/` | ✅ 已完成 | Token 生成 + 火山 OpenAPI 编排，开发端口 :3001 |
| `frontend/` | ✅ 已完成 | React + Vite + @volcengine/rtc 语音通话 UI，开发端口 :3002 |
| `docs/` | 设计文档与实施计划 | |
| `references/` | 火山引擎参考文档、Token 生成示例、OpenAPI 文档 | |

各子包独立管理 `package.json`，无根级 package.json。

## 常用命令

### Agent（在 `agent/` 目录下）

```bash
npm run dev          # 开发模式（tsx watch 热重载）
npm run build        # TypeScript 编译到 dist/
npm start            # 生产模式启动
npm test             # 运行所有测试（vitest）
npx vitest run tests/sse-format.test.ts  # 运行单个测试文件
```

### Backend（在 `backend/` 目录下）

```bash
npm run dev          # 开发模式（tsx watch 热重载）
npm run build        # TypeScript 编译到 dist/
npm start            # 生产模式启动
npm test             # 运行所有测试（vitest）
```

### Frontend（在 `frontend/` 目录下）

```bash
npm run dev          # 开发模式（Vite，端口 3002）
npm run build        # 生产构建
```

### 开发端口与启动

| 服务 | 端口 | 启动命令 |
|------|------|----------|
| Agent | 3000 | `cd agent && npm run dev` |
| Backend | 3001 | `cd backend && npm run dev` |
| Frontend | 3002 | `cd frontend && npm run dev` |

> 启动前先杀占用端口的进程：`lsof -ti:<端口> | xargs kill -9 2>/dev/null`

## 技术栈

- **语言**: TypeScript（ESM, `"type": "module"`）
- **HTTP 框架**: Hono + @hono/node-server（Agent 和 Backend 共用）
- **前端框架**: React + Vite
- **RTC SDK**: @volcengine/rtc（默认导出为 `VERTC` 类，`VERTC.createEngine()` 创建引擎）
- **Agent 框架**: LangGraph TS（@langchain/langgraph）
- **LLM**: Kimi（月之暗面），通过 @langchain/openai 的 ChatOpenAI 适配（OpenAI 兼容 API）
- **默认模型**: kimi-k2.6
- **测试**: Vitest
- **运行时**: Node.js

## Agent 架构

```
火山引擎 RTC → POST /v1/chat-stream → Hono → LangGraph Graph → Kimi API → SSE 流式返回
                                                    ↓
                                              工具调用（时间/天气/网页搜索）
```

- Graph 流程: `START → llmNode → shouldContinue(有 tool_calls?) → toolsNode → llmNode → END`
- Kimi thinking 模式已禁用（工具调用模式下会丢失 reasoning_content）
- 系统消息自动注入当前日期/星期

## 火山引擎 SSE 接口规范

- `Content-Type: text/event-stream`
- 每个 chunk 的 `id` 在同一次请求中保持一致
- 必须以 `data: [DONE]` 结束
- 最后一个 chunk 需包含 `finish_reason: "stop"` 和 `usage` 统计

## 环境变量

Agent `.env`（参考 `agent/.env.example`）:
- `KIMI_API_KEY` / `KIMI_BASE_URL` / `DEFAULT_MODEL` / `PORT`
- `QWEATHER_API_KEY` / `QWEATHER_API_HOST`（天气工具）
- `TAVILY_API_KEY`（网页搜索工具）

Backend `.env`（参考 `backend/.env.example`）:
- `RTC_APP_ID` / `RTC_APP_KEY`（RTC 鉴权）
- `VOLC_ACCESS_KEY` / `VOLC_SECRET_KEY`（火山 OpenAPI 签名）
- `AGENT_URL`（公网 Agent：`http://8.152.220.24:3000/v1/chat-stream`）/ `AGENT_API_KEY` / `AGENT_MODEL`
- `PORT`（默认 3001）

> **注意：** `AGENT_URL` 必须是火山平台可达的公网地址，不能用 `localhost`。火山 RTC 平台通过此 URL 回调 Agent 服务。

## Backend 架构

```
Frontend POST /api/start → Backend 生成 Token + 签名调用 StartVoiceChat → 火山 RTC 平台
Frontend POST /api/stop  → Backend 签名调用 StopVoiceChat → 火山 RTC 平台
```

模块结构：
```
backend/src/
├── index.ts              # Hono 入口，挂载路由，CORS
├── config.ts             # 环境变量读取
├── routes/call.ts        # /api/start 和 /api/stop 路由
└── lib/
    ├── token.ts          # RTC Token 生成（HMAC-SHA256，火山官方算法）
    ├── buffer-writer.ts  # Token 序列化用的二进制写入工具
    └── volcengine-api.ts # 火山 OpenAPI V4 签名 + fetch 调用
```

## Frontend 架构

```
frontend/src/
├── main.tsx              # React 入口
├── App.tsx               # 主页面（通话按钮 + 状态显示）
├── App.css               # 样式
├── types.ts              # CallStatus, StartCallResponse
└── hooks/
    ├── useRTC.ts         # 封装 @volcengine/rtc SDK（进房/离房/音频采集）
    └── useCall.ts        # 封装通话流程（后端 API + RTC + 状态机 + 计时器）
```

Vite 开发代理：`/api/*` → `http://localhost:3001`（后端）

## 关键设计文档

- 前后端集成设计: `docs/superpowers/specs/2026-06-02-rtc-frontend-backend-integration-design.md`
- 前后端集成实施计划: `docs/superpowers/plans/2026-06-02-rtc-frontend-backend-integration.md`
- Agent 设计: `docs/superpowers/specs/2026-05-29-rtc-agent-platform-design.md`
- 火山 Token 生成参考: `references/火山官方ts的token生成示例.md`
- 火山 OpenAPI 文档: `references/火山开启、更新、关闭VoiceChat接口相关文档/`
