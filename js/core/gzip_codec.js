(() => {
  "use strict";

  if (
    globalThis.RMLGzipCodec?.version >= 1
  ) {
    return;
  }

  const WINDOW_SIZE = 32768;
  const WINDOW_MASK = WINDOW_SIZE - 1;
  const HASH_SIZE = 32768;
  const HASH_MASK = HASH_SIZE - 1;
  const MAX_MATCH = 258;
  const MIN_MATCH = 3;
  const MAX_CHAIN = 96;

  const LENGTH_BASE = new Uint16Array([
    3, 4, 5, 6, 7, 8, 9, 10,
    11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115,
    131, 163, 195, 227, 258
  ]);
  const LENGTH_EXTRA = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4,
    5, 5, 5, 5, 0
  ]);
  const DISTANCE_BASE = new Uint16Array([
    1, 2, 3, 4, 5, 7, 9, 13,
    17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537,
    2049, 3073, 4097, 6145, 8193,
    12289, 16385, 24577
  ]);
  const DISTANCE_EXTRA = new Uint8Array([
    0, 0, 0, 0, 1, 1, 2, 2,
    3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13
  ]);
  const CODE_LENGTH_ORDER = new Uint8Array([
    16, 17, 18, 0, 8, 7, 9, 6, 10,
    5, 11, 4, 12, 3, 13, 2, 14, 1, 15
  ]);

  let crcTable = null;
  let fixedLiteralTable = null;
  let fixedDistanceTable = null;

  function bytesOf(value) {
    if (value instanceof Uint8Array) {
      return value;
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
    }
    throw new TypeError(
      "GZIP input must be binary data."
    );
  }

  function reverseBits(value, length) {
    let reversed = 0;
    for (let index = 0; index < length; index += 1) {
      reversed =
        (reversed << 1) |
        ((value >>> index) & 1);
    }
    return reversed >>> 0;
  }

  function crc32Table() {
    if (crcTable) {
      return crcTable;
    }
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value =
          (value & 1) !== 0
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
      }
      table[index] = value >>> 0;
    }
    crcTable = table;
    return table;
  }

  function crc32(bytes) {
    const table = crc32Table();
    let value = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      value =
        table[(value ^ bytes[index]) & 0xff] ^
        (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  class ByteWriter {
    constructor(initialCapacity = 1024, maximum = 0x7fffffff) {
      this.maximum = maximum;
      this.bytes = new Uint8Array(
        Math.max(16, initialCapacity)
      );
      this.length = 0;
    }

    ensure(additional) {
      const required =
        this.length + additional;
      if (required > this.maximum) {
        throw new RangeError(
          "The decompressed JSON exceeds the configured project limit."
        );
      }
      if (required <= this.bytes.length) {
        return;
      }
      let capacity = this.bytes.length;
      while (capacity < required) {
        capacity = Math.min(
          this.maximum,
          Math.max(
            required,
            capacity < 1024 * 1024
              ? capacity * 2
              : capacity +
                  Math.floor(capacity / 2)
          )
        );
        if (capacity < required) {
          throw new RangeError(
            "The binary JSON buffer is too large."
          );
        }
      }
      const grown =
        new Uint8Array(capacity);
      grown.set(
        this.bytes.subarray(0, this.length)
      );
      this.bytes = grown;
    }

    push(value) {
      this.ensure(1);
      this.bytes[this.length++] =
        value & 0xff;
    }

    copy(distance, length) {
      if (
        distance <= 0 ||
        distance > this.length
      ) {
        throw new Error(
          "The DEFLATE stream contains an invalid backward distance."
        );
      }
      this.ensure(length);
      for (let index = 0; index < length; index += 1) {
        this.bytes[this.length] =
          this.bytes[
            this.length - distance
          ];
        this.length += 1;
      }
    }

    finish() {
      return this.bytes.slice(
        0,
        this.length
      );
    }
  }

  class BitWriter {
    constructor(output) {
      this.output = output;
      this.buffer = 0;
      this.count = 0;
    }

    write(value, count) {
      if (count === 0) {
        return;
      }
      const mask =
        (1 << count) - 1;
      this.buffer |=
        (value & mask) << this.count;
      this.count += count;
      while (this.count >= 8) {
        this.output.push(
          this.buffer & 0xff
        );
        this.buffer >>>= 8;
        this.count -= 8;
      }
    }

    finish() {
      if (this.count > 0) {
        this.output.push(
          this.buffer & 0xff
        );
      }
      this.buffer = 0;
      this.count = 0;
    }
  }

  class BitReader {
    constructor(bytes, offset) {
      this.bytes = bytes;
      this.byteIndex = offset;
      this.buffer = 0;
      this.count = 0;
    }

    read(count) {
      while (this.count < count) {
        if (
          this.byteIndex >=
            this.bytes.length
        ) {
          throw new Error(
            "The DEFLATE stream ended unexpectedly."
          );
        }
        this.buffer |=
          this.bytes[this.byteIndex++] <<
          this.count;
        this.count += 8;
      }
      const mask =
        count === 0
          ? 0
          : (1 << count) - 1;
      const value =
        this.buffer & mask;
      this.buffer >>>= count;
      this.count -= count;
      return value >>> 0;
    }

    align() {
      this.buffer = 0;
      this.count = 0;
    }
  }

  function writeFixedSymbol(writer, symbol) {
    let code;
    let length;
    if (symbol <= 143) {
      code = 0x30 + symbol;
      length = 8;
    } else if (symbol <= 255) {
      code = 0x190 + symbol - 144;
      length = 9;
    } else if (symbol <= 279) {
      code = symbol - 256;
      length = 7;
    } else {
      code = 0xc0 + symbol - 280;
      length = 8;
    }
    writer.write(
      reverseBits(code, length),
      length
    );
  }

  function lengthIndex(length) {
    for (
      let index = LENGTH_BASE.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (length >= LENGTH_BASE[index]) {
        return index;
      }
    }
    return 0;
  }

  function distanceIndex(distance) {
    for (
      let index = DISTANCE_BASE.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (
        distance >=
          DISTANCE_BASE[index]
      ) {
        return index;
      }
    }
    return 0;
  }

  function writeLengthDistance(
    writer,
    length,
    distance
  ) {
    const lengthSlot =
      lengthIndex(length);
    writeFixedSymbol(
      writer,
      257 + lengthSlot
    );
    const lengthExtra =
      LENGTH_EXTRA[lengthSlot];
    if (lengthExtra > 0) {
      writer.write(
        length - LENGTH_BASE[lengthSlot],
        lengthExtra
      );
    }

    const distanceSlot =
      distanceIndex(distance);
    writer.write(
      reverseBits(distanceSlot, 5),
      5
    );
    const distanceExtra =
      DISTANCE_EXTRA[distanceSlot];
    if (distanceExtra > 0) {
      writer.write(
        distance -
          DISTANCE_BASE[distanceSlot],
        distanceExtra
      );
    }
  }

  function hashAt(bytes, index) {
    return (
      (
        (
          bytes[index] * 251 +
          bytes[index + 1]
        ) * 251 +
        bytes[index + 2]
      ) & HASH_MASK
    );
  }

  function deflateFixed(bytes) {
    const output = new ByteWriter(
      Math.max(
        128,
        Math.min(
          bytes.length + 64,
          1024 * 1024
        )
      )
    );
    const writer = new BitWriter(output);
    const head =
      new Int32Array(HASH_SIZE);
    const previous =
      new Int32Array(WINDOW_SIZE);
    head.fill(-1);
    previous.fill(-1);

    const insert = position => {
      if (
        position + MIN_MATCH >
          bytes.length
      ) {
        return;
      }
      const hash =
        hashAt(bytes, position);
      previous[
        position & WINDOW_MASK
      ] = head[hash];
      head[hash] = position;
    };

    writer.write(1, 1);
    writer.write(1, 2);

    let position = 0;
    while (position < bytes.length) {
      let bestLength = 0;
      let bestDistance = 0;

      if (
        position + MIN_MATCH <=
          bytes.length
      ) {
        const hash =
          hashAt(bytes, position);
        let candidate = head[hash];
        let chain = 0;
        const maximumLength = Math.min(
          MAX_MATCH,
          bytes.length - position
        );

        while (
          candidate >= 0 &&
          position - candidate <=
            WINDOW_SIZE &&
          chain < MAX_CHAIN
        ) {
          if (
            bytes[candidate] ===
              bytes[position] &&
            bytes[candidate + 1] ===
              bytes[position + 1] &&
            bytes[candidate + 2] ===
              bytes[position + 2] &&
            (
              bestLength === 0 ||
              bestLength ===
                maximumLength ||
              bytes[
                candidate + bestLength
              ] ===
                bytes[
                  position + bestLength
                ]
            )
          ) {
            let length = MIN_MATCH;
            while (
              length < maximumLength &&
              bytes[candidate + length] ===
                bytes[position + length]
            ) {
              length += 1;
            }
            if (length > bestLength) {
              bestLength = length;
              bestDistance =
                position - candidate;
              if (
                length === maximumLength
              ) {
                break;
              }
            }
          }
          const next =
            previous[
              candidate & WINDOW_MASK
            ];
          if (
            next < 0 ||
            next >= candidate
          ) {
            break;
          }
          candidate = next;
          chain += 1;
        }
      }

      if (bestLength >= MIN_MATCH) {
        writeLengthDistance(
          writer,
          bestLength,
          bestDistance
        );
        for (
          let offset = 0;
          offset < bestLength;
          offset += 1
        ) {
          insert(position + offset);
        }
        position += bestLength;
      } else {
        writeFixedSymbol(
          writer,
          bytes[position]
        );
        insert(position);
        position += 1;
      }
    }

    writeFixedSymbol(writer, 256);
    writer.finish();
    return output.finish();
  }

  function buildHuffman(lengths) {
    let maximumLength = 0;
    const counts = new Uint16Array(16);
    for (
      let index = 0;
      index < lengths.length;
      index += 1
    ) {
      const length = lengths[index];
      if (length > 15) {
        throw new Error(
          "The DEFLATE stream contains an invalid Huffman length."
        );
      }
      if (length > 0) {
        counts[length] += 1;
        maximumLength = Math.max(
          maximumLength,
          length
        );
      }
    }
    if (maximumLength === 0) {
      return null;
    }

    const nextCode =
      new Uint16Array(16);
    let code = 0;
    let available = 1;
    for (
      let bits = 1;
      bits <= 15;
      bits += 1
    ) {
      available =
        (available << 1) -
        counts[bits];
      if (available < 0) {
        throw new Error(
          "The DEFLATE stream contains an oversubscribed Huffman tree."
        );
      }
      code =
        (code + counts[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const byLength =
      new Array(maximumLength + 1);
    for (
      let bits = 1;
      bits <= maximumLength;
      bits += 1
    ) {
      if (counts[bits] > 0) {
        const table =
          new Int32Array(1 << bits);
        table.fill(-1);
        byLength[bits] = table;
      }
    }

    for (
      let symbol = 0;
      symbol < lengths.length;
      symbol += 1
    ) {
      const length = lengths[symbol];
      if (length === 0) {
        continue;
      }
      const reversed = reverseBits(
        nextCode[length]++,
        length
      );
      byLength[length][reversed] =
        symbol;
    }

    return {
      maximumLength,
      byLength
    };
  }

  function readHuffman(reader, table) {
    if (!table) {
      throw new Error(
        "The DEFLATE stream requires a missing Huffman tree."
      );
    }
    let code = 0;
    for (
      let length = 1;
      length <= table.maximumLength;
      length += 1
    ) {
      code |=
        reader.read(1) <<
        (length - 1);
      const symbol =
        table.byLength[length]?.[code] ??
        -1;
      if (symbol >= 0) {
        return symbol;
      }
    }
    throw new Error(
      "The DEFLATE stream contains an invalid Huffman code."
    );
  }

  function fixedTables() {
    if (
      fixedLiteralTable &&
      fixedDistanceTable
    ) {
      return {
        literal: fixedLiteralTable,
        distance: fixedDistanceTable
      };
    }
    const literalLengths =
      new Uint8Array(288);
    literalLengths.fill(8, 0, 144);
    literalLengths.fill(9, 144, 256);
    literalLengths.fill(7, 256, 280);
    literalLengths.fill(8, 280, 288);
    const distanceLengths =
      new Uint8Array(32);
    distanceLengths.fill(5);
    fixedLiteralTable =
      buildHuffman(literalLengths);
    fixedDistanceTable =
      buildHuffman(distanceLengths);
    return {
      literal: fixedLiteralTable,
      distance: fixedDistanceTable
    };
  }

  function dynamicTables(reader) {
    const literalCount =
      reader.read(5) + 257;
    const distanceCount =
      reader.read(5) + 1;
    const codeLengthCount =
      reader.read(4) + 4;
    const codeLengths =
      new Uint8Array(19);
    for (
      let index = 0;
      index < codeLengthCount;
      index += 1
    ) {
      codeLengths[
        CODE_LENGTH_ORDER[index]
      ] = reader.read(3);
    }
    const codeLengthTable =
      buildHuffman(codeLengths);
    const total =
      literalCount + distanceCount;
    const lengths =
      new Uint8Array(total);
    let offset = 0;

    while (offset < total) {
      const symbol = readHuffman(
        reader,
        codeLengthTable
      );
      if (symbol <= 15) {
        lengths[offset++] = symbol;
        continue;
      }
      let repeated;
      let count;
      if (symbol === 16) {
        if (offset === 0) {
          throw new Error(
            "The DEFLATE code-length repeat has no previous value."
          );
        }
        repeated = lengths[offset - 1];
        count = reader.read(2) + 3;
      } else if (symbol === 17) {
        repeated = 0;
        count = reader.read(3) + 3;
      } else if (symbol === 18) {
        repeated = 0;
        count = reader.read(7) + 11;
      } else {
        throw new Error(
          "The DEFLATE stream contains an invalid code-length symbol."
        );
      }
      if (offset + count > total) {
        throw new Error(
          "The DEFLATE code-length repeat exceeds its table."
        );
      }
      lengths.fill(
        repeated,
        offset,
        offset + count
      );
      offset += count;
    }

    return {
      literal: buildHuffman(
        lengths.subarray(0, literalCount)
      ),
      distance: buildHuffman(
        lengths.subarray(literalCount)
      )
    };
  }

  function inflateCompressedBlock(
    reader,
    output,
    tables
  ) {
    while (true) {
      const symbol = readHuffman(
        reader,
        tables.literal
      );
      if (symbol < 256) {
        output.push(symbol);
        continue;
      }
      if (symbol === 256) {
        return;
      }
      if (symbol < 257 || symbol > 285) {
        throw new Error(
          "The DEFLATE stream contains an invalid length symbol."
        );
      }
      const lengthSlot = symbol - 257;
      const length =
        LENGTH_BASE[lengthSlot] +
        reader.read(
          LENGTH_EXTRA[lengthSlot]
        );
      const distanceSymbol =
        readHuffman(
          reader,
          tables.distance
        );
      if (distanceSymbol > 29) {
        throw new Error(
          "The DEFLATE stream contains an invalid distance symbol."
        );
      }
      const distance =
        DISTANCE_BASE[distanceSymbol] +
        reader.read(
          DISTANCE_EXTRA[
            distanceSymbol
          ]
        );
      output.copy(distance, length);
    }
  }

  function inflate(bytes, offset, maximumBytes) {
    const reader =
      new BitReader(bytes, offset);
    const initial = Math.max(
      1024,
      Math.min(
        maximumBytes,
        Math.max(
          65536,
          (bytes.length - offset) * 3
        )
      )
    );
    const output =
      new ByteWriter(initial, maximumBytes);
    let final = false;

    while (!final) {
      final = reader.read(1) === 1;
      const type = reader.read(2);
      if (type === 0) {
        reader.align();
        const length = reader.read(16);
        const complement = reader.read(16);
        if (
          ((length ^ 0xffff) & 0xffff) !==
            complement
        ) {
          throw new Error(
            "The stored DEFLATE block length is invalid."
          );
        }
        for (
          let index = 0;
          index < length;
          index += 1
        ) {
          output.push(reader.read(8));
        }
      } else if (type === 1) {
        inflateCompressedBlock(
          reader,
          output,
          fixedTables()
        );
      } else if (type === 2) {
        inflateCompressedBlock(
          reader,
          output,
          dynamicTables(reader)
        );
      } else {
        throw new Error(
          "The DEFLATE stream uses the reserved block type."
        );
      }
    }

    reader.align();
    return {
      bytes: output.finish(),
      nextOffset: reader.byteIndex
    };
  }

  function readUint16(bytes, offset) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8)
    ) >>> 0;
  }

  function readUint32(bytes, offset) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }

  function pushUint32(output, value) {
    output.push(value & 0xff);
    output.push((value >>> 8) & 0xff);
    output.push((value >>> 16) & 0xff);
    output.push((value >>> 24) & 0xff);
  }

  function skipZeroTerminated(bytes, offset) {
    while (
      offset < bytes.length &&
      bytes[offset] !== 0
    ) {
      offset += 1;
    }
    if (offset >= bytes.length) {
      throw new Error(
        "The GZIP header is incomplete."
      );
    }
    return offset + 1;
  }

  function gzipPayloadOffset(bytes) {
    if (
      bytes.length < 18 ||
      bytes[0] !== 0x1f ||
      bytes[1] !== 0x8b
    ) {
      throw new Error(
        "The file does not contain a complete GZIP member."
      );
    }
    if (bytes[2] !== 8) {
      throw new Error(
        "The GZIP member does not use DEFLATE compression."
      );
    }
    const flags = bytes[3];
    if ((flags & 0xe0) !== 0) {
      throw new Error(
        "The GZIP header contains reserved flags."
      );
    }
    let offset = 10;
    if ((flags & 0x04) !== 0) {
      if (offset + 2 > bytes.length) {
        throw new Error(
          "The GZIP extra-field header is incomplete."
        );
      }
      const length =
        readUint16(bytes, offset);
      offset += 2 + length;
      if (offset > bytes.length) {
        throw new Error(
          "The GZIP extra field exceeds the file boundary."
        );
      }
    }
    if ((flags & 0x08) !== 0) {
      offset = skipZeroTerminated(
        bytes,
        offset
      );
    }
    if ((flags & 0x10) !== 0) {
      offset = skipZeroTerminated(
        bytes,
        offset
      );
    }
    if ((flags & 0x02) !== 0) {
      if (offset + 2 > bytes.length) {
        throw new Error(
          "The GZIP header checksum is incomplete."
        );
      }
      const expectedHeaderCrc =
        readUint16(bytes, offset);
      const actualHeaderCrc =
        crc32(
          bytes.subarray(0, offset)
        ) & 0xffff;
      if (
        expectedHeaderCrc !==
          actualHeaderCrc
      ) {
        throw new Error(
          "The GZIP header checksum is invalid."
        );
      }
      offset += 2;
    }
    if (offset >= bytes.length - 8) {
      throw new Error(
        "The GZIP payload is incomplete."
      );
    }
    return offset;
  }

  function compress(value) {
    const input = bytesOf(value);
    const deflated =
      deflateFixed(input);
    const output = new ByteWriter(
      deflated.length + 18
    );
    output.push(0x1f);
    output.push(0x8b);
    output.push(8);
    output.push(0);
    pushUint32(output, 0);
    output.push(0);
    output.push(255);
    for (
      let index = 0;
      index < deflated.length;
      index += 1
    ) {
      output.push(deflated[index]);
    }
    pushUint32(output, crc32(input));
    pushUint32(
      output,
      input.length >>> 0
    );
    return output.finish();
  }

  function decompress(
    value,
    maximumBytes = 0x7ffffffff
  ) {
    const input = bytesOf(value);
    const maximum = Number(maximumBytes);
    if (
      !Number.isFinite(maximum) ||
      maximum <= 0
    ) {
      throw new RangeError(
        "A positive decompressed-size limit is required."
      );
    }
    const payloadOffset =
      gzipPayloadOffset(input);
    const inflated = inflate(
      input,
      payloadOffset,
      Math.floor(maximum)
    );
    const trailer = inflated.nextOffset;
    if (trailer + 8 !== input.length) {
      throw new Error(
        "The GZIP member has unexpected trailing or missing data."
      );
    }
    const expectedCrc =
      readUint32(input, trailer);
    const expectedSize =
      readUint32(input, trailer + 4);
    if (
      expectedSize !==
        (inflated.bytes.length >>> 0)
    ) {
      throw new Error(
        "The GZIP uncompressed-size check failed."
      );
    }
    if (expectedCrc !== crc32(inflated.bytes)) {
      throw new Error(
        "The GZIP CRC32 integrity check failed."
      );
    }
    return inflated.bytes;
  }

  Object.defineProperty(
    globalThis,
    "RMLGzipCodec",
    {
      value: Object.freeze({
        version: 1,
        compress,
        decompress
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );
})();
