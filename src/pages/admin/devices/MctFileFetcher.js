/**
 * MCT File Fetcher — Downloads multiple MCT fragment files from device,
 * then merges them into a single BSE output buffer.
 *
 * MCT Protocol:
 *   1. Drain all fragments: GetLastFileInfo (1A56) → Download (C6) → Delete (1A58) → repeat
 *   2. Fetch MCT header file: Download "mctheader" via C6, then delete it
 *   3. Merge all fragments + header into single BSE binary
 *
 * Each fragment has:
 *   Magic: AA B5 CE ED at [0..3]
 *   block_num: U32LE at [8..11]
 *   Payload: starts at offset 128
 */

import { BuildPacket } from './PceTransport';
import {
  buildMctGetLastFileInfo,
  buildMctDeleteLastFile,
  calculateMctFrameSize,
  MCT_HEADER_SIZE,
  MCT_FRAGMENT_PAYLOAD_OFFSET,
  MCT_MAGIC,
  MCT_BUFFER_SECONDS,
} from './ProtocolEngine';

export class MctFileFetcher {
  constructor(transport, opts = {}) {
    this.transport = transport;
    this.durationSec = opts.durationSec || 300;
    this.bufferSeconds = opts.bufferSeconds || MCT_BUFFER_SECONDS;
    this.cable = opts.cable || 0x09;
    this.ekgCompress = opts.ekgCompress || 0;
    this.onProgress = null;
    this.onLog = null;
  }

  _log(msg) {
    console.log(`[MctFetch] ${msg}`);
    if (this.onLog) this.onLog(msg);
  }

  /**
   * Main entry point: Fetch all MCT data and return a merged BSE buffer.
   */
  async fetchAndMerge() {
    const fragments = [];

    // ════════════════════════════════════════════════
    // PHASE 1: Drain all fragment files from device
    // ════════════════════════════════════════════════
    this._log('Phase 1: Draining MCT fragments from device...');
    let drainCount = 0;
    const maxFragments = Math.ceil(this.durationSec / this.bufferSeconds) + 5;

    while (drainCount < maxFragments) {
      const infoResult = await this._getLastFileInfo();

      if (!infoResult.success) {
        if (infoResult.noFile) {
          this._log(`No more fragments (total: ${fragments.length})`);
          break;
        }
        this._log(`GetLastFileInfo failed: ${infoResult.error}`);
        break;
      }

      const { fileName, fileSize } = infoResult;
      this._log(`Fragment found: "${fileName}" (${fileSize}B)`);

      if (this.onProgress) {
        this.onProgress(`Downloading fragment ${drainCount + 1}...`, drainCount, maxFragments);
      }

      const downloadResult = await this._downloadFile(fileName, fileSize);

      if (!downloadResult.success) {
        this._log(`Download failed for "${fileName}": ${downloadResult.error}`);
        await this._deleteLastFile();
        drainCount++;
        continue;
      }

      fragments.push({ fileName, fileSize, buffer: downloadResult.buffer });

      const deleted = await this._deleteLastFile();
      if (!deleted) {
        this._log(`Warning: Delete failed for "${fileName}"`);
      }

      drainCount++;
      await this._sleep(200);
    }

    if (fragments.length === 0) {
      return {
        success: false,
        error: 'No MCT fragments found on device',
        fragments: [],
      };
    }

    // ════════════════════════════════════════════════
    // PHASE 2: Fetch MCT header file ("mctheader")
    // ════════════════════════════════════════════════
    this._log('Phase 2: Fetching MCT header file...');
    let headerBuffer = null;

    // Try to get header info first
    const headerInfo = await this._getLastFileInfo();
    if (headerInfo.success && headerInfo.fileName.toLowerCase().includes('header')) {
      const headerResult = await this._downloadFile(headerInfo.fileName, headerInfo.fileSize);
      if (headerResult.success) {
        headerBuffer = headerResult.buffer;
        this._log(`MCT header fetched: ${headerBuffer.length}B`);
        await this._deleteLastFile();
      }
    } else {
      this._log('MCT header not found — will use empty header');
    }

    // ════════════════════════════════════════════════
    // PHASE 3: Merge fragments into single BSE
    // ════════════════════════════════════════════════
    this._log('Phase 3: Merging fragments into single BSE...');

    if (this.onProgress) {
      this.onProgress('Merging fragments...', fragments.length, fragments.length);
    }

    const mergeResult = this._mergeFragments(fragments, headerBuffer);

    if (!mergeResult.success) {
      return { success: false, error: mergeResult.error, fragments: fragments.length };
    }

    this._log(`Merge complete: ${mergeResult.buffer.length}B BSE, ${mergeResult.blocksPlaced} blocks`);

    return {
      success: true,
      buffer: mergeResult.buffer,
      fileName: `mct_merged_${Date.now()}.bse`,
      fileSize: mergeResult.buffer.length,
      fragmentCount: fragments.length,
      blocksPlaced: mergeResult.blocksPlaced,
    };
  }

