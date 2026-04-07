import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Lightbulb, Bug, Wrench, Sparkles, Tag, Plus, Upload, Send, MessageSquare, Clock, ChevronRight, Image } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TAGS = [
  { id: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: '#3b82f6', bg: 'bg-blue-500/10' },
  { id: 'bug', label: 'Bug Report', icon: Bug, color: '#ef4444', bg: 'bg-rose-500/10' },
  { id: 'fix_required', label: 'Fix Required', icon: Wrench, color: '#f59e0b', bg: 'bg-amber-500/10' },
  { id: 'new_idea', label: 'New Idea', icon: Sparkles, color: '#8b5cf6', bg: 'bg-violet-500/10' },
  { id: 'custom', label: 'Custom', icon: Tag, color: '#6b7280', bg: 'bg-muted' },
];

const getTag = (t) => TAGS.find(x => x.id === t) || TAGS.find(x => x.label.toLowerCase().replace(/\s/g,'_') === t?.toLowerCase()) || { color: '#6b7280', label: t };

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

export default function HelpUsImprove() {
  const { api, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('suggestion');
  const [customTag, setCustomTag] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    try { const r = await api.get('/api/improvements'); setItems(r.data || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!content.trim()) { toast.error('Please enter your feedback'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/api/improvements', { content: content.trim(), tag, custom_tag: tag === 'custom' ? customTag.trim() : null });
      const impId = res.data._id;
      for (const f of files) {
        const fd = new FormData(); fd.append('file', f);
        await api.post(`/api/improvements/${impId}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      toast.success('Feedback submitted! Thank you.');
      setContent(''); setTag('suggestion'); setCustomTag(''); setFiles([]); setShowForm(false);
      load();
    } catch (e) {
      console.error('Submit error:', e);
      toast.error(e.response?.data?.detail || 'Failed to submit');
    }
    setSubmitting(false);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !detail) return;
    try {
      await api.post(`/api/improvements/${detail._id}/reply`, { content: replyText.trim() });
      setReplyText('');
      const r = await api.get(`/api/improvements/${detail._id}`);
      setDetail(r.data);
      load();
    } catch { toast.error('Failed to send reply'); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Help Us Improve</h1>
          <p className="text-sm text-muted-foreground mt-1">Share suggestions, report bugs, or propose new ideas</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="lg" className="gap-2 text-sm shadow-md">
          <Plus className="w-5 h-5" /> New Feedback
        </Button>
      </div>

      {/* Submit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-lg">Share Your Feedback</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-3">
            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {TAGS.map(t => (
                  <button key={t.id} onClick={() => setTag(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-all border-2 ${tag === t.id ? 'border-current shadow-sm scale-[1.02]' : 'border-transparent opacity-50 hover:opacity-80'}`}
                    style={{ color: t.color, background: tag === t.id ? `${t.color}10` : 'transparent' }}>
                    <t.icon className="w-5 h-5" />
                    <span className="text-[10px] leading-tight text-center">{t.label}</span>
                  </button>
                ))}
              </div>
              {tag === 'custom' && <Input value={customTag} onChange={e => setCustomTag(e.target.value)} placeholder="Enter custom tag name..." className="mt-2 h-10" />}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Your Feedback</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Describe your suggestion, bug, or idea in detail..." rows={6} className="text-sm" />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Attach Images</Label>
              <div className="flex items-center gap-3 flex-wrap">
                {files.map((f, i) => (
                  <div key={i} className="relative group">
                    <img src={URL.createObjectURL(f)} alt="" className="w-16 h-12 object-cover rounded-lg border" />
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()} className="w-16 h-12 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                  <Image className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[8px] text-muted-foreground mt-0.5">Add</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) setFiles([...files, ...Array.from(e.target.files)]); e.target.value = ''; }} />
              </div>
            </div>

            <Button onClick={submit} disabled={submitting || !content.trim()} size="lg" className="w-full gap-2 shadow-md">
              <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Lightbulb className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-base font-medium text-muted-foreground">No feedback yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Be the first to share your thoughts!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const t = getTag(item.tag);
            return (
              <Card key={item._id} className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }} onClick={() => { setDetail(item); setReplyText(''); }}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${t.color}12` }}>
                      {t.icon ? <t.icon className="w-5 h-5" style={{ color: t.color }} /> : <Tag className="w-5 h-5" style={{ color: t.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge style={{ background: `${t.color}12`, color: t.color, border: `1px solid ${t.color}25` }} className="text-[11px]">{item.tag?.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">{fmtDate(item.created_at)}</span>
                        {item.thread?.length > 0 && <Badge variant="outline" className="text-[10px] gap-1"><MessageSquare className="w-3 h-3" /> {item.thread.length}</Badge>}
                        {item.status === 'resolved' && <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Resolved</Badge>}
                      </div>
                      <p className="text-sm leading-relaxed line-clamp-2">{item.content}</p>
                      {item.images?.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Image className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{item.images.length} image(s)</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (() => {
            const t = getTag(detail.tag);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Badge style={{ background: `${t.color}12`, color: t.color, border: `1px solid ${t.color}25` }} className="text-xs">{detail.tag?.replace(/_/g, ' ')}</Badge>
                    <span className="text-muted-foreground font-normal text-sm">by {detail.user_name}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-3">
                  <p className="text-sm leading-relaxed">{detail.content}</p>
                  {detail.images?.length > 0 && (
                    <div className="flex gap-3 flex-wrap">
                      {detail.images.map((img, i) => (
                        <img key={i} src={`${BACKEND}${img.file_url}`} alt="" className="w-28 h-20 object-cover rounded-xl border cursor-pointer hover:scale-105 transition-transform shadow-sm" onClick={() => window.open(`${BACKEND}${img.file_url}`, '_blank')} />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {fmtDate(detail.created_at)}</p>

                  {detail.thread?.length > 0 && (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversation</p>
                      {detail.thread.map((r, i) => (
                        <div key={i} className={`p-3.5 rounded-xl text-sm ${r.user_role === 'super_admin' ? 'bg-primary/5 border border-primary/10' : 'bg-muted'}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-semibold text-xs">{r.user_name}</span>
                            {r.user_role === 'super_admin' && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">Admin</Badge>}
                            <span className="text-[10px] text-muted-foreground ml-auto">{fmtDate(r.created_at)}</span>
                          </div>
                          <p className="leading-relaxed text-sm">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <div className="flex gap-2">
                      <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 h-11" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                      <Button size="icon" className="h-11 w-11" onClick={sendReply} disabled={!replyText.trim()}><Send className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
