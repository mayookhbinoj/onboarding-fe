import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, Maximize, Minimize2, Users, UserPlus, Signal, Hand, X, ChevronRight } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { showCallNotification, dismissCallNotification } from '../../utils/callNotifications';

const ICE_SERVERS_FALLBACK = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ── Optimised RTC config ──
const RTC_CONFIG_BASE = {
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const MAX_PARTICIPANTS = 10;

function ControlButton({ icon: Icon, label, active, onClick, danger, highlight, 'data-testid': tid }) {
  return (
    <div className="text-center">
      <button onClick={onClick} data-testid={tid} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${danger ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : highlight ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' : active ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10' : 'bg-white/5 text-white/40 hover:bg-white/10 border border-white/5'}`} title={label}>
        <Icon className="w-5 h-5" />
      </button>
      <p className="text-[9px] text-white/50 mt-1">{label}</p>
    </div>
  );
}

// Video tile for one participant
function ParticipantTile({ stream, name, isLocal, isMuted, isCameraOff, isSpeaking, isConnecting, quality }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) { videoRef.current.srcObject = stream; }
  }, [stream]);
  const initial = name?.[0]?.toUpperCase() || '?';

  return (
    <div data-testid={`participant-tile-${name}`} className={`relative rounded-2xl overflow-hidden bg-gray-800 border-2 transition-all duration-300 ${isSpeaking ? 'border-emerald-400 shadow-lg shadow-emerald-500/20' : 'border-white/5'}`} style={{ minHeight: 160 }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[80px] sm:text-[100px] font-bold text-white" style={{ opacity: 0.08 }}>{initial}</span>
      </div>
      {stream && !isCameraOff ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white/60">{initial}</div>
        </div>
      )}
      {isConnecting && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60" />
          <p className="absolute mt-14 text-xs text-white/60">Connecting...</p>
        </div>
      )}
      {!isLocal && quality && (
        <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${quality === 'green' ? 'bg-emerald-400' : quality === 'yellow' ? 'bg-amber-400' : 'bg-red-400'}`} title={quality === 'green' ? 'Good connection' : quality === 'yellow' ? 'Fair connection' : 'Poor connection'} />
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
        <span className="text-xs text-white font-medium">{name}{isLocal ? ' (You)' : ''}</span>
      </div>
      {isMuted && <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center"><MicOff className="w-3 h-3 text-white" /></div>}
    </div>
  );
}

export default function GlobalGroupCall() {
  const { user, api } = useAuth();
  const { send, addListener, removeListener } = useSocket();

  // ── FIX: Use refs for user and send to avoid stale closures ──
  const userRef = useRef(user);
  const sendRef = useRef(send);
  const apiRef = useRef(api);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { sendRef.current = send; }, [send]);
  useEffect(() => { apiRef.current = api; }, [api]);

  // State
  const [state, setState] = useState('idle');
  const [roomId, setRoomId] = useState(null);
  const [callType, setCallType] = useState('video');
  const [participants, setParticipants] = useState({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [invite, setInvite] = useState(null);
  const [handRaised, setHandRaised] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  const stateRef = useRef('idle');
  const roomRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});
  const iceServersRef = useRef(ICE_SERVERS_FALLBACK);
  const durationRef = useRef(null);
  const inviteNotifRef = useRef(null);
  // ── FIX: Per-peer ICE candidate buffers ──
  const iceBuffersRef = useRef({});
  const deviceChangeHandlerRef = useRef(null);

  // ── FIX: Expose API using refs to avoid stale closures ──
  // Detect and reset stale __callBusy flag from previous calls that didn't clean up
  const resetStaleBusy = () => {
    if (window.__callBusy && stateRef.current === 'idle') {
      console.log('[GroupCall] Resetting stale __callBusy flag');
      window.__callBusy = false;
    }
  };

  useEffect(() => {
    window.__groupCall = {
      createRoom: async (type, groupId) => {
        resetStaleBusy();
        if (window.__callBusy) { toast.info('Already on a call'); return null; }
        const currentApi = apiRef.current;
        const currentUser = userRef.current;
        try {
          const iceRes = await currentApi.get('/api/call/ice-servers');
          iceServersRef.current = iceRes.data.ice_servers || ICE_SERVERS_FALLBACK;
        } catch {}
        try {
          const body = { call_type: type };
          if (groupId) body.group_id = groupId;
          const res = await currentApi.post('/api/call/room/create', body);
          roomRef.current = res.data.room_id;
          setRoomId(res.data.room_id);
          setCallType(type);
          window.__callBusy = true;
          await startLocalMedia(type);
          stateRef.current = 'active';
          setState('active');
          startTimer();
          toast.success(groupId ? `Group call started — ringing members` : 'Group call started');
          return res.data.room_id;
        } catch (e) { toast.error('Failed to create room'); return null; }
      },
      inviteUser: async (userId) => {
        if (!roomRef.current) return;
        try { await apiRef.current.post('/api/call/room/invite', { room_id: roomRef.current, target_user_id: userId }); } catch {}
      },
      joinRoom: async (roomId, type) => {
        resetStaleBusy();
        if (window.__callBusy) { toast.info('Already on a call'); return false; }
        const currentApi = apiRef.current;
        const currentUser = userRef.current;
        try {
          const iceRes = await currentApi.get('/api/call/ice-servers');
          iceServersRef.current = iceRes.data.ice_servers || ICE_SERVERS_FALLBACK;
        } catch {}
        roomRef.current = roomId;
        setRoomId(roomId);
        setCallType(type);
        window.__callBusy = true;
        await startLocalMedia(type);
        try {
          const roomData = await currentApi.post('/api/call/room/join', { room_id: roomId });
          const existing = roomData.data?.participants || {};
          if (roomData.data?.creator_id === currentUser._id) setIsCreator(true);
          for (const pid of Object.keys(existing)) {
            if (pid !== currentUser._id) createPeerConnection(pid, existing[pid]?.name || '?', true);
          }
        } catch (e) { toast.error('Failed to join room'); window.__callBusy = false; return false; }
        stateRef.current = 'active';
        setState('active');
        startTimer();
        toast.success('Joined group call');
        return true;
      },
      getActiveRoomId: () => roomRef.current,
    };
    return () => { window.__groupCall = null; };
  }, []); // Empty deps — uses refs internally

  // Check for P2P -> Group upgrade on mount/state change
  useEffect(() => {
    const upgrade = window.__callUpgrade;
    if (upgrade && stateRef.current === 'idle') {
      window.__callUpgrade = null;
      const currentApi = apiRef.current;
      const currentUser = userRef.current;
      (async () => {
        try {
          const iceRes = await currentApi.get('/api/call/ice-servers');
          iceServersRef.current = iceRes.data.ice_servers || ICE_SERVERS_FALLBACK;
        } catch {}
        roomRef.current = upgrade.roomId;
        setRoomId(upgrade.roomId);
        setCallType(upgrade.callType);
        window.__callBusy = true;
        if (upgrade.mediaStream) {
          localStreamRef.current = upgrade.mediaStream;
          setParticipants(prev => ({ ...prev, [currentUser._id]: { name: currentUser.name || currentUser.email, stream: upgrade.mediaStream, muted: false, cameraOff: false, isLocal: true, connecting: false } }));
        } else {
          await startLocalMedia(upgrade.callType);
        }
        try {
          const roomData = await currentApi.post('/api/call/room/join', { room_id: upgrade.roomId });
          const existing = roomData.data?.participants || {};
          if (roomData.data?.creator_id === currentUser._id) setIsCreator(true);
          for (const pid of Object.keys(existing)) {
            if (pid !== currentUser._id) createPeerConnection(pid, existing[pid]?.name || '?', true);
          }
        } catch {}
        stateRef.current = 'active';
        setState('active');
        startTimer();
        toast.info('Call upgraded to group call');
      })();
    }
  }, [state]);

  const startLocalMedia = async (type) => {
    const currentUser = userRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      setParticipants(prev => ({ ...prev, [currentUser._id]: { name: currentUser.name || currentUser.email, stream, muted: false, cameraOff: false, isLocal: true, connecting: false } }));
    } catch (e) {
      if (type === 'video') {
        toast.warning('Camera denied — joining with audio only');
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = audioStream;
          setCameraOff(true);
          setParticipants(prev => ({ ...prev, [currentUser._id]: { name: currentUser.name || currentUser.email, stream: audioStream, muted: false, cameraOff: true, isLocal: true, connecting: false } }));
        } catch {
          toast.error('Microphone access denied. Please enable in browser settings.');
          window.__callBusy = false;
        }
      } else {
        toast.error('Microphone access denied. Please enable in browser settings.');
        window.__callBusy = false;
      }
    }
  };

  const startTimer = () => {
    setDuration(0);
    durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  // ── FIX: ICE candidate buffer helpers ──
  const bufferIceCandidate = useCallback((peerId, candidate) => {
    if (!iceBuffersRef.current[peerId]) iceBuffersRef.current[peerId] = [];
    iceBuffersRef.current[peerId].push(candidate);
  }, []);

  const drainIceBuffer = useCallback((peerId, pc) => {
    const buffer = iceBuffersRef.current[peerId];
    if (buffer && buffer.length > 0 && pc.remoteDescription) {
      console.log(`[GroupCall] Draining ${buffer.length} buffered ICE candidates for ${peerId}`);
      for (const c of buffer) {
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(e => console.warn('[GroupCall] ICE add error:', e));
      }
      iceBuffersRef.current[peerId] = [];
    }
  }, []);

  // Create peer connection for a remote user
  const createPeerConnection = useCallback((peerId, peerName, isInitiator) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];
    const currentUser = userRef.current;
    const currentSend = sendRef.current;

    const currentCount = Object.keys(peersRef.current).length + 1;
    if (currentCount >= MAX_PARTICIPANTS) { toast.error(`Room is full (max ${MAX_PARTICIPANTS} participants)`); return null; }
    if (currentCount >= 8) toast.warning('Performance may degrade. Consider turning off cameras.');
    else if (currentCount >= 5) toast.info('Large group call — video quality may adjust automatically.');

    // ── FIX: Upgraded RTC config ──
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      ...RTC_CONFIG_BASE,
    });
    peersRef.current[peerId] = pc;
    // Init ICE buffer for this peer
    iceBuffersRef.current[peerId] = [];

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

    setParticipants(prev => ({ ...prev, [peerId]: { ...prev[peerId], name: peerName || prev[peerId]?.name || '?', connecting: true, stream: null, muted: false, cameraOff: false } }));

    pc.ontrack = (e) => {
      if (!peersRef.current[peerId]) return; // Peer was removed
      const remoteStream = e.streams[0];
      setParticipants(prev => prev[peerId] ? ({ ...prev, [peerId]: { ...prev[peerId], stream: remoteStream, connecting: false } }) : prev);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && currentSend && peersRef.current[peerId]) {
        currentSend({ type: 'room:ice', room_id: roomRef.current, target_user_id: peerId, candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      // If peer was already removed by room:peer-left, ignore state changes
      if (!peersRef.current[peerId]) return;
      if (pc.connectionState === 'failed') {
        setParticipants(prev => prev[peerId] ? ({ ...prev, [peerId]: { ...prev[peerId], connecting: true, quality: 'red' } }) : prev);
        // Attempt ICE restart
        if (isInitiator) {
          pc.createOffer({ iceRestart: true }).then(o => pc.setLocalDescription(o)).then(() => {
            sendRef.current({ type: 'room:offer', room_id: roomRef.current, target_user_id: peerId, sdp: pc.localDescription.sdp });
          }).catch(() => {});
        }
        // Give 10s for ICE restart to work, then clean up if still failed
        setTimeout(() => {
          if (!peersRef.current[peerId]) return;
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            clearInterval(pc._statsInterval);
            pc.close(); delete peersRef.current[peerId];
            delete iceBuffersRef.current[peerId];
            setParticipants(prev => { const n = { ...prev }; delete n[peerId]; return n; });
          }
        }, 10000);
      } else if (pc.connectionState === 'disconnected') {
        // Brief disconnections are normal during ICE — just show yellow quality, don't remove
        setParticipants(prev => prev[peerId] ? ({ ...prev, [peerId]: { ...prev[peerId], quality: 'yellow' } }) : prev);
      } else if (pc.connectionState === 'connected') {
        setParticipants(prev => prev[peerId] ? ({ ...prev, [peerId]: { ...prev[peerId], connecting: false, quality: 'green' } }) : prev);
      }
    };

    // Network quality monitoring
    const statsInterval = setInterval(async () => {
      if (pc.connectionState !== 'connected') return;
      try {
        const stats = await pc.getStats();
        let loss = 0, rtt = 0;
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && r.packetsLost !== undefined && r.packetsReceived) {
            loss = (r.packetsLost / (r.packetsLost + r.packetsReceived)) * 100;
          }
          if (r.type === 'candidate-pair' && r.currentRoundTripTime) {
            rtt = r.currentRoundTripTime * 1000;
          }
        });
        const quality = loss > 10 || rtt > 400 ? 'red' : loss > 3 || rtt > 200 ? 'yellow' : 'green';
        setParticipants(prev => prev[peerId] ? { ...prev, [peerId]: { ...prev[peerId], quality } } : prev);
      } catch {}
    }, 3000);
    pc._statsInterval = statsInterval;

    if (isInitiator) {
      pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
        currentSend({ type: 'room:offer', room_id: roomRef.current, target_user_id: peerId, sdp: pc.localDescription.sdp });
      }).catch(() => {});
    }

    return pc;
  }, []); // Uses refs internally — no stale closures

  // Handle signaling messages
  useEffect(() => {
    const handler = async (data) => {
      const currentUser = userRef.current;
      const currentSend = sendRef.current;

      if (data.type === 'room:invite' || data.type === 'group-call:ring') {
        resetStaleBusy();
        if (stateRef.current !== 'idle' || window.__callBusy) return;
        setInvite({ ...data, isGroupRing: data.type === 'group-call:ring' });
        inviteNotifRef.current = showCallNotification(data.from_user_name, data.call_type === 'video' ? 'video' : 'voice');
        setTimeout(() => { if (stateRef.current === 'idle') { setInvite(null); dismissCallNotification(inviteNotifRef.current); } }, 30000);
      }

      if (data.type === 'room:peer-joined' && stateRef.current === 'active' && data.room_id === roomRef.current) {
        createPeerConnection(data.user_id, data.user_name, true);
      }

      if (data.type === 'room:peer-left' && stateRef.current === 'active') {
        const pc = peersRef.current[data.user_id];
        if (pc) { clearInterval(pc._statsInterval); pc.close(); delete peersRef.current[data.user_id]; }
        delete iceBuffersRef.current[data.user_id]; // Clean up ICE buffer
        setParticipants(prev => {
          const n = { ...prev }; delete n[data.user_id];
          const remaining = Object.keys(n).filter(id => !n[id]?.isLocal);
          if (remaining.length === 0) toast.info('Everyone else has left the call');
          return n;
        });
      }

      if (data.type === 'room:offer' && stateRef.current === 'active') {
        const pc = createPeerConnection(data.from_user_id, data.from_user_name, false);
        if (!pc) return;
        try {
          // Polite peer pattern
          if (pc.signalingState !== 'stable') {
            if (currentUser._id > data.from_user_id) return; // impolite — ignore
            await pc.setLocalDescription({ type: 'rollback' }); // polite — rollback
          }
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
          // ── FIX: Drain ICE buffer after setting remote description ──
          drainIceBuffer(data.from_user_id, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          currentSend({ type: 'room:answer', room_id: roomRef.current, target_user_id: data.from_user_id, sdp: answer.sdp });
        } catch (e) { console.warn('[GroupCall] offer handling error:', e.message); }
      }

      if (data.type === 'room:answer' && stateRef.current === 'active') {
        const pc = peersRef.current[data.from_user_id];
        if (pc && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
            // ── FIX: Drain ICE buffer after setting remote description ──
            drainIceBuffer(data.from_user_id, pc);
          } catch (e) { console.warn('[GroupCall] answer handling error:', e.message); }
        }
      }

      // ── FIX: Buffer ICE candidates when remoteDescription isn't set yet ──
      if (data.type === 'room:ice' && stateRef.current === 'active') {
        const pc = peersRef.current[data.from_user_id];
        if (pc && data.candidate) {
          if (pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
          } else {
            // Buffer the candidate — will be drained after setRemoteDescription
            bufferIceCandidate(data.from_user_id, data.candidate);
          }
        }
      }

      if (data.type === 'room:mute') {
        setParticipants(prev => ({ ...prev, [data.from_user_id]: { ...prev[data.from_user_id], muted: data.muted } }));
      }
      if (data.type === 'room:camera-off') {
        setParticipants(prev => ({ ...prev, [data.from_user_id]: { ...prev[data.from_user_id], cameraOff: data.cameraOff } }));
      }
      if (data.type === 'room:ended-by-host' && data.room_id === roomRef.current) {
        toast.info(`Call ended by ${data.host_name || 'host'}`);
        // Trigger leave via timeout to avoid stale closure
        setTimeout(() => {
          Object.entries(peersRef.current).forEach(([, pc]) => { clearInterval(pc._statsInterval); pc.close(); });
          peersRef.current = {};
          localStreamRef.current?.getTracks().forEach(t => t.stop());
          localStreamRef.current = null;
          clearInterval(durationRef.current);
          setParticipants({});
          setRoomId(null);
          roomRef.current = null;
          stateRef.current = 'idle';
          setState('idle');
          setMuted(false);
          setCameraOff(false);
          setIsCreator(false);
          setMinimized(false);
          window.__callBusy = false;
        }, 100);
      }
    };

    addListener(handler);
    return () => removeListener(handler);
  }, [addListener, removeListener, createPeerConnection, bufferIceCandidate, drainIceBuffer]);

  // Accept invite
  const acceptInvite = async () => {
    if (!invite) return;
    dismissCallNotification(inviteNotifRef.current);
    const rid = invite.room_id;
    const type = invite.call_type || 'video';
    setInvite(null);

    try {
      const iceRes = await api.get('/api/call/ice-servers');
      iceServersRef.current = iceRes.data.ice_servers || ICE_SERVERS_FALLBACK;
    } catch {}

    roomRef.current = rid;
    setRoomId(rid);
    setCallType(type);
    window.__callBusy = true;
    await startLocalMedia(type);

    try {
      const roomData = await api.post('/api/call/room/join', { room_id: rid });
      const existingPeers = roomData.data?.participants || {};
      if (roomData.data?.creator_id === user._id) setIsCreator(true);
      for (const pid of Object.keys(existingPeers)) {
        if (pid !== user._id) {
          createPeerConnection(pid, existingPeers[pid]?.name || '?', true);
        }
      }
    } catch (e) { toast.error('Failed to join room'); return; }

    stateRef.current = 'active';
    setState('active');
    startTimer();
    setupDeviceChangeListener();
    toast.success('Joined group call');
  };

  const declineInvite = () => {
    setInvite(null);
    dismissCallNotification(inviteNotifRef.current);
  };

  // ── FIX: Remove duplicate leave — only use WS (server handles room cleanup via WS disconnect too) ──
  const leaveCall = () => {
    Object.entries(peersRef.current).forEach(([pid, pc]) => { clearInterval(pc._statsInterval); pc.close(); });
    peersRef.current = {};
    iceBuffersRef.current = {};
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (roomRef.current && send) {
      // Only send WS leave — server WS disconnect handler + leave-beacon cover the rest
      send({ type: 'room:leave', room_id: roomRef.current });
    }
    // Remove device change listener
    if (deviceChangeHandlerRef.current) {
      navigator.mediaDevices?.removeEventListener('devicechange', deviceChangeHandlerRef.current);
      deviceChangeHandlerRef.current = null;
    }
    clearInterval(durationRef.current);
    setParticipants({});
    setRoomId(null);
    roomRef.current = null;
    stateRef.current = 'idle';
    setState('idle');
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
    setMinimized(false);
    setHandRaised(false);
    setIsCreator(false);
    window.__callBusy = false;
    toast.info('Left group call');
  };

  const endCallForAll = async () => {
    if (!roomRef.current) return;
    try {
      await api.post('/api/call/room/end-all', { room_id: roomRef.current });
      leaveCall();
      toast.success('Call ended for all participants');
    } catch (err) { toast.error('Failed to end call'); }
  };

  // Toggle controls
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !m; });
    if (send) send({ type: 'room:mute', room_id: roomRef.current, muted: m });
  };
  const toggleCamera = () => {
    const c = !cameraOff;
    setCameraOff(c);
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !c; });
    if (send) send({ type: 'room:camera-off', room_id: roomRef.current, cameraOff: c });
  };

  // ── FIX: Device hot-plug detection ──
  const setupDeviceChangeListener = useCallback(() => {
    if (deviceChangeHandlerRef.current) return;
    const handler = async () => {
      if (stateRef.current !== 'active' || !localStreamRef.current) return;
      console.log('[GroupCall] Device change detected');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        if (audioInputs.length === 0) { toast.warning('No microphone detected'); return; }

        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const newTrack = newStream.getAudioTracks()[0];

        // Replace track in all peer connections
        for (const pc of Object.values(peersRef.current)) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (sender) await sender.replaceTrack(newTrack);
        }
        localStreamRef.current.getAudioTracks().forEach(t => t.stop());
        localStreamRef.current.addTrack(newTrack);
        newTrack.enabled = !muted;
        toast.info('Microphone switched');
      } catch (e) { console.warn('[GroupCall] Device switch failed:', e); }
    };
    deviceChangeHandlerRef.current = handler;
    navigator.mediaDevices?.addEventListener('devicechange', handler);
  }, [muted]);

  // ── FIX: Network recovery ──
  useEffect(() => {
    const handleOnline = () => {
      if (stateRef.current !== 'active') return;
      console.log('[GroupCall] Network restored — attempting ICE restarts');
      for (const [peerId, pc] of Object.entries(peersRef.current)) {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          pc.createOffer({ iceRestart: true }).then(o => pc.setLocalDescription(o)).then(() => {
            sendRef.current({ type: 'room:offer', room_id: roomRef.current, target_user_id: peerId, sdp: pc.localDescription.sdp });
          }).catch(() => {});
        }
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Cleanup on unmount + beforeunload
  useEffect(() => {
    const onBeforeUnload = () => {
      if (roomRef.current && stateRef.current === 'active') {
        const API = process.env.REACT_APP_BACKEND_URL;
        const token = localStorage.getItem('beatx_token');
        navigator.sendBeacon(`${API}/api/call/room/leave-beacon`, new Blob([JSON.stringify({ room_id: roomRef.current, _token: token })], { type: 'application/json' }));
        window.__callBusy = false;
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); };
  }, []);

  // ── FIX: Proper cleanup on component unmount ──
  useEffect(() => {
    return () => {
      // Clean up all peer connections
      Object.entries(peersRef.current).forEach(([pid, pc]) => {
        clearInterval(pc._statsInterval);
        pc.close();
      });
      peersRef.current = {};
      iceBuffersRef.current = {};
      // Stop local media
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      // Clear timers
      clearInterval(durationRef.current);
      // Remove device listener
      if (deviceChangeHandlerRef.current) {
        navigator.mediaDevices?.removeEventListener('devicechange', deviceChangeHandlerRef.current);
        deviceChangeHandlerRef.current = null;
      }
      window.__callBusy = false;
    };
  }, []);

  const participantList = Object.entries(participants);
  const gridCols = participantList.length <= 1 ? 1 : participantList.length <= 4 ? 2 : 3;

  // ═══ INCOMING INVITE ═══
  if (invite && state === 'idle') {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]); } catch {}

    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center" style={{ background: 'linear-gradient(180deg, #064e3b 0%, #0f172a 100%)' }} data-testid="group-call-invite">
        <div className="relative mb-8">
          <div className="absolute inset-0 w-32 h-32 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-4 w-24 h-24 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          <div className="relative w-32 h-32 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center">
            {invite.call_type === 'video' ? <Video className="w-14 h-14 text-emerald-400" /> : <PhoneOff className="w-14 h-14 text-emerald-400" />}
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">
          {invite.isGroupRing ? 'Group' : ''} {invite.call_type === 'video' ? 'Video' : 'Voice'} Call
        </h2>
        <p className="text-base text-white/70">{invite.from_user_name || 'Someone'}</p>
        {invite.group_name && <p className="text-sm text-white/50 mt-1">in {invite.group_name}</p>}
        <p className="text-xs text-white/30 mt-2">{invite.participant_count || 1} participant(s) in call</p>
        <div className="flex items-center gap-10 mt-12">
          <div className="text-center">
            <button onClick={declineInvite} data-testid="group-call-decline" className="w-16 h-16 rounded-full bg-red-500/30 text-red-400 hover:bg-red-500/40 flex items-center justify-center border-2 border-red-500/40 transition-all active:scale-95 shadow-lg shadow-red-500/20">
              <X className="w-7 h-7" />
            </button>
            <p className="text-xs text-white/50 mt-2">Decline</p>
          </div>
          <div className="text-center">
            <button onClick={acceptInvite} data-testid="group-call-accept" className="w-16 h-16 rounded-full bg-emerald-500/30 text-emerald-400 hover:bg-emerald-500/40 flex items-center justify-center border-2 border-emerald-500/40 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 animate-pulse">
              {invite.call_type === 'video' ? <Video className="w-7 h-7" /> : <PhoneOff className="w-7 h-7" />}
            </button>
            <p className="text-xs text-white/50 mt-2">Join</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'idle') return null;

  // ═══ MINIMIZED ═══
  if (minimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-3 flex items-center gap-3 cursor-pointer" data-testid="group-call-minimized" onClick={() => setMinimized(false)}>
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><Users className="w-5 h-5 text-emerald-400" /></div>
        <div>
          <p className="text-xs text-white font-medium">{participantList.length} in call</p>
          <p className="text-[10px] text-white/50">{fmt(duration)}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); toggleMute(); }} className={`w-8 h-8 rounded-full flex items-center justify-center ${muted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}>{muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}</button>
        <button onClick={e => { e.stopPropagation(); leaveCall(); }} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"><PhoneOff className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  // ═══ ACTIVE CALL (Full Screen) ═══
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col" data-testid="group-call-active">
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent flex items-center gap-3">
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1"><Users className="w-3 h-3" /> {participantList.length}</Badge>
        <span className="text-xs text-white/60 font-mono">{fmt(duration)}</span>
        <span className="text-xs text-white/30">Room: {roomId?.slice(0, 6)}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 h-8 gap-1" onClick={() => setShowParticipants(!showParticipants)}>
          <Users className="w-3.5 h-3.5" /> Participants
        </Button>
        <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 h-8" onClick={() => setMinimized(true)}>
          <Minimize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 p-4 pt-16 pb-24 overflow-y-auto">
        <div className="w-full grid gap-2" style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridAutoRows: participantList.length <= 2 ? '1fr' : 'minmax(150px, 1fr)',
          minHeight: participantList.length <= 2 ? '100%' : 'auto',
          height: participantList.length <= 2 ? '100%' : 'auto',
        }}>
          {participantList.map(([pid, p]) => (
            <ParticipantTile key={pid} stream={p.stream} name={p.name} isLocal={p.isLocal} isMuted={p.muted} isCameraOff={p.cameraOff} isSpeaking={false} isConnecting={p.connecting} quality={p.quality} />
          ))}
        </div>
      </div>

      {showParticipants && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-gray-900/95 backdrop-blur-xl border-l border-white/10 z-20 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Participants ({participantList.length})</h3>
            <button onClick={() => setShowParticipants(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {participantList.map(([pid, p]) => (
              <div key={pid} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white/60">{p.name?.[0]?.toUpperCase()}</div>
                <span className="text-xs text-white flex-1">{p.name}{p.isLocal ? ' (You)' : ''}</span>
                {p.muted && <MicOff className="w-3 h-3 text-red-400" />}
                {p.cameraOff && <VideoOff className="w-3 h-3 text-amber-400" />}
                <div className={`w-2 h-2 rounded-full ${p.connecting ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 py-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
          {callType === 'video' && <ControlButton icon={cameraOff ? VideoOff : Video} label={cameraOff ? 'Camera Off' : 'Camera'} active={!cameraOff} onClick={toggleCamera} data-testid="gc-camera-toggle" />}
          <ControlButton icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} active={!muted} onClick={toggleMute} danger={muted} data-testid="gc-mute-toggle" />
          <ControlButton icon={PhoneOff} label="Leave" onClick={leaveCall} danger data-testid="gc-leave" />
          {isCreator && <ControlButton icon={PhoneOff} label="End All" onClick={endCallForAll} danger data-testid="gc-end-all" />}
        </div>
      </div>
    </div>
  );
}
