/**
 * PCE Packet Builder — Dynamic hex command builder
 * Packet = Header(7) + Payload + CRC32(4 LE)
 * CRC32: word-based, poly 0x04C11DB7, init 0xFFFFFFFF, no final XOR
 */

// ── CRC32 (word-based, MSB-first, poly 0x04C11DB7) ──
export function pceCrc32(data, length) {
  const cnt = length;
  const numWords = Math.floor(cnt / 4) + (cnt % 4 > 0 ? 1 : 0);
  let crc = 0xFFFFFFFF;
  for (let w = 0; w < numWords; w++) {
    const i = w * 4;
    const b0 = i < cnt ? data[i] : 0;
    const b1 = i + 1 < cnt ? data[i + 1] : 0;
    const b2 = i + 2 < cnt ? data[i + 2] : 0;
    const b3 = i + 3 < cnt ? data[i + 3] : 0;
    const word = (b0 | (b1 << 8) | (b2 << 16) | ((b3 << 24) >>> 0)) >>> 0;
    crc = (crc ^ word) >>> 0;
    for (let bit = 0; bit < 32; bit++) {
      if (crc & 0x80000000) {
        crc = (((crc << 1) >>> 0) ^ 0x04C11DB7) >>> 0;
      } else {
        crc = (crc << 1) >>> 0;
      }
    }
  }
  return crc >>> 0;
}

// ── Build a complete PCE packet from payload bytes ──
export function buildPacket(payloadBytes) {
  const payload = payloadBytes instanceof Uint8Array ? payloadBytes : new Uint8Array(payloadBytes);
  const totalSize = 7 + payload.length + 4; // header + payload + crc32

  const pkt = new Uint8Array(totalSize);
  // Header
  pkt[0] = 0x10; // signature
  pkt[1] = 0x01; // version
  pkt[2] = totalSize & 0xFF; // packetSize lo
  pkt[3] = (totalSize >> 8) & 0xFF; // packetSize hi
  pkt[4] = 0x07; // payload offset
  pkt[5] = 0x2A; // class
  pkt[6] = (pkt[0] + pkt[1] + pkt[2] + pkt[3] + pkt[4] + pkt[5]) & 0xFF; // headerCS

  // Payload at offset 7
  pkt.set(payload, 7);

  // CRC32 over first (totalSize - 4) bytes, with last 4 as 0x00
  const crcLen = totalSize - 4;
  const crc = pceCrc32(pkt, crcLen);

  // Write CRC32 as little-endian
  pkt[crcLen] = crc & 0xFF;
  pkt[crcLen + 1] = (crc >> 8) & 0xFF;
  pkt[crcLen + 2] = (crc >> 16) & 0xFF;
  pkt[crcLen + 3] = (crc >> 24) & 0xFF;

  return pkt;
}

