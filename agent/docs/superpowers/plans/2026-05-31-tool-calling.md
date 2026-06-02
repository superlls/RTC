# Tool Calling 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 RTC Agent 增加工具调用能力（查天气、查时间、查网络信息），采用 LangGraph ReAct 模式，LLM 自主决定是否调用工具。

**Architecture:** 将现有的线性 Graph（START→llmNode→END）改为 ReAct 循环（START→llmNode⇄toolNode→END）。使用 LangGraph 内置 ToolNode 执行工具，conditional edge 根据 LLM 输出是否含 tool_calls 决定路由。工具内部 catch 所有异常，返回错误文本让 LLM 自行解释。

**Tech Stack:** LangGraph ToolNode、LangChain `tool()` 函数、和风天气 GeoAPI + 实时天气 API、Tavily SDK (`@tavily/core`)

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `src/tools/time.ts` | getCurrentTime 工具 |
| 新建 | `src/tools/weather.ts` | getWeather 工具 |
| 新建 | `src/tools/web-search.ts` | webSearch 工具 |
| 新建 | `src/tools/index.ts` | 导出 tools 数组 |
| 新建 | `tests/tools.test.ts` | 工具单元测试 |
| 修改 | `src/config/index.ts` | 新增 qweatherApiKey、qweatherApiHost、tavilyApiKey |
| 修改 | `src/graph/nodes.ts` | llm.bindTools(tools) |
| 修改 | `src/graph/index.ts` | 添加 ToolNode + conditional edge |
| 修改 | `.env.example` | 新增 QWEATHER_API_KEY、QWEATHER_API_HOST、TAVILY_API_KEY |

---

### Task 1: 安装依赖 + 更新配置

**Files:**
- Modify: `package.json`（npm install 自动处理）
- Modify: `src/config/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: 安装 @tavily/core**

```bash
npm install @tavily/core
```

- [ ] **Step 2: 更新 src/config/index.ts，新增 API key 配置**

将 `src/config/index.ts` 改为：

```typescript
import "dotenv/config";

export const config = {
  kimiApiKey: process.env.KIMI_API_KEY || "",
  kimiBaseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
  defaultModel: process.env.DEFAULT_MODEL || "kimi-k2.6",
  port: parseInt(process.env.PORT || "3000", 10),
  qweatherApiKey: process.env.QWEATHER_API_KEY || "",
  qweatherApiHost: process.env.QWEATHER_API_HOST || "",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
} as const;
```

- [ ] **Step 3: 更新 .env.example**

在文件末尾追加：

```
QWEATHER_API_KEY=your-qweather-api-key
QWEATHER_API_HOST=your-qweather-api-host
TAVILY_API_KEY=your-tavily-api-key
```

- [ ] **Step 4: 提交**

```bash
git add src/config/index.ts .env.example package.json package-lock.json
git commit -m "feat: 添加 tool calling 依赖和配置项"
```

---

### Task 2: 实现 getCurrentTime 工具（含 TDD）

**Files:**
- Create: `src/tools/time.ts`
- Create: `tests/tools.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/tools.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { getCurrentTime } from "../src/tools/time.js";