  // ────────────────────────────────────────────────
  // MCT Get Last File Info (1A 56)
  // ────────────────────────────────────────────────
  async _getLastFileInfo() {
    const pkt = buildMctGetLastFileInfo();
    const recv = await this.transport.Transfer(pkt, 3000);

    if (!recv || recv.length < 13) {
      return { success: false, error: 'No response to 1A56', noFile: !recv };
    }

    if (recv[7] !== 0xAB) {
      return { success: false, error: `Unexpected response 0x${recv[7].toString(16)}`, noFile: false };
    }

    // Parse fileName (recv[8..39]) — 32 bytes, ASCII null-padded
    let fileName = '';
    if (recv.length >= 40) {
      const nameBytes = recv.slice(8, 40);
      fileName = String.fromCharCode(...nameBytes).replace(/\0/g, '').trim();
    }

    // Parse fileSize (recv[40..43]) — U32 LE
    let fileSize = 0;
    if (recv.length >= 44) {
      fileSize = (recv[40] | (recv[41] << 8) | (recv[42] << 16) | (recv[43] << 24)) >>> 0;
    }

    if (fileSize === 0) {
      return { success: false, noFile: true, error: 'File size is 0' };
    }

    return { success: true, fileName, fileSize };
  }

  // ────────────────────────────────────────────────
  // Download file by C6 chunks (same protocol as Holter)
  // ────────────────────────────────────────────────
  async _downloadFile(fileName, fileSize) {
    const chunkSize = 4096; // MCT uses 4096B chunks
    const buffer = new Uint8Array(fileSize);
    let offset = 0;
    const maxRetries = 3;

    while (offset < fileSize) {
      const reqSize = Math.min(chunkSize, fileSize - offset);

      // Build C6 payload (41 bytes)
      const payload = new Uint8Array(41);
      payload[0] = 0xC6;
      const nameEnc = new TextEncoder().encode(fileName);
      for (let i = 0; i < 32; i++) payload[1 + i] = i < nameEnc.length ? nameEnc[i] : 0;
      payload[33] = offset & 0xFF; payload[34] = (offset >> 8) & 0xFF;
      payload[35] = (offset >> 16) & 0xFF; payload[36] = (offset >> 24) & 0xFF;
      payload[37] = reqSize & 0xFF; payload[38] = (reqSize >> 8) & 0xFF;
      payload[39] = (reqSize >> 16) & 0xFF; payload[40] = (reqSize >> 24) & 0xFF;

      const pkt = BuildPacket(payload);
      let success = false;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const resp = await this.transport.Transfer(pkt, 10000);

        if (!resp || resp.length < 12) continue;
        if (resp[7] !== 0xAE && resp[7] !== 0xAC) continue;

        // FIX: Exclude 4 CRC bytes at end per PCE spec: data = resp[8..resp.length-4]
        const dataEnd = Math.max(8, resp.length - 4);
        const bodySize = Math.min(reqSize, dataEnd - 8);
        const dataBytes = resp.slice(8, 8 + bodySize);
        const copyLen = Math.min(dataBytes.length, reqSize, fileSize - offset);

        if (copyLen <= 0) break;
        buffer.set(dataBytes.slice(0, copyLen), offset);
        offset += copyLen;
        success = true;
        break;
      }

      if (!success) {
        return { success: false, error: `Download failed at offset ${offset}` };
      }
    }

