import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// Message types that should be queued during disconnect
const QUEUEABLE_TYPES = [
  'call:', 'vcall:', 'room:', 'group:', 'group-call:',  // Call + group signaling
  'chat:send', 'chat:read',                              // Chat messages and read receipts
  'typing',                                               // Typing indicators
];

const shouldQueue = (type) => QUEUEABLE_TYPES.some(prefix => type?.startsWith(prefix));

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectRef = useRef(null);
  const pingRef = useRef(null);
  const reconnectDelay = useRef(1000);
  const queueRef = useRef([]);
  const ackCallbacks = useRef(new Map()); // msgId -> { resolve, timeout }
  const msgIdCounter = useRef(0);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const base = process.env.REACT_APP_BACKEND_URL || '';
    const wsBase = base.replace(/^http/, 'ws');
    const url = `${wsBase}/api/ws/messages?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      reconnectDelay.current = 1000;
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }

      // Keep-alive ping every 25s to prevent proxy idle timeout
      if (ws._pingInterval) clearInterval(ws._pingInterval);
      ws._pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
        }
      }, 25000);

      // Flush queued messages (discard any older than 15s)
      const now = Date.now();
      const pending = queueRef.current.filter(q => now - q.timestamp < 15000);
      const expired = queueRef.current.length - pending.length;
      queueRef.current = [];
      if (expired > 0) console.log(`[WS] Discarded ${expired} expired queued messages`);
      if (pending.length > 0) console.log(`[WS] Flushing ${pending.length} queued messages`);
      for (const q of pending) {
        try { ws.send(JSON.stringify(q.data)); } catch (e) {}
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle ACK responses
        if (data.type === 'ack' && data.msg_id && ackCallbacks.current.has(data.msg_id)) {
          const { resolve, timeout } = ackCallbacks.current.get(data.msg_id);
          clearTimeout(timeout);
          ackCallbacks.current.delete(data.msg_id);
          resolve(true);
          return;
        }

        if (data.type === 'presence') {
          setOnlineUsers(prev => {
            const next = { ...prev };
            if (data.online) next[data.user_id] = data.user_name;
            else delete next[data.user_id];
            return next;
          });
        }
        listenersRef.current.forEach(fn => {
          try { fn(data); } catch (e) { console.warn('[WS] Listener error', e); }
        });
      } catch (e) {}
    };

    ws.onclose = (ev) => {
      console.log('[WS] Disconnected', ev.code);
      setConnected(false);
      if (ws._pingInterval) clearInterval(ws._pingInterval);
      wsRef.current = null;
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, 15000);
      reconnectRef.current = setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {};
  }, [token]);

  useEffect(() => {
    connect();
    pingRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);
    return () => {
      clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
      // Clear all pending ack callbacks
      for (const [, { timeout }] of ackCallbacks.current) clearTimeout(timeout);
      ackCallbacks.current.clear();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    // Queue critical messages for retry on reconnect
    if (shouldQueue(data.type)) {
      queueRef.current.push({ data, timestamp: Date.now() });
      console.log(`[WS] Queued ${data.type} (${queueRef.current.length} in queue)`);
    }
    return false;
  }, []);

  /**
   * Send with acknowledgment — returns a promise that resolves when server ACKs.
   * Falls back to regular send if no ACK within timeout.
   */
  const sendWithAck = useCallback((data, timeoutMs = 5000) => {
    return new Promise((resolve) => {
      const msgId = `msg_${++msgIdCounter.current}_${Date.now()}`;
      const payload = { ...data, msg_id: msgId };

      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        if (shouldQueue(data.type)) {
          queueRef.current.push({ data: payload, timestamp: Date.now() });
        }
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        ackCallbacks.current.delete(msgId);
        resolve(false); // Timed out
      }, timeoutMs);

      ackCallbacks.current.set(msgId, { resolve, timeout });
      wsRef.current.send(JSON.stringify(payload));
    });
  }, []);

  const addListener = useCallback((fn) => { listenersRef.current.add(fn); }, []);
  const removeListener = useCallback((fn) => { listenersRef.current.delete(fn); }, []);

  const getQueueSize = useCallback(() => queueRef.current.length, []);

  return (
    <SocketContext.Provider value={{ connected, send, sendWithAck, addListener, removeListener, wsRef, onlineUsers, getQueueSize }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
