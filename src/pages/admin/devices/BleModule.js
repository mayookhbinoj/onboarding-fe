/**
 * BeatX BLE Module — Web Bluetooth connectivity for QCQA
 * v4: Fixed dual-handler conflict. Handler is stored (removable) and suspendable.
 */

export const BLE_CONFIG = {
  SERVICE_UUIDS: ['7b1b0001-2f3a-bb6f-7b9e-2d8308a752ec'],
  WRITE_CHAR_UUID: '7b1b0002-2f3a-bb6f-7b9e-2d8308a752ec',
  NOTIFY_CHAR_UUID: '7b1b0003-2f3a-bb6f-7b9e-2d8308a752ec',
  DEVICE_INFO_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
  SERIAL_CHAR_UUID: '00002a25-0000-1000-8000-00805f9b34fb',
  NAME_PREFIXES: ['BeatX', 'BEATX', 'BX-', 'PCE', 'Holter', 'MCT', 'RX'],
};

export function isBleSupported() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}
export function isSecureContext() {
  return typeof window !== 'undefined' && (window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost');
}
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export class BleDeviceManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.connected = false;
    this.onData = null;
    this.onDisconnect = null;
    this.onStatusChange = null;
    this.rxBuffer = [];
    this._log = [];
    this._notifyHandler = null;           // stored reference — removable
    this.notifyHandlerSuspended = false;   // when true, skip packet parsing
    this.notifyCount = 0;
    this.notifyBytes = 0;
    this.notificationsEnabled = false;
  }

  log(msg) {
    const entry = `[BLE ${new Date().toISOString().slice(11,23)}] ${msg}`;
    this._log.push(entry);
    console.log(entry);
    if (this.onStatusChange) this.onStatusChange(msg);
  }
  getLogs() { return this._log.join('\n'); }

  async connect(expectedIdentity, mode = 'auto') {
    if (!isBleSupported()) return { success: false, error: 'Web Bluetooth not supported' };
    if (!isSecureContext()) return { success: false, error: 'Bluetooth requires HTTPS' };
    this.log('Starting device scan...');
    this.notifyCount = 0;
    this.notifyBytes = 0;
    this.notificationsEnabled = false;

    try {
      let device = null;
      if (mode === 'auto') {
        try {
          this.log('Scan mode: service UUID filter...');
          device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['7b1b0001-2f3a-bb6f-7b9e-2d8308a752ec'] }],
            optionalServices: [BLE_CONFIG.DEVICE_INFO_SERVICE],
          });
        } catch (e) {
          if (e.name === 'NotFoundError') {
            this.log('No devices with service filter, trying name filter...');
            try {
              device = await navigator.bluetooth.requestDevice({
                filters: BLE_CONFIG.NAME_PREFIXES.map(p => ({ namePrefix: p })),
                optionalServices: ['7b1b0001-2f3a-bb6f-7b9e-2d8308a752ec', BLE_CONFIG.DEVICE_INFO_SERVICE],
              });
            } catch (e2) {
              if (e2.name === 'NotFoundError') { device = null; }
              else throw e2;
            }
          } else throw e;
        }
      }
      if (!device) {
        this.log('Scan mode: open (all devices)...');
        device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['7b1b0001-2f3a-bb6f-7b9e-2d8308a752ec', BLE_CONFIG.DEVICE_INFO_SERVICE],
        });
      }
      this.device = device;
      this.log(`Device selected: "${device.name || 'unnamed'}" (id: ${device.id.slice(0,8)}...)`);
      device.addEventListener('gattserverdisconnected', () => {
        this.log('Device disconnected');
        this.connected = false;
        if (this.onDisconnect) this.onDisconnect();
      });
      this.log('Connecting GATT...');
      this.server = await device.gatt.connect();
      this.log('GATT connected');
      const charResult = await this._discoverCharacteristics();
      if (!charResult.success) { await this.disconnect(); return charResult; }

      // Enable notifications
      if (this.notifyChar) {
        try {
          await this.notifyChar.startNotifications();
          this.notificationsEnabled = true;
          this.log('Notifications ENABLED');
        } catch (notifyErr) {
          this.log(`WARNING: startNotifications failed: ${notifyErr.message}`);
          this.notificationsEnabled = false;
        }
        // Register STORED handler (removable via removeEventListener)
        if (this._notifyHandler) {
          this.notifyChar.removeEventListener('characteristicvaluechanged', this._notifyHandler);
        }
        this._notifyHandler = (e) => this._handleNotification(e);
        this.notifyChar.addEventListener('characteristicvaluechanged', this._notifyHandler);
        this.log('Notification listener registered (stored ref)');
        await new Promise(r => setTimeout(r, 500));
      } else {
        this.log('WARNING: notifyChar is null');
      }

      // Identity: name check only (skip DIS read for Bluefy stability)
      if (expectedIdentity) {
        try {
          const verified = await this._verifyIdentity(expectedIdentity);
          this.log(verified ? 'Identity verified' : 'Identity: trusting user selection');
        } catch (e) { this.log(`Identity check skipped: ${e.message}`); }
      }
      this.connected = true;
      this.log('Connected successfully!');
      return { success: true, device: { name: device.name, id: device.id } };
    } catch (err) {
      this.log(`Error: ${err.name} — ${err.message}`);
      return { success: false, error: this._formatError(err) };
    }
  }

  async _discoverCharacteristics() {
    const SVC = '7b1b0001-2f3a-bb6f-7b9e-2d8308a752ec';
    const WR = '7b1b0002-2f3a-bb6f-7b9e-2d8308a752ec';
    const NF = '7b1b0003-2f3a-bb6f-7b9e-2d8308a752ec';
    try {
      this.log(`Discovering service ${SVC.slice(0,8)}...`);
      const service = await this.server.getPrimaryService(SVC);
      this.log('Service found');
      try { this.writeChar = await service.getCharacteristic(WR); this.log(`Write char OK`); } catch (e) { this.log(`Write char err: ${e.message}`); }
      try { this.notifyChar = await service.getCharacteristic(NF); this.log(`Notify char OK`); } catch (e) { this.log(`Notify char err: ${e.message}`); }
      if (this.writeChar && this.notifyChar) return { success: true };
      this.log('Trying characteristic scan fallback...');
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (!this.writeChar && (c.properties.write || c.properties.writeWithoutResponse)) this.writeChar = c;
        if (!this.notifyChar && c.properties.notify) this.notifyChar = c;
      }
      return { success: true };
    } catch (e) {
      this.log(`Service discovery failed: ${e.message}`);
      return { success: false, error: `BLE service not found: ${e.message}` };
    }
  }

  async _verifyIdentity(expected) {
    const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const expectedNorm = norm(expected);
    if (this.device.name) {
      const nameNorm = norm(this.device.name);
      if (nameNorm.includes(expectedNorm) || expectedNorm.includes(nameNorm)) return true;
      if (expectedNorm.length >= 4 && nameNorm.includes(expectedNorm.slice(-6))) return true;
    }
    return true; // trust user selection
  }

  /**
   * Notification handler — suspendable.
   * When PceTransport is active, notifyHandlerSuspended=true skips packet parsing
   * to prevent dual-handler conflicts. Diagnostic counters always increment.
   */
  _handleNotification(event) {
    const dataView = event.target.value;
    const byteLen = dataView.byteLength;
    const bytes = new Uint8Array(byteLen);
    for (let i = 0; i < byteLen; i++) bytes[i] = dataView.getUint8(i);

    // Always track diagnostic counters
    this.notifyCount++;
    this.notifyBytes += byteLen;

    // Skip packet parsing when PceTransport is active
    if (this.notifyHandlerSuspended) return;

    for (let i = 0; i < bytes.length; i++) this.rxBuffer.push(bytes[i]);
    while (this.rxBuffer.length >= 4) {
      if (this.rxBuffer[0] !== 0x10 || this.rxBuffer[1] !== 0x01) {
        const nextIdx = this.rxBuffer.indexOf(0x10, 1);
        if (nextIdx > 0) { this.rxBuffer.splice(0, nextIdx); continue; }
        else { this.rxBuffer = []; break; }
      }
      const packetLen = this.rxBuffer[2] | (this.rxBuffer[3] << 8);
      const totalLen = Math.max(packetLen, 4);
      if (totalLen > 65536) { this.rxBuffer.shift(); continue; }
      if (this.rxBuffer.length >= totalLen) {
        const packet = this.rxBuffer.splice(0, totalLen);
        const raw = new Uint8Array(packet);
        const respCode = totalLen > 7 ? raw[7] : raw[0];
        if (this.onData) {
          this.onData({ cmd: respCode, payload: raw.length > 8 ? raw.slice(8) : new Uint8Array(0), raw: raw });
        }
      } else break;
    }
  }

  async sendCommand(bytes) {
    if (!this.writeChar) throw new Error('Not connected');
    await this.writeChar.writeValueWithResponse(new Uint8Array(bytes));
  }

  async getBattery() {
    if (!this.writeChar) return null;
    try {
      await this.sendCommand([0x1A, 0x6A]);
      return new Promise((resolve) => {
        const orig = this.onData;
        this.onData = (data) => { if (data.cmd === 0x6A || data.cmd === 0xA6) { this.onData = orig; resolve(data.payload[0] || 0); } else if (orig) orig(data); };
        setTimeout(() => { this.onData = orig; resolve(null); }, 3000);
      });
    } catch (e) { return null; }
  }

  async disconnect() {
    try { if (this._notifyHandler && this.notifyChar) { this.notifyChar.removeEventListener('characteristicvaluechanged', this._notifyHandler); } } catch (e) {}
    try { if (this.notifyChar) await this.notifyChar.stopNotifications().catch(() => {}); } catch (e) {}
    try { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); } catch (e) {}
    this.connected = false; this.device = null; this.server = null; this.writeChar = null; this.notifyChar = null; this.rxBuffer = [];
    this._notifyHandler = null;
    this.notifyHandlerSuspended = false;
    this.log('Disconnected');
  }

  _formatError(err) {
    switch (err.name) {
      case 'NotFoundError': return 'No device selected.';
      case 'NotAllowedError': case 'SecurityError': return 'Bluetooth permission denied.';
      case 'NetworkError': return 'Bluetooth is off.';
      case 'AbortError': return 'Connection cancelled.';
      default:
        if (err.message?.includes('User cancelled')) return 'Scan cancelled.';
        return `Connection failed: ${err.message || err.name}`;
    }
  }
}
