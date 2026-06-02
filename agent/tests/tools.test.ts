import { describe, it, expect, vi } from "vitest";
import { getCurrentTime } from "../src/tools/time.js";
import { getWeather } from "../src/tools/weather.js";
import { webSearch } from "../src/tools/web-search.js";

describe("getCurrentTime", () => {
  it("返回包含日期和时间的中文格式字符串", async () => {
    const result = await getCurrentTime.invoke({});
    expect(result).toMatch(/\d{4}年/);
    expect(result).toMatch(/月/);
    expect(result).toMatch(/日/);
    expect(typeof result).toBe("string");
  });
});

describe("getWeather", () => {
  it("接受 city 参数并返回字符串", async () => {
    const result = await getWeather.invoke({ city: "北京" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("城市不存在时返回错误描述而非抛异常", async () => {
    const result = await getWeather.invoke({ city: "不存在的城市名xxxx" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("webSearch", () => {
  it("接受 query 参数并返回字符串", async () => {
    const result = await webSearch.invoke({ query: "LangGraph 是什么" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("搜索失败时返回错误描述而非抛异常", async () => {
    // mock tavily 模块使其抛出错误
    vi.mock("@tavily/core", () => ({
      tavily: () => ({
        search: () => { throw new Error("API key invalid"); },
      }),
    }));

    // 需要重新导入以应用 mock
    const { webSearch: mockedWebSearch } = await import("../src/tools/web-search.js");
    const result = await mockedWebSearch.invoke({ query: "测试搜索" });
    expect(typeof result).toBe("string");
    expect(result).toMatch(/搜索失败/);

    vi.restoreAllMocks();
  });
});
