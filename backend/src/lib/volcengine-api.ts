import * as crypto from "crypto";

// 火山引擎 RTC OpenAPI 签名相关常量
const SERVICE = "rtc";
const REGION = "cn-north-1";
const HOST = "rtc.volcengineapi.com";
const VERSION = "2025-06-01";
const CONTENT_TYPE = "application/json";

// 计算 HMAC-SHA256，返回 Buffer
function hmacSHA256(key: string | Buffer, content: string): Buffer {
  return crypto.createHmac("sha256", key).update(content, "utf-8").digest();
}

// 计算 SHA256 哈希，返回十六进制字符串
function hashSHA256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

// 对查询参数按键名排序后拼接，符合火山签名规范
function normQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const safeKey = encodeURIComponent(key).replace(/%20/g, "+");
      const safeVal = encodeURIComponent(params[key]).replace(/%20/g, "+");
      return `${safeKey}=${safeVal}`;
    })
    .join("&");
}

interface BuildAuthParams {
  ak: string;
  sk: string;
  action: string;
  body: string;
  date?: Date;
}

interface AuthResult {
  authorization: string;
  headers: Record<string, string>;
  queryString: string;
}

/**
 * 构建火山引擎 OpenAPI 请求所需的 HMAC-SHA256 签名和 headers
 *
 * 签名算法参考火山引擎官方文档，流程：
 * 1. 构造规范请求（CanonicalRequest）
 * 2. 构造待签字符串（StringToSign）
 * 3. 派生签名密钥（DerivedSigningKey）
 * 4. 计算最终签名并生成 Authorization header
 */
export function buildAuthorization(params: BuildAuthParams): AuthResult {
  const { ak, sk, action, body } = params;
  const date = params.date ?? new Date();

  // 格式化日期：ISO 格式去掉分隔符，如 20260602T100000Z
  const xDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  // 短日期，用于密钥派生，如 20260602
  const shortDate = xDate.slice(0, 8);
  // 请求体的 SHA256 哈希
  const xContentSha256 = hashSHA256(body);

  // 构造查询参数：Action 和 Version
  const queryParams: Record<string, string> = { Action: action, Version: VERSION };
  const queryString = normQuery(queryParams);

  // 参与签名的 headers 名称（按字母序排列）
  const signedHeadersStr = "content-type;host;x-content-sha256;x-date";

  // 构造规范请求字符串
  const canonicalRequest = [
    "POST",
    "/",
    queryString,
    `content-type:${CONTENT_TYPE}`,
    `host:${HOST}`,
    `x-content-sha256:${xContentSha256}`,
    `x-date:${xDate}`,
    "",
    signedHeadersStr,
    xContentSha256,
  ].join("\n");

  // 构造凭证范围和待签字符串
  const credentialScope = `${shortDate}/${REGION}/${SERVICE}/request`;
  const stringToSign = ["HMAC-SHA256", xDate, credentialScope, hashSHA256(canonicalRequest)].join("\n");

  // 派生签名密钥：sk → kDate → kRegion → kService → kSigning
  const kDate = hmacSHA256(sk, shortDate);
  const kRegion = hmacSHA256(kDate, REGION);
  const kService = hmacSHA256(kRegion, SERVICE);
  const kSigning = hmacSHA256(kService, "request");
  const signature = hmacSHA256(kSigning, stringToSign).toString("hex");

  // 最终 Authorization header 值
  const authorization = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  // 组装请求所需的全部 headers
  const headers: Record<string, string> = {
    Host: HOST,
    "Content-Type": CONTENT_TYPE,
    "X-Date": xDate,
    "X-Content-Sha256": xContentSha256,
    Authorization: authorization,
  };

  return { authorization, headers, queryString };
}

/**
 * 调用火山引擎 RTC OpenAPI
 * 自动完成签名并发送 POST 请求，返回 JSON 响应
 */
export async function callVolcAPI(params: {
  ak: string;
  sk: string;
  action: string;
  body: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const bodyStr = JSON.stringify(params.body);
  const { headers, queryString } = buildAuthorization({
    ak: params.ak,
    sk: params.sk,
    action: params.action,
    body: bodyStr,
  });

  const url = `https://${HOST}/?${queryString}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: bodyStr,
  });

  return response.json() as Promise<Record<string, unknown>>;
}
