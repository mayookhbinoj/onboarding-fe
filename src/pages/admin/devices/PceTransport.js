/**
 * RX-PCE Transport Layer v3 — Exact packet builder + reliable BLE transfer
 *
 * KEY FIXES (v3 — RX path reliability):
 * 1) SAFE BYTE COPYING from DataView (prevents buffer-reuse corruption)
 * 2) RACE CONDITION FIX: _recvResolve set BEFORE write, with post-check
 * 3) ASYNC EVENT FILTERING: skip 0xA8 events during Transfer (they are
 *    spontaneous device events, not responses to our commands)
 * 4) RX DIAGNOSTIC LOGGING: every raw notification logged with byte count
 * 5) NOTIFICATION RE-ENABLE: verify notifications are active before Transfer
 */

// ══════════════════════════════════════════════════════════
// 1) HeaderCS
// ══════════════════════════════════════════════════════════
export function HeaderCS(b0, b1, b2, b3, b4, b5) {
  return (b0 + b1 + b2 + b3 + b4 + b5) & 0xFF;
}

// ══════════════════════════════════════════════════════════
// 2) GetCRC32 — custom word-based CRC
// ══════════════════════════════════════════════════════════
export function GetCRC32(data, cnt) {
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
      if (crc & 0x80000000) crc = (((crc << 1) >>> 0) ^ 0x04C11DB7) >>> 0;
      else crc = (crc << 1) >>> 0;
    }
  }
  return crc >>> 0;
}

// ══════════════════════════════════════════════════════════
// 3) BuildPacket
// ══════════════════════════════════════════════════════════
export function BuildPacket(payloadBytes) {
  const p = payloadBytes instanceof Uint8Array ? payloadBytes : new Uint8Array(payloadBytes);
  const totalSize = 7 + p.length + 4;
  const pkt = new Uint8Array(totalSize);
  pkt[0] = 0x10; pkt[1] = 0x01;
  pkt[2] = totalSize & 0xFF; pkt[3] = (totalSize >> 8) & 0xFF;
  pkt[4] = 0x07; pkt[5] = 0x2A;
  pkt[6] = HeaderCS(pkt[0], pkt[1], pkt[2], pkt[3], pkt[4], pkt[5]);
  pkt.set(p, 7);
  const crc = GetCRC32(pkt, totalSize - 4);
  const ci = totalSize - 4;
  pkt[ci] = crc & 0xFF; pkt[ci+1] = (crc>>8)&0xFF; pkt[ci+2] = (crc>>16)&0xFF; pkt[ci+3] = (crc>>24)&0xFF;
  return pkt;
}