// ── Hex helpers ──
export function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function toHexSpaced(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

// ══════════════════════════════════════════════════════════
// COMMAND BUILDERS
// ══════════════════════════════════════════════════════════

/** Build Holter SetParams packet */
export function buildHolterSetParams(samplingRate, cableType, filters, durationSec, ebcCtrl) {
  const payload = new Uint8Array(1 + 2 + 1 + 4 + 4 + 1); // 13 bytes
  payload[0] = 0xCA;
  // samplingRate U16 LE
  payload[1] = samplingRate & 0xFF;
  payload[2] = (samplingRate >> 8) & 0xFF;
  // cableType U8
  payload[3] = cableType & 0xFF;
  // filters U32 LE
  payload[4] = filters & 0xFF;
  payload[5] = (filters >> 8) & 0xFF;
  payload[6] = (filters >> 16) & 0xFF;
  payload[7] = (filters >> 24) & 0xFF;
  // durationSec U32 LE
  payload[8] = durationSec & 0xFF;
  payload[9] = (durationSec >> 8) & 0xFF;
  payload[10] = (durationSec >> 16) & 0xFF;
  payload[11] = (durationSec >> 24) & 0xFF;
  // ebcCtrl U8
  payload[12] = ebcCtrl & 0xFF;
  return buildPacket(payload);
}

/** Build Holter Start packet */
export function buildHolterStart() {
  return buildPacket(new Uint8Array([0xC9, 0x04]));
}

/** Build MCT Start packet */
export function buildMctStart() {
  return buildPacket(new Uint8Array([0xC9, 0x05]));
}

/** Build Stop Recording packet */
export function buildStopRecording() {
  return buildPacket(new Uint8Array([0x1A, 0x5C]));
}

/** Build Get Battery packet */
export function buildGetBattery() {
  return buildPacket(new Uint8Array([0x1A, 0x6A]));
}

/** Build Set Mode packet */
export function buildSetMode(mode) {
  return buildPacket(new Uint8Array([0xAF, mode]));
}

/** Build Get Holter Params packet */
export function buildGetHolterParams() {
  return buildPacket(new Uint8Array([0x1A, 0x5B]));
}

/** Build Get MCT Params packet */
export function buildGetMctParams() {
  return buildPacket(new Uint8Array([0x1A, 0x5D]));
}

/** Build Get ECG Params packet */
export function buildGetEcgParams() {
  return buildPacket(new Uint8Array([0x1A, 0x51]));
}

/** Build Get Recording State packet */
export function buildGetRecordingState() {
  return buildPacket(new Uint8Array([0x1A, 0x50]));
}

// ── ACK checker: success if response byte[7]==0xB3 and byte[8]==0x11 ──
export function isAckSuccess(rawBytes) {
  if (!rawBytes || rawBytes.length < 9) return false;
  return rawBytes[7] === 0xB3 && rawBytes[8] === 0x11;
}

// ── Constants ──
export const MODE_HOLTER = 0x05;
export const MODE_MCT = 0x06;

// ── MCT-specific constants ──
export const MCT_BUFFER_SECONDS = 60;  // 1-minute blocks
export const MCT_HEADER_SIZE = 0x2800; // 10240 bytes
export const MCT_FRAGMENT_PAYLOAD_OFFSET = 128; // data starts at byte 128 in each fragment
export const MCT_MAGIC = [0xAA, 0xB5, 0xCE, 0xED]; // fragment magic bytes

/** Build Get Last File Info (MCT) — returns info about topmost fragment */
export function buildMctGetLastFileInfo() {
  return buildPacket(new Uint8Array([0x1A, 0x56]));
}

/** Build Delete Last File (MCT) — removes topmost fragment after download */
export function buildMctDeleteLastFile() {
  return buildPacket(new Uint8Array([0x1A, 0x58]));
}

/**
 * Calculate MCT frame size based on device config.
 * Defaults: cable=0x09, MCT_buffer_seconds=60, EKG_compress=0
 */
export function calculateMctFrameSize(bufferSeconds = 60, cable = 0x09, ekgCompress = 0) {
  let fr;
  if (cable === 18 || cable === 19) fr = 500;
  else if (cable === 9) fr = 1000;
  else fr = 500;
  
  const div = (ekgCompress === 2) ? 4 : 1;
  const sizeBufS = bufferSeconds * fr / div;
  
  if (sizeBufS < 8192) return 12288;
  if (sizeBufS < 16384) return 16384;
  if (sizeBufS < 24576) return 24576;
  if (sizeBufS < 32768) return 32768;
  if (sizeBufS < 40960) return 40960;
  if (sizeBufS < 49152) return 49152;
  if (sizeBufS < 57344) return 57344;
  return 65536;
}

// ══════════════════════════════════════════════════════════
// SELF-TEST — verify exact hex outputs
// ══════════════════════════════════════════════════════════
export function runSelfTest() {
  const results = [];

  // Test 1: Holter SetParams
  const holterParams = buildHolterSetParams(250, 0x09, 0x00000203, 86400, 0);
  const holterExpected = '1001180007 2a5aca fa0009030200008051010000 3d261d7b'.replace(/ /g, '');
  results.push({
    name: 'Holter SetParams (250Hz, cable=0x09, filters=0x203, dur=86400s, ebc=0)',
    expected: holterExpected,
    actual: toHex(holterParams),
    pass: toHex(holterParams) === holterExpected,
  });

  // Test 2: Holter Start
  const holterStart = buildHolterStart();
  const startExpected = '10010d00072a4fc9040aec9b78';
  results.push({
    name: 'Holter Start (C9 04)',
    expected: startExpected,
    actual: toHex(holterStart),
    pass: toHex(holterStart) === startExpected,
  });

  // Test 3: Stop Recording
  const stop = buildStopRecording();
  const stopExpected = '10010d00072a4f1a5c5199dea0';
  results.push({
    name: 'Stop Recording (1A 5C)',
    expected: stopExpected,
    actual: toHex(stop),
    pass: toHex(stop) === stopExpected,
  });

  // Test 4: MCT GetLastFileInfo (1A 56)
  const mctInfo = buildMctGetLastFileInfo();
  results.push({
    name: 'MCT GetLastFileInfo (1A 56)',
    expected: '10010d00072a4f1a56874f548f',
    actual: toHex(mctInfo),
    pass: toHex(mctInfo) === '10010d00072a4f1a56874f548f',
  });

  // Test 5: MCT DeleteLastFile (1A 58)
  const mctDel = buildMctDeleteLastFile();
  results.push({
    name: 'MCT DeleteLastFile (1A 58)',
    expected: '10010d00072a4f1a588defdab3',
    actual: toHex(mctDel),
    pass: toHex(mctDel) === '10010d00072a4f1a588defdab3',
  });

  // Test 6: MCT Frame Size calculation
  const frameSize = calculateMctFrameSize(60, 0x09, 0);
  results.push({
    name: 'MCT FrameSize (60s, cable=0x09, compress=0)',
    expected: '65536',
    actual: String(frameSize),
    pass: frameSize === 65536,
  });

  return results;
}
