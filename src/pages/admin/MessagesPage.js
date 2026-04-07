import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { MessageCircle, Search, Send, CheckCircle, Circle, Wifi, WifiOff, Paperclip, Image, FileText, Download, X, Phone, Video, Check, CheckCheck, Users, ChevronRight, Settings, UserMinus, Shield, LogOut } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'sonner';

const ROLE_LABELS = { super_admin:'Super Admin', marketing_admin:'Marketing Admin', marketing_associate:'Marketing Associate', compliance_admin:'Compliance Admin', inventory_admin:'Inventory Admin', finance_admin:'Finance Admin', qcqa_tester:'QC/QA Tester' };
const ROLE_COLORS = { super_admin:'bg-purple-100 text-purple-700', marketing_admin:'bg-blue-100 text-blue-700', marketing_associate:'bg-sky-100 text-sky-700', compliance_admin:'bg-amber-100 text-amber-700', inventory_admin:'bg-emerald-100 text-emerald-700', finance_admin:'bg-rose-100 text-rose-700', qcqa_tester:'bg-teal-100 text-teal-700' };

function MessageStatus({ status }) {
  if (!status || status === 'sent') return <Check className="w-3.5 h-3.5 text-muted-foreground/40" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/40" />;
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
  return <span className="w-3.5" />;
}

