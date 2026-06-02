import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { config } from "../config/index.js";

export const getWeather = tool(
  async ({ city }: { city: string }) => {
    try {
      // 第一步：GeoAPI 查询城市 LocationID
      const geoUrl = `https://${config.qweatherApiHost}/geo/v2/city/lookup?location=${encodeURIComponent(city)}`;
      const geoRes = await fetch(geoUrl, {
        headers: { "X-QW-Api-Key": config.qweatherApiKey },
      });
      const geoData = await geoRes.json();

      if (geoData.code !== "200" || !geoData.location?.length) {
        return `天气查询失败：未找到城市"${city}"`;
      }

      const locationId = geoData.location[0].id;
      const cityName = geoData.location[0].name;

      // 第二步：实时天气查询
      const weatherUrl = `https://${config.qweatherApiHost}/v7/weather/now?location=${locationId}`;
      const weatherRes = await fetch(weatherUrl, {
        headers: { "X-QW-Api-Key": config.qweatherApiKey },
      });
      const weatherData = await weatherRes.json();

      if (weatherData.code !== "200") {
        return `天气查询失败：无法获取${cityName}的天气数据`;
      }

      const now = weatherData.now;
      return `${cityName}当前天气：${now.text}，温度 ${now.temp}°C，体感温度 ${now.feelsLike}°C，湿度 ${now.humidity}%，${now.windDir}${now.windScale}级，风速 ${now.windSpeed}km/h`;
    } catch (err) {
      return `天气查询失败：${err instanceof Error ? err.message : "未知错误"}`;
    }
  },
  {
    name: "getWeather",
    description: "查询指定城市的实时天气信息",
    schema: z.object({
      city: z.string().describe("城市名称，如北京、上海"),
    }),
  }
);
