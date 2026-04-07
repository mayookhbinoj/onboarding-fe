import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Lightbulb, Bug, Wrench, Sparkles, Send, MessageSquare, Clock, RefreshCw, User, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const TAG_META = {
  suggestion: { icon: Lightbulb, color: '#3b82f6' },
  bug: { icon: Bug, color: '#ef4444' },
  fix_required: { icon: Wrench, color: '#f59e0b' },
  new_idea: { icon: Sparkles, color: '#8b5cf6' },
};

const tagBadge = (tag) => {
  const meta = TAG_META[tag] || {};
  const color = meta.color || '#6b7280';
  return <Badge style={{ background: `${color}10`, color, border: `1px solid ${color}30` }} className="text-[10px] gap-1">{tag?.replace(/_/g, ' ')}</Badge>;
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

export default function UserComments() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/improvements'); setItems(r.data || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    if (filter !== 'all' && i.tag !== filter && i.status !== filter) return false;
    if (search && !i.content?.toLowerCase().includes(search.toLowerCase()) && !i.user_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sendReply = async () => {
    if (!replyText.trim() || !detail) return;
    try {
      await api.post(`/api/improvements/${detail._id}/reply`, { content: replyText.trim() });
      setReplyText('');
      const r = await api.get(`/api/improvements/${detail._id}`);
      setDetail(r.data);
      load();
      toast.success('Reply sent');
    } catch { toast.error('Failed'); }
  };

  const updateStatus = async (id, status) => {
    try { await api.put(`/api/improvements/${id}/status`, { status }); load(); toast.success(`Marked as ${status}`); } catch {}
  };

  const tagCounts = {};
  items.forEach(i => { tagCounts[i.tag] = (tagCounts[i.tag] || 0) + 1; });
  const openCount = items.filter(i => i.status === 'open').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="user-comments-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Comments</h1>
        <p className="text-sm text-muted-foreground mt-1">{items.length} submissions, {openCount} open</p>
      </div>

      {/* Tag summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(tagCounts).map(([tag, count]) => (
          <button key={tag} onClick={() => setFilter(filter === tag ? 'all' : tag)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${filter === tag ? 'ring-2 ring-offset-1 opacity-100' : 'opacity-60 hover:opacity-90'}`}
            style={{ background: `${(TAG_META[tag]?.color || '#6b7280')}10`, color: TAG_META[tag]?.color || '#6b7280' }}>
            {tag?.replace(/_/g, ' ')} <span className="font-bold">{count}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search comments..." className="flex-1 max-w-xs h-9" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="suggestion">Suggestions</SelectItem>
            <SelectItem value="bug">Bugs</SelectItem>
            <SelectItem value="fix_required">Fix Required</SelectItem>
            <SelectItem value="new_idea">New Ideas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> :
       filtered.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No submissions found</CardContent></Card> :
       <div className="space-y-3">
         {filtered.map((item, idx) => (
           <Card key={item._id} className={`hover:shadow-md transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 ${item.status === 'resolved' ? 'opacity-60' : ''}`} style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }} onClick={() => { setDetail(item); setReplyText(''); }}>
             <CardContent className="p-5">
               <div className="flex items-start gap-3">
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 flex-wrap mb-1.5">
                     {tagBadge(item.tag)}
                     <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><User className="w-3 h-3" /> {item.user_name}</div>
                     <Badge variant="outline" className="text-[9px] capitalize">{item.user_role?.replace(/_/g, ' ')}</Badge>
                     <span className="text-[10px] text-muted-foreground ml-auto">{fmtDate(item.created_at)}</span>
                   </div>
                   <p className="text-sm line-clamp-2">{item.content}</p>
                   <div className="flex items-center gap-3 mt-2">
                     {item.images?.length > 0 && <span className="text-[10px] text-muted-foreground">{item.images.length} image(s)</span>}
                     {item.thread?.length > 0 && <Badge variant="outline" className="text-[9px] gap-1"><MessageSquare className="w-3 h-3" /> {item.thread.length} replies</Badge>}
                     {item.status === 'resolved' && <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle className="w-3 h-3" /> Resolved</Badge>}
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>
         ))}
       </div>
      }

      {/* Detail + Thread Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm flex-wrap">{tagBadge(detail.tag)} <User className="w-3 h-3 text-muted-foreground" /> <span className="font-normal text-muted-foreground">{detail.user_name} ({detail.user_role?.replace(/_/g,' ')})</span></DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm leading-relaxed">{detail.content}</p>
                {detail.images?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {detail.images.map((img, i) => (
                      <img key={i} src={`${BACKEND}${img.file_url}`} alt="" className="w-28 h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80" onClick={() => window.open(`${BACKEND}${img.file_url}`, '_blank')} />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(detail.created_at)}</p>
                  <div className="flex-1" />
                  <Select value={detail.status || 'open'} onValueChange={v => { updateStatus(detail._id, v); setDetail({ ...detail, status: v }); }}>
                    <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="wont_fix">Won't Fix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {detail.thread?.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Thread</p>
                    {detail.thread.map((r, i) => (
                      <div key={i} className={`p-3 rounded-lg text-xs ${r.user_role === 'super_admin' ? 'bg-primary/5 border border-primary/10' : 'bg-muted/50'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{r.user_name}</span>
                          {r.user_role === 'super_admin' && <Badge className="text-[8px] bg-primary/10 text-primary border-primary/20">Admin</Badge>}
                          <span className="text-[9px] text-muted-foreground ml-auto">{fmtDate(r.created_at)}</span>
                        </div>
                        <p className="leading-relaxed">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex gap-2">
                    <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply to this feedback..." className="flex-1" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                    <Button size="icon" onClick={sendReply} disabled={!replyText.trim()}><Send className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
