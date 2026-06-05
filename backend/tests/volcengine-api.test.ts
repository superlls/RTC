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
