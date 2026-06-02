# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

RTC 是一个三层 monorepo，用于接入火山引擎 AI 音视频互动方案，实现语音对话功能。

整体架构：**Frontend（React + Volcano RTC SDK）→ Backend（Token 生成 + 火山 OpenAPI）→ 火山引擎 RTC ← Agent（LangGraph + Kimi LLM）**

## Monorepo 结构

| 目录 | 状态 | 说明 |
|------|------|------|
| `agent/` | ✅ 已完成 | Agent 平台端服务，Hono + LangGraph + Kimi，已部署至 8.152.220.24:3000 |
| `backend/` | 🚧 待开发 | Token 生成 + 火山 OpenAPI 编排（StartVoiceChat / StopVoiceChat） |
| `frontend/` | 🚧 待开发 | React + Vite + @volcengine/rtc 语音通话 UI |
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

### Backend / Frontend

尚未搭建，计划均使用 TypeScript + ESM。Backend 用 Hono + Vitest，Frontend 用 Vite + React。

## 技术栈

- **语言**: TypeScript（ESM, `"type": "module"`）
- **HTTP 框架**: Hono + @hono/node-server（Agent 和 Backend 共用）
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

Backend 计划使用的环境变量:
- `RTC_APP_ID` / `RTC_APP_KEY`（RTC 鉴权）
- `VOLC_ACCESS_KEY` / `VOLC_SECRET_KEY`（火山 OpenAPI 签名）
- `AGENT_URL` / `AGENT_API_KEY` / `AGENT_MODEL`（Agent 服务连接）

## 关键设计文档

- 前后端集成设计: `docs/superpowers/specs/2026-06-02-rtc-frontend-backend-integration-design.md`
- 前后端集成实施计划: `docs/superpowers/plans/2026-06-02-rtc-frontend-backend-integration.md`
- Agent 设计: `docs/superpowers/specs/2026-05-29-rtc-agent-platform-design.md`
- 火山 Token 生成参考: `references/火山官方ts的token生成示例.md`
- 火山 OpenAPI 文档: `references/火山开启、更新、关闭VoiceChat接口相关文档/`
