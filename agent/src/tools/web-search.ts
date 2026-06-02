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
