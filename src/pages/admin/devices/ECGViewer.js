import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { X, Activity, Clock, Minus, Plus, Sun, Moon } from 'lucide-react';

const ECG_COLORS_DARK = ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];
const ECG_COLORS_LIGHT = ['#2563EB', '#DC2626', '#059669', '#D97706', '#7C3AED', '#EC4899'];
const SWEEP_SPEEDS = [10, 25, 50];
const GAIN_MM_MV = [2, 5, 10, 20, 30]; // mm per mV — standard medical ECG units
const PIXELS_PER_MM = 2.4; // screen pixels per millimeter
const STRIP_DURATION = 30; // seconds per strip — fixed

const THEMES = {
  dark: {
    bg: '#0a0f1a', headerBg: '#0f1520', controlsBg: '#0d1219',
    headerBorder: '#334155', controlsBorder: 'rgba(51,65,85,0.4)',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8', textMuted: '#475569',
    channelBgEven: '#0d1219', channelBgOdd: '#0f1520',
    labelBg: '#111827', labelBorder: '#1e293b', channelSep: '#1e293b',
    gridMinor: 'rgba(34,197,94,0.06)', gridMajor: 'rgba(34,197,94,0.14)',
    hoverLine: 'rgba(52,211,153,0.4)', tooltipBg: 'rgba(15,23,42,0.95)', tooltipBorder: 'rgba(52,211,153,0.3)',
    accentText: '#34d399', badgeBorder: '#475569',
    scrollBg: '#0a0f1a', loadBtnBg: 'transparent', loadBtnBorder: '#475569', loadBtnText: '#cbd5e1',
    colors: ECG_COLORS_DARK,
  },
  light: {
    bg: '#ffffff', headerBg: '#f8fafc', controlsBg: '#f1f5f9',
    headerBorder: '#e2e8f0', controlsBorder: '#e2e8f0',
    textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8',
    channelBgEven: '#ffffff', channelBgOdd: '#f8fafc',
    labelBg: '#f1f5f9', labelBorder: '#e2e8f0', channelSep: '#e2e8f0',
    gridMinor: 'rgba(239,68,68,0.07)', gridMajor: 'rgba(239,68,68,0.15)',
    hoverLine: 'rgba(37,99,235,0.4)', tooltipBg: 'rgba(255,255,255,0.97)', tooltipBorder: 'rgba(37,99,235,0.25)',
    accentText: '#059669', badgeBorder: '#cbd5e1',
    scrollBg: '#ffffff', loadBtnBg: '#ffffff', loadBtnBorder: '#e2e8f0', loadBtnText: '#334155',
    colors: ECG_COLORS_LIGHT,
  },
};

function getSecsPerStrip(speed) {
  return STRIP_DURATION * (25 / speed);
}

/**
 * ECGViewer — fixed for correct duration rendering.
 * KEY FIXES:
 * 1) Segments REPLACE on load (not append) — prevents StrictMode/double-fetch duplication
 * 2) Strip count = ceil(totalDuration / STRIP_DURATION) — never more
 * 3) startSec = stripIndex * STRIP_DURATION only (no modulo)
 * 4) Resets state when artifactId changes
 */
