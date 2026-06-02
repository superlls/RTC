# RTC Agent 平台端最小 Demo 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建一个接入火山引擎 AI 音视频互动方案的 Agent 服务端，使用 LangGraph TS 编排 Agent 逻辑，调用 Kimi 大模型，以 SSE 流式格式返回响应。

**Architecture:** Hono HTTP 服务器接收火山引擎 RTC 的 POST 请求，将 messages 传入 LangGraph graph（单 LLM node），graph 调用 Kimi API 获取流式响应，Hono 层将 tokens 包装成火山引擎规范的 SSE chunk 格式返回。

**Tech Stack:** Hono, LangGraph TS, @langchain/openai (ChatOpenAI), Node.js + npm, TypeScript, dotenv

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `package.json` | 依赖管理、scripts |
| `tsconfig.json` | TypeScript 编译配置 |
| `.env` | 环境变量（不入 git） |
| `.gitignore` | 忽略 node_modules、.env、dist |
| `src/config/index.ts` | 读取环境变量，导出类型化配置 |
| `src/graph/nodes.ts` | LLM node 定义 |
| `src/graph/index.ts` | LangGraph graph 编译 |
| `src/routes/chat.ts` | POST /v1/chat-stream 路由，SSE 响应格式化 |
| `src/index.ts` | Hono 入口，挂载路由，启动服务器 |
| `tests/sse-format.test.ts` | SSE 格式化函数的单元测试 |

---

### Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env`

- [ ] **Step 1: 初始化 git 仓库**

```bash
cd /Users/superlls/工作/pre-demo/RTC_Agent
git init
```

- [ ] **Step 2: 创建 .gitignore**

创建 `.gitignore`：

```
node_modules/
dist/
.env
```

- [ ] **Step 3: 初始化 package.json**

```bash
npm init -y
```

然后修改 `package.json`，添加 scripts 和 type：

```json
{
  "name": "rtc-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: 安装依赖**

```bash
npm install hono @hono/node-server @langchain/langgraph @langchain/openai @langchain/core dotenv uuid
npm install -D typescript tsx vitest @types/node @types/uuid
```

- [ ] **Step 5: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: 创建 .env**

```
KIMI_API_KEY=your-kimi-api-key
KIMI_BASE_URL=https://api.moonshot.cn/v1
DEFAULT_MODEL=kimi-k2.6
PORT=3000
```

- [ ] **Step 7: 提交**

```bash
git add .gitignore package.json package-lock.json tsconfig.json .env
git commit -m "chore: 初始化项目，安装依赖"
```

注意：.env 在 .gitignore 中，不会被提交。改为提交一个 `.env.example`：

```
KIMI_API_KEY=your-kimi-api-key
KIMI_BASE_URL=https://api.moonshot.cn/v1
DEFAULT_MODEL=kimi-k2.6
PORT=3000
```

```bash
git add .gitignore package.json package-lock.json tsconfig.json .env.example
git commit -m "chore: 初始化项目，安装依赖"
```

---

### Task 2: 配置模块

**Files:**
- Create: `src/config/index.ts`

- [ ] **Step 1: 编写配置模块**

`src/config/index.ts`：

```typescript
import "dotenv/config";

export const config = {
  kimiApiKey: process.env.KIMI_API_KEY || "",
  kimiBaseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
  defaultModel: process.env.DEFAULT_MODEL || "kimi-k2.6",
  port: parseInt(process.env.PORT || "3000", 10),
} as const;
```

- [ ] **Step 2: 提交**

```bash
git add src/config/index.ts
git commit -m "feat: 添加配置模块，读取环境变量"
```

---

### Task 3: SSE 格式化工具函数（TDD）

**Files:**
- Create: `src/routes/sse-utils.ts`
- Create: `tests/sse-format.test.ts`

火山引擎对 SSE 响应格式有严格要求，把格式化逻辑抽成独立函数方便测试。

- [ ] **Step 1: 编写测试**

`tests/sse-format.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  formatSSEChunk,
  formatSSEDone,
  formatFirstChunk,
  formatFinalChunk,
} from "../src/routes/sse-utils.js";

