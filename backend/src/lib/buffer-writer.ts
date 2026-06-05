/**
 * 二进制缓冲区写入工具，用于 RTC Token 序列化
 * 参考火山引擎官方 Token 生成实现
 */
export class BufferWriter {
  private buffer = Buffer.alloc(1024);
  private position = 0;

  /** 返回已写入的内容（不含空余空间） */
  pack(): Buffer {
    const out = Buffer.alloc(this.position);
    this.buffer.copy(out, 0, 0, out.length);
    return out;
  }

  /** 写入 2 字节小端无符号整数 */
  putUint16(v: number): BufferWriter {
    this.buffer.writeUInt16LE(v, this.position);
    this.position += 2;
    return this;
  }

  /** 写入 4 字节小端无符号整数 */
  putUint32(v: number): BufferWriter {
    this.buffer.writeUInt32LE(v, this.position);
    this.position += 4;
    return this;
  }

  /** 写入字节数组（先写长度，再写内容） */
  putBytes(bytes: Buffer): BufferWriter {
    this.putUint16(bytes.length);
    bytes.copy(this.buffer, this.position);
    this.position += bytes.length;
    return this;
  }

  /** 写入字符串（UTF-8 编码，先写长度，再写内容） */
  putString(str: string): BufferWriter {
    return this.putBytes(Buffer.from(str));
  }

  /** 写入有序的 <uint16 key, uint32 value> Map（先写条目数量） */
  putTreeMapUInt32(map: Map<number, number>): BufferWriter {
    this.putUint16(map.size);
    map.forEach((value, key) => {
      this.putUint16(key);
      this.putUint32(value);
    });
    return this;
  }
}
