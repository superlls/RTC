/**
 * 火山引擎 RTC Token 生成与解析
 * 基于官方 TypeScript 示例实现，支持生成、序列化与验证
 */
import * as crypto from "crypto";
import { BufferWriter } from "./buffer-writer.js";

/** Token 版本号前缀 */
const VERSION = "001";
/** AppID 固定长度为 24 个字符 */
const APP_ID_LENGTH = 24;

/** 权限类型枚举 */
enum Privilege {
  PrivPublishStream = 0,
  PrivPublishAudioStream = 1,
  PrivPublishVideoStream = 2,
  PrivPublishDataStream = 3,
  PrivSubscribeStream = 4,
}

class AccessToken {
  appID: string;
  appKey: string;
  roomID: string;
  userID: string;
  issuedAt: number;
  nonce: number;
  expireAt: number;
  privileges: Map<number, number>;
  signature?: string;

  constructor(appID: string, appKey: string, roomID: string, userID: string) {
    this.appID = appID;
    this.appKey = appKey;
    this.roomID = roomID;
    this.userID = userID;
    this.issuedAt = Math.floor(Date.now() / 1000);
    this.nonce = Math.floor(Math.random() * 0xffffffff);
    this.expireAt = 0;
    this.privileges = new Map();
  }

  /** 添加权限；发布流权限会同时添加音频、视频、数据子权限 */
  addPrivilege(privilege: Privilege, expireTimestamp: number): void {
    this.privileges.set(privilege, expireTimestamp);
    if (privilege === Privilege.PrivPublishStream) {
      this.privileges.set(Privilege.PrivPublishAudioStream, expireTimestamp);
      this.privileges.set(Privilege.PrivPublishVideoStream, expireTimestamp);
      this.privileges.set(Privilege.PrivPublishDataStream, expireTimestamp);
    }
  }

  /** 设置 Token 过期时间（Unix 秒级时间戳） */
  expireTime(expireTimestamp: number): void {
    this.expireAt = expireTimestamp;
  }

  /** 序列化为 Token 字符串：版本号 + AppID + Base64(消息体 + 签名) */
  serialize(): string {
    const bytesM = this.packMsg();
    const signature = this.encodeHMac(this.appKey, bytesM);
    const content = new BufferWriter().putBytes(bytesM).putBytes(signature).pack();
    return VERSION + this.appID + content.toString("base64");
  }

  /** 使用给定 appKey 验证签名是否合法，同时检查是否过期 */
  verify(key: string): boolean {
    if (this.expireAt > 0 && Math.floor(Date.now() / 1000) > this.expireAt) {
      return false;
    }
    return this.encodeHMac(key, this.packMsg()).toString() === this.signature;
  }

  /** 将 Token 元数据打包为消息体 Buffer */
  private packMsg(): Buffer {
    const bufM = new BufferWriter();
    bufM.putUint32(this.nonce);
    bufM.putUint32(this.issuedAt);
    bufM.putUint32(this.expireAt);
    bufM.putString(this.roomID);
    bufM.putString(this.userID);
    bufM.putTreeMapUInt32(new Map([...this.privileges.entries()].sort()));
    return bufM.pack();
  }

  /** HMAC-SHA256 签名 */
  private encodeHMac(key: string, message: Buffer): Buffer {
    return crypto.createHmac("sha256", key).update(message).digest();
  }
}

// --- BufferReader（解析 Token 用） ---

/** 二进制缓冲区读取工具，与 BufferWriter 对应 */
class BufferReader {
  private buffer: Buffer;
  private position = 0;

  constructor(bytes: Buffer) {
    this.buffer = bytes;
  }

  /** 读取 2 字节小端无符号整数 */
  getUint16(): number {
    const ret = this.buffer.readUInt16LE(this.position);
    this.position += 2;
    return ret;
  }

  /** 读取 4 字节小端无符号整数 */
  getUint32(): number {
    const ret = this.buffer.readUInt32LE(this.position);
    this.position += 4;
    return ret;
  }

  /** 读取字节数组（先读长度，再读内容） */
  getString(): Buffer {
    const len = this.getUint16();
    const out = Buffer.alloc(len);
    this.buffer.copy(out, 0, this.position, this.position + len);
    this.position += len;
    return out;
  }

  /** 读取有序的 <uint16 key, uint32 value> Map */
  getTreeMapUInt32(): Map<number, number> {
    const map: Map<number, number> = new Map();
    const len = this.getUint16();
    for (let i = 0; i < len; i++) {
      const key = this.getUint16();
      const value = this.getUint32();
      map.set(key, value);
    }
    return map;
  }
}

// --- 公开 API ---

/** generateToken 参数 */
interface GenerateTokenParams {
  appId: string;
  appKey: string;
  roomId: string;
  userId: string;
  /** Unix 秒级时间戳，默认为当前时间 + 24 小时 */
  expireAt?: number;
}

/** 生成 RTC Token，默认授予发布流与订阅流权限 */
export function generateToken(params: GenerateTokenParams): string {
  const { appId, appKey, roomId, userId } = params;
  const expireAt = params.expireAt ?? Math.floor(Date.now() / 1000) + 24 * 3600;

  const token = new AccessToken(appId, appKey, roomId, userId);
  token.addPrivilege(Privilege.PrivSubscribeStream, 0);
  token.addPrivilege(Privilege.PrivPublishStream, 0);
  token.expireTime(expireAt);
  return token.serialize();
}

/** 解析 Token 字符串，返回 AccessToken 实例（含验证方法），解析失败返回 undefined */
export function parseToken(raw: string): AccessToken | undefined {
  try {
    if (raw.length <= 3 + APP_ID_LENGTH) return;
    if (raw.slice(0, 3) !== VERSION) return;

    const appID = raw.slice(3, 3 + APP_ID_LENGTH);
    const contentBuf = Buffer.from(raw.slice(3 + APP_ID_LENGTH), "base64");
    const readbuf = new BufferReader(contentBuf);
    const msg = readbuf.getString();
    const signature = readbuf.getString().toString();

    const msgBuf = new BufferReader(msg);
    const nonce = msgBuf.getUint32();
    const issuedAt = msgBuf.getUint32();
    const expireAt = msgBuf.getUint32();
    const roomID = msgBuf.getString().toString();
    const userID = msgBuf.getString().toString();
    const privileges = msgBuf.getTreeMapUInt32();

    const token = new AccessToken(appID, "", roomID, userID);
    token.signature = signature;
    token.nonce = nonce;
    token.issuedAt = issuedAt;
    token.expireAt = expireAt;
    token.privileges = privileges;
    return token;
  } catch {
    return undefined;
  }
}