export default function ECGViewer({ artifactId, fileName, api, onClose, onScreenshot }) {
  const [summary, setSummary] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [gain, setGain] = useState(10); // mm/mV — standard ECG default
  const [sweepSpeed, setSweepSpeed] = useState(25); // mm/s
  // Auto-detect dark theme from app's CSS variables
  const [theme, setTheme] = useState(() => {
    try {
      const root = document.documentElement;
      const bg = getComputedStyle(root).getPropertyValue('--background')?.trim();
      // If background HSL lightness is low, it's dark theme
      if (bg) {
        const parts = bg.split(/\s+/);
        const lightness = parseFloat(parts[2] || '100');
        if (lightness < 30) return 'dark';
      }
      // Check data-theme attribute
      const dt = root.getAttribute('data-theme') || '';
      if (dt.includes('midnight') || dt.includes('dark')) return 'dark';
    } catch {}
    return 'light';
  });
  const [rawChData, setRawChData] = useState(null);
  const [sumData, setSumData] = useState(null);
  const containerRef = useRef(null);
  const loadedRef = useRef(false);
  const screenshotTakenRef = useRef(false);
  const T = THEMES[theme] || THEMES.light;

  // Reset state when artifactId changes (cycle selection)
  useEffect(() => {
    setSummary(null);
    setSegments([]);
    setLoading(true);
    setError(null);
    loadedRef.current = false;
    loadData();
  }, [artifactId]);

  // Build segments from raw data for given secsPerStrip
  const buildSegments = useCallback((chData, sumInfo, sps) => {
    if (!chData || !sumInfo) return [];
    const totalDuration = sumInfo.channels?.[0]?.duration_sec || 0;
    if (totalDuration <= 0) return [];
    const numStrips = Math.min(Math.ceil(totalDuration / sps), 20); // Cap at 20 strips max
    const newSegments = [];
    for (let stripIdx = 0; stripIdx < numStrips; stripIdx++) {
      const startSec = stripIdx * sps;
      const stripDuration = Math.min(sps, totalDuration - startSec);
      if (stripDuration <= 0) break;
      const seg = { startSec, stripDuration, channels: [] };
      for (let ci = 0; ci < chData.length; ci++) {
        const ch = chData[ci];
        if (!ch.data || !ch.data.length) continue;
        const pps = ch.data.length / (ch.duration_sec || totalDuration);
        const s0 = Math.floor(startSec * pps);
        const s1 = Math.floor(Math.min((startSec + stripDuration) * pps, ch.data.length));
        const sumCh = sumInfo.channels?.[ci];
        seg.channels.push({
          label: ch.label, data: ch.data.slice(s0, s1),
          totalDuration: ch.total_duration_sec || totalDuration, stripDuration,
          physMin: sumCh?.physical_min ?? null, physMax: sumCh?.physical_max ?? null,
        });
      }
      if (seg.channels.some(c => c.data.length > 0)) newSegments.push(seg);
    }
    return newSegments;
  }, []);

  const loadData = async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const sumRes = await api.get(`/api/devices-module/qc-artifacts/${artifactId}/ecg-summary`);
      const sd = sumRes.data;
      if (!sd || !sd.channels || sd.channels.length === 0) { setError('No ECG channels in this file'); setLoading(false); return; }
      setSummary(sd);
      setSumData(sd);
      const totalDuration = sd.channels?.[0]?.duration_sec || 0;
      if (totalDuration <= 0) { setError('No ECG data in this file'); setLoading(false); return; }
      // Cap initial load to 300 seconds to prevent browser crash on large files
      const loadDuration = Math.min(Math.ceil(totalDuration), 300);
      const dataRes = await api.get(`/api/devices-module/qc-artifacts/${artifactId}/ecg-data?start_sec=0&duration_sec=${loadDuration}`);
      const chData = dataRes.data?.channels || [];
      if (chData.length === 0) { setError('No ECG channel data returned'); setLoading(false); return; }
      // Override channel duration to actual loaded duration to prevent excess strip creation
      const cappedSd = { ...sd, channels: sd.channels.map(ch => ({ ...ch, duration_sec: Math.min(ch.duration_sec, loadDuration) })) };
      setSumData(cappedSd);
      setRawChData(chData);
      const sps = getSecsPerStrip(sweepSpeed);
      setSegments(buildSegments(chData, cappedSd, sps));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load ECG data');
    }
    setLoading(false);
  };

  const adjustGain = (d) => { const i = GAIN_MM_MV.indexOf(gain) + d; if (i >= 0 && i < GAIN_MM_MV.length) setGain(GAIN_MM_MV[i]); };
  const secsPerStrip = getSecsPerStrip(sweepSpeed);

  // Re-segment when speed changes
  useEffect(() => {
    if (rawChData && sumData) {
      const sps = getSecsPerStrip(sweepSpeed);
      setSegments(buildSegments(rawChData, sumData, sps));
    }
  }, [sweepSpeed, rawChData, sumData, buildSegments]);
  const totalDuration = summary?.channels?.[0]?.duration_sec || 0;
  const totalDurationDisplay = totalDuration >= 60 ? `${Math.round(totalDuration / 60)} min` : `${Math.round(totalDuration)}s`;

  if (loading) return <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: T.bg }}><div className="text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400 mx-auto mb-3" /><p className="text-sm" style={{ color: T.textSecondary }}>Loading ECG data...</p></div></div>;
  if (error) return <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: T.bg }}><div className="text-center max-w-md"><p className="text-red-400 mb-4">{error}</p><Button variant="outline" onClick={onClose}>Close</Button></div></div>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: T.bg }}>
      {/* Header */}
      <div className="h-12 flex items-center px-4 gap-4 shrink-0" style={{ background: T.headerBg, borderBottom: `1px solid ${T.headerBorder}` }}>
        <Activity className="w-5 h-5" style={{ color: T.accentText }} />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate" style={{ fontFamily: 'Space Grotesk', color: T.textPrimary }}>ECG Viewer</h2>
          <p className="text-[10px] truncate" style={{ color: T.textMuted }}>{fileName} — {summary?.n_channels || 1} ch — {totalDurationDisplay}</p>
        </div>
        {summary?.channels?.map((ch, i) => (
          <Badge key={i} variant="outline" className="text-[10px] hidden md:flex" style={{ borderColor: T.badgeBorder, color: T.colors[i % T.colors.length] }}>{ch.label} {ch.sample_frequency}Hz</Badge>
        ))}
        <Badge variant="outline" className="text-[10px]" style={{ borderColor: T.badgeBorder, color: T.textSecondary }}>
          <Clock className="w-3 h-3 mr-1" />{segments.length} strips / {totalDurationDisplay}
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: T.textSecondary }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: T.textSecondary }} onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>

      {/* Controls */}
      <div className="h-10 flex items-center px-4 gap-6 shrink-0" style={{ background: T.controlsBg, borderBottom: `1px solid ${T.controlsBorder}` }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider w-10" style={{ color: T.textMuted }}>Gain</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" style={{ color: T.textSecondary }} onClick={() => adjustGain(-1)} disabled={gain <= GAIN_MM_MV[0]}><Minus className="w-3 h-3" /></Button>
          <span className="text-xs font-mono w-16 text-center" style={{ color: T.accentText }}>{gain}mm/mV</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" style={{ color: T.textSecondary }} onClick={() => adjustGain(1)} disabled={gain >= GAIN_MM_MV[GAIN_MM_MV.length - 1]}><Plus className="w-3 h-3" /></Button>
        </div>
        <div className="w-px h-5" style={{ background: T.headerBorder }} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider w-14" style={{ color: T.textMuted }}>Speed</span>
          {SWEEP_SPEEDS.map(s => (
            <button key={s} onClick={() => setSweepSpeed(s)} className="text-[10px] px-2 py-0.5 rounded font-mono transition-all duration-300" style={sweepSpeed === s ? { background: `${T.accentText}20`, color: T.accentText, border: `1px solid ${T.accentText}40`, transform: 'scale(1.05)' } : { color: T.textMuted, border: '1px solid transparent', transform: 'scale(1)' }}>{s}mm/s</button>
          ))}
        </div>
        <div className="w-px h-5" style={{ background: T.headerBorder }} />
        <span className="text-[10px]" style={{ color: T.textMuted }}>
          {secsPerStrip.toFixed(1)}s per strip ({segments.length} strips)
        </span>
      </div>

      {/* Traces */}
      <div ref={containerRef} className="flex-1 overflow-y-auto" style={{ background: T.scrollBg }}>
        <div style={{ transition: 'opacity 0.25s ease', opacity: loading ? 0.3 : 1 }}>
          {segments.map((seg, idx) => (
            <ECGStrip key={`strip-${sweepSpeed}-${idx}-${seg.startSec}`} segment={seg} gain={gain} sweepSpeed={sweepSpeed} theme={T} secsPerStrip={secsPerStrip} />
          ))}
        </div>
        {segments.length > 0 && (
          <div className="p-4 text-center text-[10px]" style={{ color: T.textMuted }}>
            — End of recording ({totalDurationDisplay}) —
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
function ECGStrip({ segment, gain, sweepSpeed, theme: T, secsPerStrip }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  const CHANNEL_H = 150;
  const LABEL_W = 60;
  const stripDuration = segment.stripDuration || STRIP_DURATION;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !segment.channels?.length) return;

    const containerW = wrap.parentElement?.clientWidth || wrap.clientWidth || 900;
    const W = containerW;
    setCanvasWidth(W);

    const nCh = segment.channels.length;
    const totalH = nCh * CHANNEL_H;
    const dpr = window.devicePixelRatio || 2;

    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${totalH}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const traceW = W - LABEL_W;
    // Medical-standard scaling
    const pxPerSec = traceW / stripDuration;
    const mvPerMm = 1000 / gain; // microvolts per mm (gain is mm/mV, so 1000uV/mV / gain = uV/mm)
    const pxPerMm = PIXELS_PER_MM;
    const pxPerMicroVolt = pxPerMm / mvPerMm;

    segment.channels.forEach((ch, ci) => {
      const y0 = ci * CHANNEL_H;
      const data = ch.data;
      if (!data || !data.length) return;

      // Background
      ctx.fillStyle = ci % 2 === 0 ? T.channelBgEven : T.channelBgOdd;
      ctx.fillRect(0, y0, W, CHANNEL_H);

      // ECG Grid — standard 1mm and 5mm grid
      const smallGrid = PIXELS_PER_MM;
      const largeGrid = PIXELS_PER_MM * 5;
      // Small grid (1mm)
      ctx.strokeStyle = T.gridMinor; ctx.lineWidth = 0.5;
      for (let gy = y0; gy <= y0 + CHANNEL_H; gy += smallGrid) { ctx.beginPath(); ctx.moveTo(LABEL_W, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      for (let gx = LABEL_W; gx <= W; gx += smallGrid) { ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + CHANNEL_H); ctx.stroke(); }
      // Large grid (5mm)
      ctx.strokeStyle = T.gridMajor; ctx.lineWidth = 1;
      for (let gy = y0; gy <= y0 + CHANNEL_H; gy += largeGrid) { ctx.beginPath(); ctx.moveTo(LABEL_W, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      for (let gx = LABEL_W; gx <= W; gx += largeGrid) { ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + CHANNEL_H); ctx.stroke(); }

      // Time markers
      ctx.fillStyle = T.textMuted; ctx.font = '8px monospace';
      const tickInterval = stripDuration <= 10 ? 1 : stripDuration <= 30 ? 2 : stripDuration <= 60 ? 5 : 10;
      for (let s = 0; s <= stripDuration; s += tickInterval) {
        const sx = LABEL_W + s * pxPerSec;
        if (sx > W - 20) break;
        const absS = segment.startSec + s;
        ctx.fillText(`${Math.floor(absS / 60)}:${(Math.floor(absS) % 60).toString().padStart(2, '0')}`, sx + 2, y0 + CHANNEL_H - 3);
      }

      // Label panel
      ctx.fillStyle = T.labelBg;
      ctx.fillRect(0, y0, LABEL_W, CHANNEL_H);
      ctx.strokeStyle = T.labelBorder; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(LABEL_W, y0); ctx.lineTo(LABEL_W, y0 + CHANNEL_H); ctx.stroke();

      ctx.fillStyle = T.colors[ci % T.colors.length];
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.fillText(ch.label, 4, y0 + 18);
      ctx.fillStyle = T.textSecondary; ctx.font = '9px monospace';
      ctx.fillText(`${Math.floor(segment.startSec / 60)}:${(Math.floor(segment.startSec) % 60).toString().padStart(2, '0')}`, 4, y0 + 32);
      ctx.fillText(`${gain}mm/mV`, 4, y0 + 44);
      ctx.fillText(`${sweepSpeed}mm/s`, 4, y0 + 56);

      // Separator
      ctx.strokeStyle = T.channelSep; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y0 + CHANNEL_H); ctx.lineTo(W, y0 + CHANNEL_H); ctx.stroke();

      // Signal trace — proper medical mV scaling (no percentile normalization)
      const pad = 8;
      const midY = y0 + CHANNEL_H / 2;
      const sampleRate = data.length / (stripDuration || 1);
      const pxPerSample = pxPerSec / sampleRate;

      // Compute DC offset from data mean to center the trace
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const dcOffset = sum / data.length;

      ctx.save();
      ctx.beginPath(); ctx.rect(LABEL_W, y0 + pad, traceW, CHANNEL_H - 2 * pad); ctx.clip();

      ctx.strokeStyle = T.colors[ci % T.colors.length];
      ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = LABEL_W + i * pxPerSample;
        // val is in microvolts from the backend; subtract DC offset to center
        const val = data[i] - dcOffset;
        const y = midY - val * pxPerMicroVolt;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [segment, gain, sweepSpeed, T, secsPerStrip, stripDuration]);

  // Hover
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !segment.channels?.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (mx < LABEL_W) { setHoverInfo(null); return; }

    const traceW = canvasWidth - LABEL_W;
    const fraction = Math.min(1, Math.max(0, (mx - LABEL_W) / traceW));
    const absTime = segment.startSec + fraction * stripDuration;
    const mins = Math.floor(absTime / 60);
    const secs = (absTime % 60).toFixed(2);

    const chIdx = Math.min(Math.floor(my / CHANNEL_H), segment.channels.length - 1);
    const ch = segment.channels[chIdx];
    let value = '';
    if (ch?.data?.length) {
      const idx = Math.min(Math.floor(fraction * ch.data.length), ch.data.length - 1);
      const raw = ch.data[idx];
      value = raw !== undefined ? `${(raw / 1000).toFixed(3)} mV` : '';
    }
    setHoverInfo({ x: e.clientX - rect.left, y: e.clientY - rect.top, time: `${mins}m ${secs}s`, label: ch?.label || '', value });
  };

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden"
      style={{ borderBottom: `1px solid ${T.channelSep}` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverInfo(null)}
    >
      <canvas ref={canvasRef} className="block" />
      {hoverInfo && (
        <>
          <div className="absolute top-0 pointer-events-none" style={{ left: hoverInfo.x, width: 1, height: '100%', background: T.hoverLine }} />
          <div className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg shadow-xl" style={{ left: Math.min(hoverInfo.x + 14, (wrapRef.current?.clientWidth || 800) - 190), top: Math.max(4, hoverInfo.y - 46), background: T.tooltipBg, border: `1px solid ${T.tooltipBorder}` }}>
            <p className="text-[11px] font-mono font-bold" style={{ color: T.accentText }}>{hoverInfo.time}</p>
            {hoverInfo.label && <p className="text-[10px]" style={{ color: T.textSecondary }}>{hoverInfo.label}: {hoverInfo.value}</p>}
          </div>
        </>
      )}
    </div>
  );
}
