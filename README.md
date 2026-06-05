# RTC 项目

火山引擎 AI 音视频互动方案的实现，支持语音对话功能。

## 项目概述

RTC 是一个三层 monorepo 架构，集成火山引擎 RTC 平台和 AI Agent 能力，实现实时语音对话：

- **前端**：React + Volcano RTC SDK 语音通话 UI
- **后端**：Token 生成 + 火山 OpenAPI 编排
- **Agent**：LangGraph + Kimi LLM，支持工具调用（时间/天气/网页搜索）

整体流程：Frontend → Backend（Token 生成）→ 火山 RTC 平台 ← Agent（LLM 处理）

## 目录结构

```
├── agent/              # Agent 平台端服务（Hono + LangGraph + Kimi）
├── backend/            # Token 生成 + 火山 OpenAPI 编排
├── frontend/           # React + Vite 语音通话 UI
├── docs/               # 设计文档与实施计划
└── references/         # 火山引擎参考文档、示例代码
```

## 快速开始

### 环境要求

- Node.js 18+
- 获取火山引擎 RTC 凭证（`RTC_APP_ID`、`RTC_APP_KEY`）
- 获取火山 OpenAPI 凭证（`VOLC_ACCESS_KEY`、`VOLC_SECRET_KEY`）
- 获取 Kimi API Key（`KIMI_API_KEY`）

### 启动步骤

在项目根目录，分别在三个终端窗口启动各服务：

**终端 1 - Agent（端口 3000）**

```bash
cd agent
npm install
cp .env.example .env  # 配置环境变量
npm run dev
```

**终端 2 - Backend（端口 3001）**

```bash
cd backend
npm install
cp .env.example .env  # 配置环境变量
npm run dev
```

**终端 3 - Frontend（端口 3002）**

```bash
cd frontend
npm install
npm run dev
```

启动完成后，在浏览器访问 `http://localhost:3002`。

### 一键清理占用端口的进程

```bash
lsof -ti:3000,3001,3002 | xargs kill -9 2>/dev/null
```

## 主要命令

### Agent 服务

```bash
npm run dev      # 开发模式（tsx watch 热重载）
npm run build    # TypeScript 编译到 dist/
npm start        # 生产模式启动
npm test         # 运行所有测试
```

### Backend 服务

```bash
npm run dev      # 开发模式（tsx watch 热重载）
npm run build    # TypeScript 编译到 dist/
npm start        # 生产模式启动
npm test         # 运行所有测试
```

### Frontend 服务

```bash
npm run dev      # 开发模式（Vite，端口 3002）
npm run build    # 生产构建
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **语言** | TypeScript | ESM 模块，所有子包独立 package.json |
| **HTTP** | Hono | Agent 和 Backend 共用 |
| **RTC SDK** | @volcengine/rtc | 创建引擎：`VERTC.createEngine()` |
| **前端框架** | React + Vite | 开发热重载，代理到后端 |
| **Agent 框架** | LangGraph TS | @langchain/langgraph |
| **LLM** | Kimi（月之暗面） | 通过 @langchain/openai 的 ChatOpenAI 适配 |
| **默认模型** | kimi-k2.6 | - |
| **测试** | Vitest | - |
| **运行时** | Node.js 18+ | - |

## 核心设计

### Agent 处理流程

```
火山 RTC → POST /v1/chat-stream → Hono Server
                                      ↓
                              LangGraph Graph
                                      ↓
                    llmNode → toolsNode（有 tool_calls）→ llmNode
                                      ↓
                                 Kimi API
                                      ↓
                        SSE 流式返回给火山 RTC
```

**特性**：
- 系统消息自动注入当前日期/星期
- Kimi thinking 模式已禁用（工具调用模式下会丢失 reasoning_content）
- 支持时间、天气、网页搜索工具调用

### 火山 SSE 接口规范

- Content-Type: `text/event-stream`
- 每个 chunk 的 `id` 在同一次请求中保持一致
- 必须以 `data: [DONE]` 结束
- 最后一个 chunk 需包含 `finish_reason: "stop"` 和 `usage` 统计

### Backend API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/start` | POST | 生成 Token，启动 RTC 通话 |
| `/api/stop` | POST | 关闭 RTC 通话 |

### Frontend 用户界面

- 通话开始/结束按钮
- 实时状态显示（连接中、通话中、已断开）
- 通话计时器
- 音频采集和播放

## 环境变量配置

### Agent `.env`

```bash
KIMI_API_KEY=<your-kimi-api-key>
KIMI_BASE_URL=<kimi-api-endpoint>
DEFAULT_MODEL=kimi-k2.6
PORT=3000
QWEATHER_API_KEY=<weather-api-key>
QWEATHER_API_HOST=<weather-api-host>
TAVILY_API_KEY=<search-api-key>
```

### Backend `.env`

```bash
RTC_APP_ID=<your-rtc-app-id>
RTC_APP_KEY=<your-rtc-app-key>
VOLC_ACCESS_KEY=<your-volc-access-key>
VOLC_SECRET_KEY=<your-volc-secret-key>
AGENT_URL=http://8.152.220.24:3000/v1/chat-stream
AGENT_API_KEY=<agent-api-key>
AGENT_MODEL=kimi-k2.6
PORT=3001
```

> **注意**：`AGENT_URL` 必须是火山平台可达的公网地址，不能用 `localhost`。

## 设计文档

- [前后端集成设计](docs/superpowers/specs/2026-06-02-rtc-frontend-backend-integration-design.md)
- [前后端集成实施计划](docs/superpowers/plans/2026-06-02-rtc-frontend-backend-integration.md)
- [Agent 设计](docs/superpowers/specs/2026-05-29-rtc-agent-platform-design.md)

## 故障排除

### 连接超时

确认 Agent 服务已启动，且 Backend 中的 `AGENT_URL` 指向正确的公网地址。

### Token 验证失败

检查 `RTC_APP_ID` 和 `RTC_APP_KEY` 是否正确配置。

### 火山 API 调用失败

验证 `VOLC_ACCESS_KEY` 和 `VOLC_SECRET_KEY` 是否有效。

## 许可证

内部项目
