import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { FileText, History, Eye, ChevronDown, ChevronUp, RefreshCw, Download, Lock, Settings, Ban, Plus, CheckCircle, AlertTriangle, Clipboard } from 'lucide-react';
import TemplatePreview from './TemplatePreview';

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export default function AgreementHistory() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [previewAgreementId, setPreviewAgreementId] = useState(null);
  // Contract management
  const [contractEntity, setContractEntity] = useState(null); // entity item for contract mgmt
  const [voidDialog, setVoidDialog] = useState(null); // agreement to void
  const [voidReason, setVoidReason] = useState('');
  const [voidDetail, setVoidDetail] = useState('');
  const [voidReasons, setVoidReasons] = useState([]);
  const [acting, setActing] = useState(false);
  const [newFromVoided, setNewFromVoided] = useState(null); // voided agreement to create new from
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [triggerDialog, setTriggerDialog] = useState(null);
  const [triggering, setTriggering] = useState(false);

  const BACKEND = process.env.REACT_APP_BACKEND_URL;
  const canManage = ['super_admin', 'compliance_admin', 'finance_admin'].includes(user?.role);

  useEffect(() => { load(); loadTemplates(); loadVoidReasons(); }, []);
  useEffect(() => { load(); }, [categoryFilter]);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get(`/api/agreement-history-all${categoryFilter !== 'all' ? `?category=${categoryFilter}` : ''}`); setHistory(res.data); } catch {}
    setLoading(false);
  };
  const loadTemplates = async () => { try { const res = await api.get('/api/agreement-templates'); setTemplates(res.data); } catch {} };
  const loadVoidReasons = async () => { try { const res = await api.get('/api/void-reasons'); setVoidReasons(res.data); } catch {} };

  const voidAgreement = async () => {
    if (!voidDialog || !voidReason) return;
    if (voidReason === 'Other' && !voidDetail.trim()) { toast.error('Please provide an explanation'); return; }
    setActing(true);
    try {
      const res = await api.post(`/api/agreements/${voidDialog._id}/void`, { reason: voidReason, reason_detail: voidDetail });
      if (res.data.status === 'pending_approval') { toast.info(res.data.message); }
      else { toast.success('Agreement voided'); setNewFromVoided(voidDialog); }
      setVoidDialog(null); setVoidReason(''); setVoidDetail(''); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setActing(false);
  };

  const approveVoid = async (agreementId) => {
    setActing(true);
    try { await api.post(`/api/agreements/${agreementId}/approve-void`); toast.success('Void approved'); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setActing(false);
  };

  const createFromVoided = async () => {
    if (!newFromVoided || !selectedTemplate) return;
    setActing(true);
    try {
      const res = await api.post(`/api/agreements/${newFromVoided._id}/create-from-voided`, { template_id: selectedTemplate });
      toast.success(`New agreement v${res.data.version_label} created!`);
      setNewFromVoided(null); setSelectedTemplate(''); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setActing(false);
  };

  const triggerNewAgreement = async () => {
    if (!selectedTemplate || !triggerDialog) return;
    setTriggering(true);
    try {
      const res = await api.post('/api/compliance/trigger-new-agreement', { entity_id: triggerDialog.entity_id, template_id: selectedTemplate });
      toast.success(`New agreement v${res.data.version} generated!`);
      setTriggerDialog(null); setSelectedTemplate(''); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setTriggering(false);
  };

  const STATUS_COLORS = {
    draft: 'bg-slate-50 text-slate-700', sent: 'bg-amber-50 text-amber-700',
    signed: 'bg-emerald-50 text-emerald-700', overwritten: 'bg-slate-100 text-slate-400',
    voided: 'bg-red-50 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Agreement History</h1><p className="text-sm text-muted-foreground">Full version trail with contract management</p></div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Entities</SelectItem><SelectItem value="distributor">Distributors</SelectItem><SelectItem value="hospital">Hospitals</SelectItem></SelectContent></Select>
      </div>

      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : history.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><History className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No agreement history</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const isExpanded = expandedId === item.entity_id;
            const e = item.entity;
            return (
              <Card key={item.entity_id}>
                <CardContent className="p-0">
                  <div className="p-4 cursor-pointer hover:bg-muted/10" onClick={() => setExpandedId(isExpanded ? null : item.entity_id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        <div>
                          <p className="font-medium text-sm">{e?.company_name || `${e?.first_name} ${e?.last_name}`}</p>
                          <p className="text-xs text-muted-foreground">{e?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        <Badge variant="secondary" className="text-xs">{item.agreements?.length} version(s)</Badge>
                        {canManage && (
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={ev => { ev.stopPropagation(); setContractEntity(item); }} data-testid={`manage-contract-${item.entity_id}`}>
                            <Settings className="w-3 h-3" /> Manage Contract
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t">
                      <div className="space-y-2 mt-3">
                        {item.agreements?.map((a, idx) => {
                          const isActive = a.is_active && !['overwritten', 'voided'].includes(a.status);
                          const hasVoidRequest = a.void_request?.status?.includes('pending');
                          return (
                            <div key={a._id} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${a.status === 'voided' ? 'bg-red-50/50 border border-red-200/50' : isActive && idx === 0 ? 'bg-primary/5 border border-primary/20' : a.status === 'overwritten' ? 'bg-muted/20 opacity-60' : 'bg-muted/30'}`}>
                              {a.status === 'voided' ? <Ban className="w-5 h-5 text-red-400 shrink-0" /> : a.status === 'overwritten' ? <Lock className="w-5 h-5 text-slate-300 shrink-0" /> : <FileText className="w-5 h-5 text-muted-foreground shrink-0" />}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-sm">v{a.version_label || a.version || idx + 1}</span>
                                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[a.status] || 'bg-slate-50 text-slate-700'}`}>{a.status}</Badge>
                                  {a.signing_method && <Badge variant="secondary" className="text-[10px]">{a.signing_method}</Badge>}
                                  {isActive && idx === 0 && <Badge className="bg-primary/10 text-primary text-[10px] border border-primary/20">Current Active</Badge>}
                                  {a.status === 'voided' && <Badge className="bg-red-100 text-red-700 text-[10px]">Voided</Badge>}
                                  {hasVoidRequest && <Badge className="bg-amber-100 text-amber-700 text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Void Pending Approval</Badge>}
                                  {a.created_from_voided && <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200">Created from voided</Badge>}
                                  {a.replaced_by && <Badge variant="outline" className="text-[10px] text-slate-400">Replaced</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Created: {fmtDate(a.created_at)}{a.triggered_by ? ` by ${a.triggered_by}` : ''}
                                  {a.voided_at ? ` | Voided: ${fmtDate(a.voided_at)} by ${a.voided_by}` : ''}
                                  {a.void_reason ? ` | Reason: ${a.void_reason}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7" onClick={ev => { ev.stopPropagation(); setPreviewAgreementId(a._id); }}><Eye className="w-3 h-3" /></Button>
                                {a.pdf_url && <a href={`${BACKEND}${a.pdf_url}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm" className="h-7"><Download className="w-3 h-3" /></Button></a>}
                                {hasVoidRequest && canManage && (
                                  <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={ev => { ev.stopPropagation(); approveVoid(a._id); }} disabled={acting}>Approve Void</Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manage Contract Dialog */}
      <Dialog open={!!contractEntity} onOpenChange={() => setContractEntity(null)}>
        <DialogContent className="max-w-md">
          {contractEntity && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4" /> Manage Contract</DialogTitle>
                <p className="text-xs text-muted-foreground">{contractEntity.entity?.company_name || `${contractEntity.entity?.first_name} ${contractEntity.entity?.last_name}`}</p>
              </DialogHeader>
              <div className="space-y-2 mt-2">
                {/* New Agreement */}
                <button onClick={() => { setContractEntity(null); setTriggerDialog(contractEntity); }} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left">
                  <Plus className="w-5 h-5 text-primary shrink-0" />
                  <div><p className="text-sm font-semibold">New Agreement</p><p className="text-[10px] text-muted-foreground">Generate a new version using latest form data</p></div>
                </button>
                {/* Void — show for active agreements */}
                {contractEntity.agreements?.some(a => ['draft', 'sent', 'signed'].includes(a.status)) && (
                  <button onClick={() => {
                    const active = contractEntity.agreements.find(a => ['draft', 'sent', 'signed'].includes(a.status));
                    if (active) { setContractEntity(null); setVoidDialog(active); }
                  }} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 hover:border-red-200 hover:bg-red-50 transition-colors text-left">
                    <Ban className="w-5 h-5 text-red-500 shrink-0" />
                    <div><p className="text-sm font-semibold text-red-700">Void Agreement</p><p className="text-[10px] text-muted-foreground">Void the current agreement with a reason</p></div>
                  </button>
                )}
                {/* Create from voided */}
                {contractEntity.agreements?.some(a => a.status === 'voided' && !a.replaced_by) && (
                  <button onClick={() => {
                    const voided = contractEntity.agreements.find(a => a.status === 'voided' && !a.replaced_by);
                    if (voided) { setContractEntity(null); setNewFromVoided(voided); }
                  }} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left">
                    <Clipboard className="w-5 h-5 text-blue-600 shrink-0" />
                    <div><p className="text-sm font-semibold text-blue-700">Create from Voided</p><p className="text-[10px] text-muted-foreground">New agreement pre-filled from the voided one</p></div>
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Agreement Dialog */}
      <Dialog open={!!voidDialog} onOpenChange={() => { setVoidDialog(null); setVoidReason(''); setVoidDetail(''); }}>
        <DialogContent className="max-w-md">
          {voidDialog && (
            <>
              <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><Ban className="w-4 h-4 text-red-500" /> Void Agreement v{voidDialog.version_label || voidDialog.version}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-xs text-muted-foreground">This will mark the agreement as voided. It cannot be undone. The agreement will remain as a historical record.</p>
                <div className="space-y-2">
                  <Label className="text-sm">Reason for Voiding <span className="text-red-500">*</span></Label>
                  <Select value={voidReason} onValueChange={setVoidReason}><SelectTrigger data-testid="void-reason-select"><SelectValue placeholder="Select reason" /></SelectTrigger><SelectContent>{voidReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                </div>
                {voidReason === 'Other' && (
                  <div className="space-y-2">
                    <Label className="text-sm">Explanation <span className="text-red-500">*</span></Label>
                    <Input value={voidDetail} onChange={e => setVoidDetail(e.target.value)} placeholder="Provide details..." data-testid="void-detail-input" />
                  </div>
                )}
                {user?.role !== 'super_admin' && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> This action requires cross-role approval. {user?.role === 'compliance_admin' ? 'Finance Admin' : 'Compliance Admin'} will need to approve.
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setVoidDialog(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={voidAgreement} disabled={acting || !voidReason} data-testid="void-confirm-btn">{acting ? 'Processing...' : 'Void Agreement'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create from Voided / New Agreement Dialog */}
      <Dialog open={!!newFromVoided || !!triggerDialog} onOpenChange={() => { setNewFromVoided(null); setTriggerDialog(null); setSelectedTemplate(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{newFromVoided ? 'Create from Voided Agreement' : 'New Agreement'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {newFromVoided && <p className="text-sm">Create a new agreement from voided v{newFromVoided.version_label || newFromVoided.version}. Data will be pre-populated.</p>}
            {triggerDialog && <p className="text-sm">Generate a new agreement for <strong>{triggerDialog.entity?.company_name || `${triggerDialog.entity?.first_name} ${triggerDialog.entity?.last_name}`}</strong></p>}
            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}><SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={newFromVoided ? createFromVoided : triggerNewAgreement} disabled={acting || triggering || !selectedTemplate}>
              {acting || triggering ? 'Creating...' : 'Create Agreement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewAgreementId && <TemplatePreview api={api} agreementId={previewAgreementId} onClose={() => setPreviewAgreementId(null)} title="Agreement Preview" />}
    </div>
  );
}
