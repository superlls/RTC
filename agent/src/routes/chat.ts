import { Hono, Context } from "hono";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";
import { HumanMessage, AIMessage, AIMessageChunk, SystemMessage } from "@langchain/core/messages";
import { createGraph } from "../graph/index.js";
import { config } from "../config/index.js";
import {
  formatFirstChunk,
  formatSSEChunk,
  formatFinalChunk,
  formatSSEDone,
} from "./sse-utils.js";

// 火山引擎 RTC 请求体类型
interface RTCRequest {
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  model?: string;
  top_p?: number;
  custom?: string;
}

// 将 RTC 消息格式转换为 LangChain 消息，并注入当前日期到 system prompt
export function buildMessages(rtcMessages: Array<{ role: string; content: string }>) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const dateInfo = `当前日期：${dateStr}（${weekDays[today.getDay()]}）`;

  // 检查用户是否已提供 system message
  const hasSystemMsg = rtcMessages.some((msg) => msg.role === "system");

  const messages = rtcMessages.map((msg) => {
    if (msg.role === "system") {
      // 将日期信息合并到已有的 system message
      return new SystemMessage(`${msg.content}\n\n${dateInfo}`);
    }
    if (msg.role === "user") return new HumanMessage(msg.content);
    return new AIMessage(msg.content);
  });

  // 如果没有 system message，在最前面注入一条
  if (!hasSystemMsg) {
    messages.unshift(new SystemMessage(dateInfo));
  }

  return messages;
}

export const chatRouter = new Hono();

// 火山引擎规范错误响应格式
function errorResponse(c: Context, status: 400 | 500, code: string, message: string) {
  return c.json({ Error: { Code: code, Message: message } }, status);
}

chatRouter.post("/v1/chat-stream", async (c) => {
  // 解析请求体
  let body: RTCRequest;
  try {
    body = await c.req.json<RTCRequest>();
  } catch {
    return errorResponse(c, 400, "InvalidRequest", "请求体 JSON 解析失败");
  }

  // 校验必填字段
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return errorResponse(c, 400, "InvalidRequest", "messages 字段缺失或为空");
  }

  const model = body.model || config.defaultModel;
  const requestId = uuidv4();
  const created = Math.floor(Date.now() / 1000);

  // 将 RTC 消息格式转换为 LangChain 消息（注入当前日期）
  const messages = buildMessages(body.messages);

  let graph;
  try {
    graph = createGraph(model);
  } catch (err) {
    console.error("Graph 创建失败:", err);
    return errorResponse(c, 500, "InternalError", "Agent 初始化失败");
  }

  return streamSSE(c, async (stream) => {
    try {
      // 发送首个 chunk（带 role）
      await stream.writeSSE({
        data: formatFirstChunk(requestId, model, created),
      });

      let completionTokens = 0;

      // 使用 streamEvents 获取 LLM 的逐 token 输出
      const eventStream = graph.streamEvents(
        { messages },
        { version: "v2" }
      );

      for await (const event of eventStream) {
        if (
          event.event === "on_chat_model_stream" &&
          event.data.chunk instanceof AIMessageChunk
        ) {
          const content = event.data.chunk.content;
          if (typeof content === "string" && content.length > 0) {
            completionTokens++;
            await stream.writeSSE({
              data: formatSSEChunk(requestId, model, created, content),
            });
          }
        }
      }

      // 发送结束 chunk
      await stream.writeSSE({
        data: formatFinalChunk(requestId, model, created, {
          prompt_tokens: 0,
          completion_tokens: completionTokens,
          total_tokens: completionTokens,
        }),
      });

      // 发送 [DONE]
      await stream.writeSSE({ data: formatSSEDone() });
    } catch (err) {
      console.error("流式响应异常:", err);
      // 流中断时，尽量发送结束标记让 RTC 平台能正确检测到结束
      try {
        await stream.writeSSE({
          data: formatFinalChunk(requestId, model, created, {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          }),
        });
        await stream.writeSSE({ data: formatSSEDone() });
      } catch {
        // 连结束标记都发不出去，只能放弃
      }
    }
  });
});
