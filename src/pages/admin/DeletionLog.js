import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Trash2, RotateCcw, Search, RefreshCw, AlertTriangle, CheckCircle, Clock, User, Package, Users, FileText, ChevronDown, ChevronUp, Mail, Phone, Tag, Hash } from 'lucide-react';
import { toast } from 'sonner';

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const TYPE_ICONS = { users: User, device_units: Package, groups: Users, invites: FileText, distributors: User, hospitals: Users, default: Trash2 };
const TYPE_COLORS = { users: '#ef4444', device_units: '#3b82f6', groups: '#8b5cf6', invites: '#f59e0b', distributors: '#6366f1', hospitals: '#0ea5e9' };

const SUMMARY_ICONS = { Email: Mail, Mobile: Phone, Category: Tag, 'Serial No.': Hash, Status: CheckCircle };

export default function DeletionLog() {
  const { api } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [reverting, setReverting] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/deletion-log'); setLogs(r.data || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const revert = async (logId) => {
    setReverting(logId);
    try {
      const r = await api.post(`/api/deletion-log/${logId}/revert`);
      toast.success(r.data.message || 'Reverted successfully');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Revert failed'); }
    setReverting(null);
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.collection !== filter) return false;
    const q = search.toLowerCase();
    if (q && !(l.display_name || '').toLowerCase().includes(q) && !(l.deleted_by_name || '').toLowerCase().includes(q) && !(l.entity_name || '').toLowerCase().includes(q)) return false;
    return true;
  });

  const collections = [...new Set(logs.map(l => l.collection))];

  return (
    <div className="space-y-5 max-w-4xl mx-auto" data-testid="deletion-log-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deletion Log</h1>
        <p className="text-sm text-muted-foreground mt-1">{logs.length} deletions tracked · Revert any accidental deletion</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or user..." className="pl-9 h-9" data-testid="deletion-log-search" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 h-9 text-xs" data-testid="deletion-log-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {collections.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5" data-testid="deletion-log-refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center"><Trash2 className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" /><p className="text-muted-foreground">No deletions recorded</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((l, idx) => {
            const Icon = TYPE_ICONS[l.collection] || TYPE_ICONS.default;
            const color = TYPE_COLORS[l.collection] || '#6b7280';
            const isOpen = expanded[l._id];
            const summary = l.summary || {};
            const summaryKeys = Object.keys(summary);

            return (
              <Card key={l._id} className={`transition-all hover:shadow-sm ${l.reverted ? 'opacity-60' : ''}`} style={{ animationDelay: `${idx * 30}ms` }} data-testid={`deletion-log-item-${l._id}`}>
                <CardContent className="p-0">
                  {/* Main row */}
                  <div className="flex items-center gap-3 p-4">
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold truncate max-w-[240px]" data-testid="deletion-display-name">{l.display_name || l.entity_name || l.document_id?.slice(0, 12)}</p>
                        <Badge style={{ background: `${color}10`, color, border: `1px solid ${color}25` }} className="text-[9px]">{l.entity_type || l.collection?.replace(/_/g, ' ')}</Badge>
                        {l.reverted && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"><CheckCircle className="w-3 h-3" /> Reverted</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {l.deleted_by_name || 'Unknown'}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(l.deleted_at)}</span>
                        {summary.Email && <span className="hidden sm:flex items-center gap-1"><Mail className="w-3 h-3" /> {summary.Email}</span>}
                        {summary.Status && <span className="hidden sm:flex items-center gap-1"><Tag className="w-3 h-3" /> {summary.Status}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {summaryKeys.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleExpand(l._id)} data-testid={`deletion-expand-${l._id}`} title="Expand details">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDetail(l)} data-testid={`deletion-view-${l._id}`}>View</Button>
                      {!l.reverted && (
                        <Button size="sm" className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={reverting === l._id} onClick={() => revert(l._id)} data-testid={`deletion-revert-${l._id}`}>
                          <RotateCcw className={`w-3 h-3 ${reverting === l._id ? 'animate-spin' : ''}`} /> Revert
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expandable details dropdown */}
                  {isOpen && summaryKeys.length > 0 && (
                    <div className="border-t bg-muted/30 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200" data-testid={`deletion-details-${l._id}`}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2.5">
                        {summaryKeys.map(key => {
                          const SIcon = SUMMARY_ICONS[key];
                          return (
                            <div key={key} className="min-w-0">
                              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                                {SIcon && <SIcon className="w-3 h-3" />}{key}
                              </p>
                              <p className="text-xs font-medium truncate mt-0.5" title={summary[key]}>{summary[key]}</p>
                            </div>
                          );
                        })}
                      </div>
                      {l.reverted && l.reverted_by && (
                        <div className="mt-3 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                          Reverted by <span className="font-medium text-foreground">{l.reverted_by}</span> on {fmtDate(l.reverted_at)}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog - full JSON view */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Deleted: {detail.display_name || detail.entity_name || detail.document_id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{detail.entity_type || detail.collection}</p></div>
                  <div><span className="text-muted-foreground">Collection</span><p className="font-mono">{detail.collection}</p></div>
                  <div><span className="text-muted-foreground">Deleted By</span><p>{detail.deleted_by_name}</p></div>
                  <div><span className="text-muted-foreground">Deleted At</span><p>{fmtDate(detail.deleted_at)}</p></div>
                  <div><span className="text-muted-foreground">Document ID</span><p className="font-mono text-[10px]">{detail.document_id}</p></div>
                  <div><span className="text-muted-foreground">Status</span><p>{detail.reverted ? <Badge className="text-[9px] bg-emerald-500/10 text-emerald-500">Reverted</Badge> : <Badge className="text-[9px] bg-rose-500/10 text-rose-500">Deleted</Badge>}</p></div>
                </div>
                {detail.summary && Object.keys(detail.summary).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Quick Summary</p>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 rounded-lg p-3">
                      {Object.entries(detail.summary).map(([k, v]) => (
                        <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-medium">{v}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Full Document Data</p>
                  <pre className="text-[10px] bg-muted/50 rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap font-mono">{JSON.stringify(detail.document_data, null, 2)}</pre>
                </div>
                {!detail.reverted && (
                  <Button className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => { revert(detail._id); setDetail(null); }} data-testid="deletion-dialog-revert">
                    <RotateCcw className="w-4 h-4" /> Revert This Deletion
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
