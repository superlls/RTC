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
