import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, AlertTriangle, Minimize2, Maximize2, GripHorizontal, X } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { showCallNotification, dismissCallNotification } from '../../utils/callNotifications';

const ICE_SERVERS_FALLBACK = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Optimised RTC config ──
const RTC_CONFIG_BASE = {
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const MAX_ICE_RESTARTS = 3;

export default function GlobalVoiceCall() {
  const { send, addListener, removeListener, wsRef } = useSocket() || {};
  const { api, user } = useAuth();
  const [state, setState] = useState('idle'); // idle | outgoing | ringing | connected
  const [peer, setPeer] = useState(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState('good'); // good | fair | poor

  const stateRef = useRef('idle');
  const peerRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef = useRef(null);
  const timeoutRef = useRef(null);
  const iceBufferRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const pollRef = useRef(null);
  const answerSentRef = useRef(false);
  const activeCallFromRef = useRef(null);
  const iceDisconnectTimerRef = useRef(null);
  const statsTimerRef = useRef(null);
  const endCallRef = useRef(null);
  const callNotifRef = useRef(null);
  const iceRestartCountRef = useRef(0);
  const deviceChangeHandlerRef = useRef(null);
  const makingOfferRef = useRef(false); // polite peer

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { peerRef.current = peer; }, [peer]);

  // Remote audio element
  useEffect(() => {
    const a = document.createElement('audio');
    a.autoplay = true; a.playsInline = true;
    remoteAudioRef.current = a;
    return () => { a.srcObject = null; };
  }, []);

  // ── FIX: sendBeacon for beforeunload (WS send not guaranteed during unload) ──
  useEffect(() => {
    const onBeforeUnload = () => {
      if (stateRef.current !== 'idle' && peerRef.current) {
        const p = peerRef.current;
        // Try WS first (may not arrive)
        if (send) send({ type: 'call:end', target_user_id: p.user_id });
        // sendBeacon as reliable fallback for 1:1 calls
        try {
          const API = process.env.REACT_APP_BACKEND_URL || '';
          const token = localStorage.getItem('beatx_token');
          if (API && token) {
            navigator.sendBeacon(
              `${API}/api/call/cleanup-beacon`,
              new Blob([JSON.stringify({ target_user_id: p.user_id, _token: token })], { type: 'application/json' })
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
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (iceDisconnectTimerRef.current) { clearTimeout(iceDisconnectTimerRef.current); iceDisconnectTimerRef.current = null; }
    if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    // Remove device change listener
    if (deviceChangeHandlerRef.current) {
      navigator.mediaDevices?.removeEventListener('devicechange', deviceChangeHandlerRef.current);
      deviceChangeHandlerRef.current = null;
    }
    iceBufferRef.current = [];
    pendingOfferRef.current = null;
    answerSentRef.current = false;
    activeCallFromRef.current = null;
    iceRestartCountRef.current = 0;
    makingOfferRef.current = false;
    dismissCallNotification(callNotifRef.current);
    callNotifRef.current = null;
    setMuted(false);
    setDuration(0);
    setQuality('good');
    window.__callBusy = false;
  }, []);

  // Keep endCallRef current
  const endCall = useCallback(() => {
    const p = peerRef.current;
    if (p) {
      if (send) send({ type: 'call:end', target_user_id: p.user_id });
      if (api) api.post('/api/call/respond', { target_user_id: p.user_id, response: 'end' }).catch(() => {});
    }
    cleanup(); setState('idle'); setPeer(null);
  }, [send, api, cleanup]);
  useEffect(() => { endCallRef.current = endCall; }, [endCall]);

  const fetchIceServers = useCallback(async () => {
    try {
      const res = await api.get('/api/call/ice-servers');
      return res.data.ice_servers;
    } catch (err) {
      console.error('[Call] Failed to fetch ICE servers, using STUN-only fallback:', err);
      return ICE_SERVERS_FALLBACK;
    }
  }, [api]);

  // ── FIX: ICE restart helper ──
  const attemptIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    const p = peerRef.current;
    if (!pc || !p || iceRestartCountRef.current >= MAX_ICE_RESTARTS) {
      console.log(`[Call] ICE restart limit reached (${MAX_ICE_RESTARTS}), ending call`);
      if (endCallRef.current) endCallRef.current();
      return;
    }
    iceRestartCountRef.current++;
    console.log(`[Call] Attempting ICE restart ${iceRestartCountRef.current}/${MAX_ICE_RESTARTS}`);
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      if (send) send({ type: 'call:offer', target_user_id: p.user_id, sdp: offer.sdp });
    } catch (e) {
      console.error('[Call] ICE restart failed:', e);
      if (endCallRef.current) endCallRef.current();
    }
  }, [send]);

  const makePC = useCallback((targetId, iceServers) => {
    if (pcRef.current) pcRef.current.close();
    // ── FIX: Upgraded RTC config ──
    const pc = new RTCPeerConnection({
      iceServers: iceServers || ICE_SERVERS_FALLBACK,
      ...RTC_CONFIG_BASE,
    });
    pcRef.current = pc;

    pc.onicecandidate = e => {
      if (e.candidate && send) send({ type: 'call:ice', target_user_id: targetId, candidate: e.candidate.toJSON() });
    };
    pc.onicecandidateerror = (event) => { console.error('[Call] ICE candidate error:', event.errorCode, event.errorText); };
    pc.onicegatheringstatechange = () => { console.log('[Call] ICE gathering:', pc.iceGatheringState); };

    pc.ontrack = e => {
      if (remoteAudioRef.current && e.streams[0]) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    // ── FIX: ICE restart instead of immediate end ──
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('[Call] ICE state:', s);
      if (s === 'connected' || s === 'completed') {
        if (iceDisconnectTimerRef.current) { clearTimeout(iceDisconnectTimerRef.current); iceDisconnectTimerRef.current = null; }
        iceRestartCountRef.current = 0; // Reset on successful connection
        setQuality('good');
      } else if (s === 'disconnected') {
        setQuality('poor');
        if (iceDisconnectTimerRef.current) clearTimeout(iceDisconnectTimerRef.current);
        iceDisconnectTimerRef.current = setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            console.log('[Call] ICE disconnected for 5s — attempting restart');
            attemptIceRestart();
          }
        }, 5000);
      } else if (s === 'failed') {
        attemptIceRestart();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        toast.error('Could not connect the call. Try a different network.');
        attemptIceRestart();
      }
    };

    // ── FIX: Polite peer — handle negotiationneeded for proper glare handling ──
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        if (send) send({ type: 'call:offer', target_user_id: targetId, sdp: offer.sdp });
      } catch (e) {
        console.error('[Call] negotiationneeded error:', e);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [send, attemptIceRestart]);

  // ── FIX: Optimised audio constraints ──
  const getMic = useCallback(async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
          latency: { ideal: 0.01 },
        }
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Click the lock icon in your address bar to enable it.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No microphone detected. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError') {
        toast.error('Microphone is in use by another application.');
      } else {
        toast.error('Could not access microphone. Check browser settings.');
      }
      return null;
    }
  }, []);

  // ── FIX: Device hot-plug detection ──
  const setupDeviceChangeListener = useCallback(() => {
    if (deviceChangeHandlerRef.current) return; // Already set up
    const handler = async () => {
      if (stateRef.current !== 'connected' || !localStreamRef.current || !pcRef.current) return;
      console.log('[Call] Audio device change detected');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        if (audioInputs.length === 0) {
          toast.warning('No microphone detected');
          return;
        }
        // Get new mic stream
        const newStream = await getMic();
        if (!newStream) return;
        const newTrack = newStream.getAudioTracks()[0];
        // Replace track in peer connection
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
        // Stop old tracks and update ref
        localStreamRef.current.getAudioTracks().forEach(t => t.stop());
        localStreamRef.current = newStream;
        // Preserve mute state
        newTrack.enabled = !muted;
        toast.info('Microphone switched');
      } catch (e) {
        console.warn('[Call] Device switch failed:', e);
      }
    };
    deviceChangeHandlerRef.current = handler;
    navigator.mediaDevices?.addEventListener('devicechange', handler);
  }, [getMic, muted]);

  // ── Start call ──
  const startCall = useCallback(async (targetId, targetName) => {
    if (stateRef.current !== 'idle') return;
    // Reset stale __callBusy from previous calls
    if (window.__callBusy && stateRef.current === 'idle') { console.log('[VoiceCall] Reset stale __callBusy'); window.__callBusy = false; }
    if (window.__callBusy) { toast.info('Already on a call'); return; }
    window.__callBusy = true;

    const iceServers = await fetchIceServers();
    const stream = await getMic();
    if (!stream) { window.__callBusy = false; return; }
    localStreamRef.current = stream;

    setPeer({ user_id: targetId, user_name: targetName });
    setState('outgoing');
    activeCallFromRef.current = targetId;
    answerSentRef.current = false;
    iceRestartCountRef.current = 0;

    if (send) send({ type: 'call:ring', target_user_id: targetId });
    else { toast.error('Not connected — please wait and try again'); window.__callBusy = false; setState('idle'); stateRef.current = 'idle'; localStreamRef.current?.getTracks().forEach(t => t.stop()); return; }
    if (api) api.post('/api/call/initiate', { target_user_id: targetId }).catch(() => {});

    const pc = makePC(targetId, iceServers);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (send) send({ type: 'call:offer', target_user_id: targetId, sdp: offer.sdp });

    // 30s ring timeout
    timeoutRef.current = setTimeout(() => {
      if (stateRef.current === 'outgoing') {
        if (send) send({ type: 'call:end', target_user_id: targetId });
        cleanup(); setState('idle'); setPeer(null);
        toast.info('Call not answered');
      }
    }, 30000);
  }, [send, api, makePC, cleanup, getMic, fetchIceServers]);

  // ── Accept call ──
  const acceptCall = useCallback(async () => {
    const p = peerRef.current;
    if (!p) return;
    window.__callBusy = true;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

    const iceServers = await fetchIceServers();
    const stream = await getMic();
    if (!stream) {
      if (send) send({ type: 'call:decline', target_user_id: p.user_id });
      cleanup(); setState('idle'); setPeer(null);
      return;
    }
    localStreamRef.current = stream;
    setState('connected');
    iceRestartCountRef.current = 0;

    const pc = makePC(p.user_id, iceServers);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    // Complete handshake if offer already arrived
    if (pendingOfferRef.current && !answerSentRef.current) {
      answerSentRef.current = true;
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: pendingOfferRef.current }));
      pendingOfferRef.current = null;
      for (const c of iceBufferRef.current) { await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}); }
      iceBufferRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (send) send({ type: 'call:answer', target_user_id: p.user_id, sdp: answer.sdp });
    }

    if (send) send({ type: 'call:accept', target_user_id: p.user_id });
    if (api) api.post('/api/call/respond', { target_user_id: p.user_id, response: 'accept' }).catch(() => {});

    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    // ── FIX: Multi-factor quality monitoring (loss + RTT + jitter) ──
    statsTimerRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        let loss = 0, rtt = 0, jitter = 0;
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            loss = report.packetsLost / Math.max(1, report.packetsReceived + report.packetsLost);
            if (report.jitter) jitter = report.jitter * 1000; // convert to ms
          }
          if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
            rtt = report.currentRoundTripTime * 1000; // convert to ms
          }
        });
        // Multi-factor quality assessment for voice
        if (loss > 0.10 || rtt > 400 || jitter > 80) setQuality('poor');
        else if (loss > 0.03 || rtt > 200 || jitter > 40) setQuality('fair');
        else setQuality('good');
      } catch {}
    }, 3000);

    // ── FIX: Setup device hot-plug listener ──
    setupDeviceChangeListener();
  }, [send, api, makePC, cleanup, getMic, fetchIceServers, setupDeviceChangeListener]);

  const declineCall = useCallback(() => {
    const p = peerRef.current;
    if (p) {
      if (send) send({ type: 'call:decline', target_user_id: p.user_id });
      if (api) api.post('/api/call/respond', { target_user_id: p.user_id, response: 'decline' }).catch(() => {});
    }
    cleanup(); setState('idle'); setPeer(null);
  }, [send, api, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getAudioTracks()[0];
      if (t) { t.enabled = !t.enabled; setMuted(!t.enabled); }
    }
  }, []);

  // ── Handle incoming call (with dedup) ──
  const handleIncomingCall = useCallback((data) => {
    if (activeCallFromRef.current === data.from_user_id && stateRef.current !== 'idle') {
      console.log('[Call] Ignoring duplicate ring from', data.from_user_id);
      return;
    }
    if (stateRef.current !== 'idle' || window.__callBusy) {
      // Reset stale flag if we're actually idle
      if (stateRef.current === 'idle' && window.__callBusy) { window.__callBusy = false; }
      else { if (send) send({ type: 'call:busy', target_user_id: data.from_user_id }); return; }
    }
    activeCallFromRef.current = data.from_user_id;
    answerSentRef.current = false;
    setPeer({ user_id: data.from_user_id, user_name: data.from_user_name });
    setState('ringing');
    callNotifRef.current = showCallNotification(data.from_user_name, 'voice');
    timeoutRef.current = setTimeout(() => {
      if (stateRef.current === 'ringing') {
        if (send) send({ type: 'call:decline', target_user_id: data.from_user_id });
        cleanup(); setState('idle'); setPeer(null);
      }
    }, 30000);
  }, [send, cleanup]);

  // ── WS listener for ALL call events ──
  useEffect(() => {
    if (!addListener) return;
    const handler = async (data) => {
      if (!data.type?.startsWith('call:')) return;

      switch (data.type) {
        case 'call:ring':
          handleIncomingCall(data);
          break;

        case 'call:offer': {
          // ── FIX: Polite peer pattern for glare handling ──
          const pc = pcRef.current;
          const isPolite = user && data.from_user_id && user._id < data.from_user_id;
          const offerCollision = makingOfferRef.current || (pc && pc.signalingState !== 'stable');

          if (offerCollision && !isPolite) {
            // Impolite peer: ignore the incoming offer
            console.log('[Call] Impolite peer ignoring colliding offer');
            return;
          }

          pendingOfferRef.current = data.sdp;

          // If user already accepted (state=connected) but offer arrived late:
          if (stateRef.current === 'connected' && pc && !answerSentRef.current) {
            answerSentRef.current = true;
            try {
              if (offerCollision && isPolite) {
                // Polite peer: rollback our offer
                await pc.setLocalDescription({ type: 'rollback' });
              }
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
              for (const c of iceBufferRef.current) { await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}); }
              iceBufferRef.current = [];
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (send) send({ type: 'call:answer', target_user_id: data.from_user_id, sdp: answer.sdp });
            } catch (e) { console.error('[Call] Late offer handshake error:', e); }
          }
          break;
        }

        case 'call:accept':
          if (stateRef.current === 'outgoing') {
            if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
            setState('connected');
            setDuration(0);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            // Start quality monitoring for caller side too
            statsTimerRef.current = setInterval(async () => {
              if (!pcRef.current) return;
              try {
                const stats = await pcRef.current.getStats();
                let loss = 0, rtt = 0, jitter = 0;
                stats.forEach(report => {
                  if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    loss = report.packetsLost / Math.max(1, report.packetsReceived + report.packetsLost);
                    if (report.jitter) jitter = report.jitter * 1000;
                  }
                  if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
                    rtt = report.currentRoundTripTime * 1000;
                  }
                });
                if (loss > 0.10 || rtt > 400 || jitter > 80) setQuality('poor');
                else if (loss > 0.03 || rtt > 200 || jitter > 40) setQuality('fair');
                else setQuality('good');
              } catch {}
            }, 3000);
            setupDeviceChangeListener();
          }
          break;

        case 'call:answer':
          if (pcRef.current && pcRef.current.signalingState === 'have-local-offer') {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
              for (const c of iceBufferRef.current) { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}); }
              iceBufferRef.current = [];
            } catch (e) { console.warn('[Call] Answer SDP error:', e.message); }
          }
          break;

        case 'call:ice':
          if (pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
          } else {
            iceBufferRef.current.push(data.candidate);
          }
          break;

        case 'call:claimed':
          if (stateRef.current === 'ringing') {
            cleanup(); setState('idle'); setPeer(null);
          }
          break;

        case 'call:decline': case 'call:end':
          cleanup(); setState('idle'); setPeer(null);
          break;

        case 'call:busy':
          cleanup(); setState('idle'); setPeer(null);
          toast.info('User is busy on another call');
          break;

        default: break;
      }
    };
    addListener(handler);
    return () => removeListener(handler);
  }, [addListener, removeListener, handleIncomingCall, cleanup, send, user, setupDeviceChangeListener]);

  // ── FIX: Conditional REST polling — only when WS is disconnected ──
  useEffect(() => {
    if (!api) return;
    pollRef.current = setInterval(async () => {
      if (stateRef.current !== 'idle') return;
      // Only poll when WebSocket is NOT connected
      if (wsRef?.current?.readyState === WebSocket.OPEN) return;
      try {
        const res = await api.get('/api/call/pending');
        if (res.data.call) {
          const ts = res.data.call.timestamp;
          if (ts) {
            const age = (Date.now() - new Date(ts).getTime()) / 1000;
            if (age > 60) return;
          }
          handleIncomingCall(res.data.call);
        }
      } catch {}
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [api, handleIncomingCall, wsRef]);

  // ── FIX: Network recovery — trigger ICE restart on reconnection ──
  useEffect(() => {
    const handleOnline = () => {
      if (stateRef.current === 'connected' && pcRef.current) {
        console.log('[Call] Network restored — attempting ICE restart');
        attemptIceRestart();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [attemptIceRestart]);

  // Expose startCall globally
  useEffect(() => { window.__voiceCall = { startCall }; return () => { delete window.__voiceCall; }; }, [startCall]);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      {/* Incoming call UI */}
      {state === 'ringing' && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center" data-testid="incoming-call-overlay">
          <div className="bg-card rounded-3xl shadow-2xl p-8 text-center w-80 animate-fade-in border">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <PhoneIncoming className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Space Grotesk' }}>Incoming Voice Call</h3>
            <p className="text-sm text-muted-foreground mb-6">{peer?.user_name}</p>
            <div className="flex justify-center gap-6">
              <div className="text-center"><button onClick={declineCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center mb-1 transition-colors" data-testid="decline-call-btn"><PhoneOff className="w-6 h-6" /></button><p className="text-[10px] text-muted-foreground">Decline</p></div>
              <div className="text-center"><button onClick={acceptCall} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center mb-1 transition-colors" data-testid="accept-call-btn"><Phone className="w-6 h-6" /></button><p className="text-[10px] text-muted-foreground">Accept</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Active/outgoing call UI */}
      {(state === 'outgoing' || state === 'connected') && (
        <DraggableCallWidget
          state={state}
          peer={peer}
          duration={duration}
          quality={quality}
          muted={muted}
          onToggleMute={toggleMute}
          onEndCall={endCall}
          fmt={fmt}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
// DRAGGABLE CALL WIDGET (unchanged — UI only)
// ══════════════════════════════════════════════════════════
function DraggableCallWidget({ state, peer, duration, quality, muted, onToggleMute, onEndCall, fmt }) {
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 300, y: window.innerHeight - 200 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const nx = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragOffset.current.x));
      const ny = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

  if (minimized) {
    return (
      <div ref={widgetRef} onPointerDown={onPointerDown} className="fixed z-[9998] select-none touch-none" style={{ left: pos.x, top: pos.y }} data-testid="call-widget-mini">
        <div className="flex items-center gap-2 bg-card border shadow-lg rounded-full px-3 py-2 cursor-grab active:cursor-grabbing">
          <div className={`w-3 h-3 rounded-full ${state === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`} />
          <span className="text-xs font-medium truncate max-w-[80px]">{peer?.user_name?.split(' ')[0]}</span>
          {state === 'connected' && <span className="text-[10px] font-mono text-muted-foreground">{fmt(duration)}</span>}
          <button onClick={() => setMinimized(false)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><Maximize2 className="w-3 h-3" /></button>
          <button onClick={onEndCall} className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors" data-testid="end-call-mini"><PhoneOff className="w-3 h-3" /></button>
        </div>
      </div>
    );
  }

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center" data-testid="call-widget-expanded">
        <div className="bg-card rounded-3xl shadow-2xl border w-96 p-8 text-center">
          <div className="flex justify-end mb-2">
            <button onClick={() => setExpanded(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><Minimize2 className="w-4 h-4" /></button>
          </div>
          <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${state === 'connected' ? 'bg-emerald-100' : 'bg-blue-100 animate-pulse'}`}>
            <Phone className={`w-12 h-12 ${state === 'connected' ? 'text-emerald-600' : 'text-blue-600'}`} />
          </div>
          <h3 className="text-xl font-semibold mb-1" style={{ fontFamily: 'Space Grotesk' }}>{peer?.user_name}</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {state === 'outgoing' ? 'Calling...' : <span className="font-mono text-lg text-emerald-600">{fmt(duration)}</span>}
          </p>
          {quality !== 'good' && state === 'connected' && (
            <Badge variant="outline" className={`mb-4 ${quality === 'poor' ? 'text-red-500 border-red-200' : 'text-amber-500 border-amber-200'}`}>
              <AlertTriangle className="w-3 h-3 mr-1" />{quality === 'poor' ? 'Poor Connection' : 'Fair Connection'}
            </Badge>
          )}
          <div className="flex justify-center gap-4">
            {state === 'connected' && (
              <div className="text-center">
                <button onClick={onToggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-colors ${muted ? 'bg-red-50 border-red-300 text-red-600' : 'bg-muted border-border text-foreground'}`}>
                  {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <p className="text-[10px] text-muted-foreground mt-1">{muted ? 'Unmute' : 'Mute'}</p>
              </div>
            )}
            <div className="text-center">
              <button onClick={onEndCall} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors" data-testid="end-call-expanded"><PhoneOff className="w-6 h-6" /></button>
              <p className="text-[10px] text-muted-foreground mt-1">End Call</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={widgetRef} onPointerDown={onPointerDown} className="fixed z-[9998] select-none touch-none" style={{ left: pos.x, top: pos.y }} data-testid="active-call-widget">
      <div className="bg-card rounded-2xl shadow-2xl border w-72 cursor-grab active:cursor-grabbing">
        <div className="flex items-center justify-center pt-2 pb-1 text-muted-foreground/40"><GripHorizontal className="w-5 h-5" /></div>
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${state === 'outgoing' ? 'bg-blue-100 animate-pulse' : 'bg-emerald-100'}`}>
              <Phone className={`w-5 h-5 ${state === 'outgoing' ? 'text-blue-600' : 'text-emerald-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{peer?.user_name}</p>
              <p className="text-xs text-muted-foreground">
                {state === 'outgoing' ? <span className="text-blue-600">Ringing...</span> : <span className="text-emerald-600 font-mono">{fmt(duration)}</span>}
              </p>
            </div>
            {quality !== 'good' && state === 'connected' && (
              <Badge variant="outline" className={`text-[10px] shrink-0 ${quality === 'poor' ? 'text-red-500 border-red-200' : 'text-amber-500 border-amber-200'}`}>
                <AlertTriangle className="w-3 h-3 mr-0.5" />{quality === 'poor' ? 'Poor' : 'Fair'}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => setMinimized(true)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-colors" title="Minimize"><Minimize2 className="w-4 h-4" /></button>
              <button onClick={() => setExpanded(true)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-colors" title="Expand"><Maximize2 className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              {state === 'connected' && (
                <button onClick={onToggleMute} className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${muted ? 'bg-red-50 border-red-200 text-red-600' : 'bg-muted border-border text-muted-foreground'}`} data-testid="mute-btn">
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button onClick={onEndCall} className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors" data-testid="end-call-btn"><PhoneOff className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
