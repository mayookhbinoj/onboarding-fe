import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Bell, Mail, Clock, Trash2, Forward, CheckSquare, Square, MessageCircle, Send, Search, X, ChevronDown } from 'lucide-react';

export default function NotificationsPage() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [users, setUsers] = useState([]);
  const [forwardDialog, setForwardDialog] = useState(null);
  const [forwardTarget, setForwardTarget] = useState('');
  const [forwardMessage, setForwardMessage] = useState('');
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    loadNotifications();
    api.get('/api/users/all-for-chat').then(r => setUsers(r.data || [])).catch(() => {});
  }, [api]);

  const loadNotifications = () => {
    setLoading(true);
    api.get('/api/notifications?limit=200').then(r => { setNotifications(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(n => n._id)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} notification(s)?`)) return;
    try {
      await api.delete('/api/notifications', { data: { ids: Array.from(selected) } });
      toast.success(`${selected.size} notification(s) deleted`);
      setSelected(new Set());
      loadNotifications();
    } catch { toast.error('Delete failed'); }
  };

  const openForward = (notif) => {
    setForwardDialog(notif);
    setForwardTarget('');
    setForwardMessage('');
  };

  const forwardNotification = async () => {
    if (!forwardTarget || !forwardDialog) return;
    setForwarding(true);
    try {
      const res = await api.post('/api/notifications/forward', {
        notification_id: forwardDialog._id,
        target_user_id: forwardTarget,
        message: forwardMessage,
      });
      toast.success(`Forwarded to ${res.data.target_name}!`);
      setForwardDialog(null);
      // Auto-open the chat conversation where the notification was forwarded
      if (res.data.conversation_id) {
        navigate(`/admin/messages?convo=${res.data.conversation_id}`);
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Forward failed'); }
    setForwarding(false);
  };

  const markRead = async (ids) => {
    try {
      await api.post('/api/notifications/mark-read', { ids });
      setNotifications(prev => prev.map(n => ids.includes(n._id) ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/api/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed'); }
  };

  const filtered = notifications.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (n.subject || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q) || (n.to_email || '').toLowerCase().includes(q);
  });

  const otherUsers = users.filter(u => u._id !== user?._id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Notifications</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{notifications.length} notification(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
            <CheckSquare className="w-3.5 h-3.5" /> Mark All Read
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}>
            {selectMode ? <X className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {selectMode ? 'Cancel' : 'Select'}
          </Button>
          {selectMode && selected.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={deleteSelected}>
              <Trash2 className="w-3.5 h-3.5" /> Delete ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Search + Select All bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notifications..." className="pl-9 h-9" />
        </div>
        {selectMode && (
          <Button variant="ghost" size="sm" onClick={selectAll} className="shrink-0 text-xs">
            {selected.size === filtered.length ? 'Deselect All' : `Select All (${filtered.length})`}
          </Button>
        )}
      </div>

      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>{search ? 'No matching notifications' : 'No notifications yet'}</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {filtered.map((n, idx) => {
            const isSelected = selected.has(n._id);
            const isExpanded = expandedId === n._id;
            return (
              <Card
                key={n._id}
                className={`transition-all duration-300 overflow-hidden ${isSelected ? 'ring-2 ring-primary/30 bg-primary/5' : n.is_read ? 'opacity-70' : 'hover:shadow-md border-l-2 border-l-primary'}`}
                style={{ animation: `notifSlideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 60}ms both` }}
              >
                <CardContent className="p-0">
                  <div className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3 cursor-pointer" onClick={() => { setExpandedId(isExpanded ? null : n._id); if (!n.is_read) markRead([n._id]); }}>
                    {selectMode && (
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(n._id)} className="mt-1 shrink-0" onClick={e => e.stopPropagation()} />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.is_read ? 'bg-muted' : 'bg-primary/10'}`}>
                      <Mail className={`w-4 h-4 ${n.is_read ? 'text-muted-foreground' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm truncate">{n.subject}</p>
                        {n.channel === 'high_priority' && <Badge className="bg-red-100 text-red-700 text-[9px]">High Priority</Badge>}
                        {n.is_demo && <Badge variant="secondary" className="text-[9px]">Demo</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">To: {n.to_email}</p>
                      {!isExpanded && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Forward & Delete always visible */}
                      <button onClick={(e) => { e.stopPropagation(); openForward(n); }} className="w-7 h-7 rounded-lg hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title="Forward">
                        <Forward className="w-3.5 h-3.5" />
                      </button>
                      {!selectMode && (
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Delete this notification?')) {
                            await api.delete('/api/notifications', { data: { ids: [n._id] } });
                            toast.success('Deleted');
                            loadNotifications();
                          }
                        }} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {/* Expandable detail section */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="px-4 pb-4 pt-0 ml-10 sm:ml-11 border-t">
                        <div className="pt-3 space-y-2">
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{n.body}</p>
                          </div>
                          <div className="text-[10px] text-muted-foreground space-y-0.5">
                            <p>Sent: {n.created_at ? new Date(n.created_at).toLocaleString() : 'N/A'}</p>
                            {n.target_role && <p>Target role: {n.target_role}</p>}
                            {n.forwarded_by && <p>Forwarded by: {n.forwarded_by}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <style>{`@keyframes notifSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </div>
      )}

      {/* Forward Dialog */}
      <Dialog open={!!forwardDialog} onOpenChange={o => { if (!o) setForwardDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Forward className="w-5 h-5" /> Forward & Discuss</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {forwardDialog && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{forwardDialog.subject}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{forwardDialog.body}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Forward to</Label>
              <Select value={forwardTarget} onValueChange={setForwardTarget}>
                <SelectTrigger><SelectValue placeholder="Select a team member" /></SelectTrigger>
                <SelectContent>
                  {otherUsers.map(u => (
                    <SelectItem key={u._id} value={u._id}>{u.name} ({u.role?.replace(/_/g, ' ')})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Add a message (optional)</Label>
              <Textarea value={forwardMessage} onChange={e => setForwardMessage(e.target.value)} placeholder="Add context or start a discussion about this notification..." rows={3} />
            </div>
            <p className="text-[10px] text-muted-foreground">This will forward the notification as a chat message. You can continue the conversation in Messages.</p>
          </div>
          <DialogFooter>
            <Button onClick={forwardNotification} disabled={forwarding || !forwardTarget}>
              {forwarding ? 'Forwarding...' : <><Send className="w-3.5 h-3.5 mr-1.5" /> Forward & Open Chat</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
