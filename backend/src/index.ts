import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { callRouter } from "./routes/call.js";

const app = new Hono();

// 允许前端跨域请求
app.use("/api/*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

// 挂载通话路由
app.route("/", callRouter);

console.log(`RTC Backend 服务启动，端口: ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});
