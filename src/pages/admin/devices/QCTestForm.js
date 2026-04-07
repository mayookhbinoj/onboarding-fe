import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Progress } from '../../../components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, Upload, CheckCircle, XCircle, FileText, Camera, Plus, Trash2, Activity, Bluetooth, Battery, AlertTriangle, Smartphone, Play, Square, Copy, Download, Clock, Loader2, CheckCircle2, CircleAlert, ChevronDown, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import ECGViewer from './ECGViewer';
import ECGViewerD3 from './ECGViewerD3';
import { BleDeviceManager, isBleSupported, isSecureContext, isIOS } from './BleModule';
import { QcTestEngine, QC_STATE } from './BleTestRunner';
import { PceTransport, HolterFileFetcher, BuildPacket, selfTest, toHex } from './PceTransport';
import { runSelfTest } from './ProtocolEngine';

// ── Study Artifact State Machine ──
const ARTIFACT_STATE = {
  WAITING: 'WAITING',       // Study not yet completed
  DATA_READY: 'DATA_READY', // Study completed, data available on device
  FETCHING: 'FETCHING',     // Downloading from device
  BSE_SAVED: 'BSE_SAVED',   // BSE auto-fetched and saved to backend
  UPLOADED: 'UPLOADED',     // EDF converted and uploaded
  FAILED: 'FAILED',         // Fetch or upload failed
};