export function toHex(b) {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════════════════════════
// UNIT TEST VECTORS
// ══════════════════════════════════════════════════════════
export function selfTest() {
  const r = [];
  const t1 = BuildPacket(new Uint8Array([0xCB, 0x01]));
  r.push({ name:'CB01 (Get Holter Info)', expected:'10010d00072a4fcb01f53e1dd8', actual:toHex(t1), pass:toHex(t1)==='10010d00072a4fcb01f53e1dd8' });
  const t2 = BuildPacket(new Uint8Array([0xCC, 0x01]));
  r.push({ name:'CC01 (Delete Holter)', expected:'10010d00072a4fcc013435b95e', actual:toHex(t2), pass:toHex(t2)==='10010d00072a4fcc013435b95e' });
  const t3 = BuildPacket(new Uint8Array([0xC9, 0x04]));
  r.push({ name:'C904 (Start Holter)', expected:'10010d00072a4fc9040aec9b78', actual:toHex(t3), pass:toHex(t3)==='10010d00072a4fc9040aec9b78' });
  const t4 = BuildPacket(new Uint8Array([0x1A, 0x5C]));
  r.push({ name:'1A5C (Stop)', expected:'10010d00072a4f1a5c5199dea0', actual:toHex(t4), pass:toHex(t4)==='10010d00072a4f1a5c5199dea0' });
  return r;
}

// ══════════════════════════════════════════════════════════
// BLE TRANSPORT v3 — multi-frame reassembly with RX fixes
// ══════════════════════════════════════════════════════════
export class PceTransport {
  constructor(bleManager) {
    this.ble = bleManager;
    this._recvBuf = new Uint8Array(0);
    this._recvResolve = null;
    this._recvTimeout = null;
    this._expectedSize = 0;
    this._notifyListener = null;
    this.onLog = null;
    // RX diagnostics
    this.rxNotifyCount = 0;   // raw notification count (during this transport session)
    this.rxTotalBytes = 0;    // total bytes received
    this.rxSkippedEvents = 0; // async events filtered out
    this.onRawNotify = null;  // optional: callback for every raw notification (for UI diagnostics)
  }

  _log(dir, msg) {
    console.log(`[PCE-TX ${dir}] ${msg}`);
    if (this.onLog) this.onLog(dir, msg);
  }

  /**
   * wireNotify — registers DIRECTLY on the BLE characteristic.
   * Does NOT depend on BleModule's internal packet parser.
   *
   * KEY: Bytes are COPIED from the DataView to avoid buffer-reuse issues.
   * KEY: Async events (0xA8) are filtered out so they don't get
   *      mistakenly delivered as command responses.
   */
  wireNotify() {
    const notifyChar = this.ble?.notifyChar;
    if (!notifyChar) {
      this._log('ERR', 'notifyChar is null — cannot wire. Check BLE connection.');
      return false;
    }
    // Remove previous listener if any
    if (this._notifyListener) {
      notifyChar.removeEventListener('characteristicvaluechanged', this._notifyListener);
    }

    // Suspend BleModule's handler to prevent dual-processing
    this.ble.notifyHandlerSuspended = true;
    this.ble.rxBuffer = [];

    this.rxNotifyCount = 0;
    this.rxTotalBytes = 0;
    this.rxSkippedEvents = 0;

    this._notifyListener = (event) => {
      // ── SAFE COPY: read bytes from DataView one by one ──
      const dv = event.target.value;
      const len = dv.byteLength;
      const raw = new Uint8Array(len);
      for (let i = 0; i < len; i++) raw[i] = dv.getUint8(i);

      this.rxNotifyCount++;
      this.rxTotalBytes += len;

      // Optional diagnostic callback
      if (this.onRawNotify) this.onRawNotify(raw, this.rxNotifyCount, this.rxTotalBytes);

      // ── Append to reassembly buffer ──
      const merged = new Uint8Array(this._recvBuf.length + raw.length);
      merged.set(this._recvBuf);
      merged.set(raw, this._recvBuf.length);
      this._recvBuf = merged;

      // ── Try to extract complete packets ──
      this._tryDeliver();
    };

    notifyChar.addEventListener('characteristicvaluechanged', this._notifyListener);
    this._log('OK', `Notify listener wired on char ${notifyChar.uuid?.slice(0,8) || '?'}`);

    // Verify notifications are enabled — re-enable if needed
    if (!this.ble.notificationsEnabled) {
      this._log('WARN', 'Notifications not enabled — attempting re-enable...');
      try {
        notifyChar.startNotifications().then(() => {
          this.ble.notificationsEnabled = true;
          this._log('OK', 'Notifications re-enabled');
        }).catch(e => {
          this._log('WARN', `Re-enable failed: ${e.message}`);
        });
      } catch (e) {
        this._log('WARN', `Re-enable error: ${e.message}`);
      }
    }
    return true;
  }

  /**
   * Try to deliver a complete, non-event packet to the pending Transfer resolver.
   * Handles:
   * - Multiple packets in buffer (events + response)
   * - Async event filtering (0xA8)
   * - Race condition: data arrived before _recvResolve was set
   */
  _tryDeliver() {
    while (this._recvBuf.length >= 4) {
      // Check for valid RX-PCE header
      if (this._recvBuf[0] !== 0x10 || this._recvBuf[1] !== 0x01) {
        // Skip to next potential header byte
        let nextIdx = -1;
        for (let i = 1; i < this._recvBuf.length; i++) {
          if (this._recvBuf[i] === 0x10) { nextIdx = i; break; }
        }
        if (nextIdx > 0) {
          this._log('SKIP', `Skipped ${nextIdx} non-header bytes`);
          this._recvBuf = this._recvBuf.slice(nextIdx);
          continue;
        } else {
          // No 0x10 found — discard everything
          this._log('SKIP', `Discarded ${this._recvBuf.length} bytes (no header found)`);
          this._recvBuf = new Uint8Array(0);
          break;
        }
      }

      // Read expected packet size from header [2..3]
      const expectedSize = this._recvBuf[2] | (this._recvBuf[3] << 8);
      if (expectedSize < 4 || expectedSize > 65536) {
        // Invalid size — skip this byte
        this._log('SKIP', `Invalid packet size ${expectedSize} — skipping byte`);
        this._recvBuf = this._recvBuf.slice(1);
        continue;
      }

      // Wait for complete packet
      if (this._recvBuf.length < expectedSize) {
        break; // need more notification frames
      }

      // ── Extract complete packet ──
      const packet = new Uint8Array(this._recvBuf.slice(0, expectedSize));
      this._recvBuf = this._recvBuf.slice(expectedSize);

      // ── Check for async events (0xA8) — skip them ──
      if (packet.length > 7 && packet[7] === 0xA8) {
        this.rxSkippedEvents++;
        const evCode = packet.length > 8 ? packet[8] : 0;
        this._log('EVT', `Async event 0xA8 sub=0x${evCode.toString(16)} (${expectedSize}B) — skipped`);
        // Don't deliver; continue looking for the actual response
        continue;
      }

      // ── Deliver to pending Transfer ──
      if (this._recvResolve) {
        this._log('RX', `Complete packet ${expectedSize}B resp=0x${(packet.length>7?packet[7]:0).toString(16)}`);
        clearTimeout(this._recvTimeout);
        const r = this._recvResolve;
        this._recvResolve = null;
        r(packet);
        return; // delivered
      } else {
        // No pending Transfer — log and discard (or it's an ACK from a fire-and-forget)
        this._log('RX', `Packet ${expectedSize}B received but no pending Transfer — discarded`);
      }
    }
  }

  unwireNotify() {
    if (this._notifyListener && this.ble?.notifyChar) {
      this.ble.notifyChar.removeEventListener('characteristicvaluechanged', this._notifyListener);
      this._notifyListener = null;
    }
    // Resume BleModule's handler
    if (this.ble) {
      this.ble.notifyHandlerSuspended = false;
      this.ble.rxBuffer = [];
    }
  }

  /**
   * Write full packet to BLE (chunked for MTU)
   * ALWAYS uses writeValueWithResponse for reliability on Bluefy/iOS.
   * Adds 50ms inter-chunk delay to prevent BLE stack overflow.
   */
  async write(pkt) {
    const c = this.ble?.writeChar;
    if (!c) throw new Error('BLE write characteristic null');
    const d = pkt instanceof Uint8Array ? pkt : new Uint8Array(pkt);
    const mtu = 20;
    for (let i = 0; i < d.length; i += mtu) {
      const chunk = d.slice(i, Math.min(i + mtu, d.length));
      try {
        // Always prefer writeValueWithResponse — writeWithoutResponse
        // silently fails on some iOS/Bluefy BLE stacks
        if (c.properties?.write) {
          await c.writeValueWithResponse(chunk);
        } else if (c.properties?.writeWithoutResponse) {
          await c.writeValueWithoutResponse(chunk);
        } else {
          await c.writeValueWithResponse(chunk);
        }
      } catch (e) {
        this._log('ERR', `Write failed at offset ${i}/${d.length}: ${e.message}`);
        throw e;
      }
      // Small inter-chunk delay for Bluefy stability
      if (i + mtu < d.length) {
        await new Promise(r => setTimeout(r, 30));
      }
    }
  }

  /**
   * Transfer(packet, timeoutMs)
   * Sends packet and waits for a complete response.
   * Returns response bytes, or null on timeout/error.
   */
  async Transfer(packet, timeoutMs = 3000) {
    // Reset reassembly state
    this._recvBuf = new Uint8Array(0);
    const rxBefore = this.rxNotifyCount;
    this._log('TX', `${toHex(packet)} (timeout=${timeoutMs}ms)`);

    // Set up resolve BEFORE writing so notifications during write are caught
    const responsePromise = new Promise((resolve) => {
      this._recvResolve = resolve;
      this._recvTimeout = setTimeout(() => {
        this._recvResolve = null;
        const rxDelta = this.rxNotifyCount - rxBefore;
        if (this._recvBuf.length > 0) {
          this._log('TIMEOUT', `Partial: ${this._recvBuf.length}B, ${rxDelta} notifies`);
          const partial = new Uint8Array(this._recvBuf);
          this._recvBuf = new Uint8Array(0);
          resolve(partial);
        } else {
          this._log('TIMEOUT', `No data after ${timeoutMs}ms. Notifies: ${rxDelta}`);
          resolve(null);
        }
      }, timeoutMs);
    });

    // Write the packet (may throw)
    try {
      await this.write(packet);
    } catch (e) {
      clearTimeout(this._recvTimeout);
      this._recvResolve = null;
      this._log('ERR', `Write failed: ${e.message}`);
      return null;
    }

    // Check if data already arrived during write
    this._tryDeliver();

    return responsePromise;
  }

  /**
   * Get RX diagnostic stats (for UI display)
   */
  getRxStats() {
    return {
      notifyCount: this.rxNotifyCount,
      totalBytes: this.rxTotalBytes,
      skippedEvents: this.rxSkippedEvents,
      bufferPending: this._recvBuf.length,
    };
  }
}

// ══════════════════════════════════════════════════════════
// HOLTER FILE FETCHER — exact RX-PCE protocol
// ══════════════════════════════════════════════════════════
export class HolterFileFetcher {
  constructor(transport) {
    this.transport = transport;
    this.onProgress = null;
    this.onLog = null;
  }

  _log(msg) {
    console.log(`[HolterFetch] ${msg}`);
    if (this.onLog) this.onLog(msg);
  }

  /**
   * GetHolterFileAndSaveBSE — Downloads holter1 file from device
   * Returns: { success, buffer, fileName, fileSize, bytesDownloaded, error, rxStats }
   */
  async GetHolterFileAndSaveBSE() {
    const rxBefore = this.transport.rxNotifyCount;

    // ══ STEP 1: GET HOLTER FILE INFO (CB 01) ══
    this._log('Step 1: Requesting Holter file info (CB 01)...');
    const infoPkt = BuildPacket(new Uint8Array([0xCB, 0x01]));
    const recv = await this.transport.Transfer(infoPkt, 3000);

    const rxAfterInfo = this.transport.rxNotifyCount;
    this._log(`RX notifications during CB01: ${rxAfterInfo - rxBefore}`);

    if (!recv) {
      const stats = this.transport.getRxStats();
      this._log(`ERROR: No response to CB01. RX stats: notifies=${stats.notifyCount} bytes=${stats.totalBytes} skippedEvents=${stats.skippedEvents}`);
      return { success: false, error: `No response to CB01 (file info). RX notifications: ${stats.notifyCount}. If 0, check BLE notification CCCD.`, rxStats: stats };
    }
    if (recv.length < 13) {
      this._log(`ERROR: Response too short (${recv.length}B, need>=13) first8=${toHex(recv.slice(0,8))}`);
      return { success: false, error: `Response too short: ${recv.length}B. First bytes: ${toHex(recv.slice(0,Math.min(recv.length,16)))}` };
    }
    if (recv[0] !== 0x10 || recv[1] !== 0x01) {
      this._log(`ERROR: Invalid header: ${toHex(recv.slice(0,4))}`);
      return { success: false, error: `Invalid response header: ${toHex(recv.slice(0,4))}` };
    }
    if (recv[7] !== 0xAB) {
      this._log(`ERROR: Expected 0xAB, got 0x${recv[7].toString(16)}. Full resp: ${toHex(recv.slice(0,Math.min(recv.length,20))).toUpperCase()}`);
      return { success: false, error: `Unexpected response 0x${recv[7].toString(16)} (expected 0xAB file-info). Full: ${toHex(recv.slice(0,16))}` };
    }

    // Parse filename (recv[8..39]) and fileSize (recv[40..43])
    let fileName = 'holter1';
    if (recv.length >= 40) {
      const nameBytes = recv.slice(8, 40);
      fileName = String.fromCharCode(...nameBytes).replace(/\0/g, '').trim() || 'holter1';
    }
    let fileSize = 0;
    if (recv.length >= 44) {
      fileSize = (recv[40] | (recv[41] << 8) | (recv[42] << 16) | (recv[43] << 24)) >>> 0;
    }
    this._log(`File: "${fileName}", size: ${fileSize} bytes (${(fileSize/1024).toFixed(1)} KB)`);

    if (fileSize === 0) {
      this._log('No Holter data available (file size is 0)');
      return { success: false, error: 'No Holter data available (file size 0). Study may not have recorded data.', fileName, fileSize: 0 };
    }

    // ══ STEP 2: DOWNLOAD FILE BY CHUNKS (C6) ══
    this._log(`Step 2: Downloading ${fileSize} bytes in 8192B chunks...`);
    const chunkSize = 8192;
    const buffer = new Uint8Array(fileSize);
    let offset = 0;
    const maxRetries = 3;

    while (offset < fileSize) {
      const reqSize = Math.min(chunkSize, fileSize - offset);
      // Build C6 payload (41 bytes)
      const payload = new Uint8Array(41);
      payload[0] = 0xC6;
      const nameEnc = new TextEncoder().encode(fileName);
      for (let i = 0; i < 32; i++) payload[1+i] = i < nameEnc.length ? nameEnc[i] : 0;
      payload[33] = offset & 0xFF; payload[34] = (offset>>8)&0xFF;
      payload[35] = (offset>>16)&0xFF; payload[36] = (offset>>24)&0xFF;
      payload[37] = reqSize & 0xFF; payload[38] = (reqSize>>8)&0xFF;
      payload[39] = (reqSize>>16)&0xFF; payload[40] = (reqSize>>24)&0xFF;

      const pkt = BuildPacket(payload);
      if (this.onProgress) this.onProgress(offset, fileSize);
      this._log(`Fetch @${offset}/${fileSize} (req ${reqSize}B)...`);

      let success = false;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Match BleService.cs: expectedLength = Size + 12
        // Response = header(7) + type(1) + data(reqSize) + CRC(4) = reqSize + 12
        const expectedLength = reqSize + 12;
        const resp = await this.transport.Transfer(pkt, 10000);

        if (!resp || resp.length < 12) {
          const stats = this.transport.getRxStats();
          this._log(`WARN: No/short response @${offset} (attempt ${attempt+1}/${maxRetries}). RX notifies=${stats.notifyCount} bytes=${stats.totalBytes}`);
          continue;
        }
        if (resp[7] !== 0xAE && resp[7] !== 0xAC) {
          this._log(`WARN: Unexpected resp 0x${resp[7].toString(16)} @${offset} (attempt ${attempt+1})`);
          continue;
        }

        // Match BleService.cs: body = recv.Skip(8).Take(Size) — exactly reqSize bytes from index 8
        // NOT recv[8:recv.length-4] which could over/under-read
        const availableData = resp.length - 8; // bytes available after header+type
        let bodySize = Math.min(reqSize, availableData);
        const dataBytes = resp.slice(8, 8 + bodySize);

        if (dataBytes.length < reqSize && attempt < maxRetries - 1) {
          this._log(`WARN: Short read ${dataBytes.length}/${reqSize} @${offset} (attempt ${attempt+1})`);
          continue;
        }

        // Match BleService.cs overflow guard: if (Offset + Size > LoadFile.Length)
        const copyLen = Math.min(dataBytes.length, reqSize, fileSize - offset);
        if (copyLen <= 0) {
          this._log(`WARN: Zero-length copy at offset ${offset}`);
          break;
        }
        buffer.set(dataBytes.slice(0, copyLen), offset);
        offset += copyLen;
        this._log(`OK: ${copyLen}B @${offset-copyLen}, total ${offset}/${fileSize}`);
        success = true;
        break;
      }

      if (!success) {
        const stats = this.transport.getRxStats();
        this._log(`ERROR: Max retries at offset ${offset}. RX notifies=${stats.notifyCount}`);
        return {
          success: false,
          error: `Download failed at offset ${offset} after ${maxRetries} retries. RX notifications total: ${stats.notifyCount}`,
          partialBuffer: buffer.slice(0, offset), bytesDownloaded: offset, fileName, fileSize, rxStats: stats
        };
      }
    }

    if (this.onProgress) this.onProgress(fileSize, fileSize);
    const stats = this.transport.getRxStats();
    this._log(`Download complete: ${offset}/${fileSize}B. Total RX: ${stats.notifyCount} notifies, ${stats.totalBytes}B`);
    return { success: true, buffer: buffer.slice(0, offset), fileName, fileSize, bytesDownloaded: offset, rxStats: stats };
  }

  async deleteHolterFile() {
    this._log('Deleting Holter file (CC 01)...');
    const pkt = BuildPacket(new Uint8Array([0xCC, 0x01]));
    const recv = await this.transport.Transfer(pkt, 2000);
    if (recv && recv.length >= 9 && recv[7] === 0xB3 && recv[8] === 0x11) {
      this._log('Delete OK (B3 11)');
      return true;
    }
    this._log('Delete failed or no ACK — warning only');
    return false;
  }
}
