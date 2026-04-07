/**
 * QC Test Engine v8 — Uses PceTransport v3 with RX fixes
 * Tracks DATA_READY state, exposes RX diagnostics
 */
import { BuildPacket, toHex, PceTransport, HolterFileFetcher } from './PceTransport';
import { buildHolterSetParams, buildHolterStart, buildMctStart, buildStopRecording, buildSetMode, buildGetRecordingState, MODE_HOLTER, MODE_MCT } from './ProtocolEngine';
import { MctFileFetcher } from './MctFileFetcher';

export const QC_STATE = {
  IDLE:'IDLE', CONNECTED:'CONNECTED', DELETE_OLD:'DELETE_OLD', PUSH_CONFIG:'PUSH_CONFIG',
  STARTING:'STARTING', RUNNING:'RUNNING', STOPPING:'STOPPING', DATA_READY:'DATA_READY',
  FETCHING:'FETCHING', DECODING:'DECODING', UPLOADING:'UPLOADING', CYCLE_DONE:'CYCLE_DONE',
  ALL_DONE:'ALL_DONE', ERROR:'ERROR', CANCELLED:'CANCELLED',
};

export class QcTestEngine {
  constructor(ble, opts={}) {
    this.ble = ble;
    this.mode = opts.mode || 'HOLTER';
    this.durationMin = opts.durationMin || 1;
    this.totalCycles = opts.cycles || 1;
    this.samplingRate = opts.samplingRate || 250;
    this.cableType = opts.cableType || 0x09;
    this.filters = opts.filters || 0x00000203;
    this.ebcCtrl = opts.ebcCtrl || 0;
    this.state = QC_STATE.IDLE;
    this.currentCycle = 0;
    this.running = false;
    this.logs = [];
    this.rxPackets = 0;
    this.rxBytes = 0;
    this.edfFiles = [];
    this.mctBlocksReceived = 0;
    this._transport = null;
    this._endResolve = null;
    this._endTimeout = null;
    // Callbacks
    this.onStateChange = null;
    this.onLog = null;
    this.onProgress = null;
    this.onCycleComplete = null;
    this.onAllComplete = null;
    this.onError = null;
    this.onDataReady = null;
    this.onBseFetched = null;  // (cycle, bseBuffer, fileName, fileSize) — called when raw BSE is downloaded from device
  }

  _setState(s) { this.state=s; if(this.onStateChange) this.onStateChange(s); }
  _log(dir,hex,desc,status='') { const e={time:new Date().toISOString(),dir,hex:(hex||'').slice(0,100),desc,status}; this.logs.push(e); if(this.onLog) this.onLog(e); }
  _progress(msg) { if(this.onProgress) this.onProgress({state:this.state,message:msg,cycle:this.currentCycle,totalCycles:this.totalCycles,rxPackets:this.rxPackets,rxBytes:this.rxBytes}); }

  async _transfer(pkt, desc, timeoutMs=3000) {
    console.log(`[QC-TX] ${desc} (${pkt.length}B, timeout=${timeoutMs}ms)`);
    this._log('TX', toHex(pkt), desc, 'sent');
    const resp = await this._transport.Transfer(pkt, timeoutMs);
    if (resp) {
      this.rxPackets++;
      this.rxBytes += resp.length;
      if (resp.length >= 8) {
        const respCode = resp[7];
        this._log('RX', toHex(resp.slice(0, Math.min(resp.length, 40))), `resp=0x${respCode.toString(16)} len=${resp.length}`, '');
        if (respCode === 0xB3 && resp.length >= 9) {
          const ackCode = resp[8];
          this._log('ACK', '', ackCode===0x11 ? 'SUCCESS' : `NACK 0x${ackCode.toString(16)}`, ackCode===0x11?'ok':'error');
        }
      }
    } else {
      const stats = this._transport.getRxStats();
      this._log('--','',`${desc} — no response (${timeoutMs}ms). RX: ${stats.notifyCount} notifies`,'timeout');
    }
    return resp;
  }