describe("SSE 格式化", () => {
  const id = "test-uuid-123";
  const model = "kimi-k2.6";
  const created = 1723714562;

  it("formatFirstChunk: 生成带 role 的首个 chunk", () => {
    const result = formatFirstChunk(id, model, created);
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe(id);
    expect(parsed.object).toBe("chat.completion.chunk");
    expect(parsed.created).toBe(created);
    expect(parsed.model).toBe(model);
    expect(parsed.choices[0].index).toBe(0);
    expect(parsed.choices[0].delta.role).toBe("assistant");
    expect(parsed.choices[0].finish_reason).toBeNull();
  });

  it("formatSSEChunk: 生成内容 chunk", () => {
    const result = formatSSEChunk(id, model, created, "你好");
    const parsed = JSON.parse(result);
    expect(parsed.choices[0].delta.content).toBe("你好");
    expect(parsed.choices[0].finish_reason).toBeNull();
    expect(parsed.id).toBe(id);
  });

  it("formatFinalChunk: 生成带 stop 和 usage 的结束 chunk", () => {
    const result = formatFinalChunk(id, model, created, {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    });
    const parsed = JSON.parse(result);
    expect(parsed.choices[0].finish_reason).toBe("stop");
    expect(parsed.choices[0].delta).toEqual({});
    expect(parsed.usage.total_tokens).toBe(30);
  });

  it("formatSSEDone: 返回 [DONE] 标记", () => {
    expect(formatSSEDone()).toBe("[DONE]");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/sse-format.test.ts
```

预期：FAIL，模块不存在。

- [ ] **Step 3: 实现 SSE 格式化函数**

`src/routes/sse-utils.ts`：

```typescript
export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export function formatFirstChunk(
  id: string,
  model: string,
  created: number
): string {
  return JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null,
      },
    ],
  });
}

export function formatSSEChunk(
  id: string,
  model: string,
  created: number,
  content: string
): string {
  return JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  });
}

export function formatFinalChunk(
  id: string,
  model: string,
  created: number,
  usage: UsageInfo
): string {
  return JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
    usage,
    stream_options: { include_usage: true },
  });
}

