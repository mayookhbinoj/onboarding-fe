import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { X, ChevronLeft, ChevronRight, Activity, Sun, Moon } from 'lucide-react';

// ═══ Constants ═══
const SAMPLE_RATE = 250;
const HEIGHT_OF_ROW = 129;
const DPI = 96;
const CHUNK_SIZE = 7500; // 30s at 250Hz
const SPEED_OPTIONS = [15, 20, 25, 35];
const GAIN_OPTIONS = [2.5, 5, 10, 15, 20];
const COLOR_OPTIONS = ['#22c55e', '#000000', '#60a5fa', '#f87171'];

function mmToPixels(mm) { return mm * (DPI / 25.4); }

// ═══ Grid Pattern as SVG ═══
function ECGGridPattern({ id, dark }) {
  const smallStep = mmToPixels(1);
  const largeStep = mmToPixels(5);
  const w = largeStep;
  const h = largeStep;
  const minor = dark ? 'rgba(34,197,94,0.08)' : 'rgba(220,38,38,0.07)';
  const major = dark ? 'rgba(34,197,94,0.18)' : 'rgba(220,38,38,0.16)';
  return (
    <defs>
      <pattern id={`${id}-sm`} width={smallStep} height={smallStep} patternUnits="userSpaceOnUse">
        <rect width={smallStep} height={smallStep} fill="none" stroke={minor} strokeWidth="0.5" />
      </pattern>
      <pattern id={id} width={w} height={h} patternUnits="userSpaceOnUse">
        <rect width={w} height={h} fill={`url(#${id}-sm)`} />
        <rect width={w} height={h} fill="none" stroke={major} strokeWidth="1" />
      </pattern>
    </defs>
  );
}