  _wireNotify() {
    // Clean up any previous transport listener
    if (this._transport) {
      this._transport.unwireNotify();
      this._transport = null;
    }
    this._transport = new PceTransport(this.ble);
    this._transport.onLog = (dir, msg) => this._log(dir, '', msg, '');
    const wired = this._transport.wireNotify();
    if (!wired) {
      this._log('ERR', '', 'Failed to wire notify listener', 'error');
    }

    // Detect EndRecording via PceTransport's raw notification stream.
    // Do NOT hijack ble.onData — that creates a third processing path
    // that conflicts with PceTransport's packet reassembly.
    this._endEventBuf = [];
    const prevRawNotify = this._transport.onRawNotify;
    this._transport.onRawNotify = (raw, count, totalBytes) => {
      for (let i = 0; i < raw.length; i++) this._endEventBuf.push(raw[i]);
      this._scanForEndEvent();
      if (prevRawNotify) prevRawNotify(raw, count, totalBytes);
    };
  }

  _scanForEndEvent() {
    while (this._endEventBuf.length >= 10) {
      if (this._endEventBuf[0] !== 0x10 || this._endEventBuf[1] !== 0x01) {
        this._endEventBuf.shift();
        continue;
      }
      const pktLen = this._endEventBuf[2] | (this._endEventBuf[3] << 8);
      if (pktLen < 4 || pktLen > 65536) { this._endEventBuf.shift(); continue; }
      if (this._endEventBuf.length < pktLen) break;

      const pkt = this._endEventBuf.splice(0, pktLen);
      if (pkt.length > 8 && pkt[7] === 0xA8) {
        const ec = pkt[8];
        this._log('EV', `0x${ec.toString(16)}`, this._evtName(ec), 'event');
        if (ec === 0x20) {
          this.mctBlocksReceived++;
          this._log('EV', '', `MCT_Block received (total: ${this.mctBlocksReceived})`, 'event');
        }
        if (ec === 0x02 && this._endResolve) {
          clearTimeout(this._endTimeout);
          const r = this._endResolve;
          this._endResolve = null;
          r();
        }
      }
    }
  }

  _isBleAlive() {
    return this.ble?.connected && this.ble?.device?.gatt?.connected && this.ble?.writeChar && this.ble?.notifyChar;
  }

  _evtName(c) { return {0x01:'Button',0x02:'EndRecording',0x03:'LowBattery',0x05:'RecStarted',0x0A:'BatteryDead',0x0B:'ElectrodesOff',0x20:'MCT_Block'}[c]||`0x${c.toString(16)}`; }