export function formatSSEDone(): string {
  return "[DONE]";
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/sse-format.test.ts
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/routes/sse-utils.ts tests/sse-format.test.ts
git commit -m "feat: 添加 SSE 格式化工具函数及测试"
```

---

### Task 4: LangGraph Graph 与 LLM Node

**Files:**
- Create: `src/graph/nodes.ts`
- Create: `src/graph/index.ts`

- [ ] **Step 1: 编写 LLM node**

`src/graph/nodes.ts`：

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { MessagesAnnotation } from "@langchain/langgraph";
import { config } from "../config/index.js";

export function createLlm(model?: string): ChatOpenAI {
  return new ChatOpenAI({
    model: model || config.defaultModel,
    apiKey: config.kimiApiKey,
    configuration: {
      baseURL: config.kimiBaseUrl,
    },
    streaming: true,
  });
}

export async function llmNode(
  state: typeof MessagesAnnotation.State,
  llm: ChatOpenAI
): Promise<typeof MessagesAnnotation.Update> {
  const response = await llm.invoke(state.messages);
  return { messages: [response] };
}
```

- [ ] **Step 2: 编写 graph 定义**

`src/graph/index.ts`：

```typescript
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { createLlm, llmNode } from "./nodes.js";

export function createGraph(model?: string) {
  const llm = createLlm(model);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("llm", (state) => llmNode(state, llm))
    .addEdge("__start__", "llm")
    .addEdge("llm", "__end__");

  return graph.compile();
}
```

- [ ] **Step 3: 提交**

```bash
git add src/graph/nodes.ts src/graph/index.ts
git commit -m "feat: 添加 LangGraph graph 定义和 LLM node"
```

---

### Task 5: Hono 路由 — POST /v1/chat-stream

**Files:**
- Create: `src/routes/chat.ts`

这是核心整合模块：接收 RTC 请求 → 调用 graph → 流式转换 → SSE 返回。

- [ ] **Step 1: 编写 chat 路由**

`src/routes/chat.ts`：

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { createGraph } from "../graph/index.js";
import { config } from "../config/index.js";
import {
  formatFirstChunk,
  formatSSEChunk,
  formatFinalChunk,
  formatSSEDone,
} from "./sse-utils.js";

// 火山引擎 RTC 请求体类型
interface RTCRequest {
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  model?: string;
  top_p?: number;
  custom?: string;
}

export const chatRouter = new Hono();

chatRouter.post("/v1/chat-stream", async (c) => {
  const body = await c.req.json<RTCRequest>();

  const model = body.model || config.defaultModel;
  const requestId = uuidv4();
  const created = Math.floor(Date.now() / 1000);

  // 将 RTC 消息格式转换为 LangChain 消息
  const messages = body.messages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    }
    // assistant 消息作为 AI 消息
    return new AIMessageChunk(msg.content);
  });

  const graph = createGraph(model);

  return streamSSE(c, async (stream) => {
    // 发送首个 chunk（带 role）
    await stream.writeSSE({
      data: formatFirstChunk(requestId, model, created),
    });

    let completionTokens = 0;

    // 使用 streamEvents 获取 LLM 的逐 token 输出
    const eventStream = graph.streamEvents(
      { messages },
      { version: "v2" }
    );

    for await (const event of eventStream) {
      if (
        event.event === "on_chat_model_stream" &&
        event.data.chunk instanceof AIMessageChunk
      ) {
        const content = event.data.chunk.content;
        if (typeof content === "string" && content.length > 0) {
          completionTokens++;
          await stream.writeSSE({
            data: formatSSEChunk(requestId, model, created, content),
          });
        }
      }
    }

    // 发送结束 chunk
    await stream.writeSSE({
      data: formatFinalChunk(requestId, model, created, {
        prompt_tokens: 0,
        completion_tokens: completionTokens,
        total_tokens: completionTokens,
      }),
    });

    // 发送 [DONE]
    await stream.writeSSE({ data: formatSSEDone() });
  });
});
```

- [ ] **Step 2: 提交**

```bash
git add src/routes/chat.ts
git commit -m "feat: 添加 chat 路由，集成 LangGraph 流式输出和 SSE 格式化"
```

---

### Task 6: Hono 入口与服务器启动

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: 编写入口文件**

`src/index.ts`：

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config/index.js";
import { chatRouter } from "./routes/chat.js";

const app = new Hono();

// 健康检查
app.get("/health", (c) => c.json({ status: "ok" }));

// 挂载 chat 路由
app.route("/", chatRouter);

console.log(`RTC Agent 服务启动，端口: ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});
```

- [ ] **Step 2: 启动服务验证编译通过**

```bash
npx tsx src/index.ts
```

预期：控制台输出 `RTC Agent 服务启动，端口: 3000`，然后 Ctrl+C 停止。

- [ ] **Step 3: 提交**

```bash
git add src/index.ts
git commit -m "feat: 添加 Hono 入口，启动 HTTP 服务器"
```

---

### Task 7: 端到端手动测试

**Files:** 无新文件

用 curl 模拟火山引擎 RTC 的请求，验证整个链路。

- [ ] **Step 1: 配置真实的 Kimi API Key**

在 `.env` 中填入真实的 `KIMI_API_KEY`。

- [ ] **Step 2: 启动服务**

```bash
npx tsx src/index.ts
```

- [ ] **Step 3: 健康检查**

```bash
curl http://localhost:3000/health
```

预期返回：`{"status":"ok"}`

- [ ] **Step 4: 模拟 RTC 请求**

新开终端窗口，执行：

```bash
curl -N --location 'http://localhost:3000/v1/chat-stream' \
  --header 'Content-Type: application/json' \
  --data '{
    "messages": [
      {"role": "user", "content": "你好，今天天气怎么样？"}
    ],
    "stream": true,
    "temperature": 0.7,
    "max_tokens": 200,
    "model": "kimi-k2.6"
  }'
```

预期返回：多个 `data: {...}` 格式的 SSE 事件，最后以 `data: [DONE]` 结束。每个 data 的 JSON 结构应包含 `id`、`object`、`created`、`model`、`choices` 字段。

- [ ] **Step 5: 验证响应格式**

检查返回的 SSE 数据：
1. 所有 chunk 的 `id` 一致
2. `object` 为 `chat.completion.chunk`
3. 第一个 chunk 包含 `delta.role: "assistant"`
4. 中间 chunk 包含 `delta.content` 文本片段
5. 最后一个 chunk 包含 `finish_reason: "stop"` 和 `usage`
6. 最终以 `data: [DONE]` 结束

- [ ] **Step 6: 提交最终状态**

确认一切正常后：

```bash
git add -A
git commit -m "chore: 最小 demo 链路跑通"
```
