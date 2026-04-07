import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import StatusBadge from '../../components/StatusBadge';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Send, Upload, Download, Clock, User, Mail, Phone, Building, MapPin, CheckCircle, AlertTriangle, Pencil, Save, X, Eye, Plus, Shield, RefreshCw } from 'lucide-react';

// GST Details Card Component
function GSTDetailsCard({ distributorId, api, formData }) {
  const [gst, setGst] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ gstin: '', gst_legal_name: '', gst_registration_date: '', gst_state: '', gst_category: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/api/distributors/${distributorId}/gst-details`).then(r => {
      setGst(r.data);
      if (r.data?.gstin) setForm(r.data);
    }).catch(() => {});
  }, [distributorId, api]);

  // Also check form submission data
  const existingGstin = gst?.gstin || formData?.gstin || '';

  const saveGst = async () => {
    if (!form.gstin.trim()) { toast.error('GST Number is required'); return; }
    setSaving(true);
    try {
      await api.post(`/api/distributors/${distributorId}/gst-details`, form);
      toast.success('GST details saved');
      setGst({ ...form, gst_added_at: new Date().toISOString() });
      setEditing(false);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
    setSaving(false);
  };

  if (existingGstin && !editing) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/20">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-600" /> GST Details</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-emerald-700">{existingGstin}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setForm({ gstin: existingGstin, gst_legal_name: gst?.gst_legal_name || '', gst_registration_date: gst?.gst_registration_date || '', gst_state: gst?.gst_state || '', gst_category: gst?.gst_category || '' }); setEditing(true); }}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
          </div>
          {gst?.gst_legal_name && <p className="text-xs text-muted-foreground">Legal Name: {gst.gst_legal_name}</p>}
          {gst?.gst_state && <p className="text-xs text-muted-foreground">State: {gst.gst_state}</p>}
          {gst?.gst_category && <p className="text-xs text-muted-foreground">Category: {gst.gst_category}</p>}
          {gst?.gst_added_by && <p className="text-[10px] text-muted-foreground/60">Added by {gst.gst_added_by}</p>}
        </CardContent>
      </Card>
    );
  }

  if (!existingGstin && !editing) {
    return (
      <Card className="border-dashed border-amber-200 bg-amber-50/20">
        <CardContent className="py-4 text-center">
          <Shield className="w-6 h-6 mx-auto text-amber-400 mb-2" />
          <p className="text-sm font-medium text-amber-700">GST Details Missing</p>
          <p className="text-[10px] text-muted-foreground mb-3">This company was onboarded without GST information</p>
          <Button size="sm" onClick={() => setEditing(true)} className="gap-1"><Plus className="w-3 h-3" /> Add GST Details</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> {existingGstin ? 'Edit' : 'Add'} GST Details</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5"><Label className="text-xs">GST Number (GSTIN) <span className="text-red-500">*</span></Label><Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="27AABCU9603R1ZP" maxLength={15} className="h-8 text-xs font-mono" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Legal Business Name</Label><Input value={form.gst_legal_name} onChange={e => setForm({ ...form, gst_legal_name: e.target.value })} placeholder="As per GST registration" className="h-8 text-xs" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Registration Date</Label><Input type="date" value={form.gst_registration_date} onChange={e => setForm({ ...form, gst_registration_date: e.target.value })} className="h-8 text-xs" /></div>
          <div className="space-y-1.5"><Label className="text-xs">State / Place of Supply</Label><Input value={form.gst_state} onChange={e => setForm({ ...form, gst_state: e.target.value })} placeholder="e.g., Maharashtra" className="h-8 text-xs" /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">GST Category</Label>
          <select value={form.gst_category} onChange={e => setForm({ ...form, gst_category: e.target.value })} className="w-full h-8 text-xs rounded-md border border-input bg-background px-2">
            <option value="">Select category</option>
            <option value="Regular">Regular</option>
            <option value="Composition">Composition</option>
            <option value="Input Service Distributor">Input Service Distributor</option>
            <option value="Casual Taxable Person">Casual Taxable Person</option>
            <option value="SEZ Developer">SEZ Developer</option>
            <option value="SEZ Unit">SEZ Unit</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={saveGst} disabled={saving}><Save className="w-3 h-3 mr-1" /> {saving ? 'Saving...' : 'Save GST'}</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Service Status Card Component
function ServiceStatusCard({ distributorId, api, userEmail }) {
  const [tracking, setTracking] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/api/compliance-tracking/${distributorId}`).then(r => setTracking(r.data)).catch(() => {});
  }, [distributorId, api]);

  const toggleStatus = async (newStatus) => {
    setSaving(true);
    try {
      await api.put('/api/compliance-tracking', { distributor_id: distributorId, service_status: newStatus });
      setTracking(prev => ({ ...prev, service_status: newStatus }));
      toast.success(`Service marked as ${newStatus}`);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
    setSaving(false);
  };

  if (!tracking) return null;

  return (
    <Card className={tracking.service_status === 'active' ? 'border-emerald-200' : 'border-rose-200'}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Service Status</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tracking.service_status === 'active' ? 'Service is currently active' : 'Service has been discontinued'}
              {tracking.renewal_due && tracking.service_status === 'active' && ` - Renewal due: ${tracking.renewal_due}`}
            </p>
            {tracking.renewal_due && new Date(tracking.renewal_due) <= new Date() && tracking.service_status === 'active' && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> Renewal is due!</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${tracking.service_status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {tracking.service_status === 'active' ? 'Active' : 'Inactive'}
            </span>
            <Switch
              checked={tracking.service_status === 'active'}
              onCheckedChange={v => toggleStatus(v ? 'active' : 'inactive')}
              disabled={saving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DistributorDetail() {
  const { id } = useParams();
  const { api, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sendMethod, setSendMethod] = useState('docusign');
  const [pdfViewUrl, setPdfViewUrl] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

  const viewPdf = async (pdfPath) => {
    try {
      const res = await api.get(pdfPath, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      console.error('PDF load error:', err);
      toast.error('Failed to load document');
    }
  };
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [signedFile, setSignedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [checkingDocusign, setCheckingDocusign] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false); // Default: show English translation
  const [editingForm, setEditingForm] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [savingForm, setSavingForm] = useState(false);

  useEffect(() => { loadData(); loadTemplates(); }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/api/distributors/${id}`);
      setData(res.data);
    } catch (err) { toast.error('Failed to load distributor'); }
    setLoading(false);
  };

  const loadTemplates = async () => {
    try {
      const res = await api.get('/api/agreement-templates');
      setTemplates(res.data);
      if (res.data.length > 0) setSelectedTemplate(res.data[0]._id);
    } catch (err) {}
  };

  const generateAgreement = async () => {
    setGenerating(true);
    try {
      await api.post('/api/agreements/generate', { distributor_id: id, template_id: selectedTemplate });
      toast.success('Agreement generated!');
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to generate'); }
    setGenerating(false);
  };

  const sendAgreement = async () => {
    if (!data?.agreement?._id) return;
    setSending(true);
    try {
      const res = await api.post('/api/agreements/send', { agreement_id: data.agreement._id, method: sendMethod });
      if (sendMethod === 'docusign') {
        toast.success('Agreement sent! DocuSign email will be delivered to the signer.');
      } else if (sendMethod === 'docusign_embedded' && res.data?.signing_url) {
        // Copy signing URL to clipboard and show it
        try { await navigator.clipboard.writeText(res.data.signing_url); } catch (e) { /* clipboard blocked by policy */ }
        toast.success('Signing link generated! Share it with the signer.');
      } else {
        toast.success(`Agreement sent via ${sendMethod}!`);
      }
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to send'); }
    setSending(false);
  };

  const demoSign = async () => {
    if (!data?.agreement?._id) return;
    try {
      await api.post(`/api/agreements/${data.agreement._id}/demo-sign`);
      toast.success('Agreement signed (demo mode)!');
      loadData();
    } catch (err) { toast.error('Failed to sign'); }
  };

  const uploadSigned = async () => {
    if (!signedFile || !data?.agreement?._id) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', signedFile);
    try {
      await api.post(`/api/agreements/${data.agreement._id}/upload-signed`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Signed agreement uploaded!');
      setSignedFile(null);
      loadData();
    } catch (err) { toast.error('Upload failed'); }
    setUploading(false);
  };

  const checkDocuSignStatus = async () => {
    if (!data?.agreement?._id) return;
    setCheckingDocusign(true);
    try {
      const res = await api.get(`/api/agreements/${data.agreement._id}/check-status`);
      const dsData = res.data;
      if (dsData.docusign_real) {
        toast.success(`DocuSign Status: ${dsData.status}${dsData.details ? ` (${dsData.details.status})` : ''}`);
      } else {
        toast.info('This agreement uses demo DocuSign mode');
      }
      loadData();
    } catch (err) { toast.error('Failed to check status'); }
    setCheckingDocusign(false);
  };

  // Auto-poll DocuSign status every 30s when agreement is sent via real DocuSign
  useEffect(() => {
    const agr = data?.agreement;
    if (!agr || agr.status !== 'sent' || !agr.docusign_real || !agr.envelope_id || agr.envelope_id.startsWith('demo-')) return;
    const poll = setInterval(async () => {
      try {
        const res = await api.get(`/api/agreements/${agr._id}/check-docusign-status`);
        if (res.data?.docusign_status?.status === 'completed' || res.data?.status === 'signed') {
          toast.success('Agreement has been signed!');
          loadData();
          clearInterval(poll);
        }
      } catch {}
    }, 30000);
    return () => clearInterval(poll);
  }, [data?.agreement?._id, data?.agreement?.status, data?.agreement?.docusign_real]);

  const [adminEditing, setAdminEditing] = useState(false);
  const [adminEditData, setAdminEditData] = useState({});
  const [adminSaving, setAdminSaving] = useState(false);

  const startAdminEdit = () => {
    const form = formSub?.data || {};
    setAdminEditData({
      company_name: d.company_name || '', first_name: d.first_name || '', last_name: d.last_name || '',
      email: d.email || '', mobile: d.mobile || '', entity_type: d.entity_type || '',
      gstin: form.gstin || d.gstin || '', pan: form.pan || d.pan || '',
      aadhaar_1: form.aadhaar_1 || '', registered_address: form.registered_address || '',
      communication_address: form.communication_address || '', country: form.country || '',
      state: form.state || '', city: form.city || '', pincode: form.pincode || '',
      contact_person_name: form.contact_person_name || '', trade_name: form.trade_name || '',
    });
    setAdminEditing(true);
  };

  const saveAdminEdit = async () => {
    setAdminSaving(true);
    try {
      const res = await api.put(`/api/distributors/${d._id}/admin-edit`, { fields: adminEditData });
      toast.success(`Saved! ${Object.keys(res.data.changes || {}).length} field(s) changed. Compliance & Finance notified.`);
      setAdminEditing(false); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
    setAdminSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!data) return <div className="text-center py-12 text-muted-foreground">Distributor not found</div>;

  const d = data.distributor;
  const formSub = data.form_submission || {};
  const formLang = formSub.preferred_language || 'en';
  const hasOriginal = formLang !== 'en' && formSub.data_original;
  const form = editingForm ? editFormData : (showOriginal && hasOriginal ? (formSub.data_original || formSub.data || {}) : (formSub.data || {}));
  const agr = data.agreement;
  const review = data.compliance_review;
  const isFinanceAdmin = ['finance_admin', 'super_admin'].includes(currentUser?.role);
  const isComplianceOrFinance = ['finance_admin', 'compliance_admin', 'super_admin'].includes(currentUser?.role);
  const canEditFormData = isComplianceOrFinance && !formSub.finance_locked && !showOriginal;
  const isMarketingOrAdmin = ['marketing_associate', 'marketing_admin', 'super_admin', 'compliance_admin'].includes(currentUser?.role);
  const canManageAgreement = ['compliance_admin', 'super_admin'].includes(currentUser?.role);
  const canGenerate = canManageAgreement && (['FORM_SUBMITTED', 'FINANCE_PROFILE_REVIEW', 'FINANCE_PROFILE_APPROVED', 'COMPLIANCE_REJECTED'].includes(d.status) && (!agr || d.status === 'COMPLIANCE_REJECTED'));
  const canSend = agr && agr.status === 'draft' && canManageAgreement;
  const canUploadSigned = agr && ['sent'].includes(agr.status) && canManageAgreement;
  const canDemoSign = agr && agr.status === 'sent' && canManageAgreement;

  const startEditForm = () => { setEditFormData({...(formSub.data || {})}); setEditingForm(true); };
  const cancelEditForm = () => { setEditingForm(false); setEditFormData({}); };
  const saveEditForm = async () => {
    setSavingForm(true);
    try {
      await api.put(`/api/finance/profile-reviews/${d._id}/edit-form`, { form_data: editFormData });
      toast.success('Form data saved! These edits are now final for agreement generation.');
      setEditingForm(false);
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
    setSavingForm(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{d.first_name} {d.last_name}</h1>
          <p className="text-sm text-muted-foreground">{d.company_name || d.email}</p>
        </div>
        <StatusBadge status={d.status} />
        {currentUser?.role === 'super_admin' && (
          <Button variant="outline" size="sm" onClick={startAdminEdit} className="gap-1"><Pencil className="w-3.5 h-3.5" /> Edit Data</Button>
        )}
      </div>

      <Tabs defaultValue="overview" data-testid="admin-distributor-detail-tabs">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="form">Form Data</TabsTrigger><TabsTrigger value="agreement">Agreement</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger></TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" />{d.first_name} {d.last_name}</div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{d.email}</div>
                {d.mobile && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{d.mobile}</div>}
                {d.company_name && <div className="flex items-center gap-2"><Building className="w-4 h-4 text-muted-foreground" />{d.company_name}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><StatusBadge status={d.status} /></div>
                <div className="text-muted-foreground">Created: {d.created_at ? new Date(d.created_at).toLocaleString() : '-'}</div>
                <div className="text-muted-foreground">Updated: {d.updated_at ? new Date(d.updated_at).toLocaleString() : '-'}</div>
                <div className="text-muted-foreground">Videos: {d.videos_watched ? 'Watched' : 'Pending'}</div>
                <div className="text-muted-foreground">Form: {d.form_submitted ? 'Submitted' : 'Pending'}</div>
              </CardContent>
            </Card>
          </div>
          {/* GST Details Card */}
          <GSTDetailsCard distributorId={id} api={api} formData={formSub?.data || {}} />
          {review && (
            <Card className={review.decision === 'approve' ? 'border-emerald-200' : 'border-rose-200'}>
              <CardHeader><CardTitle className="text-sm">Compliance Review</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <Badge variant="outline" className={review.decision === 'approve' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}>{review.decision === 'approve' ? 'Approved' : 'Rejected'}</Badge>
                {review.comments && <p className="mt-2 text-muted-foreground">{review.comments}</p>}
                <p className="text-xs text-muted-foreground mt-1">By: {review.reviewed_by_email} at {new Date(review.created_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          )}
          {/* Service Status Toggle - visible to Compliance, Finance, Marketing */}
          {['compliance_admin', 'finance_admin', 'marketing_admin', 'marketing_associate', 'super_admin'].includes(currentUser?.role) && (
            <ServiceStatusCard distributorId={id} api={api} userEmail={currentUser?.email} />
          )}
        </TabsContent>

        <TabsContent value="form" className="mt-4">
          {data.form_submission ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">Onboarding Form Data</CardTitle>
                    {formLang !== 'en' && <Badge variant="outline" className="text-[10px]">{formLang.toUpperCase()}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasOriginal && !editingForm && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
                        <span className={`text-xs font-medium transition-colors ${!showOriginal ? 'text-primary' : 'text-muted-foreground'}`}>English</span>
                        <Switch
                          checked={showOriginal}
                          onCheckedChange={setShowOriginal}
                          className="data-[state=checked]:bg-primary"
                        />
                        <span className={`text-xs font-medium transition-colors ${showOriginal ? 'text-primary' : 'text-muted-foreground'}`}>Original ({formLang.toUpperCase()})</span>
                      </div>
                    )}
                    {formLang !== 'en' && formSub.translation_status === 'failed' && !editingForm && (
                      <Button variant="outline" size="sm" className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={async () => {
                        try {
                          toast.info('Translating to English...');
                          await api.post('/api/sarvam/retranslate-form', { distributor_id: d._id });
                          toast.success('Translation completed! Refreshing...');
                          loadData();
                        } catch (err) { toast.error(err.response?.data?.detail || 'Translation failed'); }
                      }}>Re-translate to English</Button>
                    )}
                    {canEditFormData && !editingForm && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditForm} data-testid="finance-edit-form-btn">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                    )}
                    {editingForm && (
                      <>
                        <Button variant="outline" size="sm" onClick={cancelEditForm}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                        <Button size="sm" onClick={saveEditForm} disabled={savingForm}><Save className="w-3.5 h-3.5 mr-1" /> {savingForm ? 'Saving...' : 'Save & Lock'}</Button>
                      </>
                    )}
                    {!editingForm && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
                      try {
                        const res = await api.get(`/api/distributors/${data.distributor._id}/form-pdf`, { responseType: 'blob' });
                        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                        const a = document.createElement('a'); a.href = url; a.download = `Onboarding_${data.distributor.company_name || 'Form'}.pdf`; a.click();
                        URL.revokeObjectURL(url);
                        toast.success('PDF downloaded');
                      } catch (err) { toast.error('Download failed'); }
                    }}><Download className="w-3.5 h-3.5" /> Download PDF</Button>
                    )}
                    {editingForm && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Editing English data — changes are permanent after save</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {Object.entries(form).map(([key, val]) => {
                    // Skip preview fields and consent boolean
                    if (key.endsWith('_preview') || key === 'consent') return null;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    // Check if value is a file URL (uploaded document/image)
                    const isFileUrl = typeof val === 'string' && (val.startsWith('/api/uploads/') || val.startsWith('http'));
                    const isImage = isFileUrl && /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(val.split('?')[0]);
                    
                    if (isFileUrl) {
                      const fullUrl = val.startsWith('http') ? val : `${process.env.REACT_APP_BACKEND_URL}${val}`;
                      return (
                        <div key={key} className="col-span-1">
                          <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
                          {isImage ? (
                            <div className="border rounded-lg overflow-hidden inline-block">
                              <img src={fullUrl} alt={label} className="w-32 h-24 object-cover" onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }} />
                              <div style={{display:'none'}} className="w-32 h-24 items-center justify-center bg-muted text-xs text-muted-foreground">Image unavailable</div>
                              <div className="p-1.5 flex gap-1">
                                <a href={fullUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">View</a>
                                <a href={fullUrl} download className="text-[10px] text-primary underline">Download</a>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <span className="text-xs truncate flex-1">{val.split('/').pop()}</span>
                              <a href={fullUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View</a>
                              <a href={fullUrl} download className="text-xs text-primary underline">Download</a>
                            </div>
                          )}
                        </div>
                      );
                    }
                    
                    // Arrays (like security deposit terms)
                    if (Array.isArray(val)) {
                      return (
                        <div key={key}>
                          <p className="text-xs text-muted-foreground font-medium">{label}</p>
                          <p className="mt-0.5">{val.join(', ') || '-'}</p>
                        </div>
                      );
                    }
                    
                    // Boolean
                    if (typeof val === 'boolean') {
                      return (
                        <div key={key}>
                          <p className="text-xs text-muted-foreground font-medium">{label}</p>
                          <p className="mt-0.5">{val ? 'Yes' : 'No'}</p>
                        </div>
                      );
                    }
                    
                    // Regular text/number
                    return (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
                        {editingForm ? (
                          <Input
                            value={String(editFormData[key] || '')}
                            onChange={e => setEditFormData(prev => ({...prev, [key]: e.target.value}))}
                            className="mt-1 text-sm"
                            data-testid={`edit-field-${key}`}
                          />
                        ) : (
                          <p className="mt-0.5">{String(val) || '-'}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : <Card><CardContent className="py-12 text-center text-muted-foreground">No form submission yet</CardContent></Card>}
        </TabsContent>

        <TabsContent value="agreement" className="space-y-4 mt-4">
          {/* No agreement yet — message for non-privileged roles */}
          {!agr && !canGenerate && (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">
                  {canManageAgreement ? 'No Agreement Yet' : 'No Agreement Generated'}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {['INVITED', 'LINK_OPENED', 'VIDEOS_VIEWED', 'FORM_IN_PROGRESS'].includes(d.status)
                    ? 'Waiting for the onboarding form to be submitted.'
                    : d.status === 'FINANCE_PROFILE_REVIEW'
                    ? 'Waiting for Finance Admin to approve the profile.'
                    : !canManageAgreement
                    ? 'The agreement has not been generated yet. Only Compliance Admin or Super Admin can generate agreements.'
                    : `Current status: ${d.status?.replace(/_/g, ' ')}.`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* New agreement needs sending indicator */}
          {agr && agr.status === 'draft' && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><Send className="w-5 h-5 text-amber-600" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-amber-800">New Agreement Ready — Needs to be Sent</p>
                  <p className="text-xs text-amber-700">Agreement v{agr.version_label || agr.version || ''} has been generated. Please send it for signature via DocuSign, Email, or Manual process below.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Agreement */}
          {(canGenerate && d.form_submitted) && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Generate Agreement</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t._id} value={t._id}>{t.name} (v{t.version})</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={generateAgreement} disabled={generating || !selectedTemplate}>{generating ? 'Generating...' : 'Generate Draft Agreement'}</Button>
                  <span className="text-xs text-muted-foreground self-center">or</span>
                  <label>
                    <Button variant="outline" className="gap-1.5" asChild><span><Upload className="w-4 h-4" /> Upload Signed Doc</span></Button>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async (e) => {
                      const file = e.target.files[0]; if (!file) return;
                      const fd = new FormData(); fd.append('file', file); fd.append('entity_id', d._id);
                      if (selectedTemplate) fd.append('template_id', selectedTemplate);
                      try {
                        await api.post('/api/agreements/upload-signed-direct', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                        toast.success('Signed agreement uploaded — moved to Compliance Review');
                        load();
                      } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
                      e.target.value = '';
                    }} />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">Generate a draft to send for signing, or upload an already-signed agreement to skip the signing flow.</p>
              </CardContent>
            </Card>
          )}

          {/* Agreement Details */}
          {agr && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Agreement Instance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{agr.status}</Badge>
                  {agr.signing_method && <Badge variant="secondary">{agr.signing_method}</Badge>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {agr.signed_pdf_url && (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
                      <a href={`${process.env.REACT_APP_BACKEND_URL}${agr.signed_pdf_url}`} download><Download className="w-3 h-3 mr-1" /> Download Signed Agreement</a>
                    </Button>
                  )}
                  {agr.pdf_url && <Button variant="outline" size="sm" onClick={() => viewPdf(agr.pdf_url)}><Eye className="w-3 h-3 mr-1" /> {agr.signed_pdf_url ? 'View Draft' : 'View Agreement'}</Button>}
                  {agr.pdf_url && <Button variant="ghost" size="sm" asChild><a href={`${process.env.REACT_APP_BACKEND_URL}${agr.pdf_url}`} download><Download className="w-3 h-3 mr-1" /> Download PDF</a></Button>}
                </div>
                <Separator />
                {/* Send Agreement */}
                {canSend && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Send Agreement</p>
                    <div className="flex gap-2">
                      <Select value={sendMethod} onValueChange={setSendMethod}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="docusign">DocuSign (Email to Signer)</SelectItem>
                          <SelectItem value="docusign_embedded">DocuSign (Signing Link)</SelectItem>
                          <SelectItem value="manual">Manual / Upload Signed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={sendAgreement} disabled={sending} data-testid="admin-agreement-send-button"><Send className="w-3 h-3 mr-1" />{sending ? 'Sending...' : 'Send'}</Button>
                    </div>
                  </div>
                )}
                {/* Demo Sign */}
                {canDemoSign && !agr?.docusign_real && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium mb-2">Demo Mode: Simulate Signing</p>
                    <Button variant="outline" onClick={demoSign} className="border-amber-300 text-amber-800 hover:bg-amber-100"><CheckCircle className="w-3 h-3 mr-1" /> Simulate Signing</Button>
                  </div>
                )}
                {/* Real DocuSign — signed and complete */}
                {agr?.docusign_real && agr?.status === 'signed' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">DocuSign Signed</Badge>
                      <p className="text-sm text-emerald-800 font-medium">Agreement signed via DocuSign</p>
                    </div>
                    {agr.signed_at && <p className="text-xs text-emerald-700 mb-2">Signed at: {new Date(agr.signed_at).toLocaleString()}</p>}
                    {agr.signed_pdf_url && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
                        <a href={`${process.env.REACT_APP_BACKEND_URL}${agr.signed_pdf_url}`} target="_blank" rel="noreferrer"><Download className="w-3 h-3 mr-1" /> Download Signed Document</a>
                      </Button>
                    )}
                  </div>
                )}
                {/* Real DocuSign status check — still pending */}
                {agr?.docusign_real && agr?.status === 'sent' && (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-xs">DocuSign</Badge>
                      <p className="text-sm text-sky-800 font-medium">Sent to {d.email}</p>
                    </div>
                    <p className="text-xs text-sky-700">Envelope: {agr.envelope_id?.slice(0, 20)}...</p>
                    {agr.signing_url && (
                      <div className="p-2 bg-white border border-sky-200 rounded">
                        <p className="text-xs text-sky-800 font-medium mb-1">Direct Signing Link:</p>
                        <div className="flex gap-1">
                          <input readOnly value={agr.signing_url} className="text-[10px] flex-1 bg-sky-50 border border-sky-200 rounded px-2 py-1 text-sky-700 truncate" />
                          <Button size="sm" variant="outline" className="h-7 text-xs border-sky-300" onClick={() => { try { navigator.clipboard.writeText(agr.signing_url); toast.success('Signing link copied!'); } catch (e) { toast.info('Copy the link manually'); } }}>Copy</Button>
                        </div>
                        <p className="text-[9px] text-sky-600 mt-1">Share this link with the signer — expires in ~5 minutes</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={checkDocuSignStatus} disabled={checkingDocusign} className="border-sky-300 text-sky-800 hover:bg-sky-100">
                        {checkingDocusign ? 'Checking...' : 'Check Status'}
                      </Button>
                      <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100" onClick={async () => {
                        try {
                          const res = await api.post(`/api/agreements/${agr._id}/resend-docusign`);
                          toast.success(`DocuSign resent to ${res.data.signer_email}!`);
                          loadData();
                        } catch (err) { toast.error(err.response?.data?.detail || 'Resend failed'); }
                      }}><RefreshCw className="w-3 h-3 mr-1" /> Resend DocuSign</Button>
                    </div>
                    {agr.resend_count > 0 && <p className="text-[10px] text-sky-600">Resent {agr.resend_count} time(s)</p>}
                  </div>
                )}
                {/* Demo DocuSign indicator + demo sign for demo envelopes */}
                {canDemoSign && agr?.envelope_id?.startsWith('demo-') && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Demo Mode</Badge>
                      <p className="text-sm text-amber-800 font-medium">DocuSign demo envelope</p>
                    </div>
                    <Button variant="outline" onClick={demoSign} className="border-amber-300 text-amber-800 hover:bg-amber-100"><CheckCircle className="w-3 h-3 mr-1" /> Simulate Signing</Button>
                  </div>
                )}
                {/* Upload Signed */}
                {canUploadSigned && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Upload Signed Copy</p>
                    <div className="flex gap-2">
                      <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setSignedFile(e.target.files[0])} />
                      <Button onClick={uploadSigned} disabled={!signedFile || uploading}><Upload className="w-3 h-3 mr-1" />{uploading ? 'Uploading...' : 'Upload'}</Button>
                    </div>
                  </div>
                )}

                {/* Void Agreement — available for compliance + super admin when agreement exists and isn't already voided */}
                {agr && agr.status !== 'voided' && canManageAgreement && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-destructive">Void Agreement</p>
                        <p className="text-xs text-muted-foreground">Cancel this agreement and optionally create a new one</p>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => {
                        const reason = prompt('Reason for voiding this agreement:');
                        if (!reason) return;
                        api.post(`/api/agreements/${agr._id}/void`, { reason, action: 'void' })
                          .then(() => { toast.success('Agreement voided'); loadData(); })
                          .catch(err => toast.error(err.response?.data?.detail || 'Void failed'));
                      }}><X className="w-3 h-3 mr-1" /> Void Agreement</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4" data-testid="admin-distributor-timeline">
          <Card>
            <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {(d.status_history || []).map((h, i) => (
                  <div key={i} className="relative animate-slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background" />
                    <div className="text-sm"><StatusBadge status={h.status} /></div>
                    <p className="text-xs text-muted-foreground mt-1">{h.actor} - {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}</p>
                  </div>
                ))}
                {data.audit_log?.map((a, i) => (
                  <div key={`audit-${i}`} className="relative">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-muted border-2 border-background" />
                    <p className="text-sm">{a.action?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{a.actor_email} - {a.created_at ? new Date(a.created_at).toLocaleString() : ''}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PDF Viewer Modal */}
      {pdfBlobUrl && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <p className="text-sm font-semibold">Agreement Document</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild><a href={pdfBlobUrl} download="agreement.pdf"><Download className="w-3 h-3 mr-1" /> Download</a></Button>
                <Button size="sm" variant="ghost" onClick={() => { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <iframe src={pdfBlobUrl} className="flex-1 w-full" title="Agreement PDF" />
          </div>
        </div>
      )}

      {/* Super Admin Edit Dialog */}
      {adminEditing && (
        <Dialog open={adminEditing} onOpenChange={o => { if (!o) setAdminEditing(false); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit Distributor Data (Super Admin)</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground mb-2">Changes will be saved and Compliance Admin + Finance Admin will be notified.</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(adminEditData).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                  <Input value={val} onChange={e => setAdminEditData(prev => ({ ...prev, [key]: e.target.value }))} className="h-8 text-sm" />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAdminEditing(false)}>Cancel</Button>
              <Button onClick={saveAdminEdit} disabled={adminSaving}>{adminSaving ? 'Saving...' : 'Save & Notify'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