  async run() {
    console.log('[QC-RUN] run() called. BLE state:', {
      connected: this.ble?.connected,
      writeChar: !!this.ble?.writeChar,
      notifyChar: !!this.ble?.notifyChar,
      gattConnected: this.ble?.device?.gatt?.connected,
    });

    if (!this.ble?.connected || !this.ble?.writeChar || !this.ble?.notifyChar) {
      const msg = 'BLE not ready: ' + (!this.ble?.connected?'disconnected ':'') + (!this.ble?.writeChar?'no writeChar ':'') + (!this.ble?.notifyChar?'no notifyChar':'');
      if (this.onError) this.onError(msg);
      return;
    }
    if (!this.durationMin || this.durationMin < 1) { if(this.onError) this.onError('Duration must be >= 1 min'); return; }

    this.running = true;
    this.edfFiles = [];
    this.rxPackets = 0; this.rxBytes = 0;

    console.log('[QC-RUN] calling _wireNotify...');
    this._wireNotify();
    this._setState(QC_STATE.CONNECTED);

    // Stabilization delay
    console.log('[QC-RUN] stabilization wait 1s...');
    await this._sleep(1000);

    // Log initial RX diagnostic info
    this._log('INFO', '', `BLE notifyCount=${this.ble.notifyCount} notifyBytes=${this.ble.notifyBytes} notificationsEnabled=${this.ble.notificationsEnabled} suspended=${this.ble.notifyHandlerSuspended}`, '');

    try {
      for (let cycle=1; cycle<=this.totalCycles; cycle++) {
        if (!this.running) break;
        this.currentCycle = cycle;

        // BLE health check before each cycle
        if (!this._isBleAlive()) {
          this._log('ERR', '', `BLE disconnected before cycle ${cycle}`, 'error');
          throw new Error('BLE connection lost before cycle ' + cycle);
        }

        // STEP 1: STOP any ongoing recording (ensure device is in idle state)
        this._setState(QC_STATE.DELETE_OLD);
        this._progress(`Cycle ${cycle}: Ensuring device is idle...`);
        await this._transfer(buildStopRecording(), 'STOP_RECORDING (ensure idle)', 3000);
        await this._sleep(500);

        // STEP 2: DELETE old holter data
        this._progress(`Cycle ${cycle}: Deleting old holter file...`);
        const delResp = await this._transfer(BuildPacket(new Uint8Array([0xCC, 0x01])), 'DELETE_HOLTER (CC01)', 3000);
        if (delResp && delResp.length >= 9 && delResp[7] === 0xB3 && delResp[8] === 0x11) {
          this._log('--', '', 'Holter file deleted (CC01 ACK OK)', 'ok');
        } else {
          this._log('WARN', '', 'CC01 delete: no ACK — trying generic DELETE', 'warn');
          await this._transfer(BuildPacket(new Uint8Array([0x1A, 0x5A])), 'DELETE_ALL_FILES', 3000);
        }
        await this._sleep(1500);  // Increased delay after delete for device stability

        // STEP 3: SET MODE — tell the device which recording mode to use
        // This is REQUIRED before START — without it, device returns NACK 0x01
        this._setState(QC_STATE.PUSH_CONFIG);
        const modeVal = this.mode === 'MCT' ? MODE_MCT : MODE_HOLTER;
        this._progress(`Cycle ${cycle}: Setting mode to ${this.mode}...`);
        const modeResp = await this._transfer(buildSetMode(modeVal), `SET_MODE (AF ${modeVal.toString(16)})`, 3000);
        if (modeResp && modeResp.length >= 9 && modeResp[7] === 0xB3 && modeResp[8] === 0x11) {
          this._log('--', '', `Mode set to ${this.mode} (ACK OK)`, 'ok');
        } else {
          this._log('WARN', '', `Set mode ${this.mode}: no ACK (continuing anyway)`, 'warn');
        }
        await this._sleep(800);  // Increased delay after mode set

        // STEP 4: SET PARAMS — configure sampling rate, duration, cable type, filters
        const durSec = this.durationMin * 60;
        this._progress(`Cycle ${cycle}: Setting ${this.mode} params (${durSec}s)...`);
        const paramResp = await this._transfer(buildHolterSetParams(this.samplingRate, this.cableType, this.filters, durSec, this.ebcCtrl),
          `SET_PARAMS [sr=${this.samplingRate} cable=0x${this.cableType.toString(16)} dur=${durSec}s]`, 3000);
        if (paramResp && paramResp.length >= 9 && paramResp[7] === 0xB3 && paramResp[8] === 0x11) {
          this._log('--', '', 'Params set (ACK OK)', 'ok');
        } else {
          this._log('WARN', '', 'Set params: no ACK (continuing anyway)', 'warn');
        }
        await this._sleep(500);

        // STEP 5: START RECORDING (with retry and state verification)
        this._setState(QC_STATE.STARTING);
        this._progress(`Cycle ${cycle}: Starting ${this.mode}...`);
        const startPkt = this.mode === 'MCT' ? buildMctStart() : buildHolterStart();
        let startSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const startResp = await this._transfer(startPkt, `START_${this.mode} (attempt ${attempt})`, 5000);
          if (startResp && startResp.length >= 9 && startResp[7] === 0xB3 && startResp[8] === 0x11) {
            this._log('--', '', `${this.mode} started (ACK OK)`, 'ok');
            startSuccess = true;
            break;
          } else if (startResp && startResp.length >= 9 && startResp[7] === 0xB3) {
            const nackCode = startResp[8];
            this._log('WARN', '', `START attempt ${attempt}/3: NACK 0x${nackCode.toString(16)}`, 'warn');
            if (attempt < 3) {
              this._progress(`Cycle ${cycle}: Retrying start (attempt ${attempt + 1}/3)...`);
              // Full reset cycle: stop → wait → delete → wait → re-set mode → wait → re-set params
              await this._transfer(buildStopRecording(), 'RETRY_STOP', 3000);
              await this._sleep(1000);
              await this._transfer(BuildPacket(new Uint8Array([0xCC, 0x01])), 'RETRY_DELETE', 3000);
              await this._sleep(1500);
              await this._transfer(buildSetMode(modeVal), `RETRY_SET_MODE`, 3000);
              await this._sleep(800);
              await this._transfer(buildHolterSetParams(this.samplingRate, this.cableType, this.filters, durSec, this.ebcCtrl),
                'RETRY_SET_PARAMS', 3000);
              await this._sleep(500);
            }
          } else {
            this._log('WARN', '', `START attempt ${attempt}: no ACK — verifying recording state...`, 'warn');
            // Verify if recording actually started by checking state
            await this._sleep(1000);
            const stateResp = await this._transfer(buildGetRecordingState(), 'GET_RECORDING_STATE', 3000);
            if (stateResp && stateResp.length >= 9) {
              const stateCode = stateResp[8];
              if (stateCode === 0x01 || stateCode === 0x02) {
                this._log('--', '', `Recording confirmed active (state=0x${stateCode.toString(16)})`, 'ok');
                startSuccess = true;
                break;
              }
            }
            if (!startSuccess && attempt >= 3) {
              this._log('WARN', '', 'No ACK and state unconfirmed — assuming started', 'warn');
              startSuccess = true;
            }
          }
        }
        if (!startSuccess) {
          this._log('ERR', '', `${this.mode} START failed after 3 attempts`, 'error');
        }

        // RUNNING — wait for end event or timeout
        this._setState(QC_STATE.RUNNING);
        this._progress(`Cycle ${cycle}: Recording (${this.durationMin} min)...`);
        await new Promise(resolve => {
          this._endResolve = resolve;
          this._endTimeout = setTimeout(resolve, (durSec + 30) * 1000);
        });

        if (!this.running) { this._setState(QC_STATE.CANCELLED); break; }

        // DATA READY
        this._setState(QC_STATE.DATA_READY);
        this._progress(`Cycle ${cycle}: Study complete — data ready for fetch`);
        if (this.onDataReady) this.onDataReady(cycle);

        // MCT: Extra wait for device to finalize last block to storage
        if (this.mode === 'MCT') {
          this._progress(`Cycle ${cycle}: Waiting for device to finalize blocks...`);
          await this._sleep(3000);
        }

        // FETCH BSE — branch by mode
        this._setState(QC_STATE.FETCHING);
        await this._sleep(2000);

        if (!this._isBleAlive()) {
          throw new Error('BLE connection lost before BSE fetch');
        }

        let fetchResult;

        if (this.mode === 'MCT') {
          // MCT: Drain multiple fragments, merge into single BSE
          this._progress(`Cycle ${cycle}: Fetching MCT fragments from device...`);
          const mctFetcher = new MctFileFetcher(this._transport, {
            durationSec: this.durationMin * 60,
            bufferSeconds: 60,
            cable: this.cableType,
            ekgCompress: 0,
          });
          mctFetcher.onProgress = (msg) => this._progress(`Cycle ${cycle}: ${msg}`);
          mctFetcher.onLog = (msg) => this._log('--', '', msg, '');
          fetchResult = await mctFetcher.fetchAndMerge();
          fetchResult.fileName = fetchResult.fileName || `mct_cycle_${cycle}`;
          fetchResult.fileSize = fetchResult.fileSize || (fetchResult.buffer?.length || 0);
        } else {
          // HOLTER: Single file fetch (existing logic)
          this._progress(`Cycle ${cycle}: Auto-fetching Holter data from device...`);
          const fetcher = new HolterFileFetcher(this._transport);
          fetcher.onProgress = (off, total) => this._progress(`Cycle ${cycle}: Fetching ${off}/${total}...`);
          fetcher.onLog = (msg) => this._log('--', '', msg, '');
          fetchResult = await fetcher.GetHolterFileAndSaveBSE();
        }

        if (fetchResult.success && fetchResult.buffer && fetchResult.buffer.length > 0) {
          const bseData = fetchResult.buffer;
          let bseHash = 0;
          for (let i = 0; i < Math.min(bseData.length, 1000); i++) bseHash = ((bseHash << 5) - bseHash + bseData[i]) | 0;
          this._log('--', '', `BSE fetched: ${bseData.length}B, hash=${(bseHash >>> 0).toString(16)}, cycle=${cycle}`, 'ok');

          this._setState(QC_STATE.UPLOADING);
          this._progress(`Cycle ${cycle}: Uploading BSE to backend (auto-converts to EDF)...`);
          if (this.onBseFetched) {
            this.onBseFetched(cycle, bseData, fetchResult.fileName || 'holter1', fetchResult.fileSize);
          }
        } else {
          this._log('WARN','',`No BSE data: ${fetchResult.error || 'unknown'}. RX stats: ${JSON.stringify(fetchResult.rxStats || {})}`,'warn');
        }

        // Guard post-fetch delete (Holter only — MCT deletes fragments during drain)
        if (this.mode !== 'MCT' && this._isBleAlive()) {
          const fetcher2 = new HolterFileFetcher(this._transport);
          const deleted = await fetcher2.deleteHolterFile();
          this._log('--', '', `Delete file: ${deleted ? 'OK' : 'failed (warning only)'}`, deleted ? 'ok' : 'warn');
        }

        this._setState(QC_STATE.CYCLE_DONE);
        this._progress(`Cycle ${cycle}: Complete`);

        // Inter-cycle stabilization delay (give BLE stack time to settle)
        if (cycle < this.totalCycles) {
          this._progress(`Cycle ${cycle}: Complete — stabilizing before next cycle...`);
          // Check BLE health before waiting
          if (!this._isBleAlive()) {
            throw new Error('BLE connection lost between cycles');
          }
          await this._sleep(4000);
        }
      }

      this._setState(QC_STATE.ALL_DONE);
      this._progress(`Done! ${this.edfFiles.length} EDF(s).`);
      this.running = false;
      // CRITICAL: clean up the PceTransport listener to prevent listener accumulation.
      // Without this, the next test run adds another characteristicvaluechanged listener
      // and Bluefy crashes from processing notifications through 2+ handlers.
      if (this._transport) { this._transport.unwireNotify(); this._transport = null; }
      if (this.onAllComplete) this.onAllComplete(this.edfFiles);
    } catch(err) {
      this.running = false;
      if (this._transport) { this._transport.unwireNotify(); this._transport = null; }
      this._setState(QC_STATE.ERROR);
      this._log('ERR','',`Fatal: ${err.message}`,'error');
      if (this.onError) this.onError(`Error: ${err.message}`);
    }
  }

  async _decodeBseToEdf(bseData) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([bseData], {type:'application/octet-stream'}), 'recording.bse');
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/bse/decode-to-edf`, { method:'POST', body:formData });
      if (resp.ok) {
        const edfBytes = await resp.arrayBuffer();
        this._log('--','',`BSE decoded -> EDF ${edfBytes.byteLength}B (backend)`,'ok');
        return new Blob([edfBytes], {type:'application/octet-stream'});
      }
    } catch(e) {
      this._log('WARN','',`Backend decode failed: ${e.message}`,'warn');
    }
    return this._rawToEdfBlob(bseData);
  }

  _rawToEdfBlob(raw) {
    const sr = this.samplingRate;
    const ns = Math.floor(raw.length/2);
    if (ns===0) return null;
    const dur = Math.max(1, Math.floor(ns/sr));
    const pad = (s,l)=>(s+' '.repeat(l)).substring(0,l);
    const n = new Date();
    let h = pad('0',8)+pad('X X X X',80)+pad('BeatX QCQA',80)+pad(`${n.getDate().toString().padStart(2,'0')}.${(n.getMonth()+1).toString().padStart(2,'0')}.${n.getFullYear().toString().slice(2)}`,8)+pad(`${n.getHours().toString().padStart(2,'0')}.${n.getMinutes().toString().padStart(2,'0')}.${n.getSeconds().toString().padStart(2,'0')}`,8)+pad('512',8)+pad('EDF+C',44)+pad(dur.toString(),8)+pad('1',8)+pad('1',4);
    h+=pad('ECG',16)+pad('',80)+pad('uV',8)+pad('-3200',8)+pad('3200',8)+pad('-32768',8)+pad('32767',8)+pad('',80)+pad(sr.toString(),8)+pad('',32);
    const hb=new TextEncoder().encode(h);const hdr=new Uint8Array(512);hdr.set(hb.slice(0,512));
    const dl=dur*sr*2;const data=new Uint8Array(dl);data.set(raw.slice(0,dl));
    const edf=new Uint8Array(512+dl);edf.set(hdr);edf.set(data,512);
    return new Blob([edf],{type:'application/octet-stream'});
  }

  async stop() {
    this.running = false;
    try {
      if (this._transport) await this._transport.Transfer(buildStopRecording(), 3000);
    } catch(e){}
    // Clean up listener to prevent accumulation on next run
    if (this._transport) { this._transport.unwireNotify(); this._transport = null; }
    if (this._endTimeout) clearTimeout(this._endTimeout);
    if (this._endResolve) { this._endResolve(); this._endResolve=null; }
    this._setState(QC_STATE.CANCELLED);
  }

  _sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
  exportLogs() { return this.logs.map(l=>`${l.time} [${l.dir.padEnd(4)}] ${l.hex.padEnd(60)} ${l.desc} ${l.status}`).join('\n'); }
}