export default function QCTestForm() {
  const { deviceId, testId } = useParams();
  const { api } = useAuth();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [test, setTest] = useState(null);
  const [duration, setDuration] = useState('');
  const [numRuns, setNumRuns] = useState('1');
  const [studyMode, setStudyMode] = useState('HOLTER');
  const [orientation, setOrientation] = useState('HORIZONTAL');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [edfFile, setEdfFile] = useState(null);  // Auto EDF from BLE
  const [manualEdfs, setManualEdfs] = useState([]);  // Manual EDF uploads
  const [evidenceImages, setEvidenceImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [uploadFading, setUploadFading] = useState(false);
  const [expandedImgIdx, setExpandedImgIdx] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showECGViewer, setShowECGViewer] = useState(false);
  const [directEcgArtifact, setDirectEcgArtifact] = useState(null); // For manual EDF view
  // Test Cycles
  const [testCycles, setTestCycles] = useState([]);
  const [showAddCycle, setShowAddCycle] = useState(false);
  const [newCycle, setNewCycle] = useState({ mode: 'HOLTER', orientation: 'HORIZONTAL', duration: '' });
  const [activeCycleIdx, setActiveCycleIdx] = useState(-1);
  const [cycleProgress, setCycleProgress] = useState({});
  // BLE
  const [bleStatus, setBleStatus] = useState('disconnected');
  const [bleError, setBleError] = useState('');
  const [bleBattery, setBleBattery] = useState(null);
  const [showBleModal, setShowBleModal] = useState(false);
  const [bleManager] = useState(() => new BleDeviceManager());
  const [bleLog, setBleLog] = useState('');
  const [bleReady, setBleReady] = useState(false);
  // Test runner
  const [testRunning, setTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState(null);
  const [autoEdfFiles, setAutoEdfFiles] = useState([]);
  const [bleLogs, setBleLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const runnerRef = useRef(null);
  // ── Study Artifacts state ──
  const [studyState, setStudyState] = useState(ARTIFACT_STATE.WAITING);
  const [cycleArtifacts, setCycleArtifacts] = useState({});
  const [fetchingBse, setFetchingBse] = useState(false);
  const [selectedFetchCycle, setSelectedFetchCycle] = useState('1');
  const [fetchProgress, setFetchProgress] = useState(null); // {offset, total}
  const [completedCycles, setCompletedCycles] = useState(new Set());
  const [testStarted, setTestStarted] = useState(false);

  useEffect(() => { loadAll(); }, [deviceId, testId]);

  const loadAll = async () => {
    try {
      const res = await api.get(`/api/devices-module/devices/${deviceId}`);
      setDevice(res.data);
      const qcTest = res.data.qc_tests?.find(t => t._id === testId);
      if (qcTest) {
        setTest(qcTest);
        setDuration(qcTest.test_duration_minutes || '');
        setNumRuns(qcTest.num_runs || '1');
        setNotes(qcTest.notes || '');
        // Restore cycle config from DB
        if (qcTest.cycles_config && qcTest.cycles_config.length > 0) {
          setTestCycles(qcTest.cycles_config.map((c, i) => ({ ...c, id: c.id || Date.now() + i })));
        }
        // Restore study mode/orientation from first cycle
        if (qcTest.cycles_config?.[0]) {
          setStudyMode(qcTest.cycles_config[0].mode || 'HOLTER');
          setOrientation(qcTest.cycles_config[0].orientation || 'HORIZONTAL');
        }
        const autoEdfs = qcTest.artifacts?.filter(a => a.type === 'EDF' && a.cycle) || [];
        const manualEdfsList = qcTest.artifacts?.filter(a => a.type === 'EDF' && !a.cycle) || [];
        const imgs = qcTest.artifacts?.filter(a => a.type === 'IMAGE') || [];
        setEdfFile(autoEdfs[0] || null);
        setManualEdfs(manualEdfsList);
        setEvidenceImages(imgs);
        // If test was started (has artifacts), mark as started
        if ((autoEdfs.length > 0 || imgs.length > 0) && qcTest.result !== 'PASSED' && qcTest.result !== 'NONCONFORMING') {
          setTestStarted(true);
          setStudyState(autoEdfs.length > 0 ? ARTIFACT_STATE.UPLOADED : ARTIFACT_STATE.DATA_READY);
          // Mark completed cycles from existing artifacts
          const completedSet = new Set();
          for (const art of autoEdfs) { if (art.cycle) completedSet.add(art.cycle); }
          setCompletedCycles(completedSet);
        }

        // Populate cycleArtifacts from DB — only auto-registered EDFs carry a cycle field.
        // The artifacts array is sorted oldest→newest (uploaded_at ASC), so iterating in
        // order means the last entry per cycle wins (= most recently uploaded EDF).
        const cycleEdfs = (qcTest.artifacts || []).filter(a => a.type === 'EDF' && a.cycle != null);
        if (cycleEdfs.length > 0) {
          const cycleMap = {};
          for (const art of cycleEdfs) {
            cycleMap[art.cycle] = {
              edfArtifactId: art._id,
              edf: { name: art.file_name, saved: true, duration: art.duration_sec },
              status: 'uploaded',
            };
          }
          // Merge: any in-memory session entry that already has an edfArtifactId
          // (i.e. freshly uploaded this session) takes priority over the DB value.
          setCycleArtifacts(prev => {
            const merged = { ...cycleMap };
            for (const [k, v] of Object.entries(prev)) {
              if (v.edfArtifactId) merged[k] = v;
            }
            return merged;
          });
        }
      }
    } catch (err) {}
  };

  const deleteArtifact = async (artifactId, type) => {
    try { await api.delete(`/api/devices-module/qc-artifacts/${artifactId}`); toast.success(`${type} removed`); loadAll(); } catch (err) { toast.error(err.response?.data?.detail || 'Cannot delete'); }
  };

  // ── BLE Connect ──
  const connectBle = async (scanMode = 'auto') => {
    if (!isBleSupported()) { setShowBleModal(true); return; }
    if (!isSecureContext()) { setBleError('Bluetooth requires HTTPS.'); setBleStatus('error'); return; }
    setBleStatus('scanning'); setBleError(''); setBleLog('');
    
    bleManager.onStatusChange = (msg) => setBleLog(prev => prev ? prev + '\n' + msg : msg);
    bleManager.onDisconnect = () => { setBleStatus('disconnected'); setBleBattery(null); toast.error('BLE device disconnected'); };
    
    const identity = device?.device_mac_id || device?.serial_number || '';
    const result = await bleManager.connect(identity, scanMode);
    
    if (result.success) {
      setBleStatus('connected');
      setBleReady(!!bleManager.writeChar && !!bleManager.notifyChar);
      toast.success(`Connected to ${result.device.name || 'BLE Device'}${bleManager.writeChar ? '' : ' (no write char — manual upload only)'}`);
      // Wait for BLE connection to stabilize before sending ANY commands.
      // Bluefy (iOS Web BLE) disconnects if commands are sent too soon after
      // GATT connect + startNotifications. 2s delay prevents the rapid
      // connect/disconnect cycling.
      await new Promise(r => setTimeout(r, 2000));
      // Battery read is optional — failure must NOT cause disconnect
      try {
        if (bleManager.connected && bleManager.device?.gatt?.connected) {
          const bat = await bleManager.getBattery();
          if (bat !== null) setBleBattery(bat);
        }
      } catch (e) {
        console.log('Battery read skipped:', e.message);
      }
    } else {
      setBleStatus('error');
      setBleReady(false);
      setBleError(result.error);
      if (result.error.includes('not supported') || isIOS()) setShowBleModal(true);
    }
  };

  const disconnectBle = async () => { await bleManager.disconnect(); setBleStatus('disconnected'); setBleBattery(null); setBleLog(''); setBleReady(false); };

  // ── Get the artifact status chip for a cycle ──
  const getCycleStatus = useCallback((cycleNum) => {
    const art = cycleArtifacts[cycleNum];
    if (art?.edf?.saved) return ARTIFACT_STATE.UPLOADED;
    if (art?.bse?.saved || art?.status === 'bse_saved') return ARTIFACT_STATE.BSE_SAVED;
    if (fetchingBse && parseInt(selectedFetchCycle) === cycleNum) return ARTIFACT_STATE.FETCHING;
    if (completedCycles.has(cycleNum)) return ARTIFACT_STATE.DATA_READY;
    if (testStarted) return ARTIFACT_STATE.WAITING;
    return ARTIFACT_STATE.WAITING;
  }, [cycleArtifacts, fetchingBse, selectedFetchCycle, completedCycles, testStarted]);

  // ── Status chip renderer ──
  const StatusChip = ({ status }) => {
    switch (status) {
      case ARTIFACT_STATE.WAITING:
        return <Badge data-testid="status-chip-waiting" variant="outline" className="text-[10px] gap-1 border-amber-200 text-amber-600 bg-amber-50"><Clock className="w-3 h-3" />Waiting for completion</Badge>;
      case ARTIFACT_STATE.DATA_READY:
        return <Badge data-testid="status-chip-data-ready" variant="outline" className="text-[10px] gap-1 border-teal-200 text-teal-700 bg-teal-50"><CheckCircle2 className="w-3 h-3" />Data ready</Badge>;
      case ARTIFACT_STATE.FETCHING:
        return <Badge data-testid="status-chip-fetching" variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/10"><Loader2 className="w-3 h-3 animate-spin" />Auto-fetching...</Badge>;
      case ARTIFACT_STATE.BSE_SAVED:
        return <Badge data-testid="status-chip-bse-saved" variant="outline" className="text-[10px] gap-1 border-teal-200 text-teal-700 bg-teal-50"><CheckCircle className="w-3 h-3" />BSE saved</Badge>;
      case ARTIFACT_STATE.UPLOADED:
        return <Badge data-testid="status-chip-uploaded" variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/10"><CheckCircle className="w-3 h-3" />EDF uploaded</Badge>;
      case ARTIFACT_STATE.FAILED:
        return <Badge data-testid="status-chip-failed" variant="outline" className="text-[10px] gap-1 border-red-200 text-red-600 bg-red-50"><CircleAlert className="w-3 h-3" />Failed</Badge>;
      default:
        return null;
    }
  };

  // ── Start Testing (BLE auto-test) ──
  // Auto-capture ECG screenshot as evidence for a cycle (no UI needed)
  // Auto-capture clean ECG strip screenshot after each cycle's EDF is saved
  const autoCaptureCycleEvidence = async (edfArtifactId, cycleNum) => {
    try {
      // Fetch summary + data
      const [sumRes, dataRes] = await Promise.all([
        api.get(`/api/devices-module/qc-artifacts/${edfArtifactId}/ecg-summary`),
        api.get(`/api/devices-module/qc-artifacts/${edfArtifactId}/ecg-data?start_sec=0&duration_sec=300`),
      ]);
      const sd = sumRes.data;
      const chData = dataRes.data?.channels || [];
      if (!sd?.channels?.length || !chData.length || !chData[0].data?.length) return;

      const totalDur = Math.min(sd.channels[0].duration_sec || 0, 300);
      if (totalDur <= 0) return;

      // Build strips (30s each, max 10)
      const STRIP_SEC = 30;
      const numStrips = Math.min(Math.ceil(totalDur / STRIP_SEC), 10);
      const CHANNEL_H = 120;
      const LABEL_W = 50;
      const STRIP_W = 1200;
      const stripH = CHANNEL_H;
      const totalH = numStrips * stripH;

      const canvas = document.createElement('canvas');
      canvas.width = STRIP_W;
      canvas.height = totalH;
      const ctx = canvas.getContext('2d');

      const ch = chData[0];
      const pps = ch.data.length / (ch.duration_sec || totalDur);

      for (let si = 0; si < numStrips; si++) {
        const startSec = si * STRIP_SEC;
        const dur = Math.min(STRIP_SEC, totalDur - startSec);
        const s0 = Math.floor(startSec * pps);
        const s1 = Math.floor(Math.min((startSec + dur) * pps, ch.data.length));
        const data = ch.data.slice(s0, s1);
        if (!data.length) continue;

        const y0 = si * stripH;
        const traceW = STRIP_W - LABEL_W;
        const pad = 8;
        const traceH = stripH - 2 * pad;
        const mid = y0 + stripH / 2;

        // Background
        ctx.fillStyle = si % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(0, y0, STRIP_W, stripH);

        // Grid
        const pxPerSec = traceW / dur;
        const gridStep = Math.max(pxPerSec / 2.5, 4);
        ctx.strokeStyle = 'rgba(239,68,68,0.07)'; ctx.lineWidth = 0.5;
        for (let gy = y0; gy <= y0 + stripH; gy += gridStep) { ctx.beginPath(); ctx.moveTo(LABEL_W, gy); ctx.lineTo(STRIP_W, gy); ctx.stroke(); }
        for (let gx = LABEL_W; gx <= STRIP_W; gx += gridStep) { ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + stripH); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(239,68,68,0.15)';
        for (let gy = y0; gy <= y0 + stripH; gy += gridStep * 5) { ctx.beginPath(); ctx.moveTo(LABEL_W, gy); ctx.lineTo(STRIP_W, gy); ctx.stroke(); }
        for (let gx = LABEL_W; gx <= STRIP_W; gx += gridStep * 5) { ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + stripH); ctx.stroke(); }

        // Time markers
        ctx.fillStyle = '#94a3b8'; ctx.font = '8px monospace';
        const tick = dur <= 10 ? 1 : dur <= 30 ? 2 : 5;
        for (let s = 0; s <= dur; s += tick) {
          const sx = LABEL_W + s * pxPerSec;
          if (sx > STRIP_W - 20) break;
          const absS = startSec + s;
          ctx.fillText(`${Math.floor(absS / 60)}:${(Math.floor(absS) % 60).toString().padStart(2, '0')}`, sx + 2, y0 + stripH - 3);
        }

        // Label panel
        ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, y0, LABEL_W, stripH);
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(LABEL_W, y0); ctx.lineTo(LABEL_W, y0 + stripH); ctx.stroke();
        ctx.fillStyle = '#2563EB'; ctx.font = 'bold 10px sans-serif';
        ctx.fillText('ECG', 4, y0 + 16);
        ctx.fillStyle = '#475569'; ctx.font = '8px monospace';
        ctx.fillText(`${Math.floor(startSec / 60)}:${(Math.floor(startSec) % 60).toString().padStart(2, '0')}`, 4, y0 + 28);
        ctx.fillText('25mm/s', 4, y0 + 40);

        // Separator
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y0 + stripH); ctx.lineTo(STRIP_W, y0 + stripH); ctx.stroke();

        // Normalize and draw signal
        const sorted = [...data].sort((a, b) => a - b);
        const p10 = sorted[Math.max(0, Math.floor(0.10 * sorted.length))];
        const p90 = sorted[Math.min(sorted.length - 1, Math.floor(0.90 * sorted.length))];
        let mean = (p10 + p90) / 2;
        let maxAbs = Math.max(p90 - mean, mean - p10, 1);

        ctx.save();
        ctx.beginPath(); ctx.rect(LABEL_W, y0 + pad, traceW, traceH); ctx.clip();
        ctx.strokeStyle = '#2563EB'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = LABEL_W + (i / (data.length - 1 || 1)) * traceW;
          const normalized = (data[i] - mean) / maxAbs;
          const y = mid - normalized * (traceH / 2) * 0.25;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Upload
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const sn = device?.serial_number || 'DEV';
        const last3 = sn.slice(-3);
        const cycleMode = testCycles[cycleNum - 1]?.mode || studyMode || 'HOLTER';
        const cycleDur = testCycles[cycleNum - 1]?.duration || '';
        const imgName = `QC-${cycleMode.toUpperCase()}-CYCLE-${cycleNum}-${last3}${cycleDur ? `-${cycleDur}M` : ''}.png`;
        const fd = new FormData();
        fd.append('file', new File([blob], imgName, { type: 'image/png' }));
        fd.append('test_id', testId);
        fd.append('category', `ecg_cycle_${cycleNum}`);
        try {
          const res = await api.post('/api/devices-module/qc-evidence/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (res.data) {
            setEvidenceImages(prev => {
              if (prev.some(img => img.file_name === imgName)) return prev;
              return [...prev, { ...res.data, file_name: imgName }];
            });
            toast.success(`Evidence auto-saved: ${imgName}`);
          }
        } catch (e) { console.error('[QC] Evidence auto-upload failed:', e); }
      }, 'image/png');
    } catch (e) {
      console.error('[QC] Auto-capture evidence failed:', e);
    }
  };

  const startTesting = async () => {
    // REQUIRE at least 1 cycle
    if (testCycles.length === 0) { toast.error('Create at least 1 test cycle before starting'); return; }
    
    // Triple-check BLE readiness
    if (bleStatus !== 'connected') { toast.error('Device not connected. Click "Connect Device" first.'); return; }
    if (!bleManager.connected) { toast.error('BLE connection lost. Please reconnect.'); setBleStatus('disconnected'); return; }
    if (!bleManager.device?.gatt?.connected) { toast.error('GATT disconnected. Please reconnect device.'); setBleStatus('disconnected'); return; }
    if (!bleManager.writeChar) { toast.error('Write characteristic not found. Reconnect device.'); return; }
    if (!bleManager.notifyChar) { toast.error('Notify characteristic not found. Reconnect device.'); return; }

    // Save test metadata
    const totalDuration = testCycles.reduce((sum, c) => sum + c.duration, 0);
    try {
      await api.put(`/api/devices-module/qc-tests/${testId}`, { 
        test_duration_minutes: totalDuration, 
        num_runs: testCycles.length, 
        notes,
        cycles_config: testCycles.map((c, i) => ({ cycle: i + 1, mode: c.mode, orientation: c.orientation, duration: c.duration }))
      });
    } catch (e) {}

    setTestRunning(true);
    setTestStarted(true);
    setAutoEdfFiles([]);
    setBleLogs([]);
    setCompletedCycles(new Set());
    setCycleArtifacts({});
    setStudyState(ARTIFACT_STATE.WAITING);

    // Run cycles sequentially, each with its own settings
    const allFiles = [];
    for (let ci = 0; ci < testCycles.length; ci++) {
      const cycle = testCycles[ci];
      const cycleNum = ci + 1;
      setActiveCycleIdx(ci);
      
      // Set current cycle's params for display
      setStudyMode(cycle.mode);
      setDuration(String(cycle.duration));
      setOrientation(cycle.orientation);
      setNumRuns(String(testCycles.length));

      // Create a fresh runner for THIS cycle with its specific settings
      const runner = new QcTestEngine(bleManager, {
        mode: cycle.mode,
        durationMin: cycle.duration,
        cycles: 1, // Always 1 — we handle multi-cycle ourselves
        samplingRate: 250,
        cableType: 0x09,
        filters: 0x00000203,
        ebcCtrl: 0,
      });
      runnerRef.current = runner;

      runner.onBseFetched = async (_, bseData, fileName, fileSize) => {
        try {
          const now = new Date();
          const ts = `${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}_${String(now.getMinutes()).padStart(2,'0')}_${String(now.getSeconds()).padStart(2,'0')}`;
          const bseFileName = `${cycle.mode}BSE_cycle_${cycleNum}_${ts}.bse`;
          const fd = new FormData();
          fd.append('file', new Blob([bseData], {type:'application/octet-stream'}), bseFileName);
          fd.append('test_id', testId);
          fd.append('cycle', cycleNum.toString());
          fd.append('duration_minutes', cycle.duration.toString());
          fd.append('study_mode', cycle.mode);
          const res = await api.post('/api/bse/upload-and-convert', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          const data = res.data;
          setCycleArtifacts(prev => ({
            ...prev,
            [cycleNum]: {
              bse: { url: data.bse_url, size: data.bse_size, name: data.bse_name, saved: data.bse_saved },
              edf: data.edf_saved ? { url: data.edf_url, size: data.edf_size, name: data.edf_name, saved: true,
                sampleRate: data.sample_rate, duration: data.duration_sec, blocks: data.block_count, samples: data.total_samples } : null,
              edfArtifactId: data.edf_artifact_id || null,
              status: data.edf_saved ? 'uploaded' : 'bse_saved'
            }
          }));
          if (data.edf_auto_registered) {
            toast.success(`Cycle ${cycleNum} (${cycle.mode} ${cycle.duration}min): BSE + EDF saved`);
            allFiles.push(data);
            loadAll();
            // Auto-capture ECG screenshot as evidence for this cycle
            if (data.edf_artifact_id) {
              autoCaptureCycleEvidence(data.edf_artifact_id, cycleNum);
            }
          }
        } catch (e) {
          toast.error(`Cycle ${cycleNum} BSE upload failed: ${e.message}`);
        }
      };
      
      // Progress with correct cycle number
      runner.onProgress = (info) => setTestProgress({ ...info, cycle: cycleNum, totalCycles: testCycles.length });
      runner.onLog = (entry) => setBleLogs(prev => [...prev, entry]);
      
      // Start progress bar ONLY when device ACKs start (RUNNING state)
      let progressTimer = null;
      runner.onStateChange = (state) => {
        if (state === QC_STATE.RUNNING) {
          // Device started recording — NOW start the linear bar
          setCycleProgress(prev => ({ ...prev, [ci]: { elapsed: 0, total: cycle.duration * 60, active: true } }));
          progressTimer = setInterval(() => {
            setCycleProgress(prev => {
              const cur = prev[ci]?.elapsed || 0;
              if (cur >= cycle.duration * 60) { clearInterval(progressTimer); return prev; }
              return { ...prev, [ci]: { elapsed: cur + 1, total: cycle.duration * 60, active: true } };
            });
          }, 1000);
        }
        if (state === QC_STATE.DATA_READY) {
          // Recording ended — fill bar to 100% and stop
          if (progressTimer) clearInterval(progressTimer);
          setCycleProgress(prev => ({ ...prev, [ci]: { elapsed: cycle.duration * 60, total: cycle.duration * 60, active: false } }));
          setStudyState(ARTIFACT_STATE.DATA_READY);
        }
      };
      runner.onDataReady = () => {
        setCompletedCycles(prev => new Set([...prev, cycleNum]));
      };
      runner.onError = (msg) => { if (progressTimer) clearInterval(progressTimer); toast.error(`Cycle ${cycleNum}: ${msg}`); };

      // Run this cycle and WAIT for completion
      try {
        await runner.run();
      } catch (err) {
        console.error(`Cycle ${cycleNum} error:`, err);
        toast.error(`Cycle ${cycleNum} failed: ${err.message}`);
      }
      
      if (progressTimer) clearInterval(progressTimer);
      setCycleProgress(prev => ({ ...prev, [ci]: { elapsed: cycle.duration * 60, total: cycle.duration * 60, active: false } }));
    }

    // All cycles complete
    setActiveCycleIdx(testCycles.length);
    setTestRunning(false);
    const allCycleNums = new Set();
    for (let i = 1; i <= testCycles.length; i++) allCycleNums.add(i);
    setCompletedCycles(allCycleNums);
    setStudyState(ARTIFACT_STATE.DATA_READY);
    toast.success(`All ${testCycles.length} cycle(s) complete!`);
  };

  const stopTesting = async () => {
    if (runnerRef.current) { await runnerRef.current.stop(); }
    setTestRunning(false);
    // After stopping, if any cycles completed, mark data as ready
    if (completedCycles.size > 0) {
      setStudyState(ARTIFACT_STATE.DATA_READY);
    }
  };

  // ── Determine if Fetch BSE should be enabled ──
  const isFetchBseEnabled = useCallback(() => {
    // Must be connected
    if (bleStatus !== 'connected') return false;
    // Must not be currently fetching
    if (fetchingBse) return false;
    // Must have completed study (data ready) OR manual override (allow if test hasn't started)
    const cycleNum = parseInt(selectedFetchCycle) || 1;
    if (completedCycles.has(cycleNum)) return true;
    // Also allow if study state is DATA_READY (all cycles done)
    if (studyState === ARTIFACT_STATE.DATA_READY) return true;
    // Allow manual fetch if no test is running and user explicitly wants to try
    // (e.g., study was run externally)
    if (!testRunning && !testStarted) return true;
    return false;
  }, [bleStatus, fetchingBse, selectedFetchCycle, completedCycles, studyState, testRunning, testStarted]);

  // ── Fetch BSE from device for a specific cycle ──
  // Uses PceTransport + HolterFileFetcher (correct RX-PCE protocol)
  const fetchBseForCycle = async () => {
    if (bleStatus !== 'connected') { toast.error('Connect device first'); return; }
    if (!bleManager.writeChar || !bleManager.notifyChar) { toast.error('BLE characteristics not ready. Reconnect.'); return; }

    const cycle = parseInt(selectedFetchCycle) || 1;
    setFetchingBse(true);
    setFetchProgress(null);
    setStudyState(ARTIFACT_STATE.FETCHING);
    
    // Update cycle status
    setCycleArtifacts(prev => ({
      ...prev,
      [cycle]: { ...prev[cycle], status: 'fetching' }
    }));
    
    try {
      // Create PceTransport + HolterFileFetcher (correct protocol stack)
      const transport = new PceTransport(bleManager);
      transport.onLog = (dir, msg) => {
        setBleLogs(prev => [...prev, { time: new Date().toISOString(), dir, hex: '', desc: msg, status: '' }]);
      };
      // Wire RX diagnostic callback
      transport.onRawNotify = (raw, count, totalBytes) => {
        if (count <= 3 || count % 50 === 0) {
          setBleLogs(prev => [...prev, { time: new Date().toISOString(), dir: 'RX-RAW', hex: toHex(raw.slice(0, Math.min(raw.length, 20))), desc: `Notify #${count} (${raw.length}B, total ${totalBytes}B)`, status: '' }]);
        }
      };
      const wired = transport.wireNotify();
      if (!wired) {
        toast.error('Failed to wire BLE notify listener. Reconnect device.');
        setFetchingBse(false);
        return;
      }

      const fetcher = new HolterFileFetcher(transport);
      fetcher.onProgress = (offset, total) => {
        setFetchProgress({ offset, total });
      };
      fetcher.onLog = (msg) => {
        setBleLogs(prev => [...prev, { time: new Date().toISOString(), dir: '--', hex: '', desc: msg, status: '' }]);
      };

      // ── Execute the Holter file download ──
      const result = await fetcher.GetHolterFileAndSaveBSE();

      if (result.success && result.buffer && result.buffer.length > 0) {
        const bseData = result.buffer;
        const now = new Date();
        const ts = `${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}_${String(now.getMinutes()).padStart(2,'0')}_${String(now.getSeconds()).padStart(2,'0')}`;
        const bseFileName = `HolterBSE_cycle_${cycle}_${ts}.bse`;

        // Upload BSE to backend
        const fd = new FormData();
        fd.append('file', new Blob([bseData], {type:'application/octet-stream'}), bseFileName);
        fd.append('test_id', testId);
        fd.append('cycle', cycle.toString());
        fd.append('duration_minutes', (parseInt(duration) || 0).toString());
        fd.append('study_mode', studyMode);

        const res = await api.post('/api/bse/upload-and-convert', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const data = res.data;
        
        setCycleArtifacts(prev => ({
          ...prev,
          [cycle]: {
            bse: { url: data.bse_url, size: data.bse_size, name: data.bse_name, saved: data.bse_saved },
            edf: data.edf_saved ? { url: data.edf_url, size: data.edf_size, name: data.edf_name, saved: true,
              sampleRate: data.sample_rate, duration: data.duration_sec, blocks: data.block_count, samples: data.total_samples } : null,
            status: 'uploaded'
          }
        }));
        
        // Auto-upload EDF as QC artifact
        if (data.edf_saved && data.edf_url) {
          try {
            const edfResp = await fetch(`${process.env.REACT_APP_BACKEND_URL}${data.edf_url}`);
            const edfBlob = await edfResp.blob();
            const edfFd = new FormData();
            edfFd.append('artifact_type', 'EDF');
            edfFd.append('file', edfBlob, data.edf_name);
            await api.post(`/api/devices-module/qc-tests/${testId}/artifacts`, edfFd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(`Cycle ${cycle}: BSE fetched (${(bseData.length/1024).toFixed(1)}KB) + EDF converted + uploaded!`);
            loadAll();
          } catch (e) { toast.success(`BSE fetched + EDF converted. Manual upload may be needed.`); }
        } else {
          toast.success(`Cycle ${cycle}: BSE fetched (${(bseData.length/1024).toFixed(1)}KB). EDF conversion had issues.`);
        }

        // ── Optional: delete holter file from device ──
        const deleted = await fetcher.deleteHolterFile();
        if (!deleted) {
          setBleLogs(prev => [...prev, { time: new Date().toISOString(), dir: 'WARN', hex: '', desc: 'Device file delete failed — warning only', status: 'warn' }]);
        }

        setStudyState(ARTIFACT_STATE.BSE_SAVED);
      } else {
        // Fetch failed
        setCycleArtifacts(prev => ({
          ...prev,
          [cycle]: { ...prev[cycle], status: 'failed', error: result.error }
        }));
        setStudyState(ARTIFACT_STATE.FAILED);
        toast.error(`Fetch failed: ${result.error || 'No data received'}`);
      }

      // Cleanup transport
      transport.unwireNotify();

    } catch (err) {
      setCycleArtifacts(prev => ({
        ...prev,
        [cycle]: { ...prev[cycle], status: 'failed', error: err.message }
      }));
      setStudyState(ARTIFACT_STATE.FAILED);
      toast.error(`Fetch error: ${err.message}`);
    }
    setFetchingBse(false);
    setFetchProgress(null);
  };

  // ── Manual save + actions ──
  const saveTestData = async () => {
    const totalDur = testCycles.length > 0 ? testCycles.reduce((s, c) => s + c.duration, 0) : parseInt(duration) || 0;
    try {
      await api.put(`/api/devices-module/qc-tests/${testId}`, {
        test_duration_minutes: totalDur,
        num_runs: testCycles.length || parseInt(numRuns) || 1,
        notes,
        cycles_config: testCycles.map((c, i) => ({ cycle: i + 1, mode: c.mode, orientation: c.orientation, duration: c.duration, id: c.id }))
      });
      toast.success('Saved');
    } catch (e) { toast.error('Failed'); }
  };

  const uploadArtifact = async (type, file) => {
    setUploading(true);
    const fd = new FormData(); fd.append('artifact_type', type); fd.append('file', file);
    try { const res = await api.post(`/api/devices-module/qc-tests/${testId}/artifacts`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); if (type === 'EDF') setEdfFile(res.data); else setEvidenceImages(prev => [...prev, res.data]); toast.success(`${type} uploaded`); } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
    setUploading(false);
  };

  const markPassed = async () => {
    await saveTestData(); setSubmitting(true);
    try { await api.post(`/api/devices-module/qc-tests/${testId}/pass`); toast.success('QC PASSED!'); navigate('/admin/devices/qc-queue'); } catch (err) { toast.error(err.response?.data?.detail || 'Cannot mark passed'); }
    setSubmitting(false);
  };

  const markNonconforming = async () => {
    if (!reason.trim()) { toast.error('Reason required'); return; }
    await saveTestData(); setSubmitting(true);
    try { await api.post(`/api/devices-module/qc-tests/${testId}/nonconforming`, { reason }); toast.success('Marked Nonconforming'); navigate('/admin/devices/qc-queue'); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  const copyLogs = () => {
    const text = bleLogs.map(l => `${l.time} [${l.dir}] ${l.hex} ${l.desc}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast.success('Logs copied')).catch(() => {
      const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); toast.success('Logs copied');
    });
  };

  if (!device) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  const BACKEND = process.env.REACT_APP_BACKEND_URL;
  const totalCycles = testCycles.length || parseInt(numRuns) || 1;
  const progressPct = testProgress ? (
    !testRunning && completedCycles.size >= totalCycles
      ? 100
      : ((testProgress.cycle - 1) / testProgress.totalCycles * 100) + (testRunning ? 50 / testProgress.totalCycles : 0)
  ) : 0;

  const addCycle = () => {
    if (!newCycle.duration || parseInt(newCycle.duration) < 1) { toast.error('Duration must be at least 1 minute'); return; }
    setTestCycles(prev => [...prev, { ...newCycle, duration: parseInt(newCycle.duration), id: Date.now() }]);
    setNewCycle({ mode: 'HOLTER', orientation: 'HORIZONTAL', duration: '' });
    setShowAddCycle(false);
  };
  const removeCycle = (idx) => setTestCycles(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <style>{`@keyframes shimmerSweep { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/devices/qc-queue')} data-testid="back-button"><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>QC/QA Test</h1>
          <p className="text-sm text-muted-foreground font-mono">{device.serial_number} — {device.device_type_name} — {device.model_number}</p>
        </div>
        <Badge variant="outline" className="text-xs bg-primary/10 text-primary">QC In Progress</Badge>
      </div>

      {/* BLE Connection */}
      <Card className={bleStatus === 'connected' ? 'border-primary/30' : ''} data-testid="ble-connection-card">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bluetooth className="w-4 h-4" /> Device Connection {bleStatus === 'connected' && <Badge className="bg-primary/10 text-primary text-[10px]">Connected</Badge>}{bleBattery !== null && <Badge variant="outline" className="text-[10px] gap-1"><Battery className="w-3 h-3" />{bleBattery}%</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {device?.device_mac_id && <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"><span className="text-xs text-muted-foreground">Target MAC:</span><span className="text-xs font-mono font-bold">{device.device_mac_id}</span></div>}

          {/* Disconnected — show connect buttons */}
          {bleStatus === 'disconnected' && (
            <div className="space-y-2">
              <Button onClick={() => connectBle('auto')} className="w-full h-11" data-testid="connect-device-btn"><Bluetooth className="w-4 h-4 mr-2" /> Connect Device</Button>
              <Button variant="outline" onClick={() => connectBle('open')} className="w-full h-9 text-xs text-muted-foreground" data-testid="scan-all-btn">
                Device not found? → Scan All Nearby Devices
              </Button>
            </div>
          )}

          {/* Scanning */}
          {bleStatus === 'scanning' && (
            <div className="space-y-2">
              <Button disabled className="w-full h-11"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Scanning for devices...</Button>
              <p className="text-[10px] text-muted-foreground text-center">The browser device picker will appear. Select your BeatX device.</p>
            </div>
          )}

          {/* Connecting */}
          {bleStatus === 'connecting' && (
            <Button disabled className="w-full h-11"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Connecting to device...</Button>
          )}

          {/* Connected */}
          {bleStatus === 'connected' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 p-2 bg-primary/10 rounded-lg text-xs text-primary flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Connected to <strong>{bleManager.device?.name || 'BLE Device'}</strong></span>
                  {bleManager.notificationsEnabled && <Badge variant="outline" className="text-[10px] bg-primary/15 border-primary/40">Notify ON</Badge>}
                  {!bleManager.notificationsEnabled && <Badge variant="outline" className="text-[10px] bg-red-100 border-red-300 text-red-700">Notify OFF</Badge>}
                </div>
                <Button variant="outline" size="sm" onClick={disconnectBle} data-testid="disconnect-btn">Disconnect</Button>
              </div>
              {/* RX diagnostic info */}
              <div className="flex items-center gap-3 p-1.5 bg-muted/30 rounded text-[10px] text-muted-foreground font-mono">
                <span>RX: {bleManager.notifyCount} notifies</span>
                <span>{(bleManager.notifyBytes / 1024).toFixed(1)} KB</span>
                {!bleManager.notificationsEnabled && <span className="text-red-500 font-semibold">CCCD not enabled - RX will fail!</span>}
              </div>
            </div>
          )}

          {/* Error with troubleshooting */}
          {bleStatus === 'error' && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div><p className="font-medium">{bleError}</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => connectBle('auto')}>Retry</Button>
                <Button variant="outline" size="sm" onClick={() => connectBle('open')}>Scan All Devices</Button>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Troubleshooting:</p>
                <p>• Ensure the device is <strong>powered ON</strong> and in range (&lt;2m)</p>
                <p>• Disconnect the device from any <strong>phone or other app</strong></p>
                <p>• Check that <strong>Bluetooth is enabled</strong> in Windows Settings</p>
                <p>• Try "Scan All Devices" to see all nearby BLE devices</p>
                <p>• If still not found, restart the device and try again</p>
              </div>
            </div>
          )}

          {/* Connection log (collapsible) */}
          {bleLog && (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Connection log</summary>
              <pre className="mt-1 p-2 bg-slate-950 text-slate-300 rounded text-[9px] max-h-32 overflow-y-auto whitespace-pre-wrap">{bleLog}</pre>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Test Cycles */}
      <Card data-testid="test-parameters-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Test Cycles</CardTitle>
            {!testRunning && <Button variant="outline" size="sm" onClick={() => setShowAddCycle(true)}><Plus className="w-3 h-3 mr-1" /> Create Cycle</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {testCycles.length === 0 && !showAddCycle && (
            <div className="text-center py-6 text-muted-foreground"><p className="text-sm">No cycles configured</p><p className="text-xs mt-1">Click "Create Cycle" to add test cycles</p></div>
          )}
          {testCycles.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{c.mode}</Badge>
                  <Badge variant="outline" className="text-[10px]">{c.orientation}</Badge>
                  <span className="text-xs font-medium">{c.duration} min</span>
                </div>
                {activeCycleIdx === idx && testRunning && (
                  <div className="mt-2"><div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear" style={{ width: `${Math.min(100, ((cycleProgress[idx]?.elapsed || 0) / (c.duration * 60)) * 100)}%` }} /></div><p className="text-[10px] text-muted-foreground mt-1">{cycleProgress[idx]?.elapsed || 0}s / {c.duration * 60}s</p></div>
                )}
                {activeCycleIdx > idx && <div className="flex items-center gap-1 mt-1 text-primary"><CheckCircle className="w-3 h-3" /><span className="text-[10px]">Completed</span></div>}
              </div>
              {!testRunning && <button onClick={() => removeCycle(idx)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          {showAddCycle && (
            <div className="p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={newCycle.mode} onValueChange={v => setNewCycle({...newCycle, mode: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="HOLTER">Holter</SelectItem><SelectItem value="MCT">MCT</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Orientation</Label><Select value={newCycle.orientation} onValueChange={v => setNewCycle({...newCycle, orientation: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="HORIZONTAL">Horizontal</SelectItem><SelectItem value="VERTICAL">Vertical</SelectItem><SelectItem value="FINGER">Finger</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Duration (min)</Label><Input type="number" value={newCycle.duration} onChange={e => setNewCycle({...newCycle, duration: e.target.value})} placeholder="e.g., 5" min="1" className="h-9" /></div>
              </div>
              <div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={() => setShowAddCycle(false)}>Cancel</Button><Button size="sm" onClick={addCycle} disabled={!newCycle.duration || parseInt(newCycle.duration) < 1}>Add Cycle</Button></div>
            </div>
          )}
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={testRunning} /></div>
          <div className="flex gap-2">
            {!testRunning ? (
              <Button onClick={() => startTesting()} disabled={testCycles.length === 0 || bleStatus !== 'connected'} className="flex-1 h-11 bg-primary hover:bg-primary/90" data-testid="start-testing-btn">
                <Play className="w-4 h-4 mr-2" /> {bleStatus !== 'connected' ? 'Connect Device First' : testCycles.length === 0 ? 'Add Cycles First' : `Start Testing (${testCycles.length} cycle${testCycles.length > 1 ? 's' : ''})`}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopTesting} className="flex-1 h-11" data-testid="stop-testing-btn"><Square className="w-4 h-4 mr-2" /> Cancel Study</Button>
            )}
            {!testRunning && testCycles.length > 0 && <Button variant="outline" onClick={saveTestData} data-testid="save-params-btn">Save</Button>}
          </div>

          {/* Progress */}
          {testProgress && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">{testProgress.message}</p>
                {testRunning && <Badge variant="outline" className="text-[10px] animate-pulse">Running</Badge>}
              </div>
              <Progress value={progressPct} className="h-2" />
              <p className="text-[10px] text-muted-foreground">
                {!testRunning && completedCycles.size >= totalCycles
                  ? `All ${totalCycles} cycle(s) complete`
                  : `${studyMode} • Cycle ${testProgress.cycle}/${testProgress.totalCycles}${testProgress.rxPackets ? ` • ${testProgress.rxPackets} pkts / ${(testProgress.rxBytes / 1024).toFixed(1)} KB` : ''}`}
              </p>
              {studyMode === 'MCT' && (
                <p className="text-[10px] text-primary">MCT mode: recording {parseInt(duration)} x 1-minute blocks</p>
              )}
            </div>
          )}

          {/* Auto-generated EDF files */}
          {autoEdfFiles.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium mb-2">Auto-Generated EDF Files ({autoEdfFiles.length})</p>
              <div className="space-y-1">
                {autoEdfFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg text-xs">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-mono flex-1">{f.name}</span>
                    <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    <Badge className="bg-primary/15 text-primary text-[10px]">Uploaded</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Study Artifacts — Auto BSE fetch + Auto EDF conversion ═══ */}
      <Card data-testid="study-artifacts-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Study Artifacts</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Planned cycles: {totalCycles}</span>
              <StatusChip status={studyState} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[10px] text-muted-foreground">
            BSE is auto-fetched from the device after study completion. EDF is auto-generated by the backend.
          </p>

          {/* Fetch progress bar (shown during auto-fetch) */}
          {fetchProgress && (
            <div className="space-y-1">
              <Progress value={fetchProgress.total > 0 ? (fetchProgress.offset / fetchProgress.total) * 100 : 0} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                Auto-fetching: {(fetchProgress.offset / 1024).toFixed(1)} / {(fetchProgress.total / 1024).toFixed(1)} KB
              </p>
            </div>
          )}

          {/* Per-cycle EDF rows — selectable for View ECG */}
          <div className="space-y-2" data-testid="cycle-status-rows">
            {Array.from({ length: totalCycles }, (_, i) => i + 1).map(c => {
              const art = cycleArtifacts[c];
              const status = getCycleStatus(c);
              const edfReady = art?.edf?.saved || (art?.edfArtifactId);
              const isSelected = selectedFetchCycle === String(c);
              return (
                <div
                  key={c}
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-sm cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50'}`}
                  data-testid={`cycle-row-${c}`}
                  onClick={() => setSelectedFetchCycle(String(c))}
                >
                  <input
                    type="radio"
                    name="cycle-select"
                    checked={isSelected}
                    onChange={() => setSelectedFetchCycle(String(c))}
                    className="w-3.5 h-3.5 accent-primary"
                    disabled={!edfReady}
                  />
                  <span className="font-mono font-bold text-xs w-16">Cycle {c}</span>
                  <StatusChip status={status} />
                  {art?.bse?.saved && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary">
                      <FileText className="w-3 h-3" /> BSE {art.bse.size ? `${(art.bse.size/1024).toFixed(0)}KB` : ''}
                    </Badge>
                  )}
                  {(art?.edf?.saved || art?.edfArtifactId) && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary">
                      <Activity className="w-3 h-3" /> EDF {art.edf?.duration ? `${art.edf.duration}s` : 'ready'}
                    </Badge>
                  )}
                  {art?.is30sRepeated && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200">
                      <AlertTriangle className="w-3 h-3" /> 30s repeat
                    </Badge>
                  )}
                  {art?.status === 'failed' && art?.error && (
                    <span className="text-[10px] text-red-500 truncate max-w-[200px]">{art.error}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* View ECG for selected cycle */}
          {(() => {
            const selCycle = parseInt(selectedFetchCycle) || 1;
            const art = cycleArtifacts[selCycle];
            const hasEdf = art?.edf?.saved || art?.edfArtifactId;
            return (
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  className="flex-1 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => {
                    // If we have an auto-registered artifact, use it; otherwise use the first uploaded EDF
                    if (art?.edfArtifactId) {
                      setShowECGViewer(true);
                    } else if (edfFile) {
                      setShowECGViewer(true);
                    } else {
                      toast.error('No EDF available for this cycle yet.');
                    }
                  }}
                  disabled={!hasEdf && !edfFile}
                  data-testid="view-ecg-btn"
                >
                  <Activity className="w-4 h-4 mr-2" /> View ECG {hasEdf ? `(Cycle ${selCycle})` : ''}
                </Button>
                {hasEdf && art?.edf?.url && (
                  <a href={`${BACKEND}${art.edf.url}`} download className="text-xs text-primary underline">Download EDF</a>
                )}
              </div>
            );
          })()}

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{studyMode}</Badge>
            {!testStarted && !fetchingBse && Object.keys(cycleArtifacts).length === 0 && (
              <span className="text-[10px] text-muted-foreground">Start a study to generate artifacts</span>
            )}
            {testStarted && !fetchingBse && Object.keys(cycleArtifacts).length === 0 && (
              <span className="text-[10px] text-amber-600">BSE will auto-fetch when study completes</span>
            )}
            {fetchingBse && <span className="text-[10px] text-primary">Auto-fetching from device...</span>}
          </div>

          {/* Manual device fetch fallback (no manual BSE upload per E14) */}
          {!testRunning && bleStatus === 'connected' && !fetchingBse && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={fetchBseForCycle}
              disabled={fetchingBse}
              data-testid="manual-fetch-bse-btn"
            >
              <Bluetooth className="w-3 h-3 mr-1" /> Fetch from device
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Evidence Images */}
      <Card data-testid="evidence-images-card">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Camera className="w-4 h-4" /> Test Evidence Images ({evidenceImages.length})</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">Upload photos of the device, test setup, or any relevant evidence. Click any image to preview.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {evidenceImages.map((img, idx) => (
              <div key={img._id || idx} className="relative group">
                <div className="border-2 border-primary/30 rounded-xl overflow-hidden bg-primary/5 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50" onClick={() => setExpandedImgIdx(idx)}>
                  <img src={`${BACKEND}${img.file_url}`} alt={img.file_name} className="w-full h-28 object-cover" />
                  <div className="p-2 flex items-center justify-between">
                    <p className="text-[10px] font-medium text-primary truncate flex-1">{img.file_name}</p>
                    <Eye className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteArtifact(img._id, 'Evidence'); }} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
            <label className="cursor-pointer"><div className="border-2 border-dashed rounded-xl h-full min-h-[140px] flex flex-col items-center justify-center p-3 hover:border-primary/50"><Plus className="w-8 h-8 text-muted-foreground/40 mb-1" /><p className="text-xs text-muted-foreground">Add Image</p></div><input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={e => e.target.files[0] && uploadArtifact('IMAGE', e.target.files[0])} disabled={uploading} /></label>
          </div>

          {/* Full-screen image modal */}
          {expandedImgIdx !== null && evidenceImages[expandedImgIdx] && (() => {
            const img = evidenceImages[expandedImgIdx];
            return (
              <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-white truncate max-w-[300px]">{img.file_name}</p>
                    <Badge variant="outline" className="text-[9px] text-white/60 border-white/20">{expandedImgIdx + 1} / {evidenceImages.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 h-8 gap-1.5" onClick={() => { const a = document.createElement('a'); a.href = `${BACKEND}${img.file_url}`; a.download = img.file_name; a.click(); }}>
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                    <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8" onClick={() => setExpandedImgIdx(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {/* Navigation + Image */}
                <div className="flex-1 flex items-center justify-center relative overflow-auto p-4">
                  {expandedImgIdx > 0 && (
                    <button onClick={() => setExpandedImgIdx(expandedImgIdx - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <img src={`${BACKEND}${img.file_url}`} alt={img.file_name} className="max-w-full max-h-full object-contain rounded-lg" style={{ maxHeight: 'calc(100vh - 120px)' }} />
                  {expandedImgIdx < evidenceImages.length - 1 && (
                    <button onClick={() => setExpandedImgIdx(expandedImgIdx + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {/* Thumbnail strip */}
                <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto shrink-0" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  {evidenceImages.map((thumb, ti) => (
                    <button key={ti} onClick={() => setExpandedImgIdx(ti)} className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all ${ti === expandedImgIdx ? 'border-primary opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                      <img src={`${BACKEND}${thumb.file_url}`} alt="" className="w-14 h-10 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Manual EDF Upload — fallback when BLE fails */}
      <Card data-testid="manual-edf-upload">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Manual EDF Upload {manualEdfs.length > 0 && <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]">{manualEdfs.length} file{manualEdfs.length > 1 ? 's' : ''}</Badge>}</CardTitle>
            <Badge variant="outline" className="text-[10px]">Optional</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">If BLE fails, upload EDF files manually to complete QC.</p>
          {manualEdfs.map((f, idx) => (
            <div key={f._id || idx} className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{f.file_name}</p>
                <p className="text-[10px] text-muted-foreground">{f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : 'EDF'}</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => { setDirectEcgArtifact({ id: f._id, name: f.file_name }); setShowECGViewer(true); }}>View ECG</Button>
              <button onClick={async () => { try { await api.delete(`/api/devices-module/qc-tests/${testId}/artifacts/${f._id}`); setManualEdfs(prev => prev.filter(e => e._id !== f._id)); toast.success('Deleted'); } catch { toast.error('Failed'); } }} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <label className="cursor-pointer">
            <div className="relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center hover:border-primary/50 transition-colors overflow-hidden" style={{ minHeight: 100 }}>
              {/* Premium shimmer overlay */}
              {uploading && (
                <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-700 ${uploadFading ? 'opacity-0' : 'opacity-100'}`}>
                  {/* Progress fill */}
                  <div className="absolute inset-0 bg-primary/8 transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                  {/* Shimmer sweep */}
                  <div className="absolute inset-0" style={{
                    background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.12) 40%, hsl(var(--primary) / 0.25) 50%, hsl(var(--primary) / 0.12) 60%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmerSweep 1.8s ease-in-out infinite',
                  }} />
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-sm font-semibold text-primary">{uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing...'}</p>
                    {/* Mini progress bar */}
                    <div className="w-40 h-1 bg-primary/10 rounded-full mt-2 overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} /></div>
                  </div>
                </div>
              )}
              <Upload className="w-7 h-7 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Click to upload EDF or TXT file</p>
              <p className="text-[10px] text-muted-foreground mt-1">Accepts .edf, .txt files • Add multiple</p>
            </div>
            <input type="file" accept=".edf,.txt" className="hidden" onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return;
              setUploading(true); setUploadProgress(0); setUploadFading(false);
              try { const fd = new FormData(); fd.append('file', file); fd.append('artifact_type', 'EDF');
                const res = await api.post(`/api/devices-module/qc-tests/${testId}/artifacts`, fd, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  onUploadProgress: (p) => { if (p.total) setUploadProgress(Math.round((p.loaded / p.total) * 100)); }
                });
                setUploadProgress(100);
                setUploadFading(true);
                setTimeout(() => { setUploading(false); setUploadProgress(0); setUploadFading(false); }, 800);
                setManualEdfs(prev => [...prev, res.data]); toast.success(`Uploaded: ${file.name}`);
              } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); setUploading(false); setUploadProgress(0); } e.target.value = '';
            }} disabled={uploading} />
          </label>
        </CardContent>
      </Card>

      {/* Nonconformance */}
      <Card data-testid="nonconformance-card">
        <CardHeader><CardTitle className="text-sm text-rose-700">Nonconformance (if applicable)</CardTitle></CardHeader>
        <CardContent><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the issue..." rows={3} data-testid="nonconformance-reason" /></CardContent>
      </Card>

      {/* BLE Packet Log */}
      {bleLogs.length > 0 && (
        <Card data-testid="ble-log-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">BLE Command Log ({bleLogs.length})</CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" data-testid="self-test-btn" onClick={() => {
                  // Run BOTH test suites
                  const pceResults = selfTest();
                  const engineResults = runSelfTest();
                  const allResults = [...pceResults, ...engineResults];
                  allResults.forEach(r => setBleLogs(prev => [...prev, { time: new Date().toISOString(), dir: r.pass ? 'OK' : 'FAIL', hex: r.actual, desc: r.name, status: r.pass ? 'ok' : `EXPECTED: ${r.expected}` }]));
                  const passed = allResults.filter(r => r.pass).length;
                  toast[passed === allResults.length ? 'success' : 'error'](`Self-test: ${passed}/${allResults.length} passed`);
                }}>Self Test</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copyLogs} data-testid="copy-logs-btn"><Copy className="w-3 h-3 mr-1" /> Copy</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowLogs(!showLogs)} data-testid="toggle-logs-btn">{showLogs ? 'Hide' : 'Show'}</Button>
              </div>
            </div>
          </CardHeader>
          {showLogs && (
            <CardContent>
              <div className="max-h-60 overflow-y-auto font-mono text-[10px] space-y-0.5 bg-slate-950 text-slate-300 rounded-lg p-3" data-testid="ble-log-output">
                {bleLogs.map((l, i) => (
                  <div key={i} className={`flex gap-2 ${l.dir === 'TX' ? 'text-cyan-400' : l.dir === 'RX' ? 'text-emerald-400' : l.dir === 'ERR' || l.dir === 'FAIL' ? 'text-red-400' : l.dir === 'EV' ? 'text-amber-400' : l.dir === 'OK' ? 'text-emerald-500' : 'text-slate-500'}`}>
                    <span className="text-slate-600 shrink-0">{l.time?.split('T')[1]?.slice(0, 12)}</span>
                    <span className="w-6 shrink-0">[{l.dir}]</span>
                    <span className="truncate flex-1">{l.hex?.slice(0, 50)}{(l.hex?.length || 0) > 50 ? '...' : ''}</span>
                    <span className="text-slate-400 shrink-0">{l.desc}</span>
                    {l.status && <span className={`shrink-0 ${l.status === 'ok' ? 'text-emerald-500' : l.status === 'timeout' ? 'text-amber-500' : l.status === 'error' ? 'text-red-500' : 'text-slate-500'}`}>{l.status}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="destructive" onClick={markNonconforming} disabled={submitting} data-testid="mark-nonconforming-btn"><XCircle className="w-4 h-4 mr-1" /> Mark Nonconforming</Button>
        <Button onClick={markPassed} disabled={submitting || (!duration && manualEdfs.length === 0)} data-testid="mark-passed-btn"><CheckCircle className="w-4 h-4 mr-1" /> Mark QC Passed</Button>
      </div>

      {/* ECG Viewer — uses selected cycle's EDF artifact or direct manual EDF */}
      {showECGViewer && (() => {
        // Determine artifact
        let artId, artName;
        if (directEcgArtifact) {
          artId = directEcgArtifact.id;
          artName = directEcgArtifact.name;
        } else {
          const selCycle = parseInt(selectedFetchCycle) || 1;
          const art = cycleArtifacts[selCycle];
          artId = art?.edfArtifactId || edfFile?._id;
          artName = art?.edf?.name || edfFile?.file_name || 'ECG';
          if (!artId && test?.artifacts?.length) {
            const firstEdf = test.artifacts.find(a => a.type === 'EDF');
            if (firstEdf) { artId = firstEdf._id; artName = firstEdf.file_name || 'ECG'; }
          }
          if (!artId) {
            const allArts = Object.values(cycleArtifacts);
            for (const ca of allArts) {
              if (ca?.edfArtifactId) { artId = ca.edfArtifactId; artName = ca.edf?.name || 'ECG'; break; }
            }
          }
          if (!artId && manualEdfs.length > 0) { artId = manualEdfs[0]._id; artName = manualEdfs[0].file_name || 'ECG'; }
          if (artName && !directEcgArtifact) artName = `${artName} (Cycle ${parseInt(selectedFetchCycle) || 1})`;
        }
        if (!artId) return <div className="p-6 text-center text-muted-foreground">No EDF file available. <button onClick={() => setShowECGViewer(false)} className="underline text-primary ml-1">Go back</button></div>;
        // Use D3 viewer for TXT files, original for EDF
        const isTxt = (artName || '').toLowerCase().endsWith('.txt');
        if (isTxt) {
          return <ECGViewerD3 artifactId={artId} fileName={artName} api={api} onClose={() => { setShowECGViewer(false); setDirectEcgArtifact(null); }} />;
        }
        return <ECGViewer artifactId={artId} fileName={artName} api={api} onClose={() => { setShowECGViewer(false); setDirectEcgArtifact(null); }} />;
      })()}

      {/* BLE Not Supported Modal */}
      {showBleModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-4"><Smartphone className="w-12 h-12 mx-auto text-blue-500 mb-2" /><h3 className="text-lg font-semibold">Bluetooth Not Supported</h3></div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>This workflow uses <strong>Web Bluetooth</strong>.</p>
              {isIOS() ? (
                <div className="p-3 bg-primary/10 rounded-lg space-y-2"><p className="font-medium text-blue-800">For iPhone/iPad:</p><ol className="list-decimal pl-5 space-y-1"><li>Install <strong>Bluefy – Web BLE Browser</strong></li><li>Open portal URL inside Bluefy</li><li>Navigate to QC page and connect</li></ol></div>
              ) : <div className="p-3 bg-amber-50 rounded-lg"><p>Use <strong>Chrome</strong> or <strong>Edge</strong> on Windows, Mac, or Android.</p></div>}
              <p>You can also <strong>manually upload EDF</strong> without BLE.</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowBleModal(false)} data-testid="continue-without-ble-btn">Continue Without BLE</Button>
              {isIOS() && <Button className="flex-1" asChild><a href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noreferrer">Get Bluefy</a></Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
