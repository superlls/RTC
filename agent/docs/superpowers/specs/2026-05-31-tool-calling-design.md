# RTC Agent 工具调用（Tool Calling）设计文档

## 概述

在现有 RTC Agent 基础上增加工具调用能力，支持三个工具：查天气、查时间、查网络信息。LLM（Kimi kimi-k2.6）自主决定是否调用工具，采用 LangGraph 标准 ReAct 模式实现。

## 需求

- 查天气：调用和风天气（QWeather）免费 API，输入城市名，返回天气信息
- 查时间：Node.js 本地时间，零外部依赖
- 查网络信息：调用 Tavily 搜索 API，返回摘要+来源
- 工具调用由 LLM 自主决定（标准 function calling）
- 工具调用失败时 LLM 自行向用户解释，不中断对话

## 技术前提

- Kimi kimi-k2.6 完全支持 OpenAI 标准 function calling 协议（tools 参数、tool_calls 响应、tool_choice）
- LangChain 的 `ChatOpenAI.bindTools()` 可直接使用

## 架构变更

### Graph 结构

当前：
```
START → llmNode → END
```

变更为 ReAct 循环：
```
START → llmNode ──(有 tool_calls)──→ toolNode ──→ llmNode
                 └─(无 tool_calls)──→ END
```

- `llmNode`：调用 `llm.bindTools(tools)` 后的 LLM，模型自主决定是否调用工具
- `toolNode`：LangGraph 内置 `ToolNode`，自动执行工具并返回 `ToolMessage`
- conditional edge：检查 LLM 输出的最后一条消息是否含 `tool_calls`，有则路由到 toolNode，无则结束
- 支持多轮工具调用循环，LLM 认为信息足够时自然终止

## 工具定义

使用 LangChain 的 `tool()` 函数定义。

### 1. getWeather — 查天气

- **输入参数**：`city: string`（城市名，如"北京"）
- **数据源**：和风天气（QWeather）免费 API
- **调用流程**：两步请求——先调 GeoAPI（`/geo/v2/city/lookup`）将城市名转为 LocationID，再调实时天气 API（`/v7/weather/now`）获取天气数据
- **API Host**：开发者专属域名，通过 `QWEATHER_API_HOST` 配置（格式如 `xxx.qweatherapi.com`）
- **鉴权方式**：请求 Header `X-QW-Api-Key` 传递 API Key
- **环境变量**：`QWEATHER_API_KEY`、`QWEATHER_API_HOST`
- **返回**：温度、天气状况、湿度、风向等文本描述
- **错误处理**：catch 异常，返回错误描述文本

### 2. getCurrentTime — 查时间

- **输入参数**：无
- **数据源**：Node.js `new Date()`，`Intl.DateTimeFormat` 格式化为中文
- **无需外部 API**
- **返回**：当前日期时间的中文格式化字符串

### 3. webSearch — 查网络信息

- **输入参数**：`query: string`（搜索关键词）
- **数据源**：Tavily API，使用官方 SDK `@tavily/core`
- **环境变量**：`TAVILY_API_KEY`
- **返回**：搜索结果摘要 + 来源链接
- **错误处理**：catch 异常，返回错误描述文本

## 文件结构变更

### 新增文件

```
src/tools/
├── index.ts          # 导出所有工具的数组 tools[]
├── weather.ts        # getWeather
├── time.ts           # getCurrentTime
└── web-search.ts     # webSearch

tests/tools.test.ts   # 工具测试
```

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/graph/index.ts` | 引入 ToolNode，添加 toolNode 节点和 conditional edge |
| `src/graph/nodes.ts` | llm.bindTools(tools)，绑定工具 |
| `src/config/index.ts` | 新增 `qweatherApiKey`、`qweatherApiHost`、`tavilyApiKey` 配置读取 |
| `.env.example` | 新增 `QWEATHER_API_KEY`、`QWEATHER_API_HOST`、`TAVILY_API_KEY` |

### 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `src/routes/chat.ts` | 现有 SSE 过滤逻辑天然兼容——tool_calls chunk 的 content 为空，已被 `content.length > 0` 过滤 |
| `src/routes/sse-utils.ts` | SSE 格式不变 |

## SSE 流式响应处理

加了工具调用后，`streamEvents` 的事件流变复杂：

1. **LLM 决定调用工具时**：输出 `tool_calls` 而非文本 content，不发给前端
2. **工具执行过程**：对用户不可见，不发 SSE
3. **工具调用完毕后 LLM 再次回复**：文本 content 发给前端

现有的 `on_chat_model_stream` 事件监听 + `content.length > 0` 过滤逻辑天然兼容，无需修改。

**已知限制**：工具调用期间前端会有"静默期"（等工具执行 + LLM 再次回复），MVP 阶段不做优化。

## 错误处理

- 工具内部 catch 所有异常
- 返回错误描述文本作为 `ToolMessage` 内容（如"天气查询失败：API 请求超时"）
- LLM 拿到错误信息后自行向用户解释，对话不中断

## 配置变更

`.env` 新增：
```
QWEATHER_API_KEY=your-qweather-key
QWEATHER_API_HOST=your-qweather-api-host
TAVILY_API_KEY=your-tavily-key
```

## 测试

`tests/tools.test.ts` 覆盖：
- 各工具的基本调用和返回格式
- 工具调用失败时返回错误描述而非抛异常

## 未来可选优化（不在本次范围）

- 工具调用时发送"正在查询..."提示 chunk
- 工具调用超时保护
- 更多工具扩展
