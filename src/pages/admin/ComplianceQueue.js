import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import DataTable from '../../components/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import StatusBadge from '../../components/StatusBadge';
import TemplatePreview from './TemplatePreview';
import { toast } from 'sonner';
import { ShieldCheck, CheckCircle, XCircle, Eye, Download, Calendar, Bell, AlertTriangle, Pencil, Plus, FileText, History, ChevronDown, ChevronUp, RefreshCw, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ComplianceQueue() {
  const { api } = useAuth();
  const navigate = useNavigate();
  // IST formatter
  const fmtIST = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };
  const [queue, setQueue] = useState([]);
  const [trackingList, setTrackingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [renewals, setRenewals] = useState([]);
  // Agreement History state
  const [agreementHistory, setAgreementHistory] = useState([]);
  const [ahLoading, setAhLoading] = useState(true);
  const [ahCategoryFilter, setAhCategoryFilter] = useState('all');
  const [ahExpandedId, setAhExpandedId] = useState(null);
  const [ahTriggerDialog, setAhTriggerDialog] = useState(null);
  const [ahSelectedTemplate, setAhSelectedTemplate] = useState('');
  const [ahTriggering, setAhTriggering] = useState(false);
  const [ahTemplates, setAhTemplates] = useState([]);
  const [previewAgreementId, setPreviewAgreementId] = useState(null);

  useEffect(() => { loadQueue(); loadTrackingList(); loadRenewals(); loadAgreementHistory(); loadAhTemplates(); }, []);

  // Auto-sync DocuSign status every 60s
  useEffect(() => {
    const syncDs = () => {
      api.post('/api/docusign/sync-all').then(r => {
        if (r.data.synced > 0) { toast.success(`DocuSign: ${r.data.synced} new signature(s) received!`); loadQueue(); loadAgreementHistory(); }
      }).catch(() => {});
    };
    const interval = setInterval(syncDs, 60000);
    syncDs(); // Initial sync on mount
    return () => clearInterval(interval);
  }, [api]);

  const loadQueue = async () => {
    try { const res = await api.get('/api/compliance/queue'); setQueue(res.data); } catch (err) {}
    setLoading(false);
  };

  const loadTrackingList = async () => {
    try { const res = await api.get('/api/compliance-tracking-list'); setTrackingList(res.data); } catch (err) {}
    setTrackingLoading(false);
  };

  const loadRenewals = async () => {
    try { const res = await api.get('/api/compliance-tracking/renewals-due'); setRenewals(res.data); } catch (err) {}
  };

  const loadAgreementHistory = async () => {
    setAhLoading(true);
    try {
      const url = `/api/agreement-history-all${ahCategoryFilter !== 'all' ? `?category=${ahCategoryFilter}` : ''}`;
      const res = await api.get(url);
      setAgreementHistory(res.data);
    } catch (err) {}
    setAhLoading(false);
  };
  const loadAhTemplates = async () => {
    try { const res = await api.get('/api/agreement-templates'); setAhTemplates(res.data); } catch (err) {}
  };
  useEffect(() => { loadAgreementHistory(); }, [ahCategoryFilter]);

  const triggerNewAgreement = async () => {
    if (!ahSelectedTemplate || !ahTriggerDialog) return;
    setAhTriggering(true);
    try {
      const res = await api.post('/api/compliance/trigger-new-agreement', { entity_id: ahTriggerDialog.entity_id, template_id: ahSelectedTemplate });
      toast.success(`New agreement v${res.data.version} generated!`);
      setAhTriggerDialog(null);
      setAhSelectedTemplate('');
      loadAgreementHistory();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setAhTriggering(false);
  };

  const handleReview = async (decision) => {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      await api.post('/api/compliance/review', { distributor_id: reviewDialog.distributor._id, decision, comments });
      toast.success(`Distributor ${decision === 'approve' ? 'approved' : 'rejected'}!`);
      setReviewDialog(null);
      setComments('');
      loadQueue();
      loadTrackingList();
    } catch (err) { toast.error('Review failed'); }
    setSubmitting(false);
  };

  const openEdit = (item) => {
    setEditRow(item.tracking.distributor_id);
    setEditData({
      documents_signed: item.tracking.documents_signed || false,
      date_of_signing: item.tracking.date_of_signing || '',
      valid_through: item.tracking.valid_through || '',
      renewal_due: item.tracking.renewal_due || '',
      service_status: item.tracking.service_status || 'active',
    });
  };

  const handleValidThroughChange = (val) => {
    const updated = { ...editData, valid_through: val };
    if (val) {
      try {
        const vt = new Date(val);
        const rd = new Date(vt);
        rd.setDate(rd.getDate() - 30);
        updated.renewal_due = rd.toISOString().slice(0, 10);
      } catch (e) {}
    } else {
      updated.renewal_due = '';
    }
    setEditData(updated);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await api.put('/api/compliance-tracking', {
        distributor_id: editRow,
        documents_signed: editData.documents_signed,
        date_of_signing: editData.date_of_signing || null,
        valid_through: editData.valid_through || null,
        service_status: editData.service_status,
      });
      toast.success('Tracking updated!');
      setEditRow(null);
      loadTrackingList();
      loadRenewals();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
    setEditSaving(false);
  };

  const quickToggleStatus = async (distributorId, newStatus) => {
    try {
      await api.put('/api/compliance-tracking', { distributor_id: distributorId, service_status: newStatus });
      toast.success(`Status changed to ${newStatus}`);
      loadTrackingList();
      loadRenewals();
    } catch (err) { toast.error('Failed'); }
  };

  const pending = queue.filter(q => q.distributor.status === 'COMPLIANCE_REVIEW');
  const processed = queue.filter(q => ['COMPLIANCE_APPROVED', 'COMPLIANCE_REJECTED'].includes(q.distributor.status));
  const BACKEND = process.env.REACT_APP_BACKEND_URL;

  const isRenewalSoon = (item) => {
    if (!item.tracking.renewal_due || item.tracking.service_status !== 'active') return false;
    return new Date(item.tracking.renewal_due) <= new Date(Date.now() + 30 * 86400000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Compliance & Agreement Tracking</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">Review agreements, track signing status</p></div>
        <div className="flex gap-2 self-start">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
            try {
              const res = await api.post('/api/docusign/sync-all');
              if (res.data.synced > 0) { toast.success(`Synced ${res.data.synced} signed agreement(s)!`); loadQueue(); loadTrackingList(); loadAgreementHistory(); }
              else toast.info(`Checked ${res.data.checked} envelope(s). No new signatures.`);
            } catch { toast.error('Sync failed'); }
          }} data-testid="sync-docusign-btn"><RefreshCw className="w-3.5 h-3.5" /> Sync DocuSign</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/admin/templates')} data-testid="create-template-btn"><Plus className="w-3.5 h-3.5" /> Create Template</Button>
        </div>
      </div>

      {/* Renewal Alerts */}
      {renewals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><Bell className="w-4 h-4 text-amber-600" /><p className="font-medium text-sm text-amber-800">Upcoming Renewals ({renewals.length})</p></div>
            {renewals.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1">
                <span>{r.distributor?.company_name || `${r.distributor?.first_name} ${r.distributor?.last_name}`}</span>
                <Badge variant="outline" className="text-xs text-amber-700">Due: {r.tracking?.renewal_due}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tracking" data-testid="admin-queue-tabs">
        <TabsList>
          <TabsTrigger value="tracking">Agreement Tracking</TabsTrigger>
          <TabsTrigger value="pending">Needs Review ({pending.length})</TabsTrigger>
          <TabsTrigger value="processed">Agreement History ({agreementHistory.length})</TabsTrigger>
        </TabsList>

        {/* ═══ Agreement Tracking Table ═══ */}
        <TabsContent value="tracking" className="mt-4">
          <DataTable
            testId="compliance-tracking-table"
            columns={[
              { key: '_name', label: 'Associate Name', render: (_, item) => <span className="font-medium">{item.tracking?.associate_name}</span> },
              { key: '_company', label: 'Company', render: (_, item) => <span className="text-muted-foreground text-sm">{item.tracking?.company_name || '—'}</span> },
              { key: '_signed', label: 'Docs Signed', render: (_, item) => item.tracking?.documents_signed ? <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" /> },
              { key: '_date', label: 'Signing Date', render: (_, item) => <span className="text-sm">{item.tracking?.date_of_signing ? fmtIST(item.tracking.date_of_signing) : '—'}</span> },
              { key: '_valid', label: 'Valid Through', render: (_, item) => <span className="text-sm">{item.tracking?.valid_through || '—'}</span> },
              { key: '_renewal', label: 'Renewal Due', render: (_, item) => <div className="flex items-center gap-1 text-sm">{item.tracking?.renewal_due || '—'}{isRenewalSoon(item) && <AlertTriangle className="w-3 h-3 text-amber-500" />}</div> },
              { key: '_status', label: 'Service Status', render: (_, item) => {
                const t = item.tracking;
                return <button onClick={(e) => { e.stopPropagation(); quickToggleStatus(t.distributor_id, t.service_status === 'active' ? 'inactive' : 'active'); }} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${t.service_status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}>{t.service_status === 'active' ? 'Active' : 'Inactive'}</button>;
              }},
              { key: '_actions', label: 'Actions', sortable: false, width: '50px', render: (_, item) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="h-7 w-7 p-0"><Pencil className="w-3 h-3" /></Button> },
            ]}
            data={trackingList}
            loading={trackingLoading}
            searchFields={['tracking.associate_name', 'tracking.company_name']}
            searchPlaceholder="Search associate or company..."
            emptyMessage="No tracking records yet. Approve distributors to begin tracking."
            onRowClick={(item) => navigate(`/admin/distributors/${item.tracking?.distributor_id}`)}
            rowClassName={(item) => isRenewalSoon(item) ? 'bg-amber-50/50' : ''}
            exportable
            exportFilename="compliance_tracking"
          />

          {/* Inline Edit Dialog */}
          {editRow && (
            <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Edit Tracking — {editData.associate_name}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between"><Label>Documents Signed</Label><Switch checked={editData.documents_signed} onCheckedChange={v => setEditData({...editData, documents_signed: v})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Signing Date</Label><Input type="date" value={editData.date_of_signing} onChange={e => setEditData({...editData, date_of_signing: e.target.value})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Valid Through</Label><Input type="date" value={editData.valid_through} onChange={e => handleValidThroughChange(e.target.value)} /></div>
                  <div className="flex items-center justify-between"><Label>Renewal Due</Label><span className="text-sm text-muted-foreground">{editData.renewal_due || '—'}</span></div>
                  <div className="flex items-center justify-between"><Label>Service Status</Label><div className="flex items-center gap-2"><Switch checked={editData.service_status === 'active'} onCheckedChange={v => setEditData({...editData, service_status: v ? 'active' : 'inactive'})} /><span className={`text-xs ${editData.service_status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>{editData.service_status}</span></div></div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setEditRow(null)}>Cancel</Button>
                  <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* ═══ Needs Review ═══ */}
        <TabsContent value="pending" className="mt-4">
          {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : pending.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No items pending review</p></CardContent></Card>
          ) : (
            <div className="space-y-3" data-testid="admin-queue-table">
              {pending.map(q => {
                const hasUnsent = q.agreement && q.agreement.status === 'draft';
                const isSigned = q.agreement && q.agreement.status === 'signed';
                const signedPdfUrl = q.agreement?.signed_pdf_url;
                const draftPdfUrl = q.agreement?.pdf_url;
                const BACKEND = process.env.REACT_APP_BACKEND_URL;
                // Highlight new items (arrived within last 24 hours)
                const isNew = q.distributor?.updated_at && (Date.now() - new Date(q.distributor.updated_at).getTime()) < 86400000;
                return (
                  <Card key={q.distributor._id} className={`animate-row-in hover:shadow-md transition-shadow duration-200 cursor-pointer ${isNew ? 'border-l-4 border-l-primary bg-primary/[0.02]' : ''} ${isSigned ? 'border-emerald-200' : hasUnsent ? 'border-amber-200' : ''}`} onClick={() => navigate(`/admin/distributors/${q.distributor._id}`)}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{q.distributor.first_name} {q.distributor.last_name}</p>
                            {isNew && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 animate-pulse">New</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{q.distributor.company_name || q.distributor.email}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <StatusBadge status={q.distributor.status} />
                            {q.agreement && <Badge variant="outline" className="text-xs">{q.agreement.status} {q.agreement.version_label ? `v${q.agreement.version_label}` : ''}</Badge>}
                            {q.agreement?.signing_method && <Badge variant="secondary" className="text-xs">{q.agreement.signing_method}</Badge>}
                            {hasUnsent && <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Draft — needs sending</Badge>}
                            {isSigned && q.agreement?.docusign_real && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">DocuSign Signed</Badge>}
                          </div>
                          {/* Signed document links */}
                          {isSigned && (
                            <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                              {signedPdfUrl && (
                                <a href={`${BACKEND}${signedPdfUrl}?t=${Date.now()}`} download>
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"><Download className="w-3 h-3 mr-1" /> Download Signed</Button>
                                </a>
                              )}
                            </div>
                          )}
                          {/* Draft actions — Send Agreement */}
                          {hasUnsent && q.agreement && (
                            <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                              {draftPdfUrl && (
                                <a href={`${BACKEND}${draftPdfUrl}?t=${Date.now()}`} target="_blank" rel="noreferrer">
                                  <Button variant="outline" size="sm" className="h-7 text-xs"><Eye className="w-3 h-3 mr-1" /> Preview Draft</Button>
                                </a>
                              )}
                              <Button size="sm" className="h-7 text-xs" onClick={async () => {
                                try {
                                  await api.post(`/api/agreements/${q.agreement._id}/send`, { method: q.agreement.signing_method || 'email' });
                                  toast.success('Agreement sent!'); load();
                                } catch (err) { toast.error(err.response?.data?.detail || 'Send failed'); }
                              }}><FileText className="w-3 h-3 mr-1" /> Send Agreement</Button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            const pdfUrl = q.agreement?.signed_pdf_url || q.agreement?.pdf_url;
                            if (pdfUrl) window.open(`${BACKEND}${pdfUrl}`, '_blank');
                            else navigate(`/admin/distributors/${q.distributor._id}`);
                          }}><Eye className="w-3 h-3 mr-1" /> View</Button>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setReviewDialog(q); }}><ShieldCheck className="w-3 h-3 mr-1" /> Review</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ Agreement History — full version trail from /api/agreement-history-all ═══ */}
        <TabsContent value="processed" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <Select value={ahCategoryFilter} onValueChange={setAhCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="distributor">Distributors</SelectItem>
                <SelectItem value="hospital">Hospitals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {ahLoading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : agreementHistory.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><History className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No agreement history</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {agreementHistory.map((item) => {
                const isExpanded = ahExpandedId === item.entity_id;
                const e = item.entity;
                return (
                  <Card key={item.entity_id} data-testid={`ah-entity-${item.entity_id}`}>
                    <CardContent className="p-0">
                      <div className="p-4 cursor-pointer hover:bg-muted/10" onClick={() => setAhExpandedId(isExpanded ? null : item.entity_id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            <div>
                              <p className="font-medium text-sm">{e?.company_name || `${e?.first_name || ''} ${e?.last_name || ''}`}</p>
                              <p className="text-xs text-muted-foreground">{e?.first_name ? `${e.first_name} ${e.last_name || ''} · ` : ''}{e?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{item.category}</Badge>
                            <Badge variant="secondary" className="text-xs">{item.agreements?.length} version(s)</Badge>
                            <Button variant="outline" size="sm" onClick={ev => { ev.stopPropagation(); setAhTriggerDialog(item); }}>
                              <RefreshCw className="w-3 h-3 mr-1" /> New Agreement
                            </Button>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t">
                          <div className="space-y-2 mt-3">
                            {item.agreements?.map((a, idx) => {
                              const isActive = a.is_active && a.status !== 'overwritten';
                              const statusColors = {
                                draft: 'bg-slate-50 text-slate-700',
                                sent: 'bg-amber-50 text-amber-700',
                                signed: 'bg-emerald-50 text-emerald-700',
                                overwritten: 'bg-slate-100 text-slate-400',
                              };
                              return (
                                <div key={a._id} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${isActive && idx === 0 ? 'bg-primary/5 border border-primary/20' : a.status === 'overwritten' ? 'bg-muted/20 opacity-60' : 'bg-muted/30'}`}>
                                  {a.status === 'overwritten' ? <Lock className="w-5 h-5 text-slate-300 shrink-0" /> : <FileText className="w-5 h-5 text-muted-foreground shrink-0" />}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-sm">v{a.version_label || a.version || idx + 1}</span>
                                      <Badge variant="outline" className={`text-[10px] ${statusColors[a.status] || 'bg-slate-50 text-slate-700'}`}>{a.status}</Badge>
                                      {a.signing_method && <Badge variant="secondary" className="text-[10px]">{a.signing_method}</Badge>}
                                      {isActive && idx === 0 && <Badge className="bg-primary/10 text-primary text-[10px] border border-primary/20">Current Active</Badge>}
                                      {a.status === 'overwritten' && <Badge variant="outline" className="text-[10px] text-slate-400">Superseded</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Created: {fmtIST(a.created_at)}
                                      {a.triggered_by ? ` — by ${a.triggered_by}` : ''}
                                      {a.overwritten_at ? ` — Overwritten: ${fmtIST(a.overwritten_at)}` : ''}
                                      {a.reviewed_at ? ` — Reviewed: ${fmtIST(a.reviewed_at)}` : ''}
                                    </p>
                                  </div>
                                  {(a.signed_pdf_url || a.pdf_url) && <a href={`${BACKEND}${a.signed_pdf_url || a.pdf_url}`} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()}><Button variant="outline" size="sm" className="h-7 gap-1"><Eye className="w-3 h-3" /> View Agreement</Button></a>}
                                  {(a.signed_pdf_url || a.pdf_url) && <a href={`${BACKEND}${a.signed_pdf_url || a.pdf_url}`} download onClick={ev => ev.stopPropagation()}><Button variant="ghost" size="sm" className="h-7" title="Download"><Download className="w-3 h-3" /></Button></a>}
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
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={(open) => { if (!open) setReviewDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Compliance Review</DialogTitle></DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Distributor:</strong> {reviewDialog.distributor.first_name} {reviewDialog.distributor.last_name}</p>
                <p><strong>Company:</strong> {reviewDialog.distributor.company_name}</p>
                <p><strong>Email:</strong> {reviewDialog.distributor.email}</p>
                {reviewDialog.agreement?.signed_pdf_url && (
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}${reviewDialog.agreement.signed_pdf_url}`, '_blank')}><Eye className="w-3 h-3" /> View Signed Agreement</Button>
                    <Button variant="outline" size="sm" className="gap-1" asChild><a href={`${process.env.REACT_APP_BACKEND_URL}${reviewDialog.agreement.signed_pdf_url}`} download><Download className="w-3 h-3" /> Download Signed</a></Button>
                  </div>
                )}
                {reviewDialog.agreement?.pdf_url && !reviewDialog.agreement?.signed_pdf_url && (
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}${reviewDialog.agreement.pdf_url}`, '_blank')}><Eye className="w-3 h-3" /> View Agreement</Button>
                    <Button variant="outline" size="sm" className="gap-1" asChild><a href={`${process.env.REACT_APP_BACKEND_URL}${reviewDialog.agreement.pdf_url}`} download><Download className="w-3 h-3" /> Download PDF</a></Button>
                  </div>
                )}
              </div>
              <div className="space-y-2"><Label>Comments</Label><Textarea placeholder="Add review comments..." value={comments} onChange={e => setComments(e.target.value)} /></div>
              <DialogFooter className="gap-2">
                <Button variant="destructive" onClick={() => handleReview('reject')} disabled={submitting}><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
                <Button onClick={() => handleReview('approve')} disabled={submitting}><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trigger New Agreement Dialog (for Agreement History tab) */}
      <Dialog open={!!ahTriggerDialog} onOpenChange={o => { if (!o) setAhTriggerDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trigger New Agreement</DialogTitle></DialogHeader>
          {ahTriggerDialog && (
            <div className="space-y-4">
              <p className="text-sm">Generate a new agreement for <strong>{ahTriggerDialog.entity?.company_name || `${ahTriggerDialog.entity?.first_name} ${ahTriggerDialog.entity?.last_name}`}</strong></p>
              <p className="text-xs text-muted-foreground">This will create version {(ahTriggerDialog.agreements?.length || 0) + 1} using the latest onboarding form data.</p>
              <div className="space-y-2">
                <Label>Select Template</Label>
                <Select value={ahSelectedTemplate} onValueChange={setAhSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                  <SelectContent>{ahTemplates.map(t => <SelectItem key={t._id} value={t._id}>{t.name} ({t.target_entity || 'All'})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={triggerNewAgreement} disabled={ahTriggering || !ahSelectedTemplate}>{ahTriggering ? 'Generating...' : 'Generate Agreement'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agreement Preview Modal */}
      {previewAgreementId && (
        <TemplatePreview api={api} agreementId={previewAgreementId} onClose={() => setPreviewAgreementId(null)} title="Agreement Preview" />
      )}
    </div>
  );
}
