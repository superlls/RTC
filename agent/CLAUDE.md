# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

RTC Agent 平台端 — 接入火山引擎 AI 音视频互动方案的 Agent 服务。火山引擎 RTC 通过 HTTP POST 调用本服务，本服务使用 LangGraph TS 编排 Agent 逻辑，调用 Kimi（月之暗面）大模型，以 SSE 流式格式返回响应。

## 技术栈

- **HTTP 框架**: Hono + @hono/node-server
- **Agent 框架**: LangGraph TypeScript (@langchain/langgraph)
- **LLM**: Kimi（月之暗面），通过 @langchain/openai 的 ChatOpenAI 接入（OpenAI 兼容 API）
- **默认模型**: kimi-k2.6（可通过请求透传覆盖）
- **运行时**: Node.js + npm
- **语言**: TypeScript（ESM, "type": "module"）
- **测试**: Vitest
- **部署**: 火山云 ECS

## 常用命令

```bash
npm run dev          # 开发模式（tsx watch）
npm run build        # TypeScript 编译
npm start            # 生产模式启动
npm test             # 运行测试
npx vitest run tests/sse-format.test.ts  # 运行单个测试文件
```

## 架构

```
火山引擎 RTC → POST /v1/chat-stream → Hono → LangGraph Graph(START→llmNode→END) → Kimi API → SSE 流式返回
```

- `src/index.ts` — Hono 入口，挂载路由，启动服务器
- `src/routes/chat.ts` — 核心路由，接收 RTC 请求，调用 graph，SSE 格式化返回
- `src/routes/sse-utils.ts` — SSE chunk 格式化函数（严格遵循火山引擎规范）
- `src/graph/index.ts` — LangGraph graph 编译（当前 START→llmNode→END）
- `src/graph/nodes.ts` — graph 节点定义（llmNode 调用 Kimi）
- `src/config/index.ts` — 环境变量读取

## 火山引擎接口规范要点

- SSE 响应必须设置 `Content-Type: text/event-stream`
- 每个 chunk 的 `id` 在同一次请求中保持一致
- 必须以 `data: [DONE]` 结束
- 最后一个 chunk 需包含 `finish_reason: "stop"` 和 `usage` 统计
- 详细接口规范见 `references/火山引擎接入Agent.md`

## 环境变量

配置在 `.env` 文件中（不入 git），参考 `.env.example`：
- `KIMI_API_KEY` — Kimi API 密钥
- `KIMI_BASE_URL` — Kimi API 地址（默认 https://api.moonshot.cn/v1）
- `DEFAULT_MODEL` — 默认模型（kimi-k2.6）
- `PORT` — 服务端口（默认 3000）

## 设计与计划文档

- 设计文档: `docs/superpowers/specs/2026-05-29-rtc-agent-platform-design.md`
- 实施计划: `docs/superpowers/plans/2026-05-29-rtc-agent-platform.md`