// ═══ Main Component ═══
export default function ECGViewerD3({ artifactId, fileName, api, onClose }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // State
  const [meta, setMeta] = useState(null);
  const [loadedChunks, setLoadedChunks] = useState({});
  const [visibleStart, setVisibleStart] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [speed, setSpeed] = useState(25);
  const [gain, setGain] = useState(10);
  const [ecgColor, setEcgColor] = useState('#22c55e');
  const [showGrid, setShowGrid] = useState(true);
  const [invertGraph, setInvertGraph] = useState(false);
  const [dark, setDark] = useState(true);
  const [containerWidth, setContainerWidth] = useState(900);
  const [containerHeight, setContainerHeight] = useState(600);
  const [hoverInfo, setHoverInfo] = useState(null);

  // ═══ Derived layout ═══
  const pixelsPerSecond = useMemo(() => mmToPixels(speed), [speed]);
  const secondsPerRow = useMemo(() => containerWidth / pixelsPerSecond, [containerWidth, pixelsPerSecond]);
  const rowsPerScreen = useMemo(() => Math.max(1, Math.floor(containerHeight / HEIGHT_OF_ROW)), [containerHeight]);
  const totalSecondsNeeded = useMemo(() => rowsPerScreen * secondsPerRow, [rowsPerScreen, secondsPerRow]);
  const chunksNeeded = useMemo(() => {
    if (!meta) return 1;
    const chunkDur = meta.chunkSize / meta.sampleRate;
    return Math.max(1, Math.ceil(totalSecondsNeeded / chunkDur));
  }, [meta, totalSecondsNeeded]);

  const graphStartTime = useMemo(() => {
    if (!meta) return 0;
    const chunkDur = meta.chunkSize / meta.sampleRate;
    return visibleStart * chunkDur;
  }, [visibleStart, meta]);

  // ═══ Load metadata ═══
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/devices-module/qc-artifacts/${artifactId}/txt-meta`);
        if (!cancelled) {
          setMeta(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) { setError(err.response?.data?.detail || 'Failed to load metadata'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [artifactId, api]);

  // ═══ Chunk loading ═══
  const loadChunks = useCallback(async (startChunk, count) => {
    if (!meta) return;
    const buffer = 2;
    const loadStart = Math.max(0, startChunk - buffer);
    const loadEnd = Math.min(meta.totalChunks, startChunk + count + buffer);
    const toLoad = [];
    for (let i = loadStart; i < loadEnd; i++) {
      if (!loadedChunks[i]) toLoad.push(i);
    }
    if (toLoad.length === 0) return;
    try {
      const results = await Promise.all(
        toLoad.map(i => api.get(`/api/devices-module/qc-artifacts/${artifactId}/txt-chunk/${i}`).then(r => ({ index: i, data: r.data.data })))
      );
      setLoadedChunks(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.index] = r.data; });
        // Unload chunks outside buffer range
        for (const k of Object.keys(next)) {
          const ki = parseInt(k);
          if (ki < loadStart || ki >= loadEnd) delete next[ki];
        }
        return next;
      });
    } catch {}
  }, [meta, loadedChunks, artifactId, api]);

  useEffect(() => {
    if (meta) loadChunks(visibleStart, chunksNeeded);
  }, [meta, visibleStart, chunksNeeded]);

  // ═══ Resize ═══
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
        setContainerHeight(rect.height);
      }
    };
    update();
    let timer;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(update, 250); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(timer); };
  }, []);

  // ═══ Get ECG values for a time range from loaded chunks ═══
  const getValuesForRange = useCallback((startTime, endTime) => {
    if (!meta) return [];
    const sr = meta.sampleRate;
    const cs = meta.chunkSize;
    const startIdx = Math.floor(startTime * sr);
    const endIdx = Math.ceil(endTime * sr);
    const result = [];
    for (let i = startIdx; i < endIdx; i++) {
      const chunkIdx = Math.floor(i / cs);
      const localIdx = i % cs;
      const chunk = loadedChunks[chunkIdx];
      if (chunk && localIdx < chunk.length) {
        result.push([i / sr, chunk[localIdx]]);
      }
    }
    return result;
  }, [meta, loadedChunks]);

  // ═══ D3 Drawing ═══
  useEffect(() => {
    if (!meta || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('g.ecg-row').remove();

    const W = containerWidth;
    const totalH = rowsPerScreen * HEIGHT_OF_ROW;

    for (let row = 0; row < rowsPerScreen; row++) {
      const rowStartTime = graphStartTime + row * secondsPerRow;
      const rowEndTime = rowStartTime + secondsPerRow;
      const data = getValuesForRange(rowStartTime, rowEndTime);

      const g = svg.append('g').attr('class', 'ecg-row').attr('transform', `translate(0, ${row * HEIGHT_OF_ROW})`);

      // Clip path per row
      const clipId = `clip-row-${row}`;
      g.append('defs').append('clipPath').attr('id', clipId)
        .append('rect').attr('width', W).attr('height', HEIGHT_OF_ROW);

      // X scale: time → pixels
      const xScale = d3.scaleLinear().domain([rowStartTime, rowEndTime]).range([0, W]);

      // Y scale: ECG value → pixels (gain in mm/mV)
      const yDomain = 30000 / gain;
      const yScale = d3.scaleLinear().domain([-yDomain, yDomain]).range([HEIGHT_OF_ROW, 0]);

      // Time label
      const mins = Math.floor(rowStartTime / 60);
      const secs = Math.floor(rowStartTime % 60);
      g.append('text')
        .attr('x', 4).attr('y', 12)
        .attr('fill', dark ? '#475569' : '#94a3b8')
        .attr('font-size', '9px').attr('font-family', 'monospace')
        .text(`${mins}:${secs.toString().padStart(2, '0')}`);

      if (data.length === 0) {
        // No data — flat line
        g.append('line')
          .attr('x1', 0).attr('y1', HEIGHT_OF_ROW / 2)
          .attr('x2', W).attr('y2', HEIGHT_OF_ROW / 2)
          .attr('stroke', dark ? '#334155' : '#e2e8f0').attr('stroke-width', 1);
      } else {
        // Flat line detection
        const vals = data.map(d => d[1]);
        const vMin = d3.min(vals);
        const vMax = d3.max(vals);
        const isFlat = (vMax - vMin) < 0.001;

        if (isFlat) {
          const flatY = yScale(invertGraph ? -vals[0] : vals[0]);
          g.append('line')
            .attr('x1', 0).attr('y1', flatY)
            .attr('x2', W).attr('y2', flatY)
            .attr('stroke', ecgColor).attr('stroke-width', 2).attr('stroke-dasharray', '4,2');
        } else {
          // ECG line
          const line = d3.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(invertGraph ? -d[1] : d[1]))
            .curve(d3.curveLinear);

          g.append('path')
            .datum(data)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', ecgColor)
            .attr('stroke-width', 1.2)
            .attr('stroke-linejoin', 'round')
            .attr('clip-path', `url(#${clipId})`);
        }
      }

      // Row separator
      g.append('line')
        .attr('x1', 0).attr('y1', HEIGHT_OF_ROW)
        .attr('x2', W).attr('y2', HEIGHT_OF_ROW)
        .attr('stroke', '#c97869').attr('stroke-width', 0.5);
    }
  }, [meta, loadedChunks, containerWidth, rowsPerScreen, secondsPerRow, gain, speed, invertGraph, ecgColor, graphStartTime, dark, getValuesForRange]);

  // ═══ Navigation ═══
  const canGoNext = meta && (visibleStart + chunksNeeded) < meta.totalChunks;
  const canGoPrev = visibleStart > 0;
  const goNext = () => { if (canGoNext) setVisibleStart(v => Math.min(v + chunksNeeded, meta.totalChunks - chunksNeeded)); };
  const goPrev = () => { if (canGoPrev) setVisibleStart(v => Math.max(0, v - chunksNeeded)); };

  // ═══ Hover handler ═══
  const handleMouseMove = (e) => {
    if (!svgRef.current || !meta) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const rowIdx = Math.floor(my / HEIGHT_OF_ROW);
    if (rowIdx < 0 || rowIdx >= rowsPerScreen) { setHoverInfo(null); return; }
    const rowStartTime = graphStartTime + rowIdx * secondsPerRow;
    const fraction = mx / containerWidth;
    const absTime = rowStartTime + fraction * secondsPerRow;
    const sampleIdx = Math.floor(absTime * meta.sampleRate);
    const chunkIdx = Math.floor(sampleIdx / meta.chunkSize);
    const localIdx = sampleIdx % meta.chunkSize;
    const chunk = loadedChunks[chunkIdx];
    const val = chunk && localIdx < chunk.length ? chunk[localIdx] : null;
    setHoverInfo({ x: mx, y: my, time: absTime, value: val, row: rowIdx });
  };

  // ═══ Keyboard navigation ═══
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const totalH = rowsPerScreen * HEIGHT_OF_ROW;
  const bg = dark ? '#0a0f1a' : '#ffffff';
  const textColor = dark ? '#f1f5f9' : '#0f172a';
  const mutedColor = dark ? '#475569' : '#94a3b8';
  const controlBg = dark ? '#0f1520' : '#f8fafc';
  const borderColor = dark ? '#334155' : '#e2e8f0';

  if (loading) return <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: bg }}><div className="text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400 mx-auto mb-3" /><p className="text-sm" style={{ color: mutedColor }}>Loading ECG data...</p></div></div>;
  if (error) return <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: bg }}><div className="text-center max-w-md"><p className="text-red-400 mb-4">{error}</p><Button variant="outline" onClick={onClose}>Close</Button></div></div>;

  const progress = meta ? ((visibleStart + chunksNeeded) / meta.totalChunks * 100).toFixed(0) : 0;
  const currentTimeSec = graphStartTime;
  const currentTimeStr = `${Math.floor(currentTimeSec / 60)}:${Math.floor(currentTimeSec % 60).toString().padStart(2, '0')}`;
  const totalTimeStr = meta ? `${Math.floor(meta.durationInSeconds / 60)}:${Math.floor(meta.durationInSeconds % 60).toString().padStart(2, '0')}` : '0:00';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: bg, color: textColor }}>
      {/* Header */}
      <div className="h-11 flex items-center px-4 gap-3 shrink-0" style={{ background: controlBg, borderBottom: `1px solid ${borderColor}` }}>
        <Activity className="w-4 h-4 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate" style={{ fontFamily: 'Space Grotesk' }}>ECG Viewer (D3)</h2>
          <p className="text-[10px] truncate" style={{ color: mutedColor }}>{fileName} — {meta?.durationInSeconds ? `${(meta.durationInSeconds / 60).toFixed(1)} min` : ''} — {meta?.sampleRate || 250}Hz</p>
        </div>
        <Badge variant="outline" className="text-[10px]" style={{ borderColor, color: mutedColor }}>{currentTimeStr} / {totalTimeStr}</Badge>
        <Badge variant="outline" className="text-[10px]" style={{ borderColor, color: mutedColor }}>{progress}%</Badge>
        <button className="h-7 w-7 rounded inline-flex items-center justify-center hover:opacity-80" style={{ color: mutedColor }} onClick={() => setDark(d => !d)}>{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
        <button className="h-7 w-7 rounded inline-flex items-center justify-center hover:opacity-80" style={{ color: mutedColor }} onClick={onClose}><X className="w-5 h-5" /></button>
      </div>

      {/* Controls */}
      <div className="h-9 flex items-center px-4 gap-4 shrink-0" style={{ background: controlBg, borderBottom: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: mutedColor }}>Speed</span>
          {SPEED_OPTIONS.map(s => (
            <button key={s} onClick={() => setSpeed(s)} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={speed === s ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' } : { color: mutedColor, border: '1px solid transparent' }}>{s}mm/s</button>
          ))}
        </div>
        <div className="w-px h-5" style={{ background: borderColor }} />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: mutedColor }}>Gain</span>
          {GAIN_OPTIONS.map(g => (
            <button key={g} onClick={() => setGain(g)} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={gain === g ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' } : { color: mutedColor, border: '1px solid transparent' }}>{g}mm/mV</button>
          ))}
        </div>
        <div className="w-px h-5" style={{ background: borderColor }} />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: mutedColor }}>Color</span>
          {COLOR_OPTIONS.map(c => (
            <button key={c} onClick={() => setEcgColor(c)} className="w-5 h-5 rounded-full border-2" style={{ background: c, borderColor: ecgColor === c ? '#ffffff' : 'transparent', opacity: ecgColor === c ? 1 : 0.5 }} />
          ))}
        </div>
        <div className="w-px h-5" style={{ background: borderColor }} />
        <button onClick={() => setShowGrid(g => !g)} className="text-[10px] px-2 py-0.5 rounded" style={{ color: showGrid ? '#22c55e' : mutedColor, border: `1px solid ${showGrid ? 'rgba(34,197,94,0.3)' : 'transparent'}` }}>Grid</button>
        <button onClick={() => setInvertGraph(v => !v)} className="text-[10px] px-2 py-0.5 rounded" style={{ color: invertGraph ? '#f87171' : mutedColor, border: `1px solid ${invertGraph ? 'rgba(248,113,113,0.3)' : 'transparent'}` }}>Invert</button>
        <div className="flex-1" />
        {/* Nav */}
        <button onClick={goPrev} disabled={!canGoPrev} className="h-6 w-6 rounded inline-flex items-center justify-center disabled:opacity-20" style={{ color: mutedColor }}><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-[10px] font-mono" style={{ color: mutedColor }}>Chunk {visibleStart}–{Math.min(visibleStart + chunksNeeded, meta?.totalChunks || 0)} / {meta?.totalChunks || 0}</span>
        <button onClick={goNext} disabled={!canGoNext} className="h-6 w-6 rounded inline-flex items-center justify-center disabled:opacity-20" style={{ color: mutedColor }}><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative" style={{ background: bg }}>
        <svg
          ref={svgRef}
          width={containerWidth}
          height={totalH}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          style={{ display: 'block' }}
        >
          <ECGGridPattern id="ecg-grid" dark={dark} />
          {showGrid && <rect width={containerWidth} height={totalH} fill="url(#ecg-grid)" />}
        </svg>

        {/* Hover crosshair + tooltip */}
        {hoverInfo && (
          <>
            <div className="absolute top-0 pointer-events-none" style={{ left: hoverInfo.x, width: 1, height: totalH, background: dark ? 'rgba(52,211,153,0.3)' : 'rgba(37,99,235,0.3)' }} />
            <div className="absolute pointer-events-none px-2 py-1 rounded shadow-lg text-[10px] font-mono" style={{
              left: Math.min(hoverInfo.x + 12, containerWidth - 160), top: Math.max(4, hoverInfo.y - 36),
              background: dark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
              border: `1px solid ${dark ? 'rgba(52,211,153,0.3)' : 'rgba(37,99,235,0.25)'}`,
              color: textColor,
            }}>
              <span style={{ color: '#22c55e' }}>{Math.floor(hoverInfo.time / 60)}m {(hoverInfo.time % 60).toFixed(2)}s</span>
              {hoverInfo.value !== null && <span style={{ color: mutedColor }}> | {hoverInfo.value.toFixed(1)}</span>}
            </div>
          </>
        )}

        {/* Scrollbar */}
        {meta && meta.totalChunks > chunksNeeded && (
          <div className="absolute right-1 top-0 w-2 rounded-full" style={{ height: totalH, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
            <div className="rounded-full" style={{
              width: '100%',
              height: `${Math.max(10, (chunksNeeded / meta.totalChunks) * 100)}%`,
              marginTop: `${(visibleStart / meta.totalChunks) * 100}%`,
              background: dark ? 'rgba(52,211,153,0.3)' : 'rgba(37,99,235,0.3)',
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
