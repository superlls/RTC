import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config/index.js";
import { chatRouter } from "./routes/chat.js";

const app = new Hono();

// 健康检查
app.get("/health", (c) => c.json({ status: "ok" }));

// 挂载 chat 路由
app.route("/", chatRouter);

console.log(`RTC Agent 服务启动，端口: ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});
