# RTC Agent 平台端

接入火山引擎 AI 音视频互动方案的 Agent 服务。火山引擎 RTC 通过 HTTP POST 调用本服务，使用 LangGraph TS 编排 Agent 逻辑，调用 Kimi（月之暗面）大模型，以 SSE 流式格式返回响应。

## 架构

```
火山引擎 RTC → POST /v1/chat-stream → Hono → LangGraph (START→LLM→END) → Kimi API → SSE 流式返回
```

## 技术栈

- **HTTP 框架**: Hono + @hono/node-server
- **Agent 框架**: LangGraph TypeScript
- **LLM**: Kimi（月之暗面），通过 OpenAI 兼容 API 接入
- **默认模型**: kimi-k2.6
- **运行时**: Node.js + npm
- **语言**: TypeScript（ESM）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入真实的 API Key：

```bash
cp .env.example .env
```

```env
KIMI_API_KEY=你的Kimi API密钥
KIMI_BASE_URL=https://api.moonshot.cn/v1
DEFAULT_MODEL=kimi-k2.6
PORT=3000
```

### 3. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

### 4. 验证

```bash
# 健康检查
curl http://localhost:3000/health

# 模拟 RTC 请求
curl -N http://localhost:3000/v1/chat-stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true,
    "model": "kimi-k2.6"
  }'
```

## API

### POST /v1/chat-stream

接收火山引擎 RTC 的请求，返回 SSE 流式响应。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| messages | Array | 是 | 消息列表，每项含 role 和 content |
| stream | boolean | 否 | 是否流式返回 |
| model | string | 否 | 模型名称，默认 kimi-k2.6 |
| temperature | number | 否 | 温度参数 |
| max_tokens | number | 否 | 最大生成 token 数 |

**SSE 响应格式：**

```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"你好"},"finish_reason":null}]}
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{...}}
data: [DONE]
```

### GET /health

健康检查，返回 `{"status": "ok"}`。

## 项目结构

```
src/
├── index.ts              # Hono 入口，挂载路由，启动服务器
├── config/index.ts       # 环境变量读取
├── graph/
│   ├── index.ts          # LangGraph graph 编译
│   └── nodes.ts          # LLM node 定义
└── routes/
    ├── chat.ts           # 核心路由，SSE 流式响应
    └── sse-utils.ts      # SSE chunk 格式化函数
tests/
└── sse-format.test.ts    # SSE 格式化单元测试
```

## 测试

```bash
npm test
```

## 部署

目标环境：火山云 ECS

```bash
# 在 ECS 上
git clone https://github.com/superlls/RTC_Agent.git
cd RTC_Agent
npm install
npm run build

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实 API Key

# 使用 pm2 守护进程
npm install -g pm2
pm2 start dist/index.js --name rtc-agent
```
