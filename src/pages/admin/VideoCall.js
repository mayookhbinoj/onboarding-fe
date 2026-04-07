import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, Maximize, Minimize2, Maximize2, AlertTriangle, Signal } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { showCallNotification, dismissCallNotification } from '../../utils/callNotifications';

const ICE_SERVERS_FALLBACK = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ── Optimised RTC config ──
const RTC_CONFIG_BASE = {
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const MAX_ICE_RESTARTS = 3;

// ── Adaptive bitrate tiers ──
const BITRATE_TIERS = {
  high:    { maxBitrate: 2500000, maxFramerate: 30 },
  medium:  { maxBitrate: 1000000, maxFramerate: 24 },
  low:     { maxBitrate: 500000,  maxFramerate: 20 },
  veryLow: { maxBitrate: 150000,  maxFramerate: 15 },
};

function ControlButton({ icon: Icon, label, active, onClick, danger, highlight }) {
  return (
    <div className="text-center">
      <button onClick={onClick} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${danger ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : highlight ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' : active ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10' : 'bg-white/5 text-white/40 hover:bg-white/10 border border-white/5'}`} title={label}>
        <Icon className="w-5 h-5" />
      </button>
      <p className="text-[9px] text-white/50 mt-1">{label}</p>
    </div>
  );
}

export default function GlobalVideoCall() {
  const { user, api } = useAuth();
  const { send, addListener, removeListener, wsRef } = useSocket();
  const [state, setState] = useState('idle');
  const [peer, setPeer] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [peerCameraOff, setPeerCameraOff] = useState(false);
  const [peerScreenSharing, setPeerScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState('good');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ bitrate: 0, packetLoss: 0, resolution: '', fps: 0, rtt: 0 });

  const stateRef = useRef('idle');
  const peerRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const timerRef = useRef(null);
  const timeoutRef = useRef(null);
  const iceBufferRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const pollRef = useRef(null);
  const answerSentRef = useRef(false);
  const iceDisconnectTimerRef = useRef(null);
  const statsTimerRef = useRef(null);
  const endCallRef = useRef(null);
  const callNotifRef = useRef(null);
  const containerRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceRestartCountRef = useRef(0);
  const makingOfferRef = useRef(false); // polite peer
  const currentBitrateTierRef = useRef('high');
  const deviceChangeHandlerRef = useRef(null);
  const lastBytesSentRef = useRef(0);
  const lastBytesTimestampRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { peerRef.current = peer; }, [peer]);

  const getMedia = useCallback(async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280, min: 320 }, height: { ideal: 720, min: 240 }, frameRate: { ideal: 30, min: 15 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 }
      });
    } catch (err) {
      try {
        console.warn('[VideoCall] Retrying getUserMedia with minimal constraints');
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err2) {
        console.error('[VideoCall] getUserMedia error:', err2);
        toast.error(err2.name === 'NotAllowedError' ? 'Camera/mic access denied' : 'Could not access camera/microphone');
        return null;
      }
    }
  }, []);

  // ── FIX: sendBeacon for beforeunload ──
  useEffect(() => {
    const onBeforeUnload = () => {
      if (stateRef.current !== 'idle' && peerRef.current) {
        const p = peerRef.current;
        if (send) send({ type: 'vcall:end', target_user_id: p.user_id });
        try {
          const API = process.env.REACT_APP_BACKEND_URL || '';
          const token = localStorage.getItem('beatx_token');
          if (API && token) {
            navigator.sendBeacon(
              `${API}/api/call/cleanup-beacon`,
              new Blob([JSON.stringify({ target_user_id: p.user_id, _token: token, call_type: 'video' })], { type: 'application/json' })
            );
          }
        } catch {}
        window.__callBusy = false;
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [send]);

  const cleanup = useCallback(() => {
    console.log('[VideoCall] cleanup');
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null; screenStreamRef.current = null; remoteStreamRef.current = null;
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    clearInterval(timerRef.current); clearTimeout(timeoutRef.current);
    clearTimeout(iceDisconnectTimerRef.current); clearInterval(statsTimerRef.current);
    timerRef.current = null; timeoutRef.current = null; statsTimerRef.current = null;
    setDuration(0); setMuted(false); setCameraOff(false); setScreenSharing(false);
    setPeerCameraOff(false); setPeerScreenSharing(false); setQuality('good');
    setShowStats(false); setMinimized(false); setIsFullscreen(false);
    iceBufferRef.current = []; pendingOfferRef.current = null; answerSentRef.current = false;
    originalVideoTrackRef.current = null;
    iceRestartCountRef.current = 0;
    makingOfferRef.current = false;
    currentBitrateTierRef.current = 'high';
    lastBytesSentRef.current = 0;
    lastBytesTimestampRef.current = 0;
    // Remove device change listener
    if (deviceChangeHandlerRef.current) {
      navigator.mediaDevices?.removeEventListener('devicechange', deviceChangeHandlerRef.current);
      deviceChangeHandlerRef.current = null;
    }
    dismissCallNotification(callNotifRef.current);
    callNotifRef.current = null;
    window.__callBusy = false;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const attachRemoteStream = useCallback((stream) => {
    console.log('[VideoCall] Attaching remote stream, tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`));
    remoteStreamRef.current = stream;
    const tryAttach = () => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        const playPromise = remoteVideoRef.current.play();
        if (playPromise) {
          playPromise.catch(() => {
            console.log('[VideoCall] Play blocked, retrying in 500ms...');
            setTimeout(() => {
              if (remoteVideoRef.current && remoteStreamRef.current) {
                remoteVideoRef.current.srcObject = remoteStreamRef.current;
                remoteVideoRef.current.play().catch(() => {
                  console.warn('[VideoCall] Play still blocked — user may need to tap screen');
                });
              }
            }, 500);
          });
        }
      } else {
        setTimeout(tryAttach, 200);
      }
    };
    tryAttach();
  }, []);

  const drainIceBuffer = useCallback(() => {
    if (pcRef.current?.remoteDescription && iceBufferRef.current.length > 0) {
      console.log(`[VideoCall] Draining ${iceBufferRef.current.length} buffered ICE candidates`);
      iceBufferRef.current.forEach(c => {
        pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(e => console.warn('[VideoCall] ICE add error:', e));
      });
      iceBufferRef.current = [];
    }
  }, []);

  const fetchIceServers = useCallback(async () => {
    try {
      const res = await api.get('/api/call/ice-servers');
      return res.data.ice_servers;
    } catch (err) {
      console.error('[VideoCall] Failed to fetch ICE servers:', err);
      return ICE_SERVERS_FALLBACK;
    }
  }, [api]);

  // ── FIX: ICE restart helper ──
  const attemptIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    const p = peerRef.current;
    if (!pc || !p || iceRestartCountRef.current >= MAX_ICE_RESTARTS) {
      console.log(`[VideoCall] ICE restart limit reached (${MAX_ICE_RESTARTS}), ending call`);
      if (endCallRef.current) endCallRef.current();
      return;
    }
    iceRestartCountRef.current++;
    console.log(`[VideoCall] Attempting ICE restart ${iceRestartCountRef.current}/${MAX_ICE_RESTARTS}`);
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      if (send) send({ type: 'vcall:offer', target_user_id: p.user_id, sdp: offer.sdp });
    } catch (e) {
      console.error('[VideoCall] ICE restart failed:', e);
      if (endCallRef.current) endCallRef.current();
    }
  }, [send]);

  // ── FIX: Adaptive bitrate adjustment ──
  const adjustBitrate = useCallback(async (tier) => {
    if (!pcRef.current || currentBitrateTierRef.current === tier) return;
    const vs = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
    if (!vs) return;
    const params = vs.getParameters();
    if (!params.encodings) params.encodings = [{}];
    const config = BITRATE_TIERS[tier];
    params.encodings[0].maxBitrate = config.maxBitrate;
    params.encodings[0].maxFramerate = config.maxFramerate;
    try {
      await vs.setParameters(params);
      currentBitrateTierRef.current = tier;
      console.log(`[VideoCall] Bitrate adjusted to ${tier}: ${config.maxBitrate/1000}kbps @ ${config.maxFramerate}fps`);
    } catch (e) {
      console.warn('[VideoCall] Bitrate adjustment failed:', e);
    }
  }, []);

  // ── FIX: Codec preferences (VP9 > VP8 > H264) ──
  const setCodecPreferences = useCallback((pc) => {
    try {
      const transceivers = pc.getTransceivers();
      const videoTransceiver = transceivers.find(t => t.sender?.track?.kind === 'video' || t.receiver?.track?.kind === 'video');
      if (videoTransceiver && typeof videoTransceiver.setCodecPreferences === 'function') {
        const codecs = RTCRtpReceiver.getCapabilities?.('video')?.codecs || [];
        const sorted = [
          ...codecs.filter(c => c.mimeType === 'video/VP9'),
          ...codecs.filter(c => c.mimeType === 'video/VP8'),
          ...codecs.filter(c => c.mimeType === 'video/H264'),
          ...codecs.filter(c => !['video/VP9', 'video/VP8', 'video/H264'].includes(c.mimeType)),
        ];
        if (sorted.length > 0) {
          videoTransceiver.setCodecPreferences(sorted);
          console.log('[VideoCall] Codec preferences set: VP9 > VP8 > H264');
        }
      }
    } catch (e) {
      console.warn('[VideoCall] setCodecPreferences failed (expected on some browsers):', e);
    }
  }, []);

  const makePC = useCallback((targetId, iceServers) => {
    console.log('[VideoCall] Creating RTCPeerConnection for', targetId);
    // ── FIX: Upgraded RTC config ──
    const pc = new RTCPeerConnection({
      iceServers: iceServers || ICE_SERVERS_FALLBACK,
      ...RTC_CONFIG_BASE,
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && send) send({ type: 'vcall:ice', target_user_id: targetId, candidate: e.candidate.toJSON() });
    };
    pc.onicecandidateerror = (event) => { console.error('[VideoCall] ICE candidate error:', event.errorCode, event.errorText); };
    pc.onicegatheringstatechange = () => { console.log('[VideoCall] ICE gathering:', pc.iceGatheringState); };

    pc.ontrack = (e) => {
      console.log('[VideoCall] ontrack fired, kind:', e.track.kind, 'streams:', e.streams.length);
      if (e.streams && e.streams[0]) {
        attachRemoteStream(e.streams[0]);
      } else {
        const stream = remoteStreamRef.current || new MediaStream();
        stream.addTrack(e.track);
        attachRemoteStream(stream);
      }
    };

    // ── FIX: ICE restart instead of immediate end ──
    pc.oniceconnectionstatechange = () => {
      console.log('[VideoCall] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        clearTimeout(iceDisconnectTimerRef.current);
        iceRestartCountRef.current = 0;
      } else if (pc.iceConnectionState === 'disconnected') {
        iceDisconnectTimerRef.current = setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            console.log('[VideoCall] ICE disconnected for 8s — attempting restart');
            attemptIceRestart();
          }
        }, 8000);
      } else if (pc.iceConnectionState === 'failed') {
        console.error('[VideoCall] ICE failed — attempting restart');
        attemptIceRestart();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[VideoCall] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        // Set initial bitrate
        adjustBitrate('high');
      }
      if (pc.connectionState === 'failed') {
        toast.error('Could not connect video call. Try a different network.');
        attemptIceRestart();
      }
    };

    // ── FIX: Polite peer — handle negotiationneeded ──
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        if (send) send({ type: 'vcall:offer', target_user_id: targetId, sdp: offer.sdp });
      } catch (e) {
        console.error('[VideoCall] negotiationneeded error:', e);
      } finally {
        makingOfferRef.current = false;
      }
    };

    pcRef.current = pc;
    return pc;
  }, [send, attachRemoteStream, attemptIceRestart, adjustBitrate]);

  // ── FIX: Multi-factor quality monitoring + adaptive bitrate ──
  const startStatsMonitor = useCallback(() => {
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const report = await pcRef.current.getStats();
        let loss = 0, rtt = 0, outBitrate = 0, inFps = 0, inRes = '';

        report.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') {
            loss = r.packetsLost / Math.max(1, r.packetsReceived + r.packetsLost);
            inFps = r.framesPerSecond || 0;
            inRes = `${r.frameWidth || 0}x${r.frameHeight || 0}`;
          }
          if (r.type === 'candidate-pair' && r.currentRoundTripTime) {
            rtt = r.currentRoundTripTime * 1000;
          }
          if (r.type === 'outbound-rtp' && r.kind === 'video') {
            const now = r.timestamp;
            const bytes = r.bytesSent || 0;
            if (lastBytesSentRef.current && lastBytesTimestampRef.current) {
              const dt = (now - lastBytesTimestampRef.current) / 1000;
              if (dt > 0) outBitrate = Math.round(((bytes - lastBytesSentRef.current) * 8) / dt / 1000); // kbps
            }
            lastBytesSentRef.current = bytes;
            lastBytesTimestampRef.current = now;
          }
        });

        // Update stats display
        setStats(prev => ({ ...prev, packetLoss: (loss * 100).toFixed(1), fps: inFps, resolution: inRes, bitrate: outBitrate, rtt: Math.round(rtt) }));

        // Multi-factor quality assessment
        if (loss > 0.12 || rtt > 400) {
          setQuality('poor');
          adjustBitrate('veryLow');
        } else if (loss > 0.05 || rtt > 250) {
          setQuality('fair');
          adjustBitrate('low');
        } else if (loss > 0.02 || rtt > 150) {
          setQuality('good');
          adjustBitrate('medium');
        } else {
          setQuality('good');
          adjustBitrate('high');
        }
      } catch {}
    }, 3000);
  }, [adjustBitrate]);

  // ── FIX: Device hot-plug detection ──
  const setupDeviceChangeListener = useCallback(() => {
    if (deviceChangeHandlerRef.current) return;
    const handler = async () => {
      if (stateRef.current !== 'connected' || !localStreamRef.current || !pcRef.current) return;
      console.log('[VideoCall] Device change detected');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        // Replace audio track if needed
        if (audioInputs.length > 0) {
          try {
            const newAudio = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            const newAudioTrack = newAudio.getAudioTracks()[0];
            const audioSender = pcRef.current.getSenders().find(s => s.track?.kind === 'audio');
            if (audioSender && newAudioTrack) {
              await audioSender.replaceTrack(newAudioTrack);
              localStreamRef.current.getAudioTracks().forEach(t => t.stop());
              localStreamRef.current.addTrack(newAudioTrack);
              newAudioTrack.enabled = !muted;
            }
          } catch (e) { console.warn('[VideoCall] Audio device switch failed:', e); }
        }

        // Replace video track if needed (and camera is on)
        if (videoInputs.length > 0 && !cameraOff && !screenSharing) {
          try {
            const newVideo = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
            const newVideoTrack = newVideo.getVideoTracks()[0];
            const videoSender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
            if (videoSender && newVideoTrack) {
              await videoSender.replaceTrack(newVideoTrack);
              localStreamRef.current.getVideoTracks().forEach(t => t.stop());
              localStreamRef.current.addTrack(newVideoTrack);
              originalVideoTrackRef.current = newVideoTrack;
            }
          } catch (e) { console.warn('[VideoCall] Video device switch failed:', e); }
        }

        toast.info('Device switched');
      } catch (e) { console.warn('[VideoCall] Device change handling failed:', e); }
    };
    deviceChangeHandlerRef.current = handler;
    navigator.mediaDevices?.addEventListener('devicechange', handler);
  }, [muted, cameraOff, screenSharing]);

  // ══════════════════════════════════════════
  // CALLER: Start video call
  // ══════════════════════════════════════════
  const startVideoCall = useCallback(async (targetId, targetName) => {
    if (stateRef.current !== 'idle') return;
    // Reset stale __callBusy from previous calls
    if (window.__callBusy && stateRef.current === 'idle') { console.log('[VideoCall] Reset stale __callBusy'); window.__callBusy = false; }
    if (window.__callBusy) { toast.info('Already on a call'); return; }
    window.__callBusy = true;

    const iceServers = await fetchIceServers();
    const stream = await getMedia();
    if (!stream) { window.__callBusy = false; return; }
    localStreamRef.current = stream;

    setState('outgoing');
    stateRef.current = 'outgoing';
    setPeer({ user_id: targetId, user_name: targetName });
    iceRestartCountRef.current = 0;

    setTimeout(() => {
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    }, 100);

    if (send) send({ type: 'vcall:ring', target_user_id: targetId });
    else { toast.error('Not connected — please wait and try again'); window.__callBusy = false; setState('idle'); stateRef.current = 'idle'; localStreamRef.current?.getTracks().forEach(t => t.stop()); return; }
    api?.post('/api/call/initiate', { target_user_id: targetId, call_type: 'video' }).catch(() => {});

    const pc = makePC(targetId, iceServers);
    stream.getTracks().forEach(t => {
      console.log('[VideoCall] Caller adding track:', t.kind, t.readyState);
      pc.addTrack(t, stream);
    });

    // ── FIX: Set codec preferences ──
    setCodecPreferences(pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('[VideoCall] Caller sending offer, SDP length:', offer.sdp.length);
    if (send) send({ type: 'vcall:offer', target_user_id: targetId, sdp: offer.sdp });

    timeoutRef.current = setTimeout(() => {
      if (stateRef.current === 'outgoing') {
        if (send) send({ type: 'vcall:end', target_user_id: targetId });
        cleanup(); setState('idle'); setPeer(null);
        toast.info('No answer');
      }
    }, 45000);
  }, [getMedia, makePC, send, api, cleanup, fetchIceServers, setCodecPreferences]);

  // ══════════════════════════════════════════
  // CALLEE: Accept incoming call
  // ══════════════════════════════════════════
  const acceptCall = useCallback(async () => {
    if (window.__callBusy && stateRef.current !== 'ringing') { return; }
    window.__callBusy = true;
    const p = peerRef.current;
    if (!p) return;

    clearTimeout(timeoutRef.current);

    const iceServers = await fetchIceServers();
    const stream = await getMedia();
    if (!stream) {
      if (send) send({ type: 'vcall:decline', target_user_id: p.user_id });
      cleanup(); setState('idle'); setPeer(null);
      return;
    }
    localStreamRef.current = stream;
    iceRestartCountRef.current = 0;

    setTimeout(() => {
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    }, 100);

    stateRef.current = 'connected';
    setState('connected');

    if (send) send({ type: 'vcall:accept', target_user_id: p.user_id });
    api?.post('/api/call/respond', { caller_user_id: p.user_id, action: 'accept' }).catch(() => {});

    const pc = makePC(p.user_id, iceServers);
    stream.getTracks().forEach(t => {
      console.log('[VideoCall] Callee adding track:', t.kind, t.readyState);
      pc.addTrack(t, stream);
    });

    // ── FIX: Set codec preferences ──
    setCodecPreferences(pc);

    // Process the pending offer
    let offerSdp = pendingOfferRef.current;
    if (!offerSdp) {
      console.log('[VideoCall] Offer not yet received, waiting up to 5s...');
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (pendingOfferRef.current) { offerSdp = pendingOfferRef.current; break; }
      }
    }
    if (offerSdp) {
      console.log('[VideoCall] Processing offer, SDP length:', offerSdp.length);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
        drainIceBuffer();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[VideoCall] Sending answer, SDP length:', answer.sdp.length);
        if (send) send({ type: 'vcall:answer', target_user_id: p.user_id, sdp: answer.sdp });
        answerSentRef.current = true;
      } catch (e) {
        console.error('[VideoCall] SDP handshake error:', e);
        toast.error('Failed to establish video connection');
        cleanup(); setState('idle'); setPeer(null);
        return;
      }
    } else {
      console.warn('[VideoCall] No offer after 5s — relying on late offer handler');
    }

    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    startStatsMonitor();
    setupDeviceChangeListener();
  }, [getMedia, makePC, send, api, cleanup, drainIceBuffer, startStatsMonitor, fetchIceServers, setCodecPreferences, setupDeviceChangeListener]);

  const endCall = useCallback(() => {
    const p = peerRef.current;
    if (p && send) send({ type: 'vcall:end', target_user_id: p.user_id });
    api?.post('/api/call/respond', { caller_user_id: p?.user_id, action: 'end' }).catch(() => {});
    cleanup(); stateRef.current = 'idle'; setState('idle'); setPeer(null);
  }, [send, api, cleanup]);
  useEffect(() => { endCallRef.current = endCall; }, [endCall]);

  const declineCall = useCallback(() => {
    const p = peerRef.current;
    if (p && send) send({ type: 'vcall:decline', target_user_id: p.user_id });
    api?.post('/api/call/respond', { caller_user_id: p?.user_id, action: 'decline' }).catch(() => {});
    cleanup(); stateRef.current = 'idle'; setState('idle'); setPeer(null);
  }, [send, api, cleanup]);

  const handleIncoming = useCallback((data) => {
    if (stateRef.current !== 'idle' || window.__callBusy) {
      if (stateRef.current === 'idle' && window.__callBusy) { window.__callBusy = false; }
      else { if (send) send({ type: 'vcall:busy', target_user_id: data.from_user_id }); return; }
    }
    console.log('[VideoCall] Incoming video call from', data.from_user_name);
    setPeer({ user_id: data.from_user_id, user_name: data.from_user_name });
    stateRef.current = 'ringing';
    setState('ringing');
    callNotifRef.current = showCallNotification(data.from_user_name, 'video');
    timeoutRef.current = setTimeout(() => { if (stateRef.current === 'ringing') declineCall(); }, 30000);
  }, [send, declineCall]);

  // ══════════════════════════════════════════
  // WebSocket event handler
  // ══════════════════════════════════════════
  useEffect(() => {
    if (!addListener) return;
    const handler = async (data) => {
      if (!data.type?.startsWith('vcall:')) return;
      console.log('[VideoCall] WS event:', data.type, 'from:', data.from_user_name || data.from_user_id);

      switch (data.type) {
        case 'vcall:ring':
          handleIncoming(data);
          break;

        case 'vcall:offer': {
          // ── FIX: Polite peer pattern ──
          const pc = pcRef.current;
          const isPolite = user && data.from_user_id && user._id < data.from_user_id;
          const offerCollision = makingOfferRef.current || (pc && pc.signalingState !== 'stable');

          if (offerCollision && !isPolite) {
            console.log('[VideoCall] Impolite peer ignoring colliding offer');
            return;
          }

          console.log('[VideoCall] Received offer, SDP length:', data.sdp?.length);
          pendingOfferRef.current = data.sdp;

          if (pc && stateRef.current === 'connected' && !answerSentRef.current) {
            try {
              if (offerCollision && isPolite) {
                await pc.setLocalDescription({ type: 'rollback' });
              }
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
              drainIceBuffer();
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              if (send) send({ type: 'vcall:answer', target_user_id: data.from_user_id, sdp: ans.sdp });
              answerSentRef.current = true;
              console.log('[VideoCall] Late offer processed, answer sent');
            } catch (e) {
              console.error('[VideoCall] Late offer processing error:', e);
            }
          }
          break;
        }

        case 'vcall:accept':
          clearTimeout(timeoutRef.current);
          if (stateRef.current === 'outgoing') {
            stateRef.current = 'connected';
            setState('connected');
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            startStatsMonitor();
            setupDeviceChangeListener();
          }
          break;

        case 'vcall:answer':
          console.log('[VideoCall] Received answer, SDP length:', data.sdp?.length);
          if (pcRef.current && data.sdp && pcRef.current.signalingState === 'have-local-offer') {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
              drainIceBuffer();
              console.log('[VideoCall] Answer set, ICE buffer drained');
            } catch (e) {
              console.error('[VideoCall] setRemoteDescription(answer) error:', e);
            }
          }
          break;

        case 'vcall:ice':
          if (data.candidate) {
            if (pcRef.current?.remoteDescription) {
              pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.warn('[VideoCall] addIceCandidate error:', e));
            } else {
              iceBufferRef.current.push(data.candidate);
            }
          }
          break;

        case 'vcall:claimed':
          if (stateRef.current === 'ringing') {
            cleanup(); setState('idle'); setPeer(null);
          }
          break;
        case 'vcall:decline':
        case 'vcall:end':
          cleanup(); stateRef.current = 'idle'; setState('idle'); setPeer(null);
          break;
        case 'vcall:busy':
          cleanup(); stateRef.current = 'idle'; setState('idle'); setPeer(null);
          toast.info('User is busy');
          break;
        case 'vcall:camera-off': setPeerCameraOff(true); break;
        case 'vcall:camera-on': setPeerCameraOff(false); break;
        case 'vcall:screen-share': setPeerScreenSharing(true); break;
        case 'vcall:screen-share-end': setPeerScreenSharing(false); break;
        default: break;
      }
    };
    addListener(handler);
    return () => removeListener(handler);
  }, [addListener, removeListener, handleIncoming, cleanup, send, drainIceBuffer, startStatsMonitor, user, setupDeviceChangeListener]);

  // ── FIX: Conditional REST polling ──
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      if (stateRef.current !== 'idle') return;
      if (wsRef?.current?.readyState === WebSocket.OPEN) return;
      try {
        const res = await api?.get('/api/call/pending');
        if (res?.data?.pending && res.data.call_type === 'video') handleIncoming(res.data);
      } catch {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [api, handleIncoming, wsRef]);

  // ── FIX: Tab backgrounding — reduce bitrate when tab is hidden ──
  useEffect(() => {
    const handleVisibility = () => {
      if (!pcRef.current || stateRef.current !== 'connected') return;
      if (document.hidden) {
        console.log('[VideoCall] Tab hidden — reducing to veryLow bitrate');
        adjustBitrate('veryLow');
      } else {
        console.log('[VideoCall] Tab visible — restoring bitrate');
        // Will be adjusted by stats monitor on next tick
        adjustBitrate('high');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [adjustBitrate]);

  // ── FIX: Network recovery ──
  useEffect(() => {
    const handleOnline = () => {
      if (stateRef.current === 'connected' && pcRef.current) {
        console.log('[VideoCall] Network restored — attempting ICE restart');
        attemptIceRestart();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [attemptIceRestart]);

  // Expose globally
  useEffect(() => {
    window.__videoCall = { startVideoCall };
    return () => { delete window.__videoCall; };
  }, [startVideoCall]);

  // Continuously ensure remote video is playing
  useEffect(() => {
    if (state !== 'connected' && state !== 'outgoing') return;
    const interval = setInterval(() => {
      if (remoteVideoRef.current && remoteStreamRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        if (remoteVideoRef.current.paused) {
          remoteVideoRef.current.play().catch(() => {});
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  // Re-attach local video when ref is available
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && (state === 'outgoing' || state === 'connected')) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [state, minimized]);

  // Re-attach remote video when expanding from minimized
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current && !minimized) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [minimized]);

  const toggleMute = useCallback(() => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMuted(!t.enabled); }
  }, []);

  const toggleCamera = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCameraOff(!t.enabled);
      if (send) send({ type: t.enabled ? 'vcall:camera-on' : 'vcall:camera-off', target_user_id: peerRef.current?.user_id }); }
  }, [send]);

  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current) return;
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop()); screenStreamRef.current = null;
      const vs = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (vs && originalVideoTrackRef.current) await vs.replaceTrack(originalVideoTrackRef.current);
      setScreenSharing(false);
      if (send) send({ type: 'vcall:screen-share-end', target_user_id: peerRef.current?.user_id });
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } });
        screenStreamRef.current = ss;
        const st = ss.getVideoTracks()[0];
        const vs = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (vs) { originalVideoTrackRef.current = vs.track; await vs.replaceTrack(st); }
        st.onended = () => toggleScreenShare();
        setScreenSharing(true);
        if (send) send({ type: 'vcall:screen-share', target_user_id: peerRef.current?.user_id });
      } catch (e) { if (e.name !== 'NotAllowedError') toast.error('Screen sharing failed'); }
    }
  }, [screenSharing, send]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    else document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
  }, []);

  if (state === 'idle') return null;

  // ── Incoming ring ──
  if (state === 'ringing') return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center" data-testid="incoming-video-call">
      <div className="bg-card rounded-3xl shadow-2xl p-8 text-center w-80 border">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 animate-pulse"><Video className="w-10 h-10 text-blue-600" /></div>
        <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Space Grotesk' }}>Incoming Video Call</h3>
        <p className="text-sm text-muted-foreground mb-6">{peer?.user_name}</p>
        <div className="flex justify-center gap-6">
          <div className="text-center"><button onClick={declineCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"><PhoneOff className="w-6 h-6" /></button><p className="text-[10px] text-muted-foreground mt-1">Decline</p></div>
          <div className="text-center"><button onClick={acceptCall} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors"><Video className="w-6 h-6" /></button><p className="text-[10px] text-muted-foreground mt-1">Accept</p></div>
        </div>
      </div>
    </div>
  );

  // ── Minimized (draggable) ──
  if (minimized) return (
    <DraggableMinimizedVideo
      remoteVideoRef={remoteVideoRef}
      remoteStreamRef={remoteStreamRef}
      state={state}
      duration={duration}
      peer={peer}
      onExpand={() => setMinimized(false)}
      onEnd={endCall}
      muted={muted}
      onToggleMute={toggleMute}
    />
  );

  // ── Full page ──
  return (
    <div ref={containerRef} className="fixed inset-0 z-[9998] bg-gray-950 flex flex-col" data-testid="video-call-fullpage">
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-3">
          <button onClick={() => setMinimized(true)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"><Minimize2 className="w-4 h-4" /></button>
          <div>
            <p className="text-white text-sm font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{peer?.user_name}</p>
            <p className="text-white/60 text-xs">{state === 'outgoing' ? 'Calling...' : <span className="font-mono">{fmt(duration)}</span>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quality !== 'good' && state === 'connected' && (
            <Badge className={`text-[10px] ${quality === 'poor' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}><AlertTriangle className="w-3 h-3 mr-1" />{quality}</Badge>
          )}
          <button onClick={() => setShowStats(s => !s)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center"><Signal className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {showStats && state === 'connected' && (
        <div className="absolute top-16 right-4 z-20 bg-black/80 backdrop-blur-md rounded-xl px-4 py-3 text-xs text-white/80 space-y-1 font-mono">
          <p>Bitrate: {stats.bitrate} kbps</p><p>Loss: {stats.packetLoss}%</p><p>RTT: {stats.rtt}ms</p><p>Res: {stats.resolution}</p><p>FPS: {stats.fps}</p>
        </div>
      )}
      <div className="flex-1 relative overflow-hidden">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ WebkitPlaysinline: true }} />
        {(peerCameraOff || state === 'outgoing') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
            <div className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center mb-4"><span className="text-5xl font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>{peer?.user_name?.charAt(0) || '?'}</span></div>
            <p className="text-white text-lg font-semibold">{peer?.user_name}</p>
            <p className="text-white/50 text-sm mt-1">{state === 'outgoing' ? 'Calling...' : 'Camera off'}</p>
          </div>
        )}
        {peerScreenSharing && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10"><Badge className="bg-blue-500/90 text-white text-xs"><Monitor className="w-3 h-3 mr-1" />Screen shared</Badge></div>}
      </div>
      {/* Local PiP */}
      <div className="absolute z-30 w-44 h-32 sm:w-52 sm:h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl" style={{ bottom: 100, right: 16 }}>
        {cameraOff ? (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center"><div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center"><span className="text-lg font-bold text-primary">{user?.name?.charAt(0)}</span></div></div>
        ) : (
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-6 sm:pb-8 bg-gradient-to-t from-black/70 to-transparent pt-16">
        <div className="flex items-center gap-3 sm:gap-4 bg-gray-900/80 backdrop-blur-xl rounded-2xl px-4 sm:px-6 py-3 border border-white/10 shadow-2xl">
          <ControlButton icon={cameraOff ? VideoOff : Video} label={cameraOff ? 'Camera On' : 'Camera Off'} active={!cameraOff} onClick={toggleCamera} />
          <ControlButton icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} active={!muted} onClick={toggleMute} danger={muted} />
          {state === 'connected' && <ControlButton icon={screenSharing ? MonitorOff : Monitor} label={screenSharing ? 'Stop' : 'Share'} active={!screenSharing} onClick={toggleScreenShare} highlight={screenSharing} />}
          <ControlButton icon={isFullscreen ? Minimize2 : Maximize} label={isFullscreen ? 'Exit FS' : 'Fullscreen'} active={true} onClick={toggleFullscreen} />
          <button onClick={endCall} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-500/20" data-testid="end-video-call"><PhoneOff className="w-6 h-6" /></button>
        </div>
      </div>
    </div>
  );
}


// Draggable minimized video widget (unchanged — UI only)
function DraggableMinimizedVideo({ remoteVideoRef, remoteStreamRef, state, duration, peer, onExpand, onEnd, muted, onToggleMute }) {
  const [pos, setPos] = useState({ x: window.innerWidth - 240, y: window.innerHeight - 260 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);
  const miniVideoRef = useRef(null);

  useEffect(() => {
    if (miniVideoRef.current && remoteStreamRef.current) {
      miniVideoRef.current.srcObject = remoteStreamRef.current;
      miniVideoRef.current.play().catch(() => {});
    }
  }, [remoteStreamRef]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const nx = Math.max(0, Math.min(window.innerWidth - 230, e.clientX - offset.current.x));
      const ny = Math.max(0, Math.min(window.innerHeight - 220, e.clientY - offset.current.y));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

  const onDown = (e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    const rect = widgetRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  return (
    <div ref={widgetRef} onPointerDown={onDown} className="fixed z-[9998] select-none touch-none" style={{ left: pos.x, top: pos.y }} data-testid="video-call-minimized">
      <div className="bg-card rounded-2xl shadow-2xl border overflow-hidden w-56 cursor-grab active:cursor-grabbing">
        <div className="w-56 h-32 bg-gray-900 relative overflow-hidden" onClick={onExpand}>
          <video ref={miniVideoRef} autoPlay playsInline className="w-full h-full object-cover opacity-80" style={{ WebkitPlaysinline: true }} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30"><Maximize2 className="w-6 h-6 text-white" /></div>
          <div className="absolute bottom-1 left-2 flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${state === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`} />
            <span className="text-white text-[10px] font-mono">{state === 'connected' ? fmt(duration) : 'Connecting...'}</span>
          </div>
        </div>
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-medium truncate max-w-[70px]">{peer?.user_name?.split(' ')[0]}</span>
          <div className="flex gap-1.5">
            <button onClick={onToggleMute} className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground hover:bg-primary hover:text-white'}`} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </button>
            <button onClick={onExpand} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-colors" title="Expand"><Maximize2 className="w-3 h-3" /></button>
            <button onClick={onEnd} className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors" title="End Call"><PhoneOff className="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
