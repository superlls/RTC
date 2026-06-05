# Bug Fix: 火山 CustomLLM 无法通过 HTTP 回调 Agent

**日期:** 2026-06-05
**影响范围:** Backend StartVoiceChat 配置
**修复提交:** `89546ed`

---

## 症状

前端一切正常：用户成功进房，AI Bot 也进房并发布了音频流（mediaType: 1），但用户完全听不到 AI 说话。表面看起来像"没连上火山引擎"。

## 排查过程

### 1. 逐层排查数据流

```
Frontend → Backend /api/start → 火山 StartVoiceChat API → 火山 RTC 平台 → Agent
```

| 环节 | 状态 | 验证方式 |
|------|------|----------|
| Backend → 火山 API | ✅ 返回 `"Result": "ok"` | curl 直接调用 StartVoiceChat |
| Agent 服务可达 | ✅ HTTP 200, 0.5s | curl 直接请求 Agent URL |
| 用户进房 | ✅ | 浏览器 Console: `[RTC] 成功加入房间` |
| AI Bot 进房 | ✅ | 浏览器 Console: `[RTC] 远端用户加入房间: ai_bot_...` |
| AI Bot 发布音频流 | ✅ | 浏览器 Console: `[RTC] 远端用户发布流: ... mediaType: 1` |
| AI 实际说话 | ❌ 无声 | 用户听不到任何语音 |

### 2. 定位根因

所有链路都通，但 AI 不说话。问题在火山平台内部：**ASR → LLM → TTS 管道无法工作**。

查阅火山引擎 StartVoiceChat API 文档（`references/火山开启、更新、关闭VoiceChat接口相关文档/开启AI对话.md`）发现：

> **Url**: 第三方大模型/Agent 的请求 URL，**需要使用 HTTPS 域名**，且必须符合火山引擎标准。

> **如需使用 HTTP 域名进行测试**：可在下方 `Feature` 参数中填入 `{"Http":true}`，但无法保证服务质量。

而我们的 Agent URL 是 `http://8.152.220.24:3000/v1/chat-stream`（HTTP + IP），缺少 `Feature` 配置导致火山平台拒绝回调 Agent。

## 根因

`LLMConfig` 缺少 `Feature: '{"Http":true}'`。火山引擎 CustomLLM 默认仅支持 HTTPS 域名回调，Agent 使用 HTTP 协议导致火山平台无法调用 Agent 服务，ASR→LLM→TTS 管道断裂。

## 修复

**文件:** `backend/src/routes/call.ts`

```typescript
// LLMConfig 中添加 Feature 允许 HTTP 回调
LLMConfig: {
  Mode: "CustomLLM",
  Url: config.agentUrl,
  Feature: '{"Http":true}',  // ← 新增
  // ...
},

// AgentConfig 中添加欢迎词，让 AI 主动打招呼
AgentConfig: {
  WelcomeMessage: "你好，我是你的 AI 助手，有什么可以帮你的吗？",  // ← 新增
  // ...
},
```

## 经验教训

1. **火山 StartVoiceChat 返回 200 只代表任务下发成功**，不代表 AI 已成功工作。需要通过 RTC 事件或回调监控实际状态。
2. **CustomLLM 的 Url 默认要求 HTTPS 域名**，HTTP 测试必须显式配置 `Feature: '{"Http":true}'`。
3. **诊断 RTC 问题时，前端添加 `onUserJoined` / `onUserPublishStream` 事件监听**是快速定位"连没连上"的关键手段。
4. **生产环境应使用 HTTPS 域名**，`Feature: {"Http":true}` 仅用于开发测试。