    return { success: true, buffer: buffer.slice(0, offset) };
  }

  // ────────────────────────────────────────────────
  // MCT Delete Last File (1A 58)
  // ────────────────────────────────────────────────
  async _deleteLastFile() {
    const pkt = buildMctDeleteLastFile();
    const recv = await this.transport.Transfer(pkt, 2000);
    return recv && recv.length >= 9 && recv[7] === 0xB3 && recv[8] === 0x11;
  }

  // ────────────────────────────────────────────────
  // Merge fragments into single BSE output
  // ────────────────────────────────────────────────
  // IMPORTANT: BseFragDecoder64K.exe expects blocks at fixed 65536-byte (64K) intervals.
  // Block 0 at offset 0x2800, Block 1 at 0x2800 + 65536, Block 2 at 0x2800 + 2*65536, etc.
  // Each block slot is zero-filled, with the fragment payload written at the start of the slot.
  // The zero padding between payloads is expected by the decoder and is handled by
  // remove_mct_block_gaps() in the backend after decoding.
  // DO NOT use contiguous merge — it breaks the BSE file format.
  _mergeFragments(fragments, headerBuffer) {
    const frameSize = calculateMctFrameSize(this.bufferSeconds, this.cable, this.ekgCompress);

    const parsed = [];
    for (const frag of fragments) {
      const buf = frag.buffer;
      if (buf.length < MCT_FRAGMENT_PAYLOAD_OFFSET) {
        this._log(`Skipping short fragment "${frag.fileName}" (${buf.length}B)`);
        continue;
      }
      if (buf[0] !== MCT_MAGIC[0] || buf[1] !== MCT_MAGIC[1] ||
          buf[2] !== MCT_MAGIC[2] || buf[3] !== MCT_MAGIC[3]) {
        this._log(`Warning: Fragment "${frag.fileName}" missing magic — placing anyway`);
      }
      const blockNum = (buf[8] | (buf[9] << 8) | (buf[10] << 16) | (buf[11] << 24)) >>> 0;
      const blockPayload = buf.slice(MCT_FRAGMENT_PAYLOAD_OFFSET);
      parsed.push({ blockNum, payload: blockPayload, fileName: frag.fileName });
    }

    if (parsed.length === 0) {
      return { success: false, error: 'No valid blocks placed in output' };
    }

    parsed.sort((a, b) => a.blockNum - b.blockNum);

    const maxBlockNum = parsed[parsed.length - 1].blockNum;
    const totalSlots = maxBlockNum + 1;
    const finalSize = MCT_HEADER_SIZE + totalSlots * frameSize;

    this._log(`Merge (64K slots): ${parsed.length} blocks, frameSize=${frameSize}, totalSlots=${totalSlots}, finalSize=${finalSize}B`);

    const output = new Uint8Array(finalSize);

    if (headerBuffer && headerBuffer.length >= MCT_FRAGMENT_PAYLOAD_OFFSET) {
      const headerPayload = headerBuffer.slice(MCT_FRAGMENT_PAYLOAD_OFFSET);
      const headerWriteLen = Math.min(headerPayload.length, MCT_HEADER_SIZE);
      output.set(headerPayload.slice(0, headerWriteLen), 0);
    }

    let blocksPlaced = 0;
    for (const p of parsed) {
      const writeOffset = MCT_HEADER_SIZE + p.blockNum * frameSize;
      if (writeOffset + p.payload.length > output.length) {
        this._log(`Warning: Block ${p.blockNum} exceeds output bounds — skipping`);
        continue;
      }
      output.set(p.payload, writeOffset);
      this._log(`Block ${p.blockNum}: ${p.payload.length}B → offset 0x${writeOffset.toString(16)} (slot ${p.blockNum})`);
      blocksPlaced++;
    }

    return { success: true, buffer: output, blocksPlaced };
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
