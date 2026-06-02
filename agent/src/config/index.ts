import "dotenv/config";

export const config = {
  kimiApiKey: process.env.KIMI_API_KEY || "",
  kimiBaseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
  defaultModel: process.env.DEFAULT_MODEL || "kimi-k2.6",
  port: parseInt(process.env.PORT || "3000", 10),
  qweatherApiKey: process.env.QWEATHER_API_KEY || "",
  qweatherApiHost: process.env.QWEATHER_API_HOST || "",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
} as const;
