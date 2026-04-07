import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, UserPlus, ExternalLink, Building, ShieldCheck, Lock, QrCode, List, Download } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

export default function CreateInvite() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', mobile: '', company_name: '', invite_category: 'distributor', entity_type: 'registered', include_videos: true, expires_in_days: 7, preferred_language: 'en', password_protected: false, password: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password_protected && !form.password.trim()) { toast.error('Password is required when protection is enabled'); return; }
    setLoading(true);
    try {
      const res = await api.post('/api/invites', form);
      setResult(res.data);
      toast.success('Invite created successfully!');
      setForm(prev => ({ ...prev, first_name: '', last_name: '', email: '', mobile: '', company_name: '', password: '' }));
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create invite'); }
    setLoading(false);
  };

  const portalUrl = result ? `${window.location.origin}/portal/${result.token}` : '';

  const copyLink = () => {
    navigator.clipboard?.writeText(portalUrl).then(() => { setCopied(true); toast.success('Link copied!'); setTimeout(() => setCopied(false), 2000); }).catch(() => {
      const el = document.createElement('textarea'); el.value = portalUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
      setCopied(true); toast.success('Link copied!'); setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadQR = async () => {
    if (!result?.invite?._id) return;
    setQrLoading(true);
    try {
      const res = await api.get(`/api/invites/${result.invite._id}/qrcode`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `invite_qr_${result.token.slice(0,8)}.png`; a.click();
      URL.revokeObjectURL(url);
      toast.success('QR code downloaded');
    } catch { toast.error('Failed to generate QR code'); }
    setQrLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Create Invite</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate a unique onboarding link</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/manage-invites')} className="gap-1.5" data-testid="manage-invites-btn">
          <List className="w-4 h-4" /> Manage Invites
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-5 gap-6">
              <div className="md:col-span-3 space-y-4">
                <div className="flex items-center gap-2 mb-1"><UserPlus className="w-5 h-5 text-primary" /><h3 className="font-semibold text-sm">Details</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>First Name <span className="text-red-500">*</span></Label><Input data-testid="invite-first-name" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required /></div>
                  <div className="space-y-2"><Label>Last Name <span className="text-red-500">*</span></Label><Input data-testid="invite-last-name" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required /></div>
                </div>
                <div className="space-y-2"><Label>Email <span className="text-red-500">*</span></Label><Input data-testid="invite-email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
                <div className="space-y-2"><Label>Mobile <span className="text-red-500">*</span></Label><Input data-testid="invite-mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} required placeholder="+91-XXXXXXXXXX" /></div>
                <div className="space-y-2"><Label>Company Name</Label><Input data-testid="invite-company" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-3"><Building className="w-5 h-5 text-primary" /><h3 className="font-semibold text-sm">Category & Type</h3></div>
                <p className="text-xs text-muted-foreground mb-2">1. Select category</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button type="button" onClick={() => setForm({...form, invite_category: 'distributor', entity_type: 'registered'})} className={`text-left p-2.5 rounded-lg border-2 transition-colors ${form.invite_category === 'distributor' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}>
                    <p className="font-medium text-sm">Distributor</p><p className="text-[10px] text-muted-foreground">Device distributor/dealer</p>
                  </button>
                  <button type="button" onClick={() => setForm({...form, invite_category: 'hospital', entity_type: 'private_hospital'})} className={`text-left p-2.5 rounded-lg border-2 transition-colors ${form.invite_category === 'hospital' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}>
                    <p className="font-medium text-sm">Hospital</p><p className="text-[10px] text-muted-foreground">Hospital / clinic</p>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">2. Select type</p>
                <div className="space-y-2">
                  {form.invite_category === 'distributor' ? (
                    <>
                      <button type="button" onClick={() => setForm({...form, entity_type: 'registered'})} className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${form.entity_type === 'registered' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between"><div><p className="font-medium text-sm">Registered Entity</p><p className="text-[10px] text-muted-foreground">GST registered</p></div>{form.entity_type === 'registered' && <ShieldCheck className="w-4 h-4 text-primary" />}</div>
                      </button>
                      <button type="button" onClick={() => setForm({...form, entity_type: 'private'})} className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${form.entity_type === 'private' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between"><div><p className="font-medium text-sm">Unregistered Entity</p><p className="text-[10px] text-muted-foreground">Non-GST / individual</p></div>{form.entity_type === 'private' && <ShieldCheck className="w-4 h-4 text-primary" />}</div>
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setForm({...form, entity_type: 'private_hospital'})} className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${form.entity_type === 'private_hospital' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between"><div><p className="font-medium text-sm">Private Hospital</p></div>{form.entity_type === 'private_hospital' && <ShieldCheck className="w-4 h-4 text-primary" />}</div>
                      </button>
                      <button type="button" onClick={() => setForm({...form, entity_type: 'government_hospital'})} className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${form.entity_type === 'government_hospital' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between"><div><p className="font-medium text-sm">Government Hospital</p></div>{form.entity_type === 'government_hospital' && <ShieldCheck className="w-4 h-4 text-primary" />}</div>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Include Videos */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
              <Checkbox checked={form.include_videos} onCheckedChange={v => setForm({...form, include_videos: v})} id="include-videos" />
              <label htmlFor="include-videos" className="text-sm cursor-pointer">
                <span className="font-medium">Include Instruction Videos</span>
                <p className="text-xs text-muted-foreground">Show intro videos before the onboarding form</p>
              </label>
            </div>

            {/* Expiry + Language row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Link Expiry</Label>
                <Select value={String(form.expires_in_days)} onValueChange={v => setForm({...form, expires_in_days: parseInt(v)})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,3,7,14,30,90].map(d => <SelectItem key={d} value={String(d)}>{d} day{d>1?'s':''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Language</Label>
                <Select value={form.preferred_language} onValueChange={v => setForm({...form, preferred_language: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="ta">Tamil</SelectItem>
                    <SelectItem value="te">Telugu</SelectItem>
                    <SelectItem value="bn">Bengali</SelectItem>
                    <SelectItem value="mr">Marathi</SelectItem>
                    <SelectItem value="gu">Gujarati</SelectItem>
                    <SelectItem value="kn">Kannada</SelectItem>
                    <SelectItem value="ml">Malayalam</SelectItem>
                    <SelectItem value="pa">Punjabi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Password Protection */}
            <div className="p-3 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Password Protection</p>
                    <p className="text-[10px] text-muted-foreground">Require a password to access the invite form</p>
                  </div>
                </div>
                <Switch checked={form.password_protected} onCheckedChange={v => setForm({...form, password_protected: v, password: v ? form.password : ''})} data-testid="password-toggle" />
              </div>
              {form.password_protected && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Set Password</Label>
                  <Input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Enter password for this link" className="text-sm" data-testid="invite-password" />
                </div>
              )}
            </div>

            <Button data-testid="invite-submit" type="submit" disabled={loading} className="w-full">{loading ? 'Creating...' : 'Create Invite & Generate Link'}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Result card */}
      {result && (
        <Card className="border-2 border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-emerald-700 flex items-center gap-2"><Check className="w-5 h-5" /> Invite Created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs capitalize">{result.invite?.invite_category}</Badge>
              <Badge variant="outline" className="text-xs">{result.invite?.entity_type?.replace(/_/g, ' ')}</Badge>
              {result.invite?.password_protected && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300"><Lock className="w-3 h-3 mr-1" /> Protected</Badge>}
            </div>

            {/* Link */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Invite Link</Label>
              <div className="flex items-center gap-2">
                <Input data-testid="invite-link" value={portalUrl} readOnly className="bg-white text-xs font-mono" onClick={e => { e.target.select(); }} />
                <Button variant="outline" size="icon" onClick={copyLink} data-testid="invite-copy-link" title="Copy link">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" asChild title="Open link"><a href={portalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a></Button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex items-center gap-3">
              <div className="w-24 h-24 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                {result.invite?._id ? (
                  <img src={`${BACKEND}/api/invites/${result.invite._id}/qrcode`} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">QR Code</p>
                <p className="text-[10px] text-muted-foreground mb-2">Scan to open the invite link</p>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadQR} disabled={qrLoading}>
                  <Download className="w-3 h-3" /> {qrLoading ? 'Generating...' : 'Download QR'}
                </Button>
              </div>
            </div>

            {/* Password display */}
            {result.invite?.password_protected && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-medium text-amber-800 flex items-center gap-1"><Lock className="w-3 h-3" /> Password Protected</p>
                <p className="text-sm font-mono mt-1 text-amber-900">{result.invite.password}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">Share this password separately with the recipient</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
