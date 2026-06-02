# RTC Agent 平台端 — 最小 Demo 设计文档

## 概述

构建一个 Agent 平台服务端，接入火山引擎 AI 音视频互动方案。火山引擎 RTC 服务通过 HTTP POST 请求调用本服务，本服务使用 LangGraph TypeScript 编排 Agent 逻辑，调用 Kimi（月之暗面）大模型，以 SSE 流式格式返回响应。

现阶段目标：**跑通整体链路**，搭建框架骨架，不包含工具调用（function calling 后期添加）。

## 技术选型

| 模块 | 选型 | 说明 |
|------|------|------|
| HTTP 框架 | Hono | 轻量，适合 SSE 场景 |
| Agent 框架 | LangGraph TS | 图编排框架，便于后续扩展工具调用 |
| LLM | Kimi（月之暗面） | OpenAI 兼容 API，通过 ChatOpenAI 接入 |
| 默认模型 | kimi-k2.6 | 可通过请求透传覆盖 |
| 运行时 | Node.js + npm | |
| 部署 | 火山云 ECS | 公网可访问 |
| 鉴权 | 暂无 | 后续添加 |

## 架构与数据流

```
火山引擎 RTC 服务
       │
       │ POST /v1/chat-stream (messages + stream=true)
       ▼
┌─────────────────────────┐
│     Hono HTTP Server     │
│  ├─ POST /v1/chat-stream │  ← 接收 RTC 请求
│  └─ SSE Response         │  ← 流式返回
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│    LangGraph Graph       │
│  START → llmNode → END   │
│                          │
│  llmNode:                │
│    - 接收 messages        │
│    - 调用 Kimi API       │
│    - 流式输出 tokens      │
└──────────┬──────────────┘
           │
           │ OpenAI-compatible streaming
           ▼
┌─────────────────────────┐
│   Kimi API (Moonshot)    │
│   chat/completions       │
└─────────────────────────┘
```

## 项目结构

```
RTC_Agent/
├── src/
│   ├── index.ts          # Hono 入口，启动服务器
│   ├── routes/
│   │   └── chat.ts       # /v1/chat-stream 路由，SSE 处理
│   ├── graph/
│   │   ├── index.ts      # LangGraph graph 定义
│   │   └── nodes.ts      # graph 节点（llmNode）
│   └── config/
│       └── index.ts      # 环境变量、配置
├── .env                  # API keys（不入 git）
├── package.json
├── tsconfig.json
└── references/           # 参考文档
```

## 模块详细设计

### 1. Hono 层 — 请求接收与 SSE 响应

**路由**：`POST /v1/chat-stream`

**请求处理流程**：
1. 接收 RTC POST 请求，解析 body（messages、model、temperature、max_tokens 等）
2. 将参数传入 LangGraph graph 执行
3. graph 返回的流式 tokens 逐个包装成火山引擎要求的 SSE chunk 格式
4. 最后发送 `data: [DONE]`

**SSE 响应格式**（严格遵循火山引擎规范）：

每个 chunk：
```json
data: {
  "id": "<uuid，同一次请求保持一致>",
  "object": "chat.completion.chunk",
  "created": <unix_timestamp>,
  "model": "<透传的 model>",
  "choices": [{"index": 0, "delta": {"content": "文本片段"}, "finish_reason": null}]
}
```

最后一个 chunk 携带 `finish_reason: "stop"` 和 `usage` 统计，然后发送 `data: [DONE]`。

### 2. LangGraph 层 — Graph 定义与 LLM Node

**Graph 结构**：`START → llmNode → END`

**State 定义**：使用 LangGraph 内置的 `MessagesAnnotation`，包含 messages 列表。

**llmNode 行为**：
1. 从 state 中取出 messages
2. 调用 ChatOpenAI（配置为 Kimi endpoint）
3. 流式获取 tokens
4. 将 AI 回复写回 state

**LLM 配置**：
```typescript
const llm = new ChatOpenAI({
  model: "kimi-k2.6",  // 可从请求透传覆盖
  apiKey: process.env.KIMI_API_KEY,
  configuration: {
    baseURL: "https://api.moonshot.cn/v1"
  },
  streaming: true
});
```

LangGraph TS 通过 `streamEvents` 方法监听 graph 执行过程中 LLM 的逐 token 输出，Hono 层通过此 stream 拿到每个 token 包装成 SSE chunk 返回。

### 3. 配置管理

**环境变量（.env）**：
```
KIMI_API_KEY=your-kimi-api-key
KIMI_BASE_URL=https://api.moonshot.cn/v1
DEFAULT_MODEL=kimi-k2.6
PORT=3000
```

配置模块读取环境变量，导出类型化的配置对象。model 优先使用 RTC 请求中透传的值，兜底用 DEFAULT_MODEL。

## 后续扩展路径

1. **工具调用**：在 graph 中加入 tool node + conditional edge，实现天气查询、时间查询、网络搜索
2. **鉴权**：加 Hono 中间件验证 Authorization header
3. **上下文管理**：LangGraph 自管理对话历史，支持更复杂的多轮对话策略
4. **角色人设**：通过 system prompt 配置 Agent 人设
