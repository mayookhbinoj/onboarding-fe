import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import StatusBadge from '../../components/StatusBadge';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Send, Upload, Download, User, Mail, Phone, Building, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

export default function HospitalDetail() {
  const { id } = useParams();
  const { api, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sendMethod, setSendMethod] = useState('docusign');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [signedFile, setSignedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadData(); loadTemplates(); }, [id]);

  const loadData = async () => {
    try { const res = await api.get(`/api/hospitals/${id}`); setData(res.data); } catch (err) { toast.error('Hospital not found'); }
    setLoading(false);
  };

  const loadTemplates = async () => {
    try { const res = await api.get('/api/agreement-templates'); setTemplates(res.data); if (res.data.length) setSelectedTemplate(res.data[0]._id); } catch (err) {}
  };

  const generateAgreement = async () => {
    setGenerating(true);
    try {
      await api.post('/api/agreements/generate', { distributor_id: id, template_id: selectedTemplate });
      toast.success('Agreement generated!'); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setGenerating(false);
  };

  const sendAgreement = async () => {
    const agr = data?.agreements?.[0];
    if (!agr) return;
    setSending(true);
    try {
      await api.post('/api/agreements/send', { agreement_id: agr._id, method: sendMethod });
      toast.success(`Agreement sent via ${sendMethod}!`); loadData();
    } catch (err) { toast.error('Failed to send'); }
    setSending(false);
  };

  const demoSign = async () => {
    const agr = data?.agreements?.[0];
    if (!agr) return;
    try { await api.post(`/api/agreements/${agr._id}/demo-sign`); toast.success('Agreement signed (demo)!'); loadData(); } catch (err) { toast.error('Failed'); }
  };

  const uploadSigned = async () => {
    const agr = data?.agreements?.[0];
    if (!signedFile || !agr) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', signedFile);
    try { await api.post(`/api/agreements/${agr._id}/upload-signed`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Signed agreement uploaded!'); setSignedFile(null); loadData(); } catch (err) { toast.error('Upload failed'); }
    setUploading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!data) return <div className="text-center py-12 text-muted-foreground">Hospital not found</div>;

  const h = data.hospital;
  const form = data.form_submission?.data || {};
  const agr = data.agreements?.[0];
  const review = data.compliance_review;
  const BACKEND = process.env.REACT_APP_BACKEND_URL;

  const canManageAgreement = ['compliance_admin', 'super_admin'].includes(currentUser?.role);
  const canGenerate = canManageAgreement && ['FORM_SUBMITTED', 'FINANCE_PROFILE_REVIEW', 'FINANCE_PROFILE_APPROVED', 'COMPLIANCE_REJECTED'].includes(h.status) && (!agr || h.status === 'COMPLIANCE_REJECTED');
  const canSend = agr && agr.status === 'draft' && canManageAgreement;
  const canUploadSigned = agr && agr.status === 'sent' && canManageAgreement;
  const canDemoSign = agr && agr.status === 'sent' && canManageAgreement;

  // Show agreement section with helpful message when no agreement yet
  const showAgreementHelp = !agr && !canGenerate;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/hospitals')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{h.first_name} {h.last_name}</h1>
          <p className="text-sm text-muted-foreground">{h.company_name || h.email} — <Badge variant="outline" className="text-xs">{h.entity_type === 'government_hospital' ? 'Government Hospital' : 'Private Hospital'}</Badge></p>
        </div>
        <StatusBadge status={h.status} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="form">Form Data</TabsTrigger><TabsTrigger value="agreement">Agreement</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger></TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" />{h.first_name} {h.last_name}</div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{h.email}</div>
                {h.mobile && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{h.mobile}</div>}
                {h.company_name && <div className="flex items-center gap-2"><Building className="w-4 h-4 text-muted-foreground" />{h.company_name}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <StatusBadge status={h.status} />
                <p className="text-muted-foreground">Created: {h.created_at ? new Date(h.created_at).toLocaleString() : '-'}</p>
                <p className="text-muted-foreground">Updated: {h.updated_at ? new Date(h.updated_at).toLocaleString() : '-'}</p>
                <p className="text-muted-foreground">Videos: {h.videos_watched ? 'Watched' : 'Pending'}</p>
                <p className="text-muted-foreground">Form: {h.form_submitted ? 'Submitted' : 'Pending'}</p>
              </CardContent>
            </Card>
          </div>
          {review && (
            <Card className={review.decision === 'approve' ? 'border-emerald-200' : 'border-rose-200'}>
              <CardHeader><CardTitle className="text-sm">Compliance Review</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <Badge variant="outline" className={review.decision === 'approve' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}>{review.decision === 'approve' ? 'Approved' : 'Rejected'}</Badge>
                {review.comments && <p className="mt-2 text-muted-foreground">{review.comments}</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Form Data */}
        <TabsContent value="form" className="mt-4">
          {data.form_submission ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">Onboarding Form Data</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {Object.entries(form).map(([key, val]) => {
                    if (key.endsWith('_preview') || key === 'consent') return null;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const isFileUrl = typeof val === 'string' && (val.startsWith('/api/uploads/') || val.startsWith('http'));
                    const isImage = isFileUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(val);
                    if (isFileUrl) {
                      const fullUrl = val.startsWith('http') ? val : `${BACKEND}${val}`;
                      return (
                        <div key={key}>
                          <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
                          {isImage ? (
                            <div className="border rounded-lg overflow-hidden inline-block">
                              <img src={fullUrl} alt={label} className="w-32 h-24 object-cover" />
                              <div className="p-1.5 flex gap-1"><a href={fullUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">View</a><a href={fullUrl} download className="text-[10px] text-primary underline">Download</a></div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                              <FileText className="w-5 h-5 text-muted-foreground" /><span className="text-xs truncate flex-1">{val.split('/').pop()}</span>
                              <a href={fullUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View</a><a href={fullUrl} download className="text-xs text-primary underline">Download</a>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (Array.isArray(val)) return <div key={key}><p className="text-xs text-muted-foreground font-medium">{label}</p><p className="mt-0.5">{val.join(', ') || '-'}</p></div>;
                    if (typeof val === 'boolean') return <div key={key}><p className="text-xs text-muted-foreground font-medium">{label}</p><p className="mt-0.5">{val ? 'Yes' : 'No'}</p></div>;
                    return <div key={key}><p className="text-xs text-muted-foreground font-medium">{label}</p><p className="mt-0.5">{String(val) || '-'}</p></div>;
                  })}
                </div>
              </CardContent>
            </Card>
          ) : <Card><CardContent className="py-12 text-center text-muted-foreground">No form submission yet</CardContent></Card>}
        </TabsContent>

        {/* Agreement */}
        <TabsContent value="agreement" className="space-y-4 mt-4">
          {/* Show status info when no agreement and can't generate yet */}
          {!agr && !canGenerate && (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">
                  {canManageAgreement ? 'No Agreement Yet' : 'No Agreement Generated'}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {['INVITED', 'LINK_OPENED', 'VIDEOS_VIEWED', 'FORM_IN_PROGRESS'].includes(h.status)
                    ? 'Waiting for the onboarding form to be submitted.'
                    : h.status === 'FINANCE_PROFILE_REVIEW'
                    ? 'Waiting for Finance Admin to approve the profile.'
                    : !canManageAgreement
                    ? 'The agreement has not been generated yet. Only Compliance Admin or Super Admin can generate agreements.'
                    : `Current status: ${h.status?.replace(/_/g, ' ')}.`}
                </p>
              </CardContent>
            </Card>
          )}
          {agr && agr.status === 'draft' && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><Send className="w-5 h-5 text-amber-600" /></div>
                <div><p className="font-medium text-sm text-amber-800">New Agreement Ready — Needs to be Sent</p><p className="text-xs text-amber-700">Please send it for signature below.</p></div>
              </CardContent>
            </Card>
          )}
          {canGenerate && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Generate Agreement</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent></Select>
                <Button onClick={generateAgreement} disabled={generating || !selectedTemplate}>{generating ? 'Generating...' : 'Generate Draft Agreement'}</Button>
              </CardContent>
            </Card>
          )}
          {agr && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Agreement</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm"><Badge variant="outline">{agr.status}</Badge>{agr.signing_method && <Badge variant="secondary">{agr.signing_method}</Badge>}{agr.version_label && <span className="text-xs text-muted-foreground">v{agr.version_label}</span>}</div>
                {agr.pdf_url && <Button variant="outline" size="sm" asChild><a href={`${BACKEND}${agr.pdf_url}`} target="_blank" rel="noreferrer"><Download className="w-3 h-3 mr-1" /> View PDF</a></Button>}
                <Separator />
                {canSend && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Send Agreement</p>
                    <div className="flex gap-2">
                      <Select value={sendMethod} onValueChange={setSendMethod}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="docusign">DocuSign (Demo)</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select>
                      <Button onClick={sendAgreement} disabled={sending}><Send className="w-3 h-3 mr-1" />{sending ? 'Sending...' : 'Send'}</Button>
                    </div>
                  </div>
                )}
                {canDemoSign && agr.envelope_id?.startsWith('demo-') && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Button variant="outline" onClick={demoSign} className="border-amber-300 text-amber-800"><CheckCircle className="w-3 h-3 mr-1" /> Simulate Signing</Button>
                  </div>
                )}
                {canUploadSigned && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Upload Signed Copy</p>
                    <div className="flex gap-2"><Input type="file" accept=".pdf,.doc,.docx" onChange={e => setSignedFile(e.target.files[0])} /><Button onClick={uploadSigned} disabled={!signedFile || uploading}><Upload className="w-3 h-3 mr-1" />{uploading ? 'Uploading...' : 'Upload'}</Button></div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {/* All agreements history */}
          {data.agreements?.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Agreement History ({data.agreements.length} versions)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.agreements.map((a, i) => (
                  <div key={a._id} className={`flex items-center gap-2 p-2 rounded text-sm ${i === 0 ? 'bg-primary/5' : 'bg-muted/30'}`}>
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono text-xs">v{a.version_label || a.version}</span>
                    <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                    <span className="text-xs text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                    {a.pdf_url && <a href={`${BACKEND}${a.pdf_url}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline ml-auto">PDF</a>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {(h.status_history || []).map((sh, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-background ${i === (h.status_history?.length || 0) - 1 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    <StatusBadge status={sh.status} />
                    <p className="text-xs text-muted-foreground mt-1">{sh.actor} — {sh.timestamp ? new Date(sh.timestamp).toLocaleString() : ''}</p>
                  </div>
                ))}
                {data.audit_log?.map((a, i) => (
                  <div key={`a-${i}`} className="relative">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-muted border-2 border-background" />
                    <p className="text-sm">{a.action?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{a.actor_email} — {a.created_at ? new Date(a.created_at).toLocaleString() : ''}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
