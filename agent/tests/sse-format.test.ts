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
