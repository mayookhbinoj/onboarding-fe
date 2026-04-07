import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { X, Send, Plus, Search, Trash2, MessageSquare, Menu, Copy, Check, ChevronDown, ChevronLeft, ChevronRight as ChevronR, Minimize2, Maximize2, ThumbsUp, ThumbsDown, Share2, Activity, Image, Users as UsersIcon, Package, Pencil } from 'lucide-react';

const DEFAULT_THINKING_WORDS = ['Processing request', 'Organizing details', 'Evaluating inputs', 'Synthesizing response', 'Preparing results'];

function ThinkingStatus({ words, rotationSpeed = 2000 }) {
  const list = words?.length ? words : DEFAULT_THINKING_WORDS;
  const [text, setText] = useState(list[0]);
  const [phase, setPhase] = useState('in'); // 'in' | 'out'
  const idxRef = useRef(0);

  useEffect(() => {
    const rotate = () => {
      setPhase('out');
      setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % list.length;
        setText(list[idxRef.current]);
        setPhase('in');
      }, 400);
    };
    const first = setTimeout(rotate, rotationSpeed);
    const interval = setInterval(rotate, rotationSpeed + 400);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [list, rotationSpeed]);

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{
        fontSize:13, color:'hsl(var(--primary, 217 91% 53%) / .7)', fontWeight:500, whiteSpace:'nowrap',
        transition:'opacity .4s ease, transform .4s ease, filter .4s ease',
        opacity: phase === 'in' ? 1 : 0,
        transform: phase === 'in' ? 'translateY(0)' : 'translateY(-8px)',
        filter: phase === 'in' ? 'blur(0)' : 'blur(3px)',
      }}>{text}</span>
      <div style={{ display:'flex', gap:3 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width:4, height:4, borderRadius:'50%', background:'hsl(var(--primary, 217 91% 53%) / .3)', display:'block',
            animation:`xtsDb 1.4s ease-in-out infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
      <style>{`@keyframes xtsDb { 0%,80%,100% { transform:scale(.5); opacity:.3; } 40% { transform:scale(1.1); opacity:1; } }`}</style>
    </div>
  );
}

const cleanText = (t) => t?.replace(/\*\*/g, '').replace(/\*/g, '') || '';
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const CAPABILITIES = [
  { iconKey: 'ecg', title: 'ECG & Clinical', desc: 'Plot ECG waveforms, view EDF files, check QC results', query: 'Show me the ECG files for the latest QC test and plot them', color: '#ef4444' },
  { iconKey: 'image', title: 'Device Images', desc: 'Pull sensor photos, packaging images, onboarding media', query: 'Show me all sensor photos from onboarding', color: '#3b82f6' },
  { iconKey: 'users', title: 'People & Partners', desc: 'Distributor info, contacts, onboarding status', query: 'List all distributors with their status and contact details', color: '#8b5cf6' },
  { iconKey: 'package', title: 'Inventory & Shipments', desc: 'Device status, shipments, allocations, returns', query: 'How many devices are in each status? Show the full breakdown', color: '#10b981' },
];

const SUGGESTIONS = [
  'What devices passed QC this week?',
  'Show the audit trail for device 000095',
  'How many agreements are signed?',
  'List all distributors who submitted forms',
  'What is the device onboarding flow?',
  'Show me the packaging images for the latest device',
];

const EXAMPLE_CHATS = [
  { id: 'ex_1', title: 'Device Inventory Overview', badge: 'Example' },
  { id: 'ex_2', title: 'Distributor Onboarding Guide', badge: 'Example' },
  { id: 'ex_3', title: 'ECG Data & QC Results', badge: 'Example' },
];

// Format plain text into structured elements (line breaks, bullets, numbered lists)
function FormattedText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Markdown Table Detection ──
    // If line starts with |, collect consecutive | lines as a table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        // Parse table: split each row by |, trim cells
        const parseRow = (row) => row.split('|').slice(1, -1).map(c => c.trim());
        // Find separator line (|---|---|)
        const sepIdx = tableLines.findIndex(l => /^\|[\s\-:|]+\|$/.test(l));
        const headerRows = sepIdx > 0 ? tableLines.slice(0, sepIdx) : [tableLines[0]];
        const bodyRows = sepIdx > 0 ? tableLines.slice(sepIdx + 1) : tableLines.slice(1);
        const headers = parseRow(headerRows[0]);

        elements.push(
          <div key={key++} className="xa-table-wrap" style={{ overflowX: 'auto', margin: '8px 0', borderRadius: 8, border: '1px solid hsl(var(--border))' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', lineHeight: 1.4 }}>
              <thead>
                <tr style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                  {headers.map((h, hi) => (
                    <th key={hi} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid hsl(var(--border))', whiteSpace: 'nowrap', color: 'hsl(var(--foreground))' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => {
                  const cells = parseRow(row);
                  return (
                    <tr key={ri} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)', background: ri % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.2)' }}>
                      {cells.map((c, ci) => (
                        <td key={ci} style={{ padding: '6px 12px', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
      // If not enough lines for a table, fall through to render as regular text
      i -= tableLines.length;
    }

    if (!trimmed) {
      elements.push(<div key={key++} style={{ height: 8 }} />);
      i++; continue;
    }

    // Numbered list: "1. ", "2. ", etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 6, paddingLeft: 2, marginTop: 2, marginBottom: 2 }}>
          <span style={{ color: 'hsl(var(--primary))', fontWeight: 600, fontSize: '0.85em', minWidth: 16, flexShrink: 0 }}>{numMatch[1]}.</span>
          <span>{numMatch[2]}</span>
        </div>
      );
      i++; continue;
    }

    // Bullet: "- " or "• "
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 6, paddingLeft: 4, marginTop: 2, marginBottom: 2 }}>
          <span style={{ color: 'hsl(var(--primary))', fontSize: '0.7em', marginTop: 5, flexShrink: 0 }}>●</span>
          <span>{trimmed.slice(2)}</span>
        </div>
      );
      i++; continue;
    }

    // Regular line
    elements.push(<div key={key++} style={{ marginTop: 1, marginBottom: 1 }}>{trimmed}</div>);
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
}

// Parse special tags in AI response and render rich content
function RichContent({ text }) {
  const parts = [];
  let remaining = cleanText(text);
  let key = 0;

  // Parse [IMAGE:url], [EDF:id:name], [GALLERY:url1,url2,...]
  const regex = /\[(IMAGE|EDF|GALLERY):([^\]]+)\]/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<FormattedText key={key++} text={remaining.slice(lastIdx, match.index)} />);
    }
    const tag = match[1];
    const val = match[2];
    if (tag === 'IMAGE') {
      const rawUrl = val.trim();
      const url = rawUrl.startsWith('http') ? rawUrl : `${BACKEND}${rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl}`;
      parts.push(
        <div key={key++} className="xa-rich-img-wrap">
          <img src={url} alt="Device" className="xa-rich-img" loading="lazy" onClick={() => window.open(url, '_blank')}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<div style="padding:12px;background:#f1f5f9;border-radius:8px;border:1px solid #e2e8f0;text-align:center;"><p style="font-size:11px;color:#64748b;margin:0;">Image not available</p><a href="' + url + '" target="_blank" style="font-size:10px;color:#2563eb;">Open link</a></div>';
            }} />
        </div>
      );
    } else if (tag === 'GALLERY') {
      const urls = val.split(',').map(u => u.trim()).filter(Boolean);
      parts.push(<ImageGallery key={key++} urls={urls} />);
    } else if (tag === 'EDF') {
      const colonIdx = val.indexOf(':');
      const artifactId = colonIdx > 0 ? val.slice(0, colonIdx) : val;
      const fileName = colonIdx > 0 ? val.slice(colonIdx + 1) : 'ECG Recording';
      parts.push(<EdfCard key={key++} artifactId={artifactId} fileName={fileName} />);
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < remaining.length) {
    parts.push(<FormattedText key={key++} text={remaining.slice(lastIdx)} />);
  }
  return <>{parts}</>;
}

// Image gallery with horizontal scroll
function ImageGallery({ urls }) {
  const scrollRef = useRef(null);
  const fullUrls = urls.map(u => u.startsWith('http') ? u : `${BACKEND}${u}`);
  const scroll = (dir) => { if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 200, behavior: 'smooth' }); };
  return (
    <div className="xa-gallery-wrap">
      {fullUrls.length > 3 && <button className="xa-gallery-arrow xa-gallery-left" onClick={() => scroll(-1)}><ChevronLeft size={14} /></button>}
      <div className="xa-gallery" ref={scrollRef}>
        {fullUrls.map((url, i) => (
          <img key={i} src={url} alt={`Image ${i+1}`} className="xa-gallery-img" loading="lazy" onClick={() => window.open(url, '_blank')}
            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
        ))}
      </div>
      {fullUrls.length > 3 && <button className="xa-gallery-arrow xa-gallery-right" onClick={() => scroll(1)}><ChevronR size={14} /></button>}
      <p className="xa-gallery-count">{fullUrls.length} images</p>
    </div>
  );
}

// Streaming text — reveals words gradually like reading speed
function StreamingText({ text, onDone }) {
  const [wordCount, setWordCount] = useState(0);
  const words = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    // Split into "tokens" — words + punctuation groups for natural pacing
    words.current = text.match(/\S+\s*/g) || [text];
    setWordCount(0);
    let i = 0;
    const tick = () => {
      i++;
      setWordCount(i);
      if (i >= words.current.length) {
        if (onDone) onDone();
        return;
      }
      // Variable speed: pause longer after periods/newlines, faster for short words
      const w = words.current[i - 1] || '';
      const delay = /[.!?\n]/.test(w) ? 80 : w.length > 8 ? 45 : 30;
      timerRef.current = setTimeout(tick, delay);
    };
    timerRef.current = setTimeout(tick, 20);
    return () => clearTimeout(timerRef.current);
  }, [text]);

  const visible = words.current.slice(0, wordCount).join('');
  const done = wordCount >= words.current.length;

  return (
    <>
      <RichContent text={visible} />
      {!done && <span className="xa-stream-cursor" />}
    </>
  );
}

// EDF Card with inline ECG plot
function EdfCard({ artifactId, fileName }) {
  const { api } = useAuth();
  const [ecgData, setEcgData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);

  const loadEcg = async () => {
    if (ecgData || loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/xaura/ecg-preview/${artifactId}`);
      setEcgData(res.data);
    } catch (e) {
      setError('Could not load ECG data');
    }
    setLoading(false);
  };

  // Auto-load on mount
  useEffect(() => { loadEcg(); }, []);

  // Draw ECG on canvas
  useEffect(() => {
    if (!ecgData?.samples?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const samples = ecgData.samples;
    const W = Math.max(samples.length * 2, 800);
    const H = 160;
    canvas.width = W;
    canvas.height = H;

    // Background grid
    ctx.fillStyle = '#f8faff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d6e4f7';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // Major grid
    ctx.strokeStyle = '#b8cde8';
    ctx.lineWidth = 0.8;
    for (let x = 0; x < W; x += 200) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

    // ECG waveform
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const range = max - min || 1;
    const pad = 15;

    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < samples.length; i++) {
      const x = (i / samples.length) * W;
      const y = pad + ((max - samples[i]) / range) * (H - 2 * pad);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [ecgData]);

  return (
    <div className="xa-edf-container">
      <div className="xa-edf-header">
        <div className="xa-edf-icon">EDF</div>
        <span className="xa-edf-name">{fileName || 'ECG Recording'}</span>
        {ecgData?.file_url && (
          <a href={`${BACKEND}${ecgData.file_url}`} download className="xa-edf-dl" title="Download">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        )}
      </div>
      {loading && (
        <div className="xa-edf-loading">
          <div className="xa-spinner" style={{ width: 16, height: 16 }} />
          <span>Loading ECG...</span>
        </div>
      )}
      {error && (
        <div className="xa-edf-error-box" style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 6, margin: '4px 0' }}>
          <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>ECG preview unavailable — open in full viewer to see the waveform</p>
          <button onClick={() => window.open(`/admin/devices`, '_blank')} style={{ fontSize: 10, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>Open Device Inventory →</button>
        </div>
      )}
      {ecgData?.samples?.length > 0 && (
        <>
          <div className="xa-ecg-info">
            <span>{ecgData.label}</span>
            <span>{ecgData.duration?.toFixed(1)}s</span>
            <span>{ecgData.samples.length} pts</span>
          </div>
          <div className="xa-ecg-scroll" ref={scrollRef}>
            <canvas ref={canvasRef} className="xa-ecg-canvas" />
          </div>
        </>
      )}
    </div>
  );
}

export default function XAuraChat({ open, onClose, mode = 'full', onModeChange, dropPosition, newSessionTrigger }) {
  const { api } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [streamingId, setStreamingId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState({});
  const [feedbackAnim, setFeedbackAnim] = useState({});
  const [sendAnim, setSendAnim] = useState(false);
  const [shareModal, setShareModal] = useState(null); // { msgId, responseText, questionText }
  const [shareTargets, setShareTargets] = useState([]);
  const [shareIncludeQ, setShareIncludeQ] = useState(true);
  const [shareConvos, setShareConvos] = useState([]);
  const [shareSearch, setShareSearch] = useState('');
  const [thinkingWords, setThinkingWords] = useState(DEFAULT_THINKING_WORDS);
  const [rotationSpeed, setRotationSpeed] = useState(2000);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatAreaRef = useRef(null);
  const abortRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Mini window drag state
  const miniRef = useRef(null);
  const [miniPos, setMiniPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 400 : 400, y: 80 });
  const [miniSize, setMiniSize] = useState({ w: 380, h: 500 });
  const dragState = useRef({ dragging: false, offX: 0, offY: 0 });
  const resizeState = useRef({ resizing: false, startX: 0, startY: 0, startW: 0, startH: 0 });

  // Update position when dropPosition changes
  useEffect(() => {
    if (dropPosition) setMiniPos({ x: dropPosition.x, y: dropPosition.y });
  }, [dropPosition]);

  // Start new chat session when dropped via drag
  useEffect(() => {
    if (newSessionTrigger > 0) {
      setActiveSession(null);
      setMessages([]);
      setStreamingId(null);
    }
  }, [newSessionTrigger]);

  const startMiniDrag = (e) => {
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { dragging: true, offX: clientX - miniPos.x, offY: clientY - miniPos.y };
    const onMove = (ev) => {
      if (!dragState.current.dragging) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      setMiniPos({ x: cx - dragState.current.offX, y: cy - dragState.current.offY });
    };
    const onUp = () => {
      dragState.current.dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const startResize = (dir, e) => {
    e.preventDefault(); e.stopPropagation();
    window.getSelection()?.removeAllRanges();
    const cx = e.clientX || e.touches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || 0;
    resizeState.current = { resizing: true, dir, startX: cx, startY: cy, startW: miniSize.w, startH: miniSize.h, startPosX: miniPos.x, startPosY: miniPos.y };
    const onMove = (ev) => {
      if (!resizeState.current.resizing) return;
      const mx = ev.clientX || ev.touches?.[0]?.clientX || 0;
      const my = ev.clientY || ev.touches?.[0]?.clientY || 0;
      const dx = mx - resizeState.current.startX;
      const dy = my - resizeState.current.startY;
      const d = resizeState.current.dir;
      let nw = resizeState.current.startW, nh = resizeState.current.startH;
      let nx = resizeState.current.startPosX, ny = resizeState.current.startPosY;
      if (d.includes('r')) nw = Math.max(280, nw + dx);
      if (d.includes('b')) nh = Math.max(300, nh + dy);
      if (d.includes('l')) { nw = Math.max(280, nw - dx); nx = nx + dx; }
      if (d.includes('t')) { nh = Math.max(300, nh - dy); ny = ny + dy; }
      setMiniSize({ w: nw, h: nh });
      setMiniPos({ x: nx, y: ny });
    };
    const onUp = () => {
      resizeState.current.resizing = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const loadSessions = useCallback(async () => {
    try { const r = await api.get('/api/xaura/sessions'); setSessions(r.data || []); } catch {}
    setLoadingSessions(false);
  }, [api]);

  useEffect(() => {
    if (open) {
      loadSessions();
      setTimeout(() => inputRef.current?.focus(), 400);
      api.get('/api/xaura/thinking-words').then(r => {
        if (r.data?.words?.length) setThinkingWords(r.data.words);
      }).catch(() => {});
    }
  }, [open, loadSessions]);

  // Lock body scroll ONLY in full mode
  useEffect(() => {
    if (open && mode === 'full') {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      };
    } else {
      // Ensure body is unlocked for mini/collapsed modes
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    }
  }, [open, mode]);

  useEffect(() => {
    if (!activeSession) { setMessages([]); return; }
    api.get(`/api/xaura/sessions/${activeSession}/messages`).then(r => setMessages(r.data || [])).catch(() => {});
  }, [activeSession, api]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setSendAnim(true);
    setTimeout(() => setSendAnim(false), 700);
    setMessages(prev => [...prev, { _id: 'temp_u', role: 'user', content: msg }]);

    // Classify in parallel (non-blocking) for thinking phrases
    api.post('/api/xaura/classify', { message: msg }).then(cls => {
      if (cls.data?.status_lines?.length) setThinkingWords(cls.data.status_lines);
      if (cls.data?.rotation_speed) setRotationSpeed(cls.data.rotation_speed);
    }).catch(() => {});

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Use async pattern to avoid proxy timeout — send message, get pending ID, poll for result
      const res = await api.post('/api/xaura/chat-async', { session_id: activeSession, message: msg }, { timeout: 15000 });
      const sid = res.data.session_id;
      const pendingId = res.data.pending_id;
      if (!activeSession) { setActiveSession(sid); loadSessions(); }

      // Poll for result every 2 seconds until done (max 3 minutes)
      const pollStart = Date.now();
      const maxPollMs = 180000;
      const pollResult = async () => {
        while (Date.now() - pollStart < maxPollMs) {
          try {
            const status = await api.get(`/api/xaura/chat-status/${pendingId}`, { timeout: 10000 });
            if (status.data.status === 'done' || status.data.status === 'error') {
              const newId = `a${Date.now()}`;
              setStreamingId(newId);
              setMessages(prev => [
                ...prev.filter(m => m._id !== 'temp_u'),
                { _id: `u${Date.now()}`, role: 'user', content: msg },
                { _id: newId, role: 'assistant', content: status.data.content },
              ]);
              return;
            }
          } catch {}
          await new Promise(r => setTimeout(r, 2000));
        }
        // Timeout after 3 min — try loading session messages
        setMessages(prev => prev.filter(m => m._id !== 'temp_u'));
        toast.info('Response is taking longer than expected. Refreshing...');
        if (sid) {
          try {
            const r = await api.get(`/api/xaura/sessions/${sid}/messages`);
            setMessages(r.data || []);
          } catch {}
        }
      };
      await pollResult();
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) {
        setMessages(prev => prev.filter(m => m._id !== 'temp_u'));
        toast('Request stopped');
      } else {
        // Fallback: try synchronous endpoint with long timeout
        try {
          const res = await api.post('/api/xaura/chat', { session_id: activeSession, message: msg }, { signal: controller.signal, timeout: 120000 });
          const sid = res.data.session_id;
          if (!activeSession) { setActiveSession(sid); loadSessions(); }
          const newId = `a${Date.now()}`;
          setStreamingId(newId);
          setMessages(prev => [
            ...prev.filter(m => m._id !== 'temp_u'),
            { _id: `u${Date.now()}`, role: 'user', content: msg },
            { _id: newId, role: 'assistant', content: res.data.response },
          ]);
        } catch (err2) {
          setMessages(prev => prev.filter(m => m._id !== 'temp_u'));
          toast.error('Failed to get response. Try again.');
        }
      }
    }
    abortRef.current = null;
    setSending(false);
  };

  const stopRequest = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  };

  const submitFeedback = async (msgId, rating) => {
    const current = feedbackGiven[msgId];
    if (current === rating) return; // same rating, no-op
    setFeedbackGiven(prev => ({ ...prev, [msgId]: rating }));
    setFeedbackAnim(prev => ({ ...prev, [msgId]: rating }));
    setTimeout(() => setFeedbackAnim(prev => ({ ...prev, [msgId]: null })), 600);
    try { await api.post('/api/xaura/feedback', { session_id: activeSession, message_id: msgId, rating }); } catch {}
  };

  const openShareModal = async (msgId, responseText) => {
    const msgIdx = messages.findIndex(m => m._id === msgId);
    const questionMsg = msgIdx > 0 ? messages[msgIdx - 1] : null;
    const questionText = questionMsg?.role === 'user' ? questionMsg.content : '';
    setShareModal({ msgId, responseText: cleanText(responseText), questionText });
    setShareTargets([]); setShareIncludeQ(true); setShareSearch('');
    try { const r = await api.get('/api/messages/conversations'); setShareConvos(r.data || []); } catch {}
  };

  const executeShare = async () => {
    if (!shareModal || shareTargets.length === 0) return;
    try {
      await api.post('/api/xaura/share', { conversation_ids: shareTargets, response_text: shareModal.responseText, question_text: shareModal.questionText, include_question: shareIncludeQ });
      toast.success(`Shared to ${shareTargets.length} chat(s)`);
      setShareModal(null);
    } catch { toast.error('Failed to share'); }
  };



  const newChat = () => { setActiveSession(null); setMessages([]); setStreamingId(null); setDrawerOpen(false); inputRef.current?.focus(); };
  const selectSession = (sid) => { setActiveSession(sid); setStreamingId(null); setDrawerOpen(false); };
  const deleteSession = async (sid, e) => {
    e.stopPropagation();
    try { await api.delete(`/api/xaura/sessions/${sid}`); setSessions(prev => prev.filter(s => s._id !== sid)); if (activeSession === sid) { setActiveSession(null); setMessages([]); } } catch {}
  };

  const renameSession = async (sid) => {
    if (!editingSessionName.trim()) { setEditingSessionId(null); return; }
    try {
      await api.put(`/api/xaura/sessions/${sid}`, { title: editingSessionName.trim() });
      setSessions(prev => prev.map(s => s._id === sid ? { ...s, title: editingSessionName.trim() } : s));
    } catch { toast.error('Failed to rename'); }
    setEditingSessionId(null);
  };
  const copyText = (id, text) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const filteredSessions = sessions.filter(s => !search || (s.title || '').toLowerCase().includes(search.toLowerCase()));

  if (!open) return null;

  // Global animation styles (always available for all modes)
  const globalStyles = <style>{`
    @keyframes xaFbPop { 0%{transform:scale(1)} 20%{transform:scale(1.5) rotate(-8deg)} 40%{transform:scale(0.9) rotate(4deg)} 60%{transform:scale(1.2) rotate(-2deg)} 100%{transform:scale(1) rotate(0)} }
    @keyframes xaFbShake { 0%{transform:scale(1)} 15%{transform:scale(1.3) rotate(6deg)} 30%{transform:translateX(-3px) scale(1.1)} 45%{transform:translateX(3px) scale(1.1)} 60%{transform:translateX(-2px)} 75%{transform:translateX(1px)} 100%{transform:translateX(0) scale(1)} }
    @keyframes xaModeIn { from{opacity:0;transform:scale(.92) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes xaPillIn { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
    .xa-fb-pop{animation:xaFbPop .5s cubic-bezier(.17,.67,.21,1.4)}
    .xa-fb-shake{animation:xaFbShake .5s cubic-bezier(.36,.07,.19,.97)}
    .xa-send-fly{animation:xaSendFly .65s cubic-bezier(.22,.68,0,1.2)}
    @keyframes xaSendFly { 
      0% { transform:scale(1) rotate(0); opacity:1; } 
      15% { transform:scale(0.7) rotate(-15deg); opacity:0.8; } 
      30% { transform:scale(1.4) rotate(5deg) translateX(4px) translateY(-6px); opacity:1; } 
      50% { transform:scale(0.3) rotate(45deg) translateX(20px) translateY(-20px); opacity:0; } 
      51% { transform:scale(0.3) rotate(0) translateX(0) translateY(8px); opacity:0; } 
      70% { transform:scale(1.15) rotate(-3deg) translateY(-2px); opacity:1; } 
      85% { transform:scale(0.95) rotate(1deg); opacity:1; } 
      100% { transform:scale(1) rotate(0); opacity:1; } 
    }
  `}</style>;

  const XLogo = ({s=14}) => (
    <svg width={s} height={Math.round(s*1.57)} viewBox="0 0 40 68" fill="none"><path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="hsl(var(--foreground))" strokeWidth="6"/><path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/></svg>
  );

  // ═══ COLLAPSED: floating popup card (like voice call popup) ═══
  if (mode === 'collapsed') {
    return (
      <>{globalStyles}<div ref={miniRef} style={{
        position:'fixed', left:miniPos.x, top:miniPos.y, zIndex:190,
        width:200, borderRadius:20, background:'hsl(var(--card))',
        boxShadow:'0 12px 48px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08)',
        animation:'xaPillIn .3s cubic-bezier(.16,1,.3,1)',
        border:'1px solid hsl(var(--border))', overflow:'hidden',
        userSelect:'none', WebkitUserSelect:'none', touchAction:'none',
      }}>
        {/* Drag nub */}
        <div onMouseDown={startMiniDrag} onTouchStart={startMiniDrag}
          style={{ width:36, height:5, borderRadius:3, background:'hsl(var(--border))', margin:'10px auto 0', cursor:'grab' }} />
        {/* Body */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px 8px' }}>
          <div style={{ width:44, height:44, borderRadius:14, background:'hsl(var(--primary) / .08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <XLogo s={18} />
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:14, fontWeight:600, margin:0 }}>Aura</p>
            <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>Minimized</p>
          </div>
        </div>
        {/* Actions */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'10px 16px 16px' }}>
          <button onClick={() => onModeChange('mini')} title="Open chat"
            style={{ width:38, height:38, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'hsl(var(--primary) / .08)', color:'#3b82f6' }}>
            <Maximize2 size={15} />
          </button>
          <button onClick={onClose} title="Close"
            style={{ width:38, height:38, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'#fee2e2', color:'#ef4444' }}>
            <X size={16} />
          </button>
        </div>
      </div></>
    );
  }

  // ═══ MINI: premium glassmorphic chat widget ═══
  if (mode === 'mini') {
    const scale = Math.min(1, miniSize.w / 380);
    const fs = Math.max(11, Math.round(13 * scale));
    const pad = Math.round(14 * scale);
    return (
      <>{globalStyles}<div ref={miniRef} style={{ position:'fixed', left:miniPos.x, top:miniPos.y, zIndex:190, width:miniSize.w, height:miniSize.h, display:'flex', flexDirection:'column', borderRadius:20, overflow:'visible', background:'hsl(var(--card) / .95)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid hsl(var(--border))', boxShadow:'0 24px 80px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.03)', animation:'xaModeIn .35s cubic-bezier(.16,1,.3,1)' }}>
        {['t','b','l','r','tl','tr','bl','br'].map(d => (<div key={d} onPointerDown={e=>startResize(d,e)} style={{ position:'absolute', zIndex:d.length>1?6:5, ...(d==='t'?{top:-4,left:16,right:16,height:8,cursor:'n-resize'}:d==='b'?{bottom:-4,left:16,right:16,height:8,cursor:'s-resize'}:d==='l'?{left:-4,top:16,bottom:16,width:8,cursor:'w-resize'}:d==='r'?{right:-4,top:16,bottom:16,width:8,cursor:'e-resize'}:d==='tl'?{top:-5,left:-5,width:16,height:16,cursor:'nw-resize'}:d==='tr'?{top:-5,right:-5,width:16,height:16,cursor:'ne-resize'}:d==='bl'?{bottom:-5,left:-5,width:16,height:16,cursor:'sw-resize'}:{bottom:-5,right:-5,width:16,height:16,cursor:'se-resize'}) }} />))}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:`${Math.round(12*scale)}px ${pad}px`, borderBottom:'1px solid hsl(var(--border))', cursor:'grab', background:'hsl(var(--card) / .85)', backdropFilter:'blur(12px)', borderRadius:'20px 20px 0 0', flexShrink:0, touchAction:'none', userSelect:'none', WebkitUserSelect:'none' }} onMouseDown={startMiniDrag} onTouchStart={startMiniDrag}>
          <div style={{ width:28, height:28, borderRadius:10, background:'hsl(var(--primary) / .08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><XLogo s={11} /></div>
          <span style={{ fontSize:Math.max(13,Math.round(15*scale)), fontWeight:600, flex:1, color:'var(--foreground)', letterSpacing:'0.3px' }}>Aura</span>
          <div style={{ display:'flex', gap:3 }}>
            {[{fn:()=>onModeChange('collapsed'),icon:<Minimize2 size={13}/>,t:'Minimize'},{fn:()=>onModeChange('full'),icon:<Maximize2 size={13}/>,t:'Full screen'},{fn:onClose,icon:<X size={13}/>,t:'Close'}].map((b,i)=>(<button key={i} onClick={b.fn} title={b.t} style={{ border:'none', background:'transparent', cursor:'pointer', padding:6, borderRadius:8, color:'var(--muted-foreground)', display:'flex', transition:'background .15s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{b.icon}</button>))}
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:pad, display:'flex', flexDirection:'column', gap:Math.round(12*scale), minHeight:0, overscrollBehavior:'contain', fontSize:fs, userSelect:'text', WebkitUserSelect:'text' }}>
          {messages.length===0 && !sending && (<div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'28px 10px', textAlign:'center' }}><div style={{ width:48, height:48, borderRadius:16, background:'hsl(var(--primary) / .06)', display:'flex', alignItems:'center', justifyContent:'center' }}><XLogo s={20}/></div><p style={{ fontSize:Math.max(13,Math.round(15*scale)), fontWeight:500, color:'var(--foreground)', margin:0 }}>How can I help?</p><p style={{ fontSize:Math.max(10,Math.round(11*scale)), color:'var(--muted-foreground)', margin:0 }}>Ask anything about the platform</p></div>)}
          {messages.map(msg=>(<div key={msg._id} style={{ display:'flex', gap:8, justifyContent:msg.role==='user'?'flex-end':'flex-start' }}>{msg.role==='assistant'&&<div style={{ width:22, height:22, borderRadius:8, background:'hsl(var(--primary) / .06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}><XLogo s={9}/></div>}{msg.role==='user'?(<div style={{ maxWidth:'78%', padding:`${Math.round(8*scale)}px ${Math.round(14*scale)}px`, background:'hsl(var(--primary) / .06)', color:'var(--foreground)', borderRadius:'16px 16px 4px 16px', fontSize:fs, lineHeight:1.5, border:'1px solid hsl(var(--primary) / .08)' }}>{msg.content}</div>):(<div style={{ maxWidth:'88%', fontSize:fs, lineHeight:1.6 }}><RichContent text={msg.content}/><div style={{ display:'flex', gap:2, marginTop:5, opacity:0.6 }}><button onClick={()=>copyText(msg._id,cleanText(msg.content))} style={{ border:'none', background:'transparent', cursor:'pointer', padding:3, borderRadius:6, color:copiedId===msg._id?'hsl(var(--primary))':'var(--muted-foreground)', display:'flex' }}>{copiedId===msg._id?<Check size={11}/>:<Copy size={11}/>}</button><button onClick={()=>submitFeedback(msg._id,'up')} className={feedbackAnim[msg._id]==='up'?'xa-fb-pop':''} style={{ border:'none', background:feedbackGiven[msg._id]==='up'?'hsl(var(--primary) / .08)':'transparent', cursor:'pointer', padding:3, borderRadius:6, color:feedbackGiven[msg._id]==='up'?'hsl(var(--primary))':'var(--muted-foreground)', display:'flex', transition:'all .2s cubic-bezier(.4,0,.2,1)' }}><ThumbsUp size={11}/></button><button onClick={()=>submitFeedback(msg._id,'down')} className={feedbackAnim[msg._id]==='down'?'xa-fb-shake':''} style={{ border:'none', background:feedbackGiven[msg._id]==='down'?'rgba(239,68,68,.06)':'transparent', cursor:'pointer', padding:3, borderRadius:6, color:feedbackGiven[msg._id]==='down'?'#ef4444':'var(--muted-foreground)', display:'flex', transition:'all .2s cubic-bezier(.4,0,.2,1)' }}><ThumbsDown size={11}/></button></div></div>)}</div>))}
          {sending&&<div style={{ display:'flex', gap:8 }}><div style={{ width:22, height:22, borderRadius:8, background:'hsl(var(--primary) / .06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><XLogo s={9}/></div><div><ThinkingStatus words={thinkingWords} rotationSpeed={rotationSpeed}/></div></div>}
          <div ref={messagesEndRef}/>
        </div>
        <div style={{ padding:`${Math.round(10*scale)}px ${pad}px ${Math.round(12*scale)}px`, borderTop:'1px solid hsl(var(--border))', flexShrink:0, background:'hsl(var(--card) / .65)', borderRadius:'0 0 20px 20px' }}>
          <form onSubmit={e=>{e.preventDefault();sendMessage();}} style={{ display:'flex', alignItems:'center', gap:6, background:'hsl(var(--background))', borderRadius:22, border:'1px solid hsl(var(--border))', padding:'0 4px 0 0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask Aura" disabled={sending} ref={inputRef} style={{ flex:1, height:Math.max(34,Math.round(38*scale)), borderRadius:22, padding:'0 14px', fontSize:Math.max(12,fs), border:'none', background:'transparent', outline:'none', color:'var(--foreground)' }} onFocus={e=>{e.currentTarget.parentElement.style.borderColor='hsl(var(--primary) / .3)';e.currentTarget.parentElement.style.boxShadow='0 0 0 3px hsl(var(--primary) / .06)';}} onBlur={e=>{e.currentTarget.parentElement.style.borderColor='rgba(0,0,0,0.08)';e.currentTarget.parentElement.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';}} />
            {sending?(<button type="button" onClick={stopRequest} style={{ border:'none', width:30, height:30, borderRadius:'50%', cursor:'pointer', background:'hsl(var(--primary) / .08)', color:'var(--muted-foreground)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="2"/></svg></button>):(<button type="submit" disabled={!input.trim()} className={sendAnim?'xa-send-fly':''} style={{ border:'none', width:30, height:30, borderRadius:'50%', cursor:input.trim()?'pointer':'default', background:input.trim()?'hsl(var(--primary))':'transparent', color:input.trim()?'#fff':'var(--muted-foreground)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .2s', opacity:input.trim()?1:0.4 }}><Send size={13}/></button>)}
          </form>
        </div>
      </div></>
    );
  }

  // ═══ FULL MODE ═══

  return (
    <div className="xa-root" data-testid="xaura-chat-panel">
      {/* ── Drawer backdrop ── */}
      {drawerOpen && <div className="xa-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      {/* ── Slide-out drawer ── */}
      <div className={`xa-drawer ${drawerOpen ? 'xa-drawer-open' : ''}`}>
        <div className="xa-drawer-search">
          <div className="xa-search-box">
            <Search className="xa-search-icon" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="xa-search-input" data-testid="xaura-search" />
          </div>
        </div>
        <p className="xa-drawer-label">Chats</p>
        <div className="xa-drawer-list">
          {loadingSessions ? <div className="xa-loading"><div className="xa-spinner" /></div> :
           filteredSessions.length === 0 ? <p className="xa-empty">No chats yet</p> :
           filteredSessions.map((s, i) => (
            <div key={s._id} data-testid={`xaura-session-${s._id}`}
              className={`xa-session-item ${activeSession === s._id ? 'xa-session-active' : ''}`}
              style={{ animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
              onClick={() => { if (editingSessionId !== s._id) selectSession(s._id); }}>
              <div className="xa-session-icon"><MessageSquare size={14} /></div>
              {editingSessionId === s._id ? (
                <input
                  autoFocus
                  value={editingSessionName}
                  onChange={e => setEditingSessionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameSession(s._id); if (e.key === 'Escape') setEditingSessionId(null); }}
                  onBlur={() => renameSession(s._id)}
                  onClick={e => e.stopPropagation()}
                  className="xa-session-rename-input"
                  data-testid={`xaura-rename-input-${s._id}`}
                />
              ) : (
                <span className="xa-session-title">{s.title || 'Untitled'}</span>
              )}
              <div className="xa-session-actions">
                <button onClick={e => { e.stopPropagation(); setEditingSessionId(s._id); setEditingSessionName(s.title || ''); }} className="xa-session-edit" data-testid={`xaura-edit-${s._id}`} title="Rename"><Pencil size={12} /></button>
                <button onClick={e => deleteSession(s._id, e)} className="xa-session-del" data-testid={`xaura-delete-${s._id}`} title="Delete"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="xa-drawer-bottom">
          <button onClick={newChat} className="xa-new-chat-btn" data-testid="xaura-new-chat">
            <span>New Chat</span>
            <div className="xa-new-chat-plus"><Plus size={16} strokeWidth={2.5} /></div>
          </button>
        </div>
      </div>

      {/* ── Main screen ── */}
      <div className="xa-main">
        {/* Header */}
        <div className="xa-header">
          <button onClick={() => setDrawerOpen(true)} className="xa-burger" data-testid="xaura-toggle-sidebar">
            <Menu size={22} />
          </button>
          <div className="xa-header-center">
            <svg width="28" height="46" viewBox="0 0 40 68" fill="none" xmlns="http://www.w3.org/2000/svg" className="xa-header-logo">
              <path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="hsl(var(--foreground))" strokeWidth="6"/>
              <path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/>
            </svg>
            <span className="xa-header-title">AURA</span>
          </div>
          <div className="xa-header-actions">
            <button onClick={() => { if (onModeChange) onModeChange('mini'); }} className="xa-header-close" title="Mini window"><Minimize2 size={16} /></button>
            <button onClick={onClose} className="xa-header-close" data-testid="xaura-close"><X size={18} /></button>
          </div>
        </div>

        {/* Chat area */}
        <div className="xa-chat-area" ref={chatAreaRef}>
          {messages.length === 0 && !sending && (
            <div className="xa-anim-fade" style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: 'hsl(var(--primary) / .06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <XLogo s={20} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>What can I help you with?</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>Explore what Aura can do for you</p>
              </div>

              {/* Capability Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                {CAPABILITIES.map((cap, i) => {
                  const IconComp = cap.iconKey === 'ecg' ? Activity : cap.iconKey === 'image' ? Image : cap.iconKey === 'users' ? UsersIcon : Package;
                  return (
                    <button key={i} onClick={() => { setInput(cap.query); inputRef.current?.focus(); }}
                      style={{ textAlign: 'left', padding: 14, borderRadius: 14, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', cursor: 'pointer', transition: 'all .2s' }}
                      className="hover:shadow-md hover:border-primary/30"
                      data-testid={`capability-${i}`}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cap.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <IconComp size={18} style={{ color: cap.color }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{cap.title}</p>
                      <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.4 }}>{cap.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Suggestion Chips */}
              <div style={{ marginBottom: 8, textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Try asking</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid hsl(var(--border))', background: 'transparent', fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap' }}
                      className="hover:bg-primary/5 hover:border-primary/30 hover:text-foreground"
                      data-testid={`suggestion-${i}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="xa-messages">
            {messages.map(msg => (
              <div key={msg._id} className={`xa-msg xa-anim-msg ${msg.role === 'user' ? 'xa-msg-user' : 'xa-msg-aura'}`}>
                {msg.role === 'assistant' && (
                  <div className="xa-aura-block">
                    <div className="xa-aura-label">
                      <svg width="14" height="22" viewBox="0 0 40 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="hsl(var(--foreground))" strokeWidth="6"/><path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/></svg>
                      <span>Aura</span>
                    </div>
                    <div className="xa-aura-text">
                      {msg._id === streamingId ? (
                        <StreamingText text={msg.content} onDone={() => setStreamingId(null)} />
                      ) : (
                        <RichContent text={msg.content} />
                      )}
                    </div>
                    {msg._id !== streamingId && (
                      <div className="xa-msg-actions">
                        <button onClick={() => copyText(msg._id, cleanText(msg.content))} className="xa-copy-btn" title="Copy">
                          {copiedId === msg._id ? <Check size={13} className="xa-copied" /> : <Copy size={13} />}
                        </button>
                        <button onClick={() => submitFeedback(msg._id, 'up')} className={`xa-fb-btn ${feedbackGiven[msg._id] === 'up' ? 'xa-fb-active' : ''} ${feedbackAnim[msg._id] === 'up' ? 'xa-fb-pop' : ''}`} title="Helpful">
                          <ThumbsUp size={13} />
                        </button>
                        <button onClick={() => submitFeedback(msg._id, 'down')} className={`xa-fb-btn ${feedbackGiven[msg._id] === 'down' ? 'xa-fb-down' : ''} ${feedbackAnim[msg._id] === 'down' ? 'xa-fb-shake' : ''}`} title="Not helpful">
                          <ThumbsDown size={13} />
                        </button>
                        <button onClick={() => openShareModal(msg._id, msg.content)} className="xa-fb-btn" title="Share to chat">
                          <Share2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="xa-user-wrap">
                    <button onClick={() => copyText(msg._id, msg.content)} className="xa-user-copy" title="Copy">
                      {copiedId === msg._id ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                    <div className="xa-user-bubble">{msg.content}</div>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="xa-msg xa-msg-aura xa-anim-msg">
                <div className="xa-aura-block">
                  <div className="xa-aura-label">
                    <svg width="14" height="22" viewBox="0 0 40 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="hsl(var(--foreground))" strokeWidth="6"/><path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/></svg>
                    <span>Aura</span>
                  </div>
                  <div className="xa-thinking-wrap">
                    <ThinkingStatus words={thinkingWords} rotationSpeed={rotationSpeed} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showScrollBtn && (
            <button className="xa-scroll-btn xa-anim-fade" onClick={scrollToBottom}>
              <ChevronDown size={16} />
            </button>
          )}
        </div>

        {/* Input bar */}
        <div className="xa-input-bar">
          <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="xa-input-form">
            <div
              className="xa-input-glow-wrap"
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                e.currentTarget.style.setProperty('--glow-x', `${x}%`);
              }}
              onMouseLeave={e => {
                e.currentTarget.style.setProperty('--glow-x', '50%');
              }}
            >
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Aura"
                className="xa-input" disabled={sending} data-testid="xaura-input" />
            </div>
            {sending ? (
              <button type="button" onClick={stopRequest} className="xa-stop-circle" data-testid="xaura-stop" title="Stop">
                <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="2" /></svg>
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className={`xa-send-btn ${sendAnim ? 'xa-send-fly' : ''}`} data-testid="xaura-send">
                <Send size={18} />
              </button>
            )}
          </form>
        </div>
      </div>


      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-card border rounded-2xl w-full max-w-md mx-4 shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-3 shrink-0">
              <Share2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold flex-1">Share Aura's Response</h2>
              <button onClick={() => setShareModal(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            {/* Preview */}
            <div className="px-5 py-3 border-b bg-muted/30">
              {shareIncludeQ && shareModal.questionText && (
                <p className="text-[10px] text-muted-foreground mb-1">💬 {shareModal.questionText.slice(0, 100)}{shareModal.questionText.length > 100 ? '...' : ''}</p>
              )}
              <p className="text-xs line-clamp-3 flex items-start gap-1"><svg width="10" height="16" viewBox="0 0 40 68" fill="none" className="shrink-0 mt-0.5"><path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="hsl(var(--foreground))" strokeWidth="6"/><path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/></svg> <span>{shareModal.responseText.slice(0, 200)}{shareModal.responseText.length > 200 ? '...' : ''}</span></p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={shareIncludeQ} onChange={e => setShareIncludeQ(e.target.checked)} className="rounded" />
                <span className="text-[10px] text-muted-foreground">Include your question</span>
              </label>
            </div>

            {/* Search + Conversation list */}
            <div className="px-4 pt-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={shareSearch} onChange={e => setShareSearch(e.target.value)} placeholder="Search chats..." className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-transparent text-xs outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {shareConvos.filter(c => !shareSearch || (c.display_name || '').toLowerCase().includes(shareSearch.toLowerCase())).map(c => {
                const selected = shareTargets.includes(c._id);
                const name = c.display_name || c.other_members?.[0]?.name || 'Unknown';
                const isGroup = c.type === 'group';
                return (
                  <button key={c._id} onClick={() => setShareTargets(prev => selected ? prev.filter(x => x !== c._id) : [...prev, c._id])}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 mb-1 transition-colors ${selected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isGroup ? 'bg-violet-500/10 text-violet-600' : 'bg-primary/10 text-primary'}`}>
                      {name[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-xs flex-1 truncate">{name}</span>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                      {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t flex items-center gap-3 shrink-0">
              <span className="text-[10px] text-muted-foreground flex-1">{shareTargets.length} selected</span>
              <button onClick={() => setShareModal(null)} className="px-4 py-2 text-xs rounded-lg border hover:bg-muted transition-colors">Cancel</button>
              <button onClick={executeShare} disabled={shareTargets.length === 0}
                className={`px-4 py-2 text-xs rounded-lg font-medium transition-colors gap-1.5 flex items-center ${shareTargets.length > 0 ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'}`}>
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        /* ═══════════ ROOT ═══════════ */
        .xa-root { position:fixed; inset:0; z-index:200; display:flex; flex-direction:column; background:hsl(var(--background)); animation: xaFadeIn .2s ease-out; overscroll-behavior:none; touch-action:pan-x pan-y; -webkit-overflow-scrolling:touch; }
        .xa-main { display:flex; flex-direction:column; flex:1; min-height:0; background:hsl(var(--background)); position:relative; z-index:1; }

        /* ═══════════ DRAWER ═══════════ */
        .xa-drawer-backdrop { position:fixed; inset:0; z-index:210; background:rgba(0,0,0,.18); animation: xaFadeIn .2s; }
        .xa-drawer {
          position:fixed; top:0; left:0; bottom:0; z-index:220; width:280px;
          background:hsl(var(--card)); display:flex; flex-direction:column;
          transform:translateX(-100%); transition:transform .28s cubic-bezier(.4,0,.2,1);
          box-shadow:4px 0 24px rgba(0,0,0,.08);
        }
        .xa-drawer-open { transform:translateX(0); }
        .xa-drawer-search { padding:20px 16px 8px; }
        .xa-search-box {
          display:flex; align-items:center; gap:10px; background:hsl(var(--muted));
          border-radius:24px; padding:10px 16px; border:1px solid hsl(var(--border));
        }
        .xa-search-icon { width:16px; height:16px; color:var(--muted-foreground, #9ca3af); flex-shrink:0; }
        .xa-search-input { flex:1; border:none; background:transparent; outline:none; font-size:14px; color:var(--foreground, #111); }
        .xa-search-input::placeholder { color:var(--muted-foreground, #9ca3af); }
        .xa-drawer-label { font-size:13px; font-weight:600; color:var(--foreground, #111); padding:12px 20px 4px; }
        .xa-drawer-list { flex:1; overflow-y:auto; padding:4px 12px; }
        .xa-session-item {
          display:flex; align-items:center; gap:10px; width:100%; text-align:left;
          padding:12px 14px; border-radius:12px; border:none; cursor:pointer;
          background:transparent; transition:background .15s; margin-bottom:2px;
          animation: xaSlideRight .3s ease-out both;
        }
        .xa-session-item:hover { background:hsl(var(--muted)); }
        .xa-session-active { background:hsl(var(--primary) / .08); }
        .xa-session-icon {
          width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center;
          background:hsl(var(--primary) / .08); color:hsl(var(--primary));
          flex-shrink:0;
        }
        .xa-session-title { flex:1; font-size:13px; color:var(--foreground, #333); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .xa-session-del { opacity:0; border:none; background:transparent; cursor:pointer; color:var(--muted-foreground); padding:4px; border-radius:6px; transition:opacity .15s, background .15s; }
        .xa-session-edit { opacity:0; border:none; background:transparent; cursor:pointer; color:var(--muted-foreground); padding:4px; border-radius:6px; transition:opacity .15s, background .15s; }
        .xa-session-actions { display:flex; align-items:center; gap:2px; flex-shrink:0; }
        .xa-session-item:hover .xa-session-del,
        .xa-session-item:hover .xa-session-edit { opacity:1; }
        .xa-session-del:hover { background:hsl(0 84% 60% / .1); color:#ef4444; }
        .xa-session-edit:hover { background:hsl(var(--primary) / .1); color:hsl(var(--primary)); }
        .xa-session-rename-input {
          flex:1; font-size:13px; color:var(--foreground); border:1.5px solid hsl(var(--primary) / .4);
          background:hsl(var(--background)); border-radius:6px; padding:2px 8px; outline:none;
          min-width:0; height:26px;
        }
        .xa-session-rename-input:focus { box-shadow:0 0 0 2px hsl(var(--primary) / .12); }
        .xa-drawer-bottom { padding:12px 16px; border-top:1px solid hsl(var(--border)); }
        .xa-new-chat-btn {
          display:flex; align-items:center; justify-content:space-between; width:100%;
          padding:12px 14px; border-radius:14px; border:none; cursor:pointer;
          background:hsl(var(--primary) / .06); color:hsl(var(--primary)); font-size:14px; font-weight:500;
          transition:background .15s;
        }
        .xa-new-chat-btn:hover { background:hsl(var(--primary) / .12); }
        .xa-new-chat-plus {
          width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center;
          background:hsl(var(--primary)); color:white;
        }

        /* ═══════════ HEADER ═══════════ */
        .xa-header {
          display:flex; align-items:center; height:64px; padding:0 16px;
          border-bottom:1px solid hsl(var(--border)); flex-shrink:0; gap:12px;
          background:hsl(var(--card));
        }
        .xa-burger { border:none; background:transparent; cursor:pointer; padding:4px; color:var(--foreground); display:flex; }
        .xa-header-center { display:flex; align-items:center; gap:10px; flex:1; justify-content:center; }
        .xa-header-logo { flex-shrink:0; }
        .xa-header-title { font-size:20px; font-weight:600; letter-spacing:3px; color:var(--foreground, #111); }
        .xa-header-close { border:none; background:transparent; cursor:pointer; padding:6px; border-radius:8px; color:var(--muted-foreground); display:flex; transition:all .15s; }
        .xa-header-close:hover { background:hsl(var(--primary) / .1); color:hsl(var(--primary)); }

        /* ═══════════ CHAT AREA ═══════════ */
        .xa-chat-area { flex:1; overflow-y:auto; padding:20px 16px; position:relative; overscroll-behavior:contain; user-select:text; -webkit-user-select:text; }
        .xa-messages { display:flex; flex-direction:column; gap:20px; }
        .xa-empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px 20px; }
        .xa-empty-icon { width:56px; height:56px; border-radius:16px; background:hsl(var(--primary) / .08); display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
        .xa-empty-icon img { width:28px; height:28px; opacity:.5; }
        .xa-empty-title { font-size:15px; font-weight:500; color:var(--foreground, #333); }
        .xa-empty-sub { font-size:12px; color:var(--muted-foreground); margin-top:4px; }

        /* Messages */
        .xa-msg-user { display:flex; justify-content:flex-end; }
        .xa-msg-aura { display:flex; justify-content:flex-start; }
        .xa-user-bubble {
          max-width:80%; padding:10px 16px; font-size:14px; line-height:1.5;
          background:hsl(var(--muted)); color:var(--foreground);
          border-radius:20px 20px 6px 20px; border:1px solid hsl(var(--border));
          user-select:text; -webkit-user-select:text;
        }
        .xa-user-wrap { display:flex; align-items:flex-start; gap:4px; justify-content:flex-end; }
        .xa-user-copy {
          border:none; background:transparent; cursor:pointer; padding:4px; border-radius:6px;
          color:var(--muted-foreground); display:flex; opacity:0; transition:opacity .15s;
          margin-top:8px;
        }
        .xa-user-wrap:hover .xa-user-copy { opacity:0.6; }
        .xa-user-copy:hover { opacity:1 !important; color:hsl(var(--primary)); }
        .xa-aura-block { max-width:92%; }
        .xa-aura-label { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
        .xa-aura-avatar { width:16px; height:16px; }
        .xa-aura-label span { font-size:14px; font-weight:600; color:var(--foreground); }
        .xa-aura-text {
          font-size:14px; line-height:1.65; color:var(--foreground, #444);
          padding-left:22px; white-space:pre-wrap;
        }
        .xa-copy-btn {
          margin-top:6px; margin-left:22px; border:none; background:transparent; cursor:pointer;
          color:var(--muted-foreground); padding:4px; border-radius:6px; transition:color .15s;
          display:inline-flex; align-items:center;
        }
        .xa-copy-btn:hover { color:var(--foreground); }
        .xa-copied { color:hsl(var(--primary)); }
        .xa-msg-actions { display:flex; align-items:center; gap:2px; margin-top:6px; margin-left:22px; }
        .xa-fb-btn {
          border:none; background:transparent; cursor:pointer; padding:4px; border-radius:6px;
          color:var(--muted-foreground); display:flex; transition:all .2s cubic-bezier(.4,0,.2,1);
        }
        .xa-fb-btn:hover { color:var(--foreground); background:var(--muted); transform:scale(1.15); }
        .xa-fb-btn:active { transform:scale(0.9); }
        .xa-fb-active { color:hsl(var(--primary)) !important; background:hsl(var(--primary) / .08) !important; }
        .xa-fb-down { color:#ef4444 !important; background:rgba(239,68,68,.06) !important; }
        .xa-fb-pop { animation:xaFbPop .5s cubic-bezier(.17,.67,.21,1.4); }
        .xa-fb-shake { animation:xaFbShake .5s cubic-bezier(.36,.07,.19,.97); }
        @keyframes xaFbPop {
          0% { transform:scale(1); }
          20% { transform:scale(1.5) rotate(-8deg); }
          40% { transform:scale(0.9) rotate(4deg); }
          60% { transform:scale(1.2) rotate(-2deg); }
          100% { transform:scale(1) rotate(0); }
        }
        @keyframes xaFbShake {
          0% { transform:scale(1); }
          15% { transform:scale(1.3) rotate(6deg); }
          30% { transform:translateX(-3px) scale(1.1); }
          45% { transform:translateX(3px) scale(1.1); }
          60% { transform:translateX(-2px); }
          75% { transform:translateX(1px); }
          100% { transform:translateX(0) scale(1); }
        }

        /* Rich content: images, galleries, EDF cards */
        .xa-rich-img-wrap { margin:10px 0; }
        .xa-rich-img { max-width:100%; max-height:280px; border-radius:12px; border:1px solid hsl(var(--border)); cursor:pointer; transition:transform .15s; object-fit:cover; }
        .xa-rich-img:hover { transform:scale(1.02); }
        .xa-gallery-wrap { margin:10px 0; position:relative; }
        .xa-gallery { display:flex; gap:8px; overflow-x:auto; padding:4px 0; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
        .xa-gallery::-webkit-scrollbar { display:none; }
        .xa-gallery-img { width:140px; height:100px; object-fit:cover; border-radius:10px; border:1px solid var(--border); cursor:pointer; flex-shrink:0; scroll-snap-align:start; transition:transform .15s; }
        .xa-gallery-img:hover { transform:scale(1.05); }
        .xa-gallery-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:2; width:28px; height:28px; border-radius:50%; border:1px solid var(--border); background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 4px rgba(0,0,0,.1); }
        .xa-gallery-left { left:-6px; }
        .xa-gallery-right { right:-6px; }
        .xa-gallery-count { font-size:11px; color:var(--muted-foreground); margin-top:4px; }
        .xa-edf-card { display:flex; align-items:center; gap:10px; padding:10px 14px; margin:8px 0; border-radius:10px; border:1px solid var(--border); background:hsl(var(--muted)); }
        .xa-edf-icon { width:36px; height:36px; border-radius:8px; background:hsl(var(--primary) / .1); color:hsl(var(--primary)); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0; }
        .xa-edf-name { flex:1; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .xa-edf-link { font-size:12px; color:hsl(var(--primary)); text-decoration:underline; flex-shrink:0; }

        /* ECG Preview */
        .xa-edf-container { margin:10px 0; border:1px solid hsl(var(--border)); border-radius:12px; overflow:hidden; background:#fff; }
        .xa-edf-header { display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid hsl(var(--border)); }
        .xa-edf-dl { color:var(--muted-foreground); padding:4px; border-radius:6px; display:flex; transition:color .15s; }
        .xa-edf-dl:hover { color:hsl(var(--primary)); }
        .xa-edf-loading { display:flex; align-items:center; gap:8px; padding:16px; font-size:12px; color:var(--muted-foreground); }
        .xa-edf-error { padding:12px; font-size:12px; color:#ef4444; }
        .xa-ecg-info { display:flex; gap:12px; padding:6px 14px; font-size:11px; color:var(--muted-foreground); }
        .xa-ecg-scroll { overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; padding:0 4px 8px; }
        .xa-ecg-scroll::-webkit-scrollbar { height:4px; }
        .xa-ecg-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }
        .xa-ecg-canvas { display:block; height:160px; min-width:100%; }

        /* Thinking dots */
        .xa-thinking-wrap { padding-left:22px; padding-top:2px; }
        .xa-stop-btn { display:none; }
        .xa-stop-circle {
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          width:36px; height:36px; border-radius:50%; border:1.5px solid var(--border, #e5e7eb);
          background:hsl(var(--background)); cursor:pointer; color:var(--muted-foreground);
          transition:all .15s;
        }
        .xa-stop-circle:hover { border-color:hsl(var(--primary) / .4); color:hsl(var(--primary)); background:hsl(var(--primary) / .05); }

        /* Scroll button */
        .xa-scroll-btn {
          position:fixed; left:12px; bottom:80px; z-index:10;
          width:32px; height:32px; border-radius:50%; border:1px solid var(--border);
          background:var(--card); display:flex; align-items:center; justify-content:center;
          cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.1);
          color:var(--muted-foreground);
        }

        /* ═══════════ INPUT BAR ═══════════ */
        .xa-input-bar {
          padding:12px 16px 24px; flex-shrink:0;
          padding-bottom:max(24px, env(safe-area-inset-bottom));
          background:hsl(var(--card));
        }
        .xa-input-form { display:flex; align-items:center; gap:8px; position:relative; }
        .xa-input-glow-wrap {
          --glow-x:50%;
          flex:1; position:relative; border-radius:26px;
        }
        .xa-input {
          width:100%; height:44px; border-radius:24px; padding:0 18px;
          border:1.5px solid #dde0e4; background:hsl(var(--card));
          font-size:16px; color:var(--foreground); outline:none;
          -webkit-appearance:none;
          transition:border-color .3s, box-shadow .3s;
          animation:xaGlow 4s ease-in-out infinite;
        }
        .xa-input:focus {
          border-color:hsl(var(--primary) / .5);
          box-shadow:0 0 0 3px hsl(var(--primary) / .1), 0 0 16px hsl(var(--primary) / .12);
          animation:none;
        }
        .xa-input-glow-wrap:hover .xa-input {
          border-color:hsl(var(--primary) / .35);
        }
        .xa-input::placeholder { color:var(--muted-foreground, #9ca3af); }
        .xa-send-btn {
          border:none; background:transparent; cursor:pointer; padding:10px;
          color:var(--muted-foreground); transition:color .15s; display:flex; flex-shrink:0;
        }
        .xa-send-btn:not(:disabled):hover { color:hsl(var(--primary)); transform:scale(1.1); }
        .xa-send-btn:disabled { opacity:.3; cursor:default; }
        .xa-send-fly { animation:xaSendFly .65s cubic-bezier(.22,.68,0,1.2); }

        /* ═══════════ LOADING ═══════════ */
        .xa-loading { display:flex; justify-content:center; padding:32px 0; }
        .xa-spinner { width:20px; height:20px; border:2px solid var(--border); border-top-color:hsl(var(--primary)); border-radius:50%; animation:xaSpin .6s linear infinite; }
        .xa-empty { text-align:center; padding:24px 0; font-size:13px; color:var(--muted-foreground); }

        /* ═══════════ DESKTOP ═══════════ */
        @media(min-width:768px) {
          .xa-drawer { width:300px; }
          .xa-chat-area { padding:24px 32px; }
          .xa-messages { max-width:680px; margin:0 auto; }
          .xa-input-form { max-width:680px; margin:0 auto; }
          .xa-aura-block { max-width:85%; }
          .xa-user-bubble { max-width:70%; }
        }

        /* ═══════════ ANIMATIONS ═══════════ */
        @keyframes xaFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes xaGlow {
          0%,100% { box-shadow:0 0 0 0 transparent, 0 0 0 0 transparent; border-color:#dde0e4; }
          50% { box-shadow:0 0 0 2px hsl(var(--primary) / .08), 0 0 12px hsl(var(--primary) / .08); border-color:hsl(var(--primary) / .25); }
        }
        @keyframes xaSlideRight { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        @keyframes xaDotBounce { 0%,80%,100% { transform:scale(.5); opacity:.3; } 40% { transform:scale(1.1); opacity:1; } }
        @keyframes xaSpin { to { transform:rotate(360deg); } }
        .xa-anim-fade { animation: xaFadeIn .4s ease-out both; }
        .xa-anim-msg { animation: xaMsgIn .3s ease-out both; }
        .xa-stream-cursor { display:inline-block; width:2px; height:14px; background:hsl(var(--primary) / .6); margin-left:1px; vertical-align:text-bottom; animation:xaCursorBlink .7s step-end infinite; }
        @keyframes xaCursorBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes xaMsgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

        /* Header actions row */
        .xa-header-actions { display:flex; align-items:center; gap:2px; }

        /* ═══ COLLAPSED POPUP (voice-call card style) ═══ */
        .xf-popup {
          width:220px; border-radius:20px; background:#fff; overflow:visible;
          box-shadow:0 12px 48px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.04);
          animation:xaFadeIn .25s ease-out;
        }
        .xf-popup-nub {
          width:36px; height:5px; border-radius:3px; background:hsl(var(--border)); margin:8px auto 0;
          cursor:grab;
        }
        .xf-popup-nub:active { cursor:grabbing; background:var(--muted-foreground); }
        .xf-popup-body { display:flex; align-items:center; gap:12px; padding:14px 18px 8px; }
        .xf-popup-icon {
          width:44px; height:44px; border-radius:14px; background:hsl(var(--primary) / .08);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .xf-popup-info { flex:1; min-width:0; }
        .xf-popup-name { font-size:14px; font-weight:600; color:var(--foreground); }
        .xf-popup-sub { font-size:11px; color:var(--muted-foreground); }
        .xf-popup-acts { display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 18px 14px; }
        .xf-popup-btn {
          width:36px; height:36px; border-radius:50%; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          background:hsl(var(--muted)); color:var(--muted-foreground); transition:all .15s;
        }
        .xf-popup-btn:hover { background:hsl(var(--primary) / .1); color:hsl(var(--primary)); }
        .xf-popup-expand { background:hsl(var(--primary) / .08); color:hsl(var(--primary)); }
        .xf-popup-close { background:#fee2e2; color:#ef4444; }
        .xf-popup-close:hover { background:#fecaca; }

        /* ═══ MINI CHAT WIDGET ═══ */
        .xf-widget {
          display:flex; flex-direction:column; border-radius:16px; overflow:hidden; position:relative;
          box-shadow:0 12px 48px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.08);
          background:hsl(var(--card)); animation:xaFadeIn .25s ease-out;
          border:1px solid rgba(0,0,0,.06);
        }
        .xf-w-hdr {
          display:flex; align-items:center; gap:8px; padding:11px 14px;
          border-bottom:1px solid var(--border); cursor:grab; user-select:none;
        }
        .xf-w-hdr:active { cursor:grabbing; }
        .xf-w-t { font-size:14px; font-weight:600; flex:1; }
        .xf-w-btns { display:flex; gap:2px; }
        .xf-w-btns button {
          border:none; background:transparent; cursor:pointer; padding:5px; border-radius:8px;
          color:var(--muted-foreground); display:flex; transition:all .15s;
        }
        .xf-w-btns button:hover { background:hsl(var(--primary) / .1); color:hsl(var(--primary)); }
        .xf-w-body {
          flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:12px;
          overscroll-behavior:contain; min-height:0;
        }
        .xf-w-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:40px 10px; color:var(--muted-foreground); font-size:13px; }
        .xf-w-row { display:flex; gap:8px; }
        .xf-w-row-u { justify-content:flex-end; }
        .xf-w-av { width:20px; flex-shrink:0; padding-top:2px; }
        .xf-w-bub-u { max-width:80%; padding:8px 14px; background:hsl(var(--muted)); border-radius:16px 16px 4px 16px; font-size:13px; line-height:1.5; }
        .xf-w-bub-a { max-width:90%; font-size:13px; line-height:1.6; white-space:pre-wrap; color:var(--foreground); }
        .xf-w-foot { padding:10px 12px; border-top:1px solid var(--border); }
        .xf-w-form { display:flex; align-items:center; gap:6px; }
        .xf-w-inp {
          flex:1; height:38px; border-radius:20px; padding:0 14px; font-size:14px;
          border:1px solid var(--border); background:#fff; outline:none; color:var(--foreground);
        }
        .xf-w-inp:focus { border-color:hsl(var(--primary) / .4); }
        .xf-w-inp::placeholder { color:var(--muted-foreground); }
        .xf-w-snd {
          border:none; background:transparent; cursor:pointer; padding:6px; color:var(--muted-foreground);
          display:flex; transition:color .15s;
        }
        .xf-w-snd:not(:disabled):hover { color:hsl(var(--primary)); }
        .xf-w-snd:disabled { opacity:.3; }
        .xf-w-grip {
          position:absolute; bottom:0; right:0; width:18px; height:18px; cursor:se-resize;
          background:linear-gradient(135deg, transparent 50%, var(--muted-foreground) 50%, var(--muted-foreground) 55%, transparent 55%, transparent 70%, var(--muted-foreground) 70%, var(--muted-foreground) 75%, transparent 75%);
          opacity:.2; border-radius:0 0 16px 0; transition:opacity .15s;
        }
        .xf-w-grip:hover { opacity:.45; }
      `}</style>
    </div>
  );
}