export default function MessagesPage() {
  const { api, user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [search, setSearch] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const socket = useSocket();
  const [wsConnected, setWsConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [groupStep, setGroupStep] = useState(1);
  const [memberSearch, setMemberSearch] = useState('');
  const [chatSettings, setChatSettings] = useState(false);
  const [groupDetail, setGroupDetail] = useState(null);
  const [editGroupName, setEditGroupName] = useState(false);
  const [editGroupDesc, setEditGroupDesc] = useState(false);
  const [tempGroupName, setTempGroupName] = useState('');
  const [tempGroupDesc, setTempGroupDesc] = useState('');
  const [ongoingCall, setOngoingCall] = useState(null); // { room_id, call_type, participant_count }
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);
  const endRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const activeConvoRef = useRef(null);
  const wsConnectedRef = useRef(false);
  const reconnectRef = useRef(null);
  const readDebounceRef = useRef(null);

  // Keep ref in sync
  useEffect(() => { activeConvoRef.current = activeConvo; }, [activeConvo]);

  // ── Load initial data ──
  useEffect(() => {
    api.get('/api/messages/users').then(r => setUsers(r.data)).catch(() => {});
    refreshConversations();
    loadGroups();
  }, [api]);

  const loadGroups = () => { api.get('/api/groups').then(r => setGroups(r.data || [])).catch(() => {}); };

  // Check ongoing group call
  const checkOngoingCall = async (groupId) => {
    if (!groupId) { setOngoingCall(null); return; }
    try {
      const cr = await api.get(`/api/call/room/active-for-group/${groupId}`);
      if (cr.data?.active) setOngoingCall(cr.data);
      else setOngoingCall(null);
    } catch { setOngoingCall(null); }
  };

  // Poll ongoing call status every 5s + refresh when call state changes
  useEffect(() => {
    const convo = conversations.find(c => c._id === activeConvo);
    if (!convo?.group_id) { setOngoingCall(null); return; }
    // Check immediately
    checkOngoingCall(convo.group_id);
    // Poll every 5s
    const iv = setInterval(() => checkOngoingCall(convo.group_id), 5000);
    return () => clearInterval(iv);
  }, [activeConvo, conversations]);

  // Re-check ongoing call when user leaves a call (callBusy goes false)
  useEffect(() => {
    const pollBusy = setInterval(() => {
      if (!window.__callBusy) {
        const convo = conversations.find(c => c._id === activeConvo);
        if (convo?.group_id) checkOngoingCall(convo.group_id);
      }
    }, 1500);
    return () => clearInterval(pollBusy);
  }, [activeConvo, conversations]);

  // Auto-open conversation from URL param (e.g., from notification forward)
  useEffect(() => {
    const convoParam = searchParams.get('convo');
    if (convoParam && conversations.length > 0 && !activeConvo) {
      const exists = conversations.find(c => c._id === convoParam);
      if (exists) {
        openConversation(convoParam);
        searchParams.delete('convo');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [conversations, searchParams]);


  const refreshConversations = useCallback(() => {
    api.get('/api/messages/conversations').then(r => setConversations(r.data)).catch(() => {});
  }, [api]);

  // Send read receipt via BOTH WS (instant) and HTTP (reliable)
  const sendReadReceipt = useCallback((convoId) => {
    if (!convoId || convoId !== activeConvoRef.current) return;
    if (document.hidden) return;
    if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
    if (socket) socket.send({ type: 'message:read', conversation_id: convoId });
    api.post(`/api/messages/conversations/${convoId}/read`).catch(() => {});
  }, [socket, api]);

  // Mark messages as read when user returns to a visible active conversation
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && activeConvoRef.current) sendReadReceipt(activeConvoRef.current);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [sendReadReceipt]);

  // ── Listen for chat events via global socket ──
  useEffect(() => {
    if (!socket) return;
    setWsConnected(socket.connected);
    
    // Track connection state changes — refresh data on reconnect
    const checkConnection = setInterval(() => {
      const wasConnected = wsConnectedRef.current;
      const isNow = socket.connected;
      setWsConnected(isNow);
      wsConnectedRef.current = isNow;
      if (!wasConnected && isNow) {
        // Just reconnected — refresh everything
        refreshConversations();
        if (activeConvoRef.current) {
          api.get(`/api/messages/conversations/${activeConvoRef.current}/messages`).then(r => setMessages(r.data || [])).catch(() => {});
        }
      }
    }, 2000);
    
    const handler = (data) => {
      if (data.type === 'message:new') {
        if (activeConvoRef.current === data.conversation_id) {
          setMessages(prev => [...prev, data.message]);
          sendReadReceipt(data.conversation_id);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } else {
          // Only send delivery ack when NOT viewing the conversation
          // (if viewing, the read receipt already supersedes delivery)
          if (data.message?._id && socket) {
            socket.send({ type: 'message:delivered', message_id: data.message._id });
          }
        }
        refreshConversations();
      }
      // Echo: replace optimistic temp message with real server message (real _id for status matching)
      if (data.type === 'message:echo') {
        setMessages(prev => {
          const idx = prev.findIndex(m => m._id?.startsWith('t-') && m.sender_id === user._id && m.conversation_id === data.conversation_id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...data.message, status: data.message.status || 'sent' };
            return updated;
          }
          return prev;
        });
      }
      if (data.type === 'unread:update') refreshConversations();
      // Real-time message status updates (sent → delivered → read)
      if (data.type === 'message:status') {
        const STATUS_PRIORITY = { sent: 0, delivered: 1, read: 2 };
        setMessages(prev => {
          const updated = prev.map(m => {
            const isTarget = (data.message_id && m._id === data.message_id) ||
                             (data.message_ids && data.message_ids.includes(m._id));
            if (isTarget && (STATUS_PRIORITY[data.status] ?? 0) > (STATUS_PRIORITY[m.status] ?? 0)) {
              return { ...m, status: data.status };
            }
            return m;
          });
          const changed = updated.some((m, i) => m.status !== prev[i]?.status);
          return changed ? updated : prev;
        });
        if (data.status === 'read' || data.status === 'delivered') refreshConversations();
      }
      if (data.type === 'typing:start' && data.conversation_id === activeConvoRef.current) {
        setTypingUser(data.user_name);
        // Auto-scroll to show typing indicator
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = setTimeout(() => setTypingUser(null), 5000);
      }
      if (data.type === 'typing:stop' && data.conversation_id === activeConvoRef.current) {
        setTypingUser(null);
        clearTimeout(typingStopTimerRef.current);
      }
      // Update online status from presence events
      if (data.type === 'presence') {
        setUsers(prev => prev.map(u => u._id === data.user_id ? { ...u, is_online: data.online, last_seen: data.last_seen || u.last_seen } : u));
      }
      // Group events
      if (data.type === 'group:invited') {
        toast.info(`You've been added to group "${data.group_name}"`);
        loadGroups();
      }
      if (data.type === 'group:member-added' || data.type === 'group:member-removed' || data.type === 'group:member-left' || data.type === 'group:updated' || data.type === 'group:deleted') {
        loadGroups();
      }
      // Refresh ongoing call when room events fire
      if (data.type === 'room:peer-joined' || data.type === 'room:peer-left' || data.type === 'group-call:ring') {
        const convo = conversations.find(c => c._id === activeConvoRef.current);
        if (convo?.group_id) checkOngoingCall(convo.group_id);
      }
    };
    socket.addListener(handler);
    return () => { socket.removeListener(handler); clearInterval(checkConnection); };
  }, [socket, api, refreshConversations, sendReadReceipt]);

  // ── Open conversation ──
  const openConversation = async (convoId) => {
    setActiveConvo(convoId);
    activeConvoRef.current = convoId;
    setMessages([]);
    setTypingUser(null);
    setLoadingMsgs(true);
    setOngoingCall(null);
    try {
      const res = await api.get(`/api/messages/conversations/${convoId}/messages`);
      setMessages(res.data);
      sendReadReceipt(convoId);
      refreshConversations();
    } catch (err) {}
    setLoadingMsgs(false);
    // Check for ongoing group call
    const convo = conversations.find(c => c._id === convoId);
    if (convo?.group_id) {
      checkOngoingCall(convo.group_id);
    }
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (inputRef.current) inputRef.current.focus();
    }, 150);
  };

  const startDirectChat = async (targetId) => {
    try {
      const res = await api.post('/api/messages/conversations', { member_ids: [targetId], type: 'direct' });
      refreshConversations();
      openConversation(res.data._id);
    } catch (err) {}
  };

  // ── Send message ──
  const inputRef = useRef(null);

  const sendMessage = async () => {
    if (!inputText.trim() || !activeConvo) return;
    const text = inputText.trim();
    setInputText('');
    if (inputRef.current && window.innerWidth < 768) inputRef.current.blur();
    const tempId = `t-${Date.now()}`;
    const temp = { _id: tempId, text, sender_id: user._id, sender_name: user.name, created_at: new Date().toISOString(), conversation_id: activeConvo, status: 'sent' };
    setMessages(prev => [...prev, temp]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    wsSend({ type: 'typing:stop', conversation_id: activeConvo });
    try {
      const res = await api.post(`/api/messages/conversations/${activeConvo}/messages`, { text });
      // Replace optimistic temp message with real server message (real MongoDB _id)
      // Critical: without this, message:status events can never match by _id
      setMessages(prev => prev.map(m => m._id === tempId ? { ...res.data, status: res.data.status || 'sent' } : m));
      refreshConversations();
    } catch (err) {
      setMessages(prev => prev.filter(m => m._id !== tempId));
    }
  };

  // ── File upload ──
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const preview = isImage ? URL.createObjectURL(file) : null;
    setPreviewFile({ file, preview, isImage, name: file.name, size: file.size });
  };

  const cancelFile = () => {
    if (previewFile?.preview) URL.revokeObjectURL(previewFile.preview);
    setPreviewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendFile = async () => {
    if (!previewFile || !activeConvo) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', previewFile.file);
    fd.append('caption', inputText.trim());
    try {
      const res = await api.post(`/api/messages/conversations/${activeConvo}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Append optimistically
      setMessages(prev => [...prev, res.data]);
      setInputText('');
      cancelFile();
      refreshConversations();
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) { console.error('Upload failed', err); }
    setUploading(false);
  };

  // ── WS send helper ──
  const wsSend = (data) => { if (socket) socket.send(data); };

  // ── Typing indicator sender ──
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!activeConvo) return;
    // Debounced typing:start
    clearTimeout(typingTimerRef.current);
    wsSend({ type: 'typing:start', conversation_id: activeConvo });
    typingTimerRef.current = setTimeout(() => {
      wsSend({ type: 'typing:stop', conversation_id: activeConvo });
    }, 2000);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  // ── Format helpers ──
  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (new Date(now - 86400000).toDateString() === d.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getDateLabel = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (new Date(now - 86400000).toDateString() === d.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const formatLastSeen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24 && d.toDateString() === now.toDateString()) return `today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (new Date(now - 86400000).toDateString() === d.toDateString()) return `yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const activeData = conversations.find(c => c._id === activeConvo);
  const isGroupConvo = activeData?.type === 'group';
  const otherUser = activeData?.other_members?.[0];
  // Get full user data (including last_seen) from users list
  const otherUserFull = users.find(u => u._id === otherUser?._id);
  const filteredUsers = users.filter(u => u._id !== user?._id && (!search || u.name?.toLowerCase().includes(search.toLowerCase())));
  const filteredConversations = conversations.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = (c.display_name || c.name || c.other_members?.[0]?.name || '').toLowerCase();
    const lastMsg = (c.last_message?.text || '').toLowerCase();
    return name.includes(s) || lastMsg.includes(s);
  });
  const filteredGroups = groups.filter(g => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (g.name || '').toLowerCase().includes(s) || (g.description || '').toLowerCase().includes(s);
  });

  let lastDateShown = '';

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl overflow-hidden border bg-card shadow-sm">
      {/* ── Left Panel ── */}
      <div className={`w-full md:w-[340px] lg:w-[360px] border-r flex flex-col shrink-0 bg-background ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Messages</h2>
            {wsConnected ? <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 gap-1 px-2 py-0.5"><Wifi className="w-2.5 h-2.5" />Live</Badge> : <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200 gap-1 px-2 py-0.5"><WifiOff className="w-2.5 h-2.5" />Offline</Badge>}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input placeholder="Search conversations, groups, users..." className="pl-10 h-9 text-sm bg-muted/40 border-0 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-muted-foreground/40" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Tabs + Content */}
        <Tabs defaultValue="inbox" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 pb-2">
            <TabsList className="grid grid-cols-3 h-9 bg-muted/50 p-0.5 rounded-lg">
              <TabsTrigger value="inbox" className="text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Inbox</TabsTrigger>
              <TabsTrigger value="groups" className="text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Groups</TabsTrigger>
              <TabsTrigger value="users" className="text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Users</TabsTrigger>
            </TabsList>
          </div>

          {/* Inbox */}
          <TabsContent value="inbox" className="flex-1 overflow-y-auto px-2 min-h-0">
            {filteredConversations.length === 0 && !search ? (
              <div className="text-center py-16 px-4">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/15" />
                <p className="text-xs text-muted-foreground">Start a conversation from the Users tab</p>
              </div>
            ) : (
              <>
                {filteredConversations.map(c => {
              const other = c.other_members?.[0];
              const isGroup = c.type === 'group';
              const displayName = c.display_name || (isGroup ? c.name : other?.name) || 'Unknown';
              const avatar = displayName?.[0]?.toUpperCase() || '?';
              const active = c._id === activeConvo;
              const hasUnread = c.unread_count > 0;
              return (
                <button key={c._id} onClick={() => openConversation(c._id)} className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 mb-1 ${active ? 'bg-primary/8 ring-1 ring-primary/15' : 'hover:bg-muted/60'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${isGroup ? 'bg-violet-500/10 text-violet-600' : 'bg-primary/10 text-primary'}`}>{isGroup ? <Users className="w-4 h-4" /> : avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>{displayName}</p>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">{formatTime(c.last_message?.created_at)}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${hasUnread ? 'text-foreground/70 font-medium' : 'text-muted-foreground/60'}`}>{
                        (() => {
                          let txt = c.last_message?.text || 'No messages';
                          txt = txt.replace(/\*\*/g, '').replace(/📋\s*/g, '📋 ').replace(/_Originally.*_/g, '');
                          return txt.length > 50 ? txt.slice(0, 50) + '...' : txt;
                        })()
                      }</p>
                    </div>
                    {hasUnread && <span className="min-w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">{c.unread_count}</span>}
                  </div>
                </button>
              );
            })}
                {/* Show matching users as DM suggestions when searching */}
                {search && filteredUsers.length > 0 && (
                  <>
                    <div className="px-2 py-2 mt-2 border-t">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Start conversation with:</span>
                    </div>
                    {filteredUsers.map(u => (
                      <button key={`suggest-${u._id}`} onClick={() => startDirectChat(u._id)} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-primary/5 transition-all duration-200 mb-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center text-sm font-semibold text-primary">{u.name?.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <span className="text-[10px] text-muted-foreground">{u.role?.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {filteredConversations.length === 0 && (!search || filteredUsers.length === 0) && (
                  <div className="text-center py-8 px-4">
                    <p className="text-xs text-muted-foreground">{search ? 'No results found' : ''}</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Groups */}
          <TabsContent value="groups" className="flex-1 overflow-y-auto px-2 min-h-0">
            <div className="px-1 mb-2">
              <Button size="sm" className="w-full gap-1.5 h-9 rounded-lg" onClick={() => setShowCreateGroup(true)} data-testid="create-group-btn"><Users className="w-3.5 h-3.5" /> Create Group</Button>
            </div>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/15" />
                <p className="text-xs text-muted-foreground">{search ? 'No groups match your search' : 'No groups yet'}</p>
              </div>
            ) :
              filteredGroups.map(g => (
                <button key={g._id} onClick={() => { if (g.conversation_id) openConversation(g.conversation_id); }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-muted/60 transition-all duration-200 mb-1" data-testid={`group-item-${g._id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center text-sm font-semibold text-violet-600 shrink-0">{g.name?.[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        <span className="text-[9px] text-muted-foreground/50 shrink-0">{g.member_count} members</span>
                      </div>
                      <p className="text-xs text-muted-foreground/50 truncate mt-0.5">{g.last_message?.text || g.description || 'No messages yet'}</p>
                    </div>
                    {g.unread_count > 0 && <span className="min-w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">{g.unread_count}</span>}
                  </div>
                </button>
              ))
            }
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="flex-1 overflow-y-auto px-2 min-h-0">
            {filteredUsers.map(u => (
              <button key={u._id} onClick={() => startDirectChat(u._id)} className="w-full text-left px-3 py-3 rounded-xl hover:bg-muted/60 transition-all duration-200 mb-1">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center text-sm font-semibold text-primary">{u.name?.charAt(0)}</div>
                    {u.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md inline-block mt-0.5 ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>{ROLE_LABELS[u.role] || u.role}</span>
                  </div>
                </div>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Chat Panel (hidden on mobile when no active convo) ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeConvo ? 'hidden md:flex' : 'flex'}`}>
        {!activeConvo ? (
          <div className="flex-1 flex items-center justify-center"><div className="text-center"><MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/15" /><p className="text-sm text-muted-foreground">Select a conversation</p></div></div>
        ) : (
          <>
            {/* Header — with back button on mobile */}
            <div className="h-14 border-b flex items-center px-3 md:px-4 gap-2 md:gap-3 shrink-0">
              <button className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted" onClick={() => { activeConvoRef.current = null; setActiveConvo(null); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity" onClick={async () => {
                if (isGroupConvo && activeData?.group_id) {
                  try { const r = await api.get(`/api/groups/${activeData.group_id}`); setGroupDetail(r.data); setTempGroupName(r.data?.name || ''); setTempGroupDesc(r.data?.description || ''); } catch {}
                }
                setChatSettings(true);
              }} data-testid="chat-settings-toggle">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isGroupConvo ? 'bg-violet-500/10 text-violet-600' : 'bg-primary/10 text-primary'}`}>{isGroupConvo ? (activeData?.display_name?.[0] || 'G') : (otherUser?.name?.charAt(0) || '?')}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{isGroupConvo ? activeData?.name : otherUser?.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {isGroupConvo ? `${activeData?.members?.length || 0} members · Tap for info` :
                    otherUserFull?.is_online ? <span className="text-emerald-600 font-medium">Online · Tap for info</span> :
                    <span>Tap for info</span>}
                  </p>
                </div>
              </button>
              {isGroupConvo ? (
                <>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50" onClick={async () => {
                    // Check if there's already an active call for this group
                    try {
                      const cr = await api.get(`/api/call/room/active-for-group/${activeData?.group_id}`);
                      if (cr.data?.active) { await window.__groupCall?.joinRoom(cr.data.room_id, 'voice'); }
                      else { await window.__groupCall?.createRoom('voice', activeData?.group_id); }
                    } catch { await window.__groupCall?.createRoom('voice', activeData?.group_id); }
                  }} title="Group Voice Call" data-testid="group-voice-call"><Phone className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-blue-600 hover:bg-blue-50" onClick={async () => {
                    try {
                      const cr = await api.get(`/api/call/room/active-for-group/${activeData?.group_id}`);
                      if (cr.data?.active) { await window.__groupCall?.joinRoom(cr.data.room_id, 'video'); }
                      else { await window.__groupCall?.createRoom('video', activeData?.group_id); }
                    } catch { await window.__groupCall?.createRoom('video', activeData?.group_id); }
                  }} title="Group Video Call" data-testid="group-video-call"><Video className="w-4 h-4" /></Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50" onClick={() => window.__voiceCall?.startCall(otherUser?._id, otherUser?.name)} title="Voice Call"><Phone className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-blue-600 hover:bg-blue-50" onClick={() => window.__videoCall?.startVideoCall(otherUser?._id, otherUser?.name)} title="Video Call"><Video className="w-4 h-4" /></Button>
                </>
              )}
            </div>

            {/* Ongoing Group Call Banner */}
            {ongoingCall && (
              <div className="mx-2 sm:mx-5 mt-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-2 sm:gap-3 shrink-0" data-testid="ongoing-call-banner">
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  {ongoingCall.call_type === 'video' ? <Video className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" /> : <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />}
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-emerald-600 truncate">{ongoingCall.call_type === 'video' ? 'Video' : 'Voice'} call active</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">{ongoingCall.participant_count} in call</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 sm:gap-1.5 shrink-0 h-8 sm:h-9 text-xs" onClick={async () => {
                  // Reset stale busy flag
                  if (window.__callBusy && !window.__groupCall?.getActiveRoomId?.()) { window.__callBusy = false; }
                  if (window.__groupCall?.joinRoom) {
                    await window.__groupCall.joinRoom(ongoingCall.room_id, ongoingCall.call_type);
                  }
                }} data-testid="join-ongoing-call">
                  <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Join
                </Button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-5">
              {loadingMsgs ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : (
                <div className="flex flex-col gap-3.5">
                  {messages.map((m, idx) => {
                    const mine = m.sender_id === user?._id;
                    const isSystem = m.is_system || m.sender_id === 'system';
                    const dateLabel = getDateLabel(m.created_at);
                    const showDate = dateLabel !== lastDateShown;
                    if (showDate) lastDateShown = dateLabel;
                    return (
                      <React.Fragment key={m._id}>
                        {showDate && <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-border" /><span className="text-[10px] text-muted-foreground bg-card px-3 py-0.5 rounded-full border">{dateLabel}</span><div className="flex-1 h-px bg-border" /></div>}
                        {isSystem ? (
                          <div className="text-center py-1">
                            <span className={`text-[10px] px-3 py-0.5 rounded-full ${m.call_event === 'missed' || m.call_event === 'cancelled' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : m.call_event === 'started' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : m.call_event === 'ended' ? 'bg-muted text-muted-foreground border border-border' : 'bg-muted text-muted-foreground'}`}>{m.text}</span>
                            {m.created_at && <p className="text-[9px] text-muted-foreground/50 mt-0.5">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                          </div>
                        ) : (
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-0.5`}>
                          <div className="max-w-[85%] md:max-w-[70%]">
                            <div className={`px-3 md:px-4 py-2.5 md:py-3 shadow-sm ${mine ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm' : 'bg-muted rounded-2xl rounded-bl-sm'}`}>
                            {!mine && <p className="text-[10px] font-bold mb-1 opacity-60">{m.sender_name}</p>}
                            {/* Attachments */}
                            {m.attachments?.length > 0 && m.attachments.map((att, ai) => (
                              <div key={ai} className="mb-2">
                                {att.is_image ? (
                                  <a href={`${process.env.REACT_APP_BACKEND_URL}${att.file_url}`} target="_blank" rel="noreferrer">
                                    <img src={`${process.env.REACT_APP_BACKEND_URL}${att.file_url}`} alt={att.file_name} className="max-w-full rounded-lg max-h-60 object-cover" />
                                  </a>
                                ) : (
                                  <a href={`${process.env.REACT_APP_BACKEND_URL}${att.file_url}`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-2 rounded-lg border ${mine ? 'border-primary-foreground/20 hover:bg-primary-foreground/10' : 'border-border hover:bg-background/50'}`}>
                                    <FileText className="w-5 h-5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">{att.file_name}</p>
                                      <p className="text-[10px] opacity-60">{(att.file_size / 1024).toFixed(0)} KB</p>
                                    </div>
                                    <Download className="w-4 h-4 shrink-0 opacity-60" />
                                  </a>
                                )}
                              </div>
                            ))}
                            {/* Text (skip if only auto-caption for attachment) */}
                            {m.text && !(m.attachments?.length > 0 && (m.text.startsWith('Sent an image') || m.text.startsWith('Sent a file'))) && (
                              m.type === 'forwarded_notification' ? (
                                /* ── Forwarded Notification — rich card UI ── */
                                <div className="space-y-2">
                                  <div className={`rounded-xl p-3 ${mine ? 'bg-primary-foreground/10 border border-primary-foreground/15' : 'bg-background/60 border border-border/60'}`}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${mine ? 'text-primary-foreground/60' : 'text-primary'}`}><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${mine ? 'text-primary-foreground/50' : 'text-primary/70'}`}>Forwarded Notification</span>
                                    </div>
                                    {(() => {
                                      // Parse the formatted text into parts (handles both markdown and plain formats)
                                      const lines = m.text.split('\n').filter(l => l.trim());
                                      // Subject: second line (first is "📋 Forwarded Notification")
                                      const subject = (lines[1] || '').replace(/\*\*/g, '');
                                      const bodyLines = lines.slice(2).filter(l => !l.startsWith('Originally') && !l.startsWith('_Originally') && !l.startsWith('💬'));
                                      const originalTo = lines.find(l => l.startsWith('Originally') || l.startsWith('_Originally'));
                                      const userMsg = lines.find(l => l.startsWith('💬'));
                                      return (
                                        <>
                                          {subject && <p className={`text-xs font-semibold ${mine ? '' : 'text-foreground'}`}>{subject}</p>}
                                          {bodyLines.length > 0 && <p className={`text-[11px] leading-relaxed ${mine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{bodyLines.join(' ').slice(0, 200)}{bodyLines.join(' ').length > 200 ? '...' : ''}</p>}
                                          {originalTo && <p className={`text-[9px] italic ${mine ? 'text-primary-foreground/40' : 'text-muted-foreground/60'}`}>{originalTo.replace(/_/g, '')}</p>}
                                        </>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const userMsg = m.text.split('\n').find(l => l.startsWith('💬'));
                                    return userMsg ? <p className="text-[13px] leading-relaxed">{userMsg.replace('💬 ', '')}</p> : null;
                                  })()}
                                </div>
                              ) : m.forwarded_from === 'xaura' || m.text?.includes('[XAURA]') ? (
                                /* ── XAura Shared Response — rich card UI ── */
                                <div className="space-y-1.5">
                                  <div className={`rounded-xl p-3 ${mine ? 'bg-primary-foreground/10 border border-primary-foreground/15' : 'bg-background/60 border border-border/60'}`}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <svg width="12" height="19" viewBox="0 0 40 68" fill="none"><path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="hsl(var(--foreground))" strokeWidth="6"/><path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/></svg>
                                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${mine ? 'text-primary-foreground/50' : 'text-primary/70'}`}>Shared from Aura</span>
                                    </div>
                                    {(() => {
                                      const lines = m.text.split('\n');
                                      const questionLine = lines.find(l => l.startsWith('💬'));
                                      const responseLine = lines.findIndex(l => l.includes('[XAURA]') || l.includes("Aura's Response"));
                                      const responseText = responseLine >= 0 ? lines.slice(responseLine + 1).join('\n').trim() : lines.filter(l => !l.startsWith('💬') && !l.includes('[XAURA]')).join('\n').trim();
                                      return (
                                        <>
                                          {questionLine && <p className={`text-[11px] italic mb-1.5 ${mine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{questionLine.replace('💬 Question: ', '').replace('💬 ', '')}</p>}
                                          <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${mine ? '' : 'text-foreground'}`}>{responseText.slice(0, 500)}{responseText.length > 500 ? '...' : ''}</p>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
                              )
                            )}
                            </div>
                            {/* Timestamp + tick — fixed height, outside bubble, no layout shift */}
                            <div className={`flex items-center gap-1 h-4 mt-0.5 px-0.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[9px] text-muted-foreground/50 leading-none">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {mine && <span className="w-4 inline-flex justify-center"><MessageStatus status={m.status} /></span>}
                            </div>
                          </div>
                        </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Typing indicator */}
                  {typingUser && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="bg-muted rounded-2xl rounded-bl-lg px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-bold mb-1.5 text-muted-foreground/60">{typingUser}</p>
                        <div className="flex gap-1.5 items-center h-4">
                          <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                          <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0.15s', animationDuration: '0.6s' }} />
                          <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.6s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t shrink-0">
              {/* File preview bar */}
              {previewFile && (
                <div className="px-3 pt-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-2 flex-1">
                    {previewFile.isImage ? (
                      <img src={previewFile.preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{previewFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(previewFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelFile}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              )}
              <div className="p-3 flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" className="hidden" onChange={handleFileSelect} />
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground hover:text-primary" onClick={() => fileInputRef.current?.click()} title="Attach file">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Input ref={inputRef} value={inputText} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={previewFile ? "Add a caption..." : "Type a message..."} className="flex-1 h-11 text-[16px] sm:text-sm" />
                <Button onClick={previewFile ? sendFile : sendMessage} disabled={previewFile ? uploading : !inputText.trim()} className="h-11 w-11 p-0">
                  {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ Chat Settings Panel ═══ */}
      {chatSettings && (() => {
        const gd = groupDetail;
        const myMembership = gd?.members?.find(m => m.user_id === user?._id);
        const isAdmin = myMembership?.role === 'admin';
        const isCreator = gd?.created_by === user?._id;

        const saveGroupInfo = async () => {
          try {
            await api.put(`/api/groups/${gd?._id}`, { name: tempGroupName, description: tempGroupDesc });
            toast.success('Group updated'); setEditGroupName(false); setEditGroupDesc(false);
            const r = await api.get(`/api/groups/${gd._id}`); setGroupDetail(r.data);
            loadGroups(); refreshConversations();
          } catch { toast.error('Failed to update'); }
        };

        const toggleAdmin = async (memberId, currentRole) => {
          try {
            await api.put(`/api/groups/${gd?._id}/members/${memberId}/role`, { role: currentRole === 'admin' ? 'member' : 'admin' });
            const r = await api.get(`/api/groups/${gd._id}`); setGroupDetail(r.data);
            toast.success(currentRole === 'admin' ? 'Removed as admin' : 'Made admin');
          } catch { toast.error('Failed'); }
        };

        const removeMember = async (memberId) => {
          try {
            await api.delete(`/api/groups/${gd?._id}/members/${memberId}`);
            const r = await api.get(`/api/groups/${gd._id}`); setGroupDetail(r.data);
            loadGroups(); toast.success('Member removed');
          } catch { toast.error('Failed'); }
        };

        const deleteGroup = async () => {
          if (!window.confirm(`Delete "${gd?.name}"? This removes the group and all history for everyone.`)) return;
          try {
            await api.delete(`/api/groups/${gd?._id}`);
            toast.success('Group deleted'); setChatSettings(false); setActiveConvo(null);
            loadGroups(); refreshConversations();
          } catch { toast.error('Failed to delete'); }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="chat-settings-panel">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setChatSettings(false)} />
            <div className="relative bg-card border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-3 shrink-0">
                <h2 className="text-sm font-semibold flex-1">{isGroupConvo ? 'Group Info' : 'Contact Info'}</h2>
                <button onClick={() => setChatSettings(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Profile header */}
                <div className="px-6 py-6 text-center border-b">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl font-bold ${isGroupConvo ? 'bg-violet-500/10 text-violet-600' : 'bg-primary/10 text-primary'}`}>
                    {isGroupConvo ? (gd?.name?.[0]?.toUpperCase() || 'G') : (otherUser?.name?.[0]?.toUpperCase() || '?')}
                  </div>
                  {/* Editable name */}
                  {isGroupConvo && isAdmin && editGroupName ? (
                    <div className="flex items-center gap-2 justify-center mt-2">
                      <Input value={tempGroupName} onChange={e => setTempGroupName(e.target.value)} className="h-9 text-center text-sm font-bold max-w-[220px]" maxLength={100} autoFocus onKeyDown={e => { if (e.key === 'Enter') saveGroupInfo(); }} />
                      <Button size="sm" className="h-9" onClick={saveGroupInfo}>Save</Button>
                      <Button size="sm" variant="outline" className="h-9" onClick={() => setEditGroupName(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <h3 className="text-base font-bold">{isGroupConvo ? gd?.name : otherUser?.name}</h3>
                      {isGroupConvo && isAdmin && (
                        <button onClick={() => { setTempGroupName(gd?.name || ''); setEditGroupName(true); }} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit name" data-testid="edit-group-name">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                  {/* Editable description */}
                  {isGroupConvo && isAdmin && editGroupDesc ? (
                    <div className="mt-3 space-y-2 px-4">
                      <textarea value={tempGroupDesc} onChange={e => setTempGroupDesc(e.target.value)} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} maxLength={500} autoFocus />
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" className="h-8" onClick={saveGroupInfo}>Save</Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setEditGroupDesc(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : isGroupConvo ? (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <p className="text-xs text-muted-foreground">{gd?.description || 'No description'}</p>
                      {isAdmin && (
                        <button onClick={() => { setTempGroupDesc(gd?.description || ''); setEditGroupDesc(true); }} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit description" data-testid="edit-group-desc">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">{otherUserFull?.is_online ? <span className="text-emerald-500">Online</span> : otherUser?.role?.replace(/_/g, ' ')}</p>
                  )}
                </div>

                {/* Group Call buttons */}
                {isGroupConvo && (
                  <div className="px-4 py-3 border-b flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={async () => {
                      try {
                        const cr = await api.get(`/api/call/room/active-for-group/${gd?._id}`);
                        if (cr.data?.active) { await window.__groupCall?.joinRoom(cr.data.room_id, 'voice'); }
                        else { await window.__groupCall?.createRoom('voice', gd?._id); }
                      } catch { await window.__groupCall?.createRoom('voice', gd?._id); }
                      setChatSettings(false);
                    }} data-testid="group-voice-call-settings"><Phone className="w-3.5 h-3.5 text-emerald-500" /> Voice Call</Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={async () => {
                      try {
                        const cr = await api.get(`/api/call/room/active-for-group/${gd?._id}`);
                        if (cr.data?.active) { await window.__groupCall?.joinRoom(cr.data.room_id, 'video'); }
                        else { await window.__groupCall?.createRoom('video', gd?._id); }
                      } catch { await window.__groupCall?.createRoom('video', gd?._id); }
                      setChatSettings(false);
                    }} data-testid="group-video-call-settings"><Video className="w-3.5 h-3.5 text-blue-500" /> Video Call</Button>
                  </div>
                )}

                {/* Members list */}
                {isGroupConvo && gd && (
                  <div className="px-4 py-4 border-b">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">{gd.members?.length || 0} Members</p>
                    <div className="space-y-1">
                      {(gd.members || []).map(m => {
                        const mIsAdmin = m.role === 'admin';
                        const isMe = m.user_id === user?._id;
                        return (
                          <div key={m.user_id} className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted/30">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${mIsAdmin ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{m.name?.[0]?.toUpperCase() || '?'}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{m.name || m.email}{isMe ? ' (You)' : ''}</p>
                              <p className="text-[9px] text-muted-foreground">{m.email}</p>
                            </div>
                            {mIsAdmin && <Badge className="text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Admin</Badge>}
                            {/* Admin actions on other members */}
                            {isAdmin && !isMe && (
                              <div className="flex items-center gap-1">
                                {isCreator && <button onClick={() => toggleAdmin(m.user_id, m.role)} className="p-1 rounded hover:bg-muted" title={mIsAdmin ? 'Remove admin' : 'Make admin'}><Shield className={`w-3.5 h-3.5 ${mIsAdmin ? 'text-emerald-500' : 'text-muted-foreground'}`} /></button>}
                                <button onClick={() => removeMember(m.user_id)} className="p-1 rounded hover:bg-destructive/10" title="Remove"><UserMinus className="w-3.5 h-3.5 text-destructive" /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DM details */}
                {!isGroupConvo && otherUser && (
                  <div className="px-4 py-4 border-b">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">Details</p>
                    <div className="space-y-3">
                      <div><p className="text-[10px] text-muted-foreground">Email</p><p className="text-xs">{otherUser?.email || '-'}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Role</p><p className="text-xs capitalize">{otherUser?.role?.replace(/_/g, ' ') || '-'}</p></div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 py-4 space-y-2">
                  {isGroupConvo && (
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={async () => {
                      try { await api.post(`/api/groups/${gd?._id}/leave`); toast.info('You left the group'); setChatSettings(false); setActiveConvo(null); loadGroups(); refreshConversations(); } catch { toast.error('Failed'); }
                    }} data-testid="leave-group-btn"><LogOut className="w-3.5 h-3.5" /> Leave Group</Button>
                  )}
                  {isGroupConvo && isCreator && (
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/5" onClick={deleteGroup} data-testid="delete-group-btn"><X className="w-3.5 h-3.5" /> Delete Group</Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ═══ Create Group Wizard ═══ */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-testid="create-group-wizard">
          <div className="bg-card border rounded-3xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk' }}>Create Group</h2>
                <button onClick={() => { setShowCreateGroup(false); setGroupStep(1); setNewGroupName(''); setNewGroupDesc(''); setNewGroupMembers([]); setMemberSearch(''); }} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${groupStep >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{s}</div>
                    <span className={`text-[10px] font-medium ${groupStep >= s ? 'text-foreground' : 'text-muted-foreground'}`}>{s === 1 ? 'Info' : s === 2 ? 'Members' : 'Review'}</span>
                    {s < 3 && <div className={`flex-1 h-0.5 rounded ${groupStep > s ? 'bg-primary' : 'bg-muted'}`} />}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {groupStep === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center shrink-0 border-2 border-dashed border-violet-300">
                      {newGroupName ? <span className="text-2xl font-bold text-violet-500">{newGroupName[0]?.toUpperCase()}</span> : <Users className="w-6 h-6 text-violet-400" />}
                    </div>
                    <div className="flex-1"><label className="text-xs font-semibold text-muted-foreground">Group Name *</label><Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g., QC Team, Marketing" className="mt-1 h-10" maxLength={100} data-testid="group-name-input" autoFocus /></div>
                  </div>
                  <div><label className="text-xs font-semibold text-muted-foreground">Description</label><textarea value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="What is this group about?" className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} maxLength={500} data-testid="group-desc-input" /><p className="text-[9px] text-muted-foreground mt-1">{newGroupDesc.length}/500</p></div>
                </div>
              )}
              {groupStep === 2 && (
                <div className="space-y-4">
                  {newGroupMembers.length > 0 && <div className="flex flex-wrap gap-1.5 pb-3 border-b">{users.filter(u => newGroupMembers.includes(u._id)).map(u => (<Badge key={u._id} className="text-[10px] gap-1 bg-violet-500/10 text-violet-600 border-violet-500/20 pr-1"><span className="w-4 h-4 rounded-full bg-violet-500/20 flex items-center justify-center text-[8px] font-bold">{u.name?.[0]?.toUpperCase()}</span>{u.name}<button onClick={() => setNewGroupMembers(prev => prev.filter(x => x !== u._id))} className="ml-0.5 hover:text-destructive">×</button></Badge>))}</div>}
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search users..." className="pl-9 h-10" data-testid="member-search" /></div>
                  <div className="max-h-[35vh] overflow-y-auto rounded-xl border">
                    {users.filter(u => u._id !== user?._id && u.name?.toLowerCase().includes(memberSearch.toLowerCase())).map(u => {
                      const sel = newGroupMembers.includes(u._id);
                      return (<button key={u._id} onClick={() => setNewGroupMembers(prev => sel ? prev.filter(x => x !== u._id) : [...prev, u._id])} data-testid={`select-user-${u._id}`} className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b last:border-0 transition-colors ${sel ? 'bg-violet-500/5' : 'hover:bg-muted/50'}`}><div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${u.is_online ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{u.name?.[0]?.toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium">{u.name}</p><p className="text-[10px] text-muted-foreground">{u.is_online ? <span className="text-emerald-500">Online</span> : u.role?.replace(/_/g, ' ')}</p></div><div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${sel ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>{sel && <Check className="w-3 h-3 text-primary-foreground" />}</div></button>);
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{newGroupMembers.length} member(s) selected</p>
                </div>
              )}
              {groupStep === 3 && (
                <div className="space-y-5">
                  <div className="text-center"><div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3"><span className="text-3xl font-bold text-violet-500">{newGroupName?.[0]?.toUpperCase()}</span></div><h3 className="text-lg font-bold">{newGroupName}</h3>{newGroupDesc && <p className="text-xs text-muted-foreground mt-1">{newGroupDesc}</p>}</div>
                  <div className="bg-muted/30 rounded-xl p-4"><p className="text-xs font-semibold text-muted-foreground mb-2">{newGroupMembers.length + 1} Members (including you)</p><div className="space-y-2"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{user?.name?.[0]?.toUpperCase()}</div><span className="text-xs font-medium">{user?.name} (You)</span><Badge className="text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 ml-auto">Admin</Badge></div>{users.filter(u => newGroupMembers.includes(u._id)).map(u => (<div key={u._id} className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{u.name?.[0]?.toUpperCase()}</div><span className="text-xs">{u.name}</span><Badge variant="outline" className="text-[8px] ml-auto">Member</Badge></div>))}</div></div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex items-center gap-3">
              {groupStep > 1 && <Button variant="outline" onClick={() => setGroupStep(s => s - 1)} className="flex-1" data-testid="group-back-btn">Back</Button>}
              {groupStep === 1 && <Button variant="outline" onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setNewGroupDesc(''); setNewGroupMembers([]); setGroupStep(1); setMemberSearch(''); }} className="flex-1">Cancel</Button>}
              {groupStep < 3 ? (
                <Button onClick={() => setGroupStep(s => s + 1)} disabled={groupStep === 1 ? !newGroupName.trim() : newGroupMembers.length === 0} className="flex-1 gap-1.5" data-testid="group-next-btn">Next <ChevronRight className="w-4 h-4" /></Button>
              ) : (
                <Button onClick={async () => { try { const res = await api.post('/api/groups', { name: newGroupName.trim(), description: newGroupDesc, member_ids: newGroupMembers }); toast.success(`Group "${newGroupName}" created!`); setShowCreateGroup(false); setNewGroupName(''); setNewGroupDesc(''); setNewGroupMembers([]); setGroupStep(1); setMemberSearch(''); loadGroups(); refreshConversations(); if (res.data?.conversation_id) openConversation(res.data.conversation_id); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } }} className="flex-1 gap-1.5 bg-violet-600 hover:bg-violet-700" data-testid="group-create-btn"><Users className="w-4 h-4" /> Create Group</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
