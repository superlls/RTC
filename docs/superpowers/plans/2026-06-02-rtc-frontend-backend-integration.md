# RTC 前后端集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已有 Agent 端基础上，实现 Backend（Hono + TS）和 Frontend（React + Vite + TS），完成真人用户与 AI 的实时语音对话。

**Architecture:** 后端生成 RTC Token、签名调用火山 OpenAPI（StartVoiceChat / StopVoiceChat）；前端用 @volcengine/rtc SDK 进房、采集音频、与 AI 实时对话。三个服务（Agent、Backend、Frontend）各自独立。

**Tech Stack:** Backend: Hono + @hono/node-server + TypeScript；Frontend: React + Vite + TypeScript + @volcengine/rtc

---

## 文件结构

### Backend (`backend/`)

| 文件 | 职责 |
|------|------|
| `package.json` | 项目配置，依赖声明 |
| `tsconfig.json` | TypeScript 配置（与 agent 一致） |
| `.env` | 环境变量（不入 git） |
| `.env.example` | 环境变量模板 |
| `src/config.ts` | 读取环境变量，导出配置对象 |
| `src/lib/buffer-writer.ts` | 二进制写入工具（Token 生成依赖） |
| `src/lib/token.ts` | RTC Token 生成（基于火山官方 TS SDK） |
| `src/lib/volcengine-api.ts` | 火山 OpenAPI HMAC-SHA256 签名 + StartVoiceChat / StopVoiceChat |
| `src/routes/call.ts` | POST /api/start 和 POST /api/stop 路由 |
| `src/index.ts` | Hono 入口，挂载路由，启动服务 |
| `tests/token.test.ts` | Token 生成测试 |
| `tests/volcengine-api.test.ts` | OpenAPI 签名测试 |

### Frontend (`frontend/`)

| 文件 | 职责 |
|------|------|
| `package.json` | 项目配置 |
| `tsconfig.json` | TypeScript 配置 |
| `index.html` | Vite 入口 HTML |
| `vite.config.ts` | Vite 配置（dev proxy 到后端） |
| `src/main.tsx` | React 入口 |
| `src/App.tsx` | 主页面：通话按钮 + 状态显示 |
| `src/App.css` | 样式 |
| `src/types.ts` | 类型定义 |
| `src/hooks/useRTC.ts` | 封装 RTC SDK 操作 |
| `src/hooks/useCall.ts` | 封装通话流程（后端接口 + RTC + 状态管理） |

---

