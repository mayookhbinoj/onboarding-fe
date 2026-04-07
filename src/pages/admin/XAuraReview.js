import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ThumbsUp, ThumbsDown, RefreshCw, MessageSquare } from 'lucide-react';

const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '-';
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

function RenderContent({ text }) {
  if (!text) return null;
  // Parse [IMAGE:url], [GALLERY:url1,url2,...], and clean **bold**
  const clean = text.replace(/\*\*/g, '');
  const parts = clean.split(/(\[IMAGE:[^\]]+\]|\[GALLERY:[^\]]+\])/g);
  return (
    <div className="leading-relaxed whitespace-pre-wrap text-foreground space-y-2">
      {parts.map((part, i) => {
        const imgMatch = part.match(/^\[IMAGE:([^\]]+)\]$/);
        if (imgMatch) {
          const url = imgMatch[1].trim();
          return <img key={i} src={`${BACKEND}${url}`} alt="" className="rounded-lg max-w-xs max-h-48 border shadow-sm mt-1" loading="lazy" />;
        }
        const galMatch = part.match(/^\[GALLERY:([^\]]+)\]$/);
        if (galMatch) {
          const urls = galMatch[1].split(',').map(u => u.trim()).filter(Boolean);
          return (
            <div key={i} className="flex flex-wrap gap-2 mt-1">
              {urls.map((url, j) => <img key={j} src={`${BACKEND}${url}`} alt="" className="rounded-lg w-24 h-24 object-cover border shadow-sm" loading="lazy" />)}
            </div>
          );
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
    </div>
  );
}

export default function XAuraReview() {
  const { api } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?rating=${filter}` : '';
      const r = await api.get(`/api/xaura/reviews${params}`);
      setReviews(r.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const upCount = reviews.filter(r => r.rating === 'up').length;
  const downCount = reviews.filter(r => r.rating === 'down').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="xaura-review-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">XAura Review</h1>
        <p className="text-sm text-muted-foreground mt-1">User feedback on Aura responses — flagged for quality improvement</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-500">{upCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <ThumbsDown className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-sm font-semibold text-rose-500">{downCount}</span>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Feedback</SelectItem>
            <SelectItem value="up">Helpful Only</SelectItem>
            <SelectItem value="down">Not Helpful Only</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 ml-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : reviews.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No feedback yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r, idx) => (
            <Card key={r._id} className={`border-l-4 animate-in fade-in slide-in-from-bottom-2 ${r.rating === 'down' ? 'border-l-rose-500' : 'border-l-emerald-500'}`} style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.rating === 'up' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] gap-1"><ThumbsUp className="w-3 h-3" /> Helpful</Badge>
                  ) : (
                    <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px] gap-1"><ThumbsDown className="w-3 h-3" /> Not Helpful</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">{r.user_email}</span>
                  <Badge variant="outline" className="text-[9px] capitalize">{(r.user_role || '').replace(/_/g, ' ')}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(r.created_at)}</span>
                </div>

                {/* Context messages */}
                {r.context?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Context</p>
                    {r.context.map((m, i) => (
                      <div key={i} className={`text-xs p-2.5 rounded-lg border ${m.role === 'user' ? 'bg-muted ml-8 border-border' : 'bg-primary/5 border-primary/10'}`}>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase">{m.role}</span>
                        <p className="mt-0.5 text-foreground leading-relaxed">{m.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Flagged response */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Flagged Response</p>
                  <div className={`text-xs p-3 rounded-lg border ${r.rating === 'down' ? 'bg-destructive/5 border-destructive/20' : 'bg-primary/5 border-primary/20'}`}>
                    <RenderContent text={r.flagged_content} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
