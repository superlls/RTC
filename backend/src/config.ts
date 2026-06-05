import "dotenv/config";

export const config = {
  rtcAppId: process.env.RTC_APP_ID!,
  rtcAppKey: process.env.RTC_APP_KEY!,
  volcAccessKey: process.env.VOLC_ACCESS_KEY!,
  volcSecretKey: process.env.VOLC_SECRET_KEY!,
  agentUrl: process.env.AGENT_URL!,
  agentApiKey: process.env.AGENT_API_KEY!,
  agentModel: process.env.AGENT_MODEL!,
  port: parseInt(process.env.PORT || "3001"),
};