## Task 1: 后端项目脚手架

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env`
- Create: `backend/.env.example`
- Create: `backend/src/config.ts`
- Create: `backend/src/index.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "rtc-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^2.0.4",
    "hono": "^4.12.23",
    "dotenv": "^17.4.2"
  },
  "devDependencies": {
    "@types/node": "^25.9.1",
    "tsx": "^4.22.3",
    "typescript": "^6.0.3",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

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
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 .env.example 和 .env**

`.env.example`:
```
RTC_APP_ID=
RTC_APP_KEY=
VOLC_ACCESS_KEY=
VOLC_SECRET_KEY=
AGENT_URL=
AGENT_API_KEY=
AGENT_MODEL=
PORT=3001
```

`.env`（实际值）:
```
RTC_APP_ID=YOUR_RTC_APP_ID
RTC_APP_KEY=YOUR_RTC_APP_KEY
VOLC_ACCESS_KEY=YOUR_VOLC_ACCESS_KEY
VOLC_SECRET_KEY=YOUR_VOLC_SECRET_KEY
AGENT_URL=http://8.152.220.24:3000/v1/chat-stream
AGENT_API_KEY=YOUR_AGENT_API_KEY
AGENT_MODEL=kimi-k2.6
PORT=3001
```

- [ ] **Step 4: 创建 src/config.ts**

```typescript
import "dotenv/config";

export const config = {
  rtcAppId: process.env.RTC_APP_ID!,
  rtcAppKey: process.env.RTC_APP_KEY!,
  volcAccessKey: process.env.VOLC_ACCESS_KEY!,
  volcSecretKey: process.env.VOLC_SECRET_KEY!,
  agentUrl: process.env.AGENT_URL!,
  agentApiKey: process.env.AGENT_API_KEY!,
  agentModel: process.env.AGENT_MODEL!,
  port: parseInt(process.env.PORT || "3001"),
};
```

- [ ] **Step 5: 创建 src/index.ts（最小启动）**

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

console.log(`RTC Backend 服务启动，端口: ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});
```

- [ ] **Step 6: 安装依赖并验证启动**

Run: `cd backend && npm install && npm run dev`

预期：终端输出 `RTC Backend 服务启动，端口: 3001`

访问 `http://localhost:3001/health` 返回 `{"status":"ok"}`

- [ ] **Step 7: 提交**

```bash
cd /Users/superlls/工作/pre-demo/RTC
git add backend/package.json backend/tsconfig.json backend/.env.example backend/src/config.ts backend/src/index.ts
git commit -m "feat(backend): 项目脚手架 — Hono + TS 最小启动"
```

> 注意：不要提交 `.env`，确认 `.gitignore` 已包含 `.env`。

---

## Task 2: RTC Token 生成

**Files:**
- Create: `backend/src/lib/buffer-writer.ts`
- Create: `backend/src/lib/token.ts`
- Create: `backend/tests/token.test.ts`

- [ ] **Step 1: 写 Token 生成的测试**

`backend/tests/token.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateToken, parseToken } from "../src/lib/token.js";

describe("RTC Token 生成", () => {
  const appId = "123456781234567812345678";
  const appKey = "test_app_key";
  const roomId = "test_room";
  const userId = "test_user";

  it("生成的 token 以版本号+appId 开头", () => {
    const token = generateToken({ appId, appKey, roomId, userId });
    expect(token.startsWith("001" + appId)).toBe(true);
  });

  it("生成的 token 可以被解析还原", () => {
    const token = generateToken({ appId, appKey, roomId, userId });
    const parsed = parseToken(token);
    expect(parsed).not.toBeUndefined();
    expect(parsed!.roomID).toBe(roomId);
    expect(parsed!.userID).toBe(userId);
    expect(parsed!.appID).toBe(appId);
  });

  it("解析后的 token 可以通过验证", () => {
    const token = generateToken({ appId, appKey, roomId, userId });
    const parsed = parseToken(token);
    expect(parsed!.verify(appKey)).toBe(true);
  });

  it("使用错误的 appKey 验证失败", () => {
    const token = generateToken({ appId, appKey, roomId, userId });
    const parsed = parseToken(token);
    expect(parsed!.verify("wrong_key")).toBe(false);
  });

  it("支持自定义过期时间", () => {
    const expireAt = Math.floor(Date.now() / 1000) + 3600;
    const token = generateToken({ appId, appKey, roomId, userId, expireAt });
    const parsed = parseToken(token);
    expect(parsed!.expireAt).toBe(expireAt);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd backend && npx vitest run tests/token.test.ts`

预期：FAIL — 模块不存在

- [ ] **Step 3: 实现 BufferWriter**

`backend/src/lib/buffer-writer.ts`:
```typescript
export class BufferWriter {
  private buffer = Buffer.alloc(1024);
  private position = 0;

  pack(): Buffer {
    const out = Buffer.alloc(this.position);
    this.buffer.copy(out, 0, 0, out.length);
    return out;
  }

  putUint16(v: number): BufferWriter {
    this.buffer.writeUInt16LE(v, this.position);
    this.position += 2;
    return this;
  }

  putUint32(v: number): BufferWriter {
    this.buffer.writeUInt32LE(v, this.position);
    this.position += 4;
    return this;
  }

  putBytes(bytes: Buffer): BufferWriter {
    this.putUint16(bytes.length);
    bytes.copy(this.buffer, this.position);
    this.position += bytes.length;
    return this;
  }

  putString(str: string): BufferWriter {
    return this.putBytes(Buffer.from(str));
  }

  putTreeMapUInt32(map: Map<number, number>): BufferWriter {
    this.putUint16(map.size);
    map.forEach((value, key) => {
      this.putUint16(key);
      this.putUint32(value);
    });
    return this;
  }
}
```

- [ ] **Step 4: 实现 BufferReader 和 Token 生成**

`backend/src/lib/token.ts`:
```typescript
import * as crypto from "crypto";
import { BufferWriter } from "./buffer-writer.js";

const VERSION = "001";
const APP_ID_LENGTH = 24;

enum Privilege {
  PrivPublishStream = 0,
  PrivPublishAudioStream = 1,
  PrivPublishVideoStream = 2,
  PrivPublishDataStream = 3,
  PrivSubscribeStream = 4,
}

class AccessToken {
  appID: string;
  appKey: string;
  roomID: string;
  userID: string;
  issuedAt: number;
  nonce: number;
  expireAt: number;
  privileges: Map<number, number>;
  signature?: string;

  constructor(appID: string, appKey: string, roomID: string, userID: string) {
    this.appID = appID;
    this.appKey = appKey;
    this.roomID = roomID;
    this.userID = userID;
    this.issuedAt = Math.floor(Date.now() / 1000);
    this.nonce = Math.floor(Math.random() * 0xffffffff);
    this.expireAt = 0;
    this.privileges = new Map();
  }

  addPrivilege(privilege: Privilege, expireTimestamp: number): void {
    this.privileges.set(privilege, expireTimestamp);
    if (privilege === Privilege.PrivPublishStream) {
      this.privileges.set(Privilege.PrivPublishAudioStream, expireTimestamp);
      this.privileges.set(Privilege.PrivPublishVideoStream, expireTimestamp);
      this.privileges.set(Privilege.PrivPublishDataStream, expireTimestamp);
    }
  }

  expireTime(expireTimestamp: number): void {
    this.expireAt = expireTimestamp;
  }

  serialize(): string {
    const bytesM = this.packMsg();
    const signature = this.encodeHMac(this.appKey, bytesM);
    const content = new BufferWriter().putBytes(bytesM).putBytes(signature).pack();
    return VERSION + this.appID + content.toString("base64");
  }

  verify(key: string): boolean {
    if (this.expireAt > 0 && Math.floor(Date.now() / 1000) > this.expireAt) {
      return false;
    }
    return this.encodeHMac(key, this.packMsg()).toString() === this.signature;
  }

  private packMsg(): Buffer {
    const bufM = new BufferWriter();
    bufM.putUint32(this.nonce);
    bufM.putUint32(this.issuedAt);
    bufM.putUint32(this.expireAt);
    bufM.putString(this.roomID);
    bufM.putString(this.userID);
    bufM.putTreeMapUInt32(new Map([...this.privileges.entries()].sort()));
    return bufM.pack();
  }

  private encodeHMac(key: string, message: Buffer): Buffer {
    return crypto.createHmac("sha256", key).update(message).digest();
  }
}

// --- BufferReader（解析 Token 用） ---
class BufferReader {
  private buffer: Buffer;
  private position = 0;

  constructor(bytes: Buffer) {
    this.buffer = bytes;
  }

  getUint16(): number {
    const ret = this.buffer.readUInt16LE(this.position);
    this.position += 2;
    return ret;
  }

  getUint32(): number {
    const ret = this.buffer.readUInt32LE(this.position);
    this.position += 4;
    return ret;
  }

  getString(): Buffer {
    const len = this.getUint16();
    const out = Buffer.alloc(len);
    this.buffer.copy(out, 0, this.position, this.position + len);
    this.position += len;
    return out;
  }

  getTreeMapUInt32(): Map<number, number> {
    const map: Map<number, number> = new Map();
    const len = this.getUint16();
    for (let i = 0; i < len; i++) {
      const key = this.getUint16();
      const value = this.getUint32();
      map.set(key, value);
    }
    return map;
  }
}

// --- 公开 API ---

interface GenerateTokenParams {
  appId: string;
  appKey: string;
  roomId: string;
  userId: string;
  expireAt?: number; // Unix 秒级时间戳，默认 24 小时后
}

export function generateToken(params: GenerateTokenParams): string {
  const { appId, appKey, roomId, userId } = params;
  const expireAt = params.expireAt ?? Math.floor(Date.now() / 1000) + 24 * 3600;

  const token = new AccessToken(appId, appKey, roomId, userId);
  token.addPrivilege(Privilege.PrivSubscribeStream, 0);
  token.addPrivilege(Privilege.PrivPublishStream, 0);
  token.expireTime(expireAt);
  return token.serialize();
}

export function parseToken(raw: string): AccessToken | undefined {
  try {
    if (raw.length <= 3 + APP_ID_LENGTH) return;
    if (raw.slice(0, 3) !== VERSION) return;

    const appID = raw.slice(3, 3 + APP_ID_LENGTH);
    const contentBuf = Buffer.from(raw.slice(3 + APP_ID_LENGTH), "base64");
    const readbuf = new BufferReader(contentBuf);
    const msg = readbuf.getString();
    const signature = readbuf.getString().toString();

    const msgBuf = new BufferReader(msg);
    const nonce = msgBuf.getUint32();
    const issuedAt = msgBuf.getUint32();
    const expireAt = msgBuf.getUint32();
    const roomID = msgBuf.getString().toString();
    const userID = msgBuf.getString().toString();
    const privileges = msgBuf.getTreeMapUInt32();

    const token = new AccessToken(appID, "", roomID, userID);
    token.signature = signature;
    token.nonce = nonce;
    token.issuedAt = issuedAt;
    token.expireAt = expireAt;
    token.privileges = privileges;
    return token;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `cd backend && npx vitest run tests/token.test.ts`

预期：5 个测试全部 PASS

- [ ] **Step 6: 提交**

```bash
git add backend/src/lib/buffer-writer.ts backend/src/lib/token.ts backend/tests/token.test.ts
git commit -m "feat(backend): RTC Token 生成与解析"
```

---

## Task 3: 火山 OpenAPI 签名

**Files:**
- Create: `backend/src/lib/volcengine-api.ts`
- Create: `backend/tests/volcengine-api.test.ts`

- [ ] **Step 1: 写签名算法的测试**

`backend/tests/volcengine-api.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildAuthorization } from "../src/lib/volcengine-api.js";

describe("火山 OpenAPI 签名", () => {
  const ak = "test_ak";
  const sk = "test_sk";
  const body = JSON.stringify({ AppId: "test", RoomId: "room1", TaskId: "task1" });

  it("生成的 Authorization 包含 HMAC-SHA256 前缀", () => {
    const date = new Date("2026-06-02T10:00:00Z");
    const auth = buildAuthorization({
      ak,
      sk,
      action: "StartVoiceChat",
      body,
      date,
    });
    expect(auth.authorization).toMatch(/^HMAC-SHA256 Credential=/);
  });

  it("生成的 headers 包含必要字段", () => {
    const date = new Date("2026-06-02T10:00:00Z");
    const auth = buildAuthorization({
      ak,
      sk,
      action: "StartVoiceChat",
      body,
      date,
    });
    expect(auth.headers["X-Date"]).toBe("20260602T100000Z");
    expect(auth.headers["Host"]).toBe("rtc.volcengineapi.com");
    expect(auth.headers["Content-Type"]).toBe("application/json");
    expect(auth.headers["X-Content-Sha256"]).toBeTruthy();
    expect(auth.headers["Authorization"]).toBe(auth.authorization);
  });

  it("相同输入产生相同签名（确定性）", () => {
    const date = new Date("2026-06-02T10:00:00Z");
    const auth1 = buildAuthorization({ ak, sk, action: "StopVoiceChat", body, date });
    const auth2 = buildAuthorization({ ak, sk, action: "StopVoiceChat", body, date });
    expect(auth1.authorization).toBe(auth2.authorization);
  });

  it("不同 action 产生不同签名", () => {
    const date = new Date("2026-06-02T10:00:00Z");
    const auth1 = buildAuthorization({ ak, sk, action: "StartVoiceChat", body, date });
    const auth2 = buildAuthorization({ ak, sk, action: "StopVoiceChat", body, date });
    expect(auth1.authorization).not.toBe(auth2.authorization);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd backend && npx vitest run tests/volcengine-api.test.ts`

预期：FAIL — 模块不存在

- [ ] **Step 3: 实现签名算法和 API 调用**

`backend/src/lib/volcengine-api.ts`:
```typescript
import * as crypto from "crypto";

const SERVICE = "rtc";
const REGION = "cn-north-1";
const HOST = "rtc.volcengineapi.com";
const VERSION = "2025-06-01";
const CONTENT_TYPE = "application/json";

function hmacSHA256(key: string | Buffer, content: string): Buffer {
  return crypto.createHmac("sha256", key).update(content, "utf-8").digest();
}

function hashSHA256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

function normQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const safeKey = encodeURIComponent(key).replace(/%20/g, "+");
      const safeVal = encodeURIComponent(params[key]).replace(/%20/g, "+");
      return `${safeKey}=${safeVal}`;
    })
    .join("&");
}

interface BuildAuthParams {
  ak: string;
  sk: string;
  action: string;
  body: string;
  date?: Date;
}

interface AuthResult {
  authorization: string;
  headers: Record<string, string>;
  queryString: string;
}

export function buildAuthorization(params: BuildAuthParams): AuthResult {
  const { ak, sk, action, body } = params;
  const date = params.date ?? new Date();

  const xDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const shortDate = xDate.slice(0, 8);
  const xContentSha256 = hashSHA256(body);

  const queryParams: Record<string, string> = { Action: action, Version: VERSION };
  const queryString = normQuery(queryParams);

  const signedHeadersStr = "content-type;host;x-content-sha256;x-date";

  const canonicalRequest = [
    "POST",
    "/",
    queryString,
    `content-type:${CONTENT_TYPE}`,
    `host:${HOST}`,
    `x-content-sha256:${xContentSha256}`,
    `x-date:${xDate}`,
    "",
    signedHeadersStr,
    xContentSha256,
  ].join("\n");

  const credentialScope = `${shortDate}/${REGION}/${SERVICE}/request`;
  const stringToSign = ["HMAC-SHA256", xDate, credentialScope, hashSHA256(canonicalRequest)].join("\n");

  const kDate = hmacSHA256(sk, shortDate);
  const kRegion = hmacSHA256(kDate, REGION);
  const kService = hmacSHA256(kRegion, SERVICE);
  const kSigning = hmacSHA256(kService, "request");
  const signature = hmacSHA256(kSigning, stringToSign).toString("hex");

  const authorization = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Host: HOST,
    "Content-Type": CONTENT_TYPE,
    "X-Date": xDate,
    "X-Content-Sha256": xContentSha256,
    Authorization: authorization,
  };

  return { authorization, headers, queryString };
}

export async function callVolcAPI(params: {
  ak: string;
  sk: string;
  action: string;
  body: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const bodyStr = JSON.stringify(params.body);
  const { headers, queryString } = buildAuthorization({
    ak: params.ak,
    sk: params.sk,
    action: params.action,
    body: bodyStr,
  });

  const url = `https://${HOST}/?${queryString}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: bodyStr,
  });

  return response.json() as Promise<Record<string, unknown>>;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd backend && npx vitest run tests/volcengine-api.test.ts`

预期：4 个测试全部 PASS

- [ ] **Step 5: 提交**

```bash
git add backend/src/lib/volcengine-api.ts backend/tests/volcengine-api.test.ts
git commit -m "feat(backend): 火山 OpenAPI HMAC-SHA256 签名"
```

---

## Task 4: 后端路由 — /api/start 和 /api/stop

**Files:**
- Create: `backend/src/routes/call.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: 实现路由**

`backend/src/routes/call.ts`:
```typescript
import { Hono } from "hono";
import { config } from "../config.js";
import { generateToken } from "../lib/token.js";
import { callVolcAPI } from "../lib/volcengine-api.js";

const callRouter = new Hono();

// 内存中维护活跃任务
const activeTasks = new Map<string, { roomId: string; userId: string }>();

function generateId(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

callRouter.post("/api/start", async (c) => {
  const roomId = generateId("room");
  const userId = generateId("user");
  const taskId = generateId("task");
  const agentUserId = `ai_bot_${taskId}`;

  // 生成 RTC Token
  const token = generateToken({
    appId: config.rtcAppId,
    appKey: config.rtcAppKey,
    roomId,
    userId,
  });

  // 调用 StartVoiceChat
  const body = {
    AppId: config.rtcAppId,
    RoomId: roomId,
    TaskId: taskId,
    Config: {
      ASRConfig: {
        Provider: "volcano",
        ProviderParams: {
          Mode: "bigmodel",
          ApiResourceId: "volc.bigasr.sauc.duration",
        },
        VADConfig: { SilenceTime: 600 },
        InterruptConfig: {},
      },
      LLMConfig: {
        Mode: "CustomLLM",
        Url: config.agentUrl,
        APIKey: config.agentApiKey,
        ModelName: config.agentModel,
        SystemMessages: [],
        HistoryLength: 10,
        Temperature: 0.1,
        TopP: 0,
        MaxTokens: 1024,
      },
      TTSConfig: {
        Provider: "volcano_bidirection",
        ProviderParams: {
          Credential: { ResourceId: "seed-tts-1.0" },
          VolcanoTTSParameters:
            '{"req_params":{"speaker":"zh_female_kailangjiejie_moon_bigtts","audio_params":{"speech_rate":0,"loudness_rate":0},"additions":{"post_process":{"pitch":0}}}}',
        },
      },
      InterruptMode: 0,
      SubtitleConfig: { DisableRTSSubtitle: false, SubtitleMode: 0 },
      FunctionCallingConfig: {},
      WebSearchAgentConfig: {},
      MemoryConfig: {},
      MusicAgentConfig: {},
    },
    AgentConfig: {
      TargetUserId: [userId],
      UserId: agentUserId,
      EnableConversationStateCallback: false,
      VoicePrint: { MetaList: null, VoicePrintList: null },
    },
  };

  const result = await callVolcAPI({
    ak: config.volcAccessKey,
    sk: config.volcSecretKey,
    action: "StartVoiceChat",
    body,
  });

  // 检查返回是否成功
  if ((result as any).ResponseMetadata?.Error) {
    return c.json({ error: (result as any).ResponseMetadata.Error }, 500);
  }

  // 记录活跃任务
  activeTasks.set(taskId, { roomId, userId });

  return c.json({
    appId: config.rtcAppId,
    roomId,
    userId,
    taskId,
    token,
  });
});

callRouter.post("/api/stop", async (c) => {
  const { taskId, roomId } = await c.req.json<{ taskId: string; roomId: string }>();

  const result = await callVolcAPI({
    ak: config.volcAccessKey,
    sk: config.volcSecretKey,
    action: "StopVoiceChat",
    body: {
      AppId: config.rtcAppId,
      RoomId: roomId,
      TaskId: taskId,
    },
  });

  activeTasks.delete(taskId);

  if ((result as any).ResponseMetadata?.Error) {
    return c.json({ error: (result as any).ResponseMetadata.Error }, 500);
  }

  return c.json({ ok: true });
});

export { callRouter };
```

- [ ] **Step 2: 修改 src/index.ts 挂载路由**

`backend/src/index.ts`:
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { callRouter } from "./routes/call.js";

const app = new Hono();

// 允许前端跨域请求
app.use("/api/*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

// 挂载通话路由
app.route("/", callRouter);

console.log(`RTC Backend 服务启动，端口: ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});
```

- [ ] **Step 3: 启动后端，手动测试 /api/start**

Run: `cd backend && npm run dev`

在另一个终端：
```bash
curl -X POST http://localhost:3001/api/start
```

预期：返回 JSON 包含 `appId`、`roomId`、`userId`、`taskId`、`token` 字段。如果火山 API 返回错误，检查 AK/SK 和 AppId 是否正确。

- [ ] **Step 4: 手动测试 /api/stop**

用上一步返回的 taskId 和 roomId：
```bash
curl -X POST http://localhost:3001/api/stop \
  -H "Content-Type: application/json" \
  -d '{"taskId":"上一步返回的taskId","roomId":"上一步返回的roomId"}'
```

预期：返回 `{"ok":true}`

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/call.ts backend/src/index.ts
git commit -m "feat(backend): /api/start 和 /api/stop 路由"
```

---

## Task 5: 前端项目脚手架

**Files:**
- Create: `frontend/` 通过 Vite 脚手架生成
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 用 Vite 创建 React + TypeScript 项目**

```bash
cd /Users/superlls/工作/pre-demo/RTC
npm create vite@latest frontend -- --template react-ts
```

如果 `frontend/` 目录已存在且为空，先删除它再运行：
```bash
rm -rf frontend && npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: 安装依赖 + RTC SDK**

```bash
cd frontend && npm install && npm install @volcengine/rtc
```

- [ ] **Step 3: 配置 vite.config.ts — 开发代理**

替换 `frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: 验证前端启动**

Run: `cd frontend && npm run dev`

预期：浏览器打开 Vite 默认页面

- [ ] **Step 5: 提交**

```bash
cd /Users/superlls/工作/pre-demo/RTC
git add frontend/
git commit -m "feat(frontend): Vite + React + TS 脚手架 + RTC SDK"
```

---

## Task 6: 前端类型定义和 hooks

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/hooks/useRTC.ts`
- Create: `frontend/src/hooks/useCall.ts`

- [ ] **Step 1: 创建类型定义**

`frontend/src/types.ts`:
```typescript
export type CallStatus = "idle" | "connecting" | "connected";

export interface StartCallResponse {
  appId: string;
  roomId: string;
  userId: string;
  taskId: string;
  token: string;
}
```

- [ ] **Step 2: 实现 useRTC hook**

`frontend/src/hooks/useRTC.ts`:
```typescript
import { useRef, useCallback } from "react";
import { createEngine, IRTCEngine } from "@volcengine/rtc";

export function useRTC() {
  const engineRef = useRef<IRTCEngine | null>(null);

  const join = useCallback(
    async (params: { appId: string; token: string; roomId: string; userId: string }) => {
      const engine = createEngine(params.appId);
      engineRef.current = engine;

      await engine.joinRoom(
        params.token,
        params.roomId,
        { userId: params.userId },
        {
          isAutoPublish: true,
          isAutoSubscribeAudio: true,
          isAutoSubscribeVideo: false,
        }
      );

      await engine.startAudioCapture();
    },
    []
  );

  const leave = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    await engine.leaveRoom();
    engineRef.current = null;
  }, []);

  return { join, leave };
}
```

- [ ] **Step 3: 实现 useCall hook**

`frontend/src/hooks/useCall.ts`:
```typescript
import { useState, useCallback, useRef } from "react";
import { useRTC } from "./useRTC";
import type { CallStatus, StartCallResponse } from "../types";

