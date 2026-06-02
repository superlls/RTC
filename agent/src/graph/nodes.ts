import { ChatOpenAI } from "@langchain/openai";
import { MessagesAnnotation } from "@langchain/langgraph";
import { config } from "../config/index.js";
import { tools } from "../tools/index.js";

export function createLlm(model?: string): ChatOpenAI {
  return new ChatOpenAI({
    model: model || config.defaultModel,
    apiKey: config.kimiApiKey,
    configuration: {
      baseURL: config.kimiBaseUrl,
    },
    streaming: true,
    modelKwargs: {
      // 关闭 Kimi 的 thinking 模式，避免工具调用时 reasoning_content 丢失导致 400 错误
      thinking: { type: "disabled" },
    },
  });
}

export async function llmNode(
  state: typeof MessagesAnnotation.State,
  llm: ChatOpenAI
): Promise<typeof MessagesAnnotation.Update> {
  const llmWithTools = llm.bindTools(tools);
  const response = await llmWithTools.invoke(state.messages);
  return { messages: [response] };
}
