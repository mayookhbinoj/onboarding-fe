import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Search, Copy, Check, ExternalLink, Download, Trash2, RefreshCw, Ban, Play, CalendarPlus, Lock, Plus, AlertTriangle, Settings, GripVertical, ChevronUp, ChevronDown, BarChart3, Trophy } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

function getInviteStatus(invite) {
  if (invite.status === 'terminated') return 'terminated';
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return 'expired';
  return 'active';
}

function daysUntilExpiry(invite) {
  if (!invite.expires_at) return 999;
  return Math.ceil((new Date(invite.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
}

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  expired: 'bg-gray-100 text-gray-600 border-gray-300',
  terminated: 'bg-red-100 text-red-700 border-red-300',
};

export default function ManageInvites() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [extendDays, setExtendDays] = useState(7);
  const [acting, setActing] = useState(false);
  const [qrModal, setQrModal] = useState(null); // invite for QR expand
  const [abModal, setAbModal] = useState(null); // invite for A/B comparison
  const [abData, setAbData] = useState(null);
  const [abLoading, setAbLoading] = useState(false);
  const [pickingWinner, setPickingWinner] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/api/invites'); setInvites(res.data || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const copyLink = (invite) => {
    const url = `${window.location.origin}/portal/${invite.token}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(invite._id); toast.success('Link copied'); setTimeout(() => setCopied(null), 2000); }).catch(() => toast.info('Copy failed'));
  };

  const downloadQR = async (invite) => {
    try {
      const res = await api.get(`/api/invites/${invite._id}/qrcode`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `qr_${invite.token.slice(0,8)}.png`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('QR download failed'); }
  };

  const terminate = async (invite) => {
    setActing(true);
    try { await api.put(`/api/invites/${invite._id}/terminate`); toast.success('Invite terminated'); load(); } catch { toast.error('Failed'); }
    setActing(false); setActionDialog(null);
  };

  const reactivate = async (invite) => {
    setActing(true);
    try { await api.put(`/api/invites/${invite._id}/reactivate`, { extend_days: extendDays }); toast.success('Invite reactivated'); load(); } catch { toast.error('Failed'); }
    setActing(false); setActionDialog(null);
  };

  const extend = async (invite) => {
    setActing(true);
    try { await api.put(`/api/invites/${invite._id}/extend`, { extend_days: extendDays }); toast.success(`Extended by ${extendDays} days`); load(); } catch { toast.error('Failed'); }
    setActing(false); setActionDialog(null);
  };

  const duplicate = (invite) => {
    // Navigate to create invite with pre-filled data
    navigate('/admin/create-invite', { state: { prefill: { first_name: invite.first_name, last_name: invite.last_name, email: '', mobile: '', company_name: invite.company_name, invite_category: invite.invite_category, entity_type: invite.entity_type, preferred_language: invite.preferred_language, expires_in_days: 7, include_videos: invite.include_videos } } });
  };

  const deleteInvite = async (invite) => {
    setActing(true);
    try { await api.delete(`/api/invites/${invite._id}`); toast.success('Invite deleted'); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setActing(false); setActionDialog(null);
  };

  // ── Form Editor is now a full page at /admin/form-editor/:inviteId ──

  const openAbComparison = async (inv) => {
    setAbModal(inv); setAbLoading(true); setAbData(null);
    try {
      const res = await api.get(`/api/invites/${inv._id}/variant-metrics`);
      setAbData(res.data);
    } catch { toast.error('Failed to load A/B data'); }
    setAbLoading(false);
  };
  const pickWinner = async (winnerId) => {
    if (!abModal || !winnerId) return;
    setPickingWinner(true);
    try {
      await api.post(`/api/invites/${abModal._id}/pick-winner`, { winner_id: winnerId });
      toast.success('Winner selected! All traffic now routes to the winning variant.');
      openAbComparison(abModal); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setPickingWinner(false);
  };

  const filtered = invites.filter(inv => {
    const status = getInviteStatus(inv);
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (inv.first_name || '').toLowerCase().includes(q) || (inv.last_name || '').toLowerCase().includes(q) || (inv.email || '').toLowerCase().includes(q) || (inv.company_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const counts = { all: invites.length, active: invites.filter(i => getInviteStatus(i) === 'active').length, expired: invites.filter(i => getInviteStatus(i) === 'expired').length, terminated: invites.filter(i => getInviteStatus(i) === 'terminated').length };

  return (
    <div className="space-y-5" data-testid="manage-invites-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Manage Invites</h1>
          <p className="text-sm text-muted-foreground mt-1">{invites.length} invite link(s)</p>
        </div>
        <Button onClick={() => navigate('/admin/create-invite')} className="gap-1.5"><Plus className="w-4 h-4" /> Create Invite</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, company..." className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'active', 'expired', 'terminated'].map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1" onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="text-[10px] opacity-70">({counts[s]})</span>
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 w-8 p-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Invite list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">No invites found</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const status = getInviteStatus(inv);
            const daysLeft = daysUntilExpiry(inv);
            const isWarning = status === 'active' && daysLeft <= 2 && daysLeft > 0;
            const portalUrl = `${window.location.origin}/portal/${inv.token}`;

            return (
              <Card key={inv._id} className={`transition-all hover:shadow-sm ${status === 'terminated' ? 'opacity-60' : ''}`} data-testid={`invite-row-${inv._id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* QR thumbnail — click to expand */}
                    <div className="w-14 h-14 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setQrModal(inv)} title="Click to expand QR">
                      <img src={`${BACKEND}/api/invites/${inv._id}/qrcode`} alt="QR" className="w-full h-full object-contain" loading="lazy" onError={e => { e.target.style.display='none'; }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold">{inv.first_name} {inv.last_name}</p>
                        <Badge variant="outline" className={`text-[9px] ${STATUS_STYLES[status]}`}>{status}</Badge>
                        <Badge variant="outline" className="text-[9px] capitalize">{inv.invite_category}</Badge>
                        {inv.password_protected && <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-300 gap-0.5"><Lock className="w-2.5 h-2.5" /> Protected</Badge>}
                        {inv.custom_fields?.length > 0 && <Badge className="text-[9px] bg-indigo-100 text-indigo-700 border-indigo-300 gap-0.5"><Settings className="w-2.5 h-2.5" /> {inv.custom_fields.length} custom</Badge>}
                        {inv.has_variants && <Badge className="text-[9px] bg-purple-100 text-purple-700 border-purple-300 gap-0.5"><BarChart3 className="w-2.5 h-2.5" /> A/B Test</Badge>}
                        {isWarning && <Badge className="text-[9px] bg-orange-100 text-orange-700 border-orange-300 gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Expires in {daysLeft}d</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{inv.email}</span>
                        {inv.mobile && <span>{inv.mobile}</span>}
                        <span>Created: {fmtDate(inv.created_at)}</span>
                        <span>Expires: {fmtDate(inv.expires_at)}</span>
                        {inv.preferred_language && inv.preferred_language !== 'en' && <Badge variant="secondary" className="text-[8px]">{inv.preferred_language.toUpperCase()}</Badge>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyLink(inv)} title="Copy link">
                        {copied === inv._id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => downloadQR(inv)} title="Download QR"><Download className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Open link"><a href={portalUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a></Button>

                      {status === 'active' && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-orange-600" onClick={() => { setExtendDays(7); setActionDialog({ type: 'extend', invite: inv }); }} title="Extend expiry"><CalendarPlus className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setActionDialog({ type: 'terminate', invite: inv })} title="Terminate"><Ban className="w-3.5 h-3.5" /></Button>
                        </>
                      )}
                      {(status === 'expired' || status === 'terminated') && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" onClick={() => { setExtendDays(7); setActionDialog({ type: 'reactivate', invite: inv }); }} title="Reactivate"><Play className="w-3.5 h-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-indigo-600" onClick={() => navigate(`/admin/form-editor/${inv._id}`)} title="Customize Form"><Settings className="w-3.5 h-3.5" /></Button>
                      {inv.has_variants && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-purple-600" onClick={() => openAbComparison(inv)} title="A/B Results"><BarChart3 className="w-3.5 h-3.5" /></Button>}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => setActionDialog({ type: 'delete', invite: inv })} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="max-w-sm">
          {actionDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">
                  {actionDialog.type === 'terminate' && 'Terminate Invite'}
                  {actionDialog.type === 'reactivate' && 'Reactivate Invite'}
                  {actionDialog.type === 'extend' && 'Extend Expiry'}
                  {actionDialog.type === 'delete' && 'Delete Invite'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {actionDialog.type === 'terminate' && `Force-expire the invite for ${actionDialog.invite.first_name} ${actionDialog.invite.last_name}? They won't be able to access the form.`}
                  {actionDialog.type === 'reactivate' && `Reactivate the invite for ${actionDialog.invite.first_name} ${actionDialog.invite.last_name}?`}
                  {actionDialog.type === 'extend' && `Extend the expiry date for ${actionDialog.invite.first_name} ${actionDialog.invite.last_name}?`}
                  {actionDialog.type === 'delete' && `Permanently delete this invite? This cannot be undone.`}
                </p>
                {(actionDialog.type === 'reactivate' || actionDialog.type === 'extend') && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">{actionDialog.type === 'extend' ? 'Extend by' : 'New validity'}</p>
                    <Select value={String(extendDays)} onValueChange={v => setExtendDays(parseInt(v))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,3,7,14,30,90].map(d => <SelectItem key={d} value={String(d)}>{d} day{d>1?'s':''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setActionDialog(null)}>Cancel</Button>
                {actionDialog.type === 'terminate' && <Button size="sm" variant="destructive" onClick={() => terminate(actionDialog.invite)} disabled={acting}>{acting ? 'Terminating...' : 'Terminate'}</Button>}
                {actionDialog.type === 'reactivate' && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => reactivate(actionDialog.invite)} disabled={acting}>{acting ? 'Reactivating...' : 'Reactivate'}</Button>}
                {actionDialog.type === 'extend' && <Button size="sm" onClick={() => extend(actionDialog.invite)} disabled={acting}>{acting ? 'Extending...' : `Extend ${extendDays} days`}</Button>}
                {actionDialog.type === 'delete' && <Button size="sm" variant="destructive" onClick={() => deleteInvite(actionDialog.invite)} disabled={acting}>{acting ? 'Deleting...' : 'Delete'}</Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* A/B Comparison Modal */}
      <Dialog open={!!abModal} onOpenChange={() => { setAbModal(null); setAbData(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {abModal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-600" /> A/B Test Results</DialogTitle>
                <p className="text-xs text-muted-foreground">{abModal.first_name} {abModal.last_name} — {abModal.email}</p>
              </DialogHeader>
              {abLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
              ) : !abData || abData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No variant data available</p>
              ) : (
                <div className="space-y-4 mt-2">
                  {/* Side-by-side cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {abData.map(v => {
                      const m = v.metrics || {};
                      const d = v.derived || {};
                      const hasWinner = abData.some(x => x.ab_result === 'winner');
                      const isWinner = v.ab_result === 'winner';
                      const isLoser = v.ab_result === 'loser';
                      const bestCompletion = Math.max(...abData.map(x => x.derived?.completion_rate || 0));
                      const worstDropoff = Math.max(...abData.map(x => x.derived?.drop_off_rate || 0));
                      const isBestCompletion = d.completion_rate > 0 && d.completion_rate === bestCompletion;
                      const isWorstDropoff = d.drop_off_rate > 0 && d.drop_off_rate === worstDropoff;

                      return (
                        <div key={v._id} className={`p-4 rounded-xl border-2 transition-all ${isWinner ? 'border-emerald-400 bg-emerald-50/50' : isLoser ? 'border-red-200 bg-red-50/30 opacity-60' : isBestCompletion ? 'border-emerald-200 bg-emerald-50/20' : isWorstDropoff ? 'border-red-200 bg-red-50/20' : 'border-border'}`} data-testid={`ab-variant-${v.label}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${v.is_original ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>Variant {v.label}</Badge>
                              {isWinner && <Badge className="text-[9px] bg-emerald-500 text-white gap-0.5"><Trophy className="w-2.5 h-2.5" /> Winner</Badge>}
                              {isLoser && <Badge variant="outline" className="text-[9px] text-red-500">Deactivated</Badge>}
                            </div>
                            {!hasWinner && !isLoser && m.submissions > 0 && (
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => pickWinner(v._id)} disabled={pickingWinner}><Trophy className="w-3 h-3" /> Pick</Button>
                            )}
                          </div>
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-center p-2 bg-muted/30 rounded-lg"><p className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk' }}>{m.views || 0}</p><p className="text-[9px] text-muted-foreground">Views</p></div>
                              <div className="text-center p-2 bg-muted/30 rounded-lg"><p className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk' }}>{m.submissions || 0}</p><p className="text-[9px] text-muted-foreground">Submissions</p></div>
                            </div>
                            {/* Visual bar */}
                            <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${d.completion_rate || 0}%` }} /></div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <div className="flex justify-between"><span className="text-muted-foreground">Completion</span><span className={`font-semibold ${isBestCompletion ? 'text-emerald-700' : ''}`}>{d.completion_rate || 0}%</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Start Rate</span><span className="font-semibold">{d.start_rate || 0}%</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Drop-off</span><span className={`font-semibold ${isWorstDropoff ? 'text-red-600' : ''}`}>{d.drop_off_rate || 0}%</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Avg Time</span><span className="font-semibold">{d.avg_completion_time_sec ? `${Math.floor(d.avg_completion_time_sec/60)}m ${d.avg_completion_time_sec%60}s` : '-'}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Form Starts</span><span className="font-semibold">{m.form_starts || 0}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Drop-offs</span><span className="font-semibold">{m.drop_offs || 0}</span></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {abData.every(v => !v.metrics?.submissions) && (
                    <p className="text-xs text-muted-foreground text-center py-2">No submissions yet. Metrics will populate as recipients fill out the form.</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Expand Modal */}
      <Dialog open={!!qrModal} onOpenChange={() => setQrModal(null)}>
        <DialogContent className="max-w-sm text-center">
          {qrModal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">{qrModal.first_name} {qrModal.last_name}</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <img src={`${BACKEND}/api/invites/${qrModal._id}/qrcode`} alt="QR Code" className="w-64 h-64 mx-auto rounded-xl border shadow-sm" />
                <p className="text-xs text-muted-foreground mt-3 font-mono break-all">{`${window.location.origin}/portal/${qrModal.token}`}</p>
              </div>
              <DialogFooter className="justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadQR(qrModal)} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Download QR</Button>
                <Button variant="outline" size="sm" onClick={() => { copyLink(qrModal); }} className="gap-1.5"><Copy className="w-3.5 h-3.5" /> Copy Link</Button>
                <Button variant="outline" size="sm" onClick={() => setQrModal(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