export function useCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [duration, setDuration] = useState(0);
  const callInfoRef = useRef<StartCallResponse | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtc = useRTC();

  const startCall = useCallback(async () => {
    try {
      setStatus("connecting");

      // 调用后端开始通话
      const res = await fetch("/api/start", { method: "POST" });
      if (!res.ok) throw new Error("启动通话失败");
      const data: StartCallResponse = await res.json();
      callInfoRef.current = data;

      // 加入 RTC 房间
      await rtc.join({
        appId: data.appId,
        token: data.token,
        roomId: data.roomId,
        userId: data.userId,
      });

      // 开始计时
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      setStatus("connected");
    } catch (err) {
      console.error("通话启动失败:", err);
      setStatus("idle");
    }
  }, [rtc]);

  const stopCall = useCallback(async () => {
    try {
      const info = callInfoRef.current;
      if (info) {
        // 调用后端停止通话
        await fetch("/api/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: info.taskId, roomId: info.roomId }),
        });
      }

      // 离开 RTC 房间
      await rtc.leave();
    } catch (err) {
      console.error("停止通话出错:", err);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      callInfoRef.current = null;
      setDuration(0);
      setStatus("idle");
    }
  }, [rtc]);

  return { status, duration, startCall, stopCall };
}
```

- [ ] **Step 4: 提交**

```bash
cd /Users/superlls/工作/pre-demo/RTC
git add frontend/src/types.ts frontend/src/hooks/
git commit -m "feat(frontend): 类型定义 + useRTC / useCall hooks"
```

---

## Task 7: 前端页面 UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: 实现 App.tsx**

替换 `frontend/src/App.tsx`:
```tsx
import { useCall } from "./hooks/useCall";
import "./App.css";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function App() {
  const { status, duration, startCall, stopCall } = useCall();

  return (
    <div className="app">
      <div className="status-text">
        {status === "idle" && "点击按钮开始通话"}
        {status === "connecting" && "连接中..."}
        {status === "connected" && `通话中 ${formatDuration(duration)}`}
      </div>

      <button
        className={`call-button ${status === "connected" ? "hangup" : ""}`}
        onClick={status === "connected" ? stopCall : startCall}
        disabled={status === "connecting"}
      >
        {status === "idle" && "开始通话"}
        {status === "connecting" && "连接中..."}
        {status === "connected" && "挂断"}
      </button>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: 实现 App.css**

替换 `frontend/src/App.css`:
```css
.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
}

.status-text {
  font-size: 1.5rem;
  margin-bottom: 3rem;
  min-height: 2rem;
}

.call-button {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: none;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #4ecca3;
  color: #1a1a2e;
}

.call-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(78, 204, 163, 0.4);
}

.call-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.call-button.hangup {
  background: #e74c3c;
  color: #fff;
}

.call-button.hangup:hover {
  box-shadow: 0 0 30px rgba(231, 76, 60, 0.4);
}
```

- [ ] **Step 3: 清理 main.tsx（移除 StrictMode 避免重复渲染）**

替换 `frontend/src/main.tsx`:
```tsx
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 4: 清理不需要的 Vite 脚手架文件**

```bash
rm -f frontend/src/assets/react.svg frontend/public/vite.svg frontend/src/index.css
```

- [ ] **Step 5: 启动前后端，端到端测试**

终端 1: `cd backend && npm run dev`
终端 2: `cd frontend && npm run dev`

打开浏览器，点击"开始通话"，预期：
1. 按钮变为"连接中..."
2. 变为"挂断"并开始计时
3. 麦克风采集开始（浏览器会弹麦克风权限）
4. 可以和 AI 语音对话
5. 点击"挂断"回到初始状态

- [ ] **Step 6: 提交**

```bash
cd /Users/superlls/工作/pre-demo/RTC
git add frontend/src/
git commit -m "feat(frontend): 纯语音通话页面 UI"
```

---

## Task 8: 收尾

**Files:**
- Modify: `backend/.gitignore` or root `.gitignore`

- [ ] **Step 1: 确认 .gitignore 包含必要条目**

检查根目录 `.gitignore`，确保包含:
```
node_modules/
dist/
.env
```

- [ ] **Step 2: 最终提交**

```bash
cd /Users/superlls/工作/pre-demo/RTC
git add -A
git commit -m "chore: 收尾 — gitignore 和清理"
```
