import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle, Check, GitMerge, Link2, Unlink, Replace, RefreshCw, ArrowRight } from 'lucide-react';

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export default function DuplicateReview() {
  const { api } = useAuth();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [compare, setCompare] = useState(null); // { flag, form_a, form_b }
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get(`/api/duplicates?status=${filter}`); setFlags(res.data || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const openCompare = async (flag) => {
    try {
      const res = await api.get(`/api/duplicates/${flag._id}/compare`);
      setCompare({ flag, form_a: res.data.form_a || {}, form_b: res.data.form_b || {} });
    } catch { toast.error('Failed to load comparison'); }
  };

  const resolve = async (flagId, action) => {
    setActing(true);
    try {
      await api.post(`/api/duplicates/${flagId}/resolve`, { action });
      toast.success(`Resolved: ${action.replace('_', ' ')}`);
      setCompare(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setActing(false);
  };

  const ACTIONS = [
    { key: 'merge', label: 'Merge', desc: 'Combine both records, filling gaps', icon: GitMerge, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
    { key: 'void_old_keep_new', label: 'Void Old & Keep New', desc: 'Void the older record\'s agreement and keep the new submission', icon: Replace, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    { key: 'overwrite', label: 'Overwrite Old', desc: 'Replace older record with newer data', icon: RefreshCw, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
    { key: 'keep_separate', label: 'Keep Separate', desc: 'Dismiss — treat as independent records', icon: Unlink, color: 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100' },
    { key: 'sync', label: 'Sync & Link', desc: 'Link records for future synced updates', icon: Link2, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
  ];

  // Collect all unique keys from both forms for comparison
  const getCompareKeys = () => {
    if (!compare) return [];
    const allKeys = new Set([...Object.keys(compare.form_a), ...Object.keys(compare.form_b)]);
    return [...allKeys].filter(k => k !== '_id' && k !== 'consent').sort();
  };

  return (
    <div className="space-y-5" data-testid="duplicate-review-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Duplicate Review</h1>
        <p className="text-sm text-muted-foreground mt-1">Review matching submissions detected across invite forms</p>
      </div>

      <div className="flex gap-1.5">
        {['pending', 'resolved', 'all'].map(s => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" className="h-8 text-xs capitalize" onClick={() => setFilter(s)}>{s}</Button>
        ))}
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 w-8 p-0 ml-2"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : flags.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center"><AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/20 mb-3" /><p className="text-sm text-muted-foreground">No duplicates found</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {flags.map(f => (
            <Card key={f._id} className={`hover:shadow-sm transition-shadow ${f.status === 'resolved' ? 'opacity-60' : ''}`} data-testid={`dup-${f._id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Record A */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{f.record_a.name || f.record_a.company || 'Record A'}</p>
                    <p className="text-[10px] text-muted-foreground">{f.record_a.email} {f.record_a.phone ? `| ${f.record_a.phone}` : ''}</p>
                    <Badge variant="secondary" className="text-[9px] mt-1">{f.record_a.status || 'N/A'}</Badge>
                  </div>

                  {/* Match indicator */}
                  <div className="text-center shrink-0">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                    <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-300 mt-1">{f.match_field}</Badge>
                  </div>

                  {/* Record B */}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold">{f.record_b.name || f.record_b.company || 'Record B'}</p>
                    <p className="text-[10px] text-muted-foreground">{f.record_b.email} {f.record_b.phone ? `| ${f.record_b.phone}` : ''}</p>
                    <Badge variant="secondary" className="text-[9px] mt-1">{f.record_b.status || 'N/A'}</Badge>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 ml-2">
                    {f.status === 'pending' ? (
                      <Button size="sm" onClick={() => openCompare(f)} className="gap-1.5 text-xs"><ArrowRight className="w-3.5 h-3.5" /> Review</Button>
                    ) : (
                      <Badge variant="outline" className="text-[9px]"><Check className="w-3 h-3 mr-1" /> {f.resolution?.replace('_', ' ')}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground mt-2">{fmtDate(f.created_at)}{f.resolved_by ? ` | Resolved by ${f.resolved_by}` : ''}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Side-by-side comparison dialog */}
      <Dialog open={!!compare} onOpenChange={() => setCompare(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {compare && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Duplicate Comparison — matched by {compare.flag.match_field}</DialogTitle>
              </DialogHeader>

              {/* Comparison table */}
              <div className="border rounded-xl overflow-hidden mt-3">
                <div className="grid grid-cols-3 bg-muted/50 text-xs font-semibold border-b">
                  <div className="p-2.5">Field</div>
                  <div className="p-2.5 border-l">Record A</div>
                  <div className="p-2.5 border-l">Record B</div>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {getCompareKeys().map(key => {
                    const va = compare.form_a[key] || '';
                    const vb = compare.form_b[key] || '';
                    const isDiff = String(va).toLowerCase() !== String(vb).toLowerCase() && va && vb;
                    const isMatch = va && vb && String(va).toLowerCase() === String(vb).toLowerCase();
                    return (
                      <div key={key} className={`grid grid-cols-3 text-xs border-b last:border-0 ${isDiff ? 'bg-amber-50/50' : isMatch && (key === 'email' || key === 'phone') ? 'bg-red-50/50' : ''}`}>
                        <div className="p-2 font-medium text-muted-foreground">{key.replace(/_/g, ' ')}</div>
                        <div className="p-2 border-l break-all">{String(va) || <span className="text-muted-foreground/40">empty</span>}</div>
                        <div className="p-2 border-l break-all">{String(vb) || <span className="text-muted-foreground/40">empty</span>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {ACTIONS.map(a => (
                  <button key={a.key} onClick={() => resolve(compare.flag._id, a.key)} disabled={acting} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${a.color}`}>
                    <a.icon className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="text-[10px] opacity-70">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <DialogFooter><Button variant="outline" size="sm" onClick={() => setCompare(null)}>Cancel</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
