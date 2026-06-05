import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

console.log(`RTC Backend 服务启动，端口: ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});
