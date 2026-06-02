export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export function formatFirstChunk(
  id: string,
  model: string,
  created: number
): string {
  return JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null,
      },
    ],
  });
}

export function formatSSEChunk(
  id: string,
  model: string,
  created: number,
  content: string
): string {
  return JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  });
}

export function formatFinalChunk(
  id: string,
  model: string,
  created: number,
  usage: UsageInfo
): string {
  return JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
    usage,
    stream_options: { include_usage: true },
  });
}

export function formatSSEDone(): string {
  return "[DONE]";
}
