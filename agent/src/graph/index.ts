import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { createLlm, llmNode } from "./nodes.js";
import { tools } from "../tools/index.js";

// 判断 LLM 输出是否包含 tool_calls
function shouldContinue(state: typeof MessagesAnnotation.State): "tools" | "__end__" {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    (lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk) &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }
  return "__end__";
}

export function createGraph(model?: string) {
  const llm = createLlm(model);
  const toolNode = new ToolNode(tools);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("llm", (state) => llmNode(state, llm))
    .addNode("tools", toolNode)
    .addEdge("__start__", "llm")
    .addConditionalEdges("llm", shouldContinue)
    .addEdge("tools", "llm");

  return graph.compile();
}
