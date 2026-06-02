import { describe, it, expect } from "vitest";
import { buildMessages } from "../src/routes/chat.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

describe("系统提示注入当前日期", () => {
  it("转换后的消息列表首条应为包含当前日期的 SystemMessage", () => {
    const rtcMessages = [{ role: "user", content: "今天发生了什么新闻" }];
    const result = buildMessages(rtcMessages);

    // 第一条消息应为 SystemMessage
    expect(result[0]).toBeInstanceOf(SystemMessage);

    // 应包含当前日期（格式：YYYY年M月D日）
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const dateStr = `${year}年${month}月${day}日`;
    expect((result[0] as SystemMessage).content).toContain(dateStr);
  });

  it("用户自带 system message 时，日期信息应合并到其中而非新增", () => {
    const rtcMessages = [
      { role: "system", content: "你是一个新闻助手" },
      { role: "user", content: "今天有什么新闻" },
    ];
    const result = buildMessages(rtcMessages);

    // 应只有一个 SystemMessage（合并后的）
    const systemMessages = result.filter((m) => m instanceof SystemMessage);
    expect(systemMessages.length).toBe(1);

    // 应同时包含原始内容和日期
    const content = systemMessages[0].content as string;
    expect(content).toContain("你是一个新闻助手");
    expect(content).toContain(`${new Date().getFullYear()}年`);
  });

  it("用户消息顺序在 system message 之后保持不变", () => {
    const rtcMessages = [
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好！" },
      { role: "user", content: "今天新闻" },
    ];
    const result = buildMessages(rtcMessages);

    // 第一条是注入的 SystemMessage
    expect(result[0]).toBeInstanceOf(SystemMessage);
    // 之后是原始消息
    expect(result[1]).toBeInstanceOf(HumanMessage);
    expect(result[1].content).toBe("你好");
  });
});