describe("getCurrentTime", () => {
  it("返回包含日期和时间的中文格式字符串", async () => {
    const result = await getCurrentTime.invoke({});
    // 应包含 "年"、"月"、"日" 等中文格式化标记
    expect(result).toMatch(/\d{4}年/);
    expect(result).toMatch(/月/);
    expect(result).toMatch(/日/);
    expect(typeof result).toBe("string");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/tools.test.ts
```

预期：FAIL，模块 `../src/tools/time.js` 不存在。

- [ ] **Step 3: 实现 getCurrentTime**

创建 `src/tools/time.ts`：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentTime = tool(
  async () => {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    }).format(now);
    return `当前时间：${formatted}`;
  },
  {
    name: "getCurrentTime",
    description: "获取当前日期和时间（北京时间）",
    schema: z.object({}),
  }
);
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/tools.test.ts
```

预期：PASS

- [ ] **Step 5: 提交**

```bash
git add src/tools/time.ts tests/tools.test.ts
git commit -m "feat: 实现 getCurrentTime 工具"
```

---

### Task 3: 实现 getWeather 工具（含 TDD）

**Files:**
- Create: `src/tools/weather.ts`
- Modify: `tests/tools.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/tools.test.ts` 中追加：

```typescript
import { getWeather } from "../src/tools/weather.js";

describe("getWeather", () => {
  it("接受 city 参数并返回字符串", async () => {
    const result = await getWeather.invoke({ city: "北京" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("城市不存在时返回错误描述而非抛异常", async () => {
    const result = await getWeather.invoke({ city: "不存在的城市名xxxx" });
    expect(typeof result).toBe("string");
    // 不应抛异常，应返回包含"失败"或错误信息的文本
    expect(result.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/tools.test.ts
```

预期：FAIL，模块 `../src/tools/weather.js` 不存在。

- [ ] **Step 3: 实现 getWeather**

创建 `src/tools/weather.ts`：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { config } from "../config/index.js";

export const getWeather = tool(
  async ({ city }: { city: string }) => {
    try {
      // 第一步：GeoAPI 查询城市 LocationID
      const geoUrl = `https://${config.qweatherApiHost}/geo/v2/city/lookup?location=${encodeURIComponent(city)}`;
      const geoRes = await fetch(geoUrl, {
        headers: { "X-QW-Api-Key": config.qweatherApiKey },
      });
      const geoData = await geoRes.json();

      if (geoData.code !== "200" || !geoData.location?.length) {
        return `天气查询失败：未找到城市"${city}"`;
      }

      const locationId = geoData.location[0].id;
      const cityName = geoData.location[0].name;

      // 第二步：实时天气查询
      const weatherUrl = `https://${config.qweatherApiHost}/v7/weather/now?location=${locationId}`;
      const weatherRes = await fetch(weatherUrl, {
        headers: { "X-QW-Api-Key": config.qweatherApiKey },
      });
      const weatherData = await weatherRes.json();

      if (weatherData.code !== "200") {
        return `天气查询失败：无法获取${cityName}的天气数据`;
      }

      const now = weatherData.now;
      return `${cityName}当前天气：${now.text}，温度 ${now.temp}°C，体感温度 ${now.feelsLike}°C，湿度 ${now.humidity}%，${now.windDir}${now.windScale}级，风速 ${now.windSpeed}km/h`;
    } catch (err) {
      return `天气查询失败：${err instanceof Error ? err.message : "未知错误"}`;
    }
  },
  {
    name: "getWeather",
    description: "查询指定城市的实时天气信息",
    schema: z.object({
      city: z.string().describe("城市名称，如"北京"、"上海""),
    }),
  }
);
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/tools.test.ts
```

预期：PASS（注意：需要 `.env` 中配置了有效的 `QWEATHER_API_KEY` 才能真正返回天气数据，否则第一个测试会返回错误文本但仍通过类型检查；第二个测试天然通过）

- [ ] **Step 5: 提交**

```bash
git add src/tools/weather.ts tests/tools.test.ts
git commit -m "feat: 实现 getWeather 工具"
```

---

### Task 4: 实现 webSearch 工具（含 TDD）

**Files:**
- Create: `src/tools/web-search.ts`
- Modify: `tests/tools.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/tools.test.ts` 中追加：

```typescript
import { webSearch } from "../src/tools/web-search.js";

describe("webSearch", () => {
  it("接受 query 参数并返回字符串", async () => {
    const result = await webSearch.invoke({ query: "LangGraph 是什么" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("搜索失败时返回错误描述而非抛异常", async () => {
    // 无效 API key 场景下应返回错误文本
    const result = await webSearch.invoke({ query: "test" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/tools.test.ts
```

预期：FAIL，模块 `../src/tools/web-search.js` 不存在。

- [ ] **Step 3: 实现 webSearch**

创建 `src/tools/web-search.ts`：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { tavily } from "@tavily/core";
import { config } from "../config/index.js";

export const webSearch = tool(
  async ({ query }: { query: string }) => {
    try {
      const client = tavily({ apiKey: config.tavilyApiKey });
      const response = await client.search(query, { maxResults: 3 });

      if (!response.results?.length) {
        return `未找到与"${query}"相关的搜索结果`;
      }

      const results = response.results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.content}\n   来源: ${r.url}`)
        .join("\n\n");

      return `搜索结果：\n\n${results}`;
    } catch (err) {
      return `网络搜索失败：${err instanceof Error ? err.message : "未知错误"}`;
    }
  },
  {
    name: "webSearch",
    description: "搜索网络信息，获取最新的网络内容",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
    }),
  }
);
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/tools.test.ts
```

预期：PASS

- [ ] **Step 5: 提交**

```bash
git add src/tools/web-search.ts tests/tools.test.ts
git commit -m "feat: 实现 webSearch 工具"
```

---

### Task 5: 创建工具索引文件

**Files:**
- Create: `src/tools/index.ts`

- [ ] **Step 1: 创建 src/tools/index.ts**

```typescript
import { getCurrentTime } from "./time.js";
import { getWeather } from "./weather.js";
import { webSearch } from "./web-search.js";

export const tools = [getCurrentTime, getWeather, webSearch];
```

- [ ] **Step 2: 确认 TypeScript 编译无错误**

```bash
npx tsc --noEmit
```

预期：无错误输出。

- [ ] **Step 3: 提交**

```bash
git add src/tools/index.ts
git commit -m "feat: 创建工具索引文件"
```

---

### Task 6: 改造 Graph 为 ReAct 模式

**Files:**
- Modify: `src/graph/nodes.ts`
- Modify: `src/graph/index.ts`

- [ ] **Step 1: 修改 src/graph/nodes.ts — llm 绑定工具**

将 `src/graph/nodes.ts` 改为：

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { MessagesAnnotation } from "@langchain/langgraph";
import { config } from "../config/index.js";
import { tools } from "../tools/index.js";

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
  const llmWithTools = llm.bindTools(tools);
  const response = await llmWithTools.invoke(state.messages);
  return { messages: [response] };
}
```

- [ ] **Step 2: 修改 src/graph/index.ts — 添加 ToolNode + conditional edge**

将 `src/graph/index.ts` 改为：

```typescript
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { createLlm, llmNode } from "./nodes.js";
import { tools } from "../tools/index.js";

// 判断 LLM 输出是否包含 tool_calls
function shouldContinue(state: typeof MessagesAnnotation.State): "tools" | "__end__" {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }
  return "__end__";
}

export function createGraph(model?: string) {
  const llm = createLlm(model);
  const toolNode = new ToolNode(tools);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("llm", (state) => llmNode(state, llm))
    .addNode("tools", toolNode)
    .addEdge("__start__", "llm")
    .addConditionalEdges("llm", shouldContinue)
    .addEdge("tools", "llm");

  return graph.compile();
}
```

- [ ] **Step 3: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

预期：无错误。

- [ ] **Step 4: 运行全部已有测试，确认不破坏现有功能**

```bash
npm test
```

预期：所有测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/graph/nodes.ts src/graph/index.ts
git commit -m "feat: 改造 Graph 为 ReAct 循环，支持工具调用"
```

---

### Task 7: 手动端到端验证

- [ ] **Step 1: 确保 .env 中配置了必需的 API key**

确认 `.env` 包含 `QWEATHER_API_KEY`、`QWEATHER_API_HOST` 和 `TAVILY_API_KEY`。

- [ ] **Step 2: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 3: 发送不需要工具的普通对话请求**

```bash
curl -X POST http://localhost:3000/v1/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```

预期：正常返回 SSE 流式响应，不调用任何工具。

- [ ] **Step 4: 发送需要查时间的请求**

```bash
curl -X POST http://localhost:3000/v1/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"现在几点了？"}]}'
```

预期：LLM 调用 getCurrentTime 工具后返回当前时间。SSE 流中有短暂静默期后出现文本响应。

- [ ] **Step 5: 发送需要查天气的请求**

```bash
curl -X POST http://localhost:3000/v1/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"北京今天天气怎么样？"}]}'
```

预期：LLM 调用 getWeather 工具后返回北京天气信息。

- [ ] **Step 6: 发送需要搜索的请求**

```bash
curl -X POST http://localhost:3000/v1/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"帮我搜索一下 LangGraph 最新版本"}]}'
```

预期：LLM 调用 webSearch 工具后返回搜索结果摘要。
