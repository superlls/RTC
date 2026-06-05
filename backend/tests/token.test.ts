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
