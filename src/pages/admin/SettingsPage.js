import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { Settings, Save, Plus, Trash2, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Upload, Image, Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import XAuraUsagePanel from '../../components/admin/XAuraUsagePanel';

export default function SettingsPage() {
  const { api } = useAuth();
  const [settings, setSettings] = useState({});
  const [rules, setRules] = useState([]);
  const [demoBuffer, setDemoBuffer] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dsStatus, setDsStatus] = useState(null);
  const [checkingDs, setCheckingDs] = useState(false);

  const [dsConfig, setDsConfig] = useState({});
  const [dsPrivateKey, setDsPrivateKey] = useState('');
  const [savingDs, setSavingDs] = useState(false);
  const [showFields, setShowFields] = useState({});
  const toggleShow = (key) => setShowFields(prev => ({ ...prev, [key]: !prev[key] }));

  // XAura settings
  const [xauraSettings, setXauraSettings] = useState({});
  const [savingXaura, setSavingXaura] = useState(false);
  const [editingPromptRole, setEditingPromptRole] = useState(null);

  // AI Packaging references
  const [packRefs, setPackRefs] = useState([]);
  const [packUploading, setPackUploading] = useState({});
  const PACK_SLOTS = [
    { key: 'SENSOR_FRONT', name: 'Sensor Front', desc: 'Top/front face showing BeatX Lite logo and power button' },
    { key: 'SENSOR_BACK', name: 'Sensor Back', desc: 'Underside showing product label (Model, SN, manufacturer)' },
    { key: 'GATEWAY_FRONT', name: 'Gateway Case Front', desc: 'Open charging cradle showing sensor dock, charging pins' },
    { key: 'GATEWAY_BACK', name: 'Gateway Case Back', desc: 'Underside showing QR code, serial code, rubber feet' },
    { key: 'BOX_CONTENTS', name: 'Box Contents', desc: 'Open box with all components arranged' },
    { key: 'SEALED_BOX', name: 'Sealed Box', desc: 'Closed retail box with branding' },
  ];

  useEffect(() => { loadAll(); loadDsConfig(); loadXauraSettings(); loadPackRefs(); }, []);

  const loadXauraSettings = async () => {
    try {
      const res = await api.get('/api/xaura/settings');
      setXauraSettings(res.data || {});
    } catch {}
  };

  const loadPackRefs = async () => {
    try { const res = await api.get('/api/devices-module/packaging-references'); setPackRefs(res.data || []); } catch {}
  };
  const uploadPackRef = async (slotKey, file) => {
    setPackUploading(prev => ({ ...prev, [slotKey]: true }));
    try {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`/api/devices-module/packaging-references/${slotKey}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Reference image uploaded');
      loadPackRefs();
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
    setPackUploading(prev => ({ ...prev, [slotKey]: false }));
  };
  const deletePackRef = async (slotKey) => {
    if (!window.confirm('Delete this reference image?')) return;
    try { await api.delete(`/api/devices-module/packaging-references/${slotKey}`); toast.success('Deleted'); loadPackRefs(); } catch { toast.error('Failed'); }
  };

  const saveXauraSettings = async () => {
    setSavingXaura(true);
    try {
      await api.put('/api/xaura/settings', xauraSettings);
      toast.success('XAura settings saved!');
    } catch (err) { toast.error('Failed to save XAura settings'); }
    setSavingXaura(false);
  };

  const loadDsConfig = async () => {
    try {
      const res = await api.get('/api/docusign/config');
      setDsConfig(res.data || {});
    } catch {}
  };

  const saveDsConfig = async () => {
    setSavingDs(true);
    try {
      const payload = { ...dsConfig };
      if (dsPrivateKey) payload.private_key = dsPrivateKey;
      await api.put('/api/docusign/config', payload);
      toast.success('DocuSign credentials saved! Click Test Connection to verify.');
      loadDsConfig();
      setDsStatus(null);
    } catch (err) { toast.error('Failed to save DocuSign config'); }
    setSavingDs(false);
  };

  const loadAll = async () => {
    try {
      const [settingsRes, rulesRes] = await Promise.all([api.get('/api/settings'), api.get('/api/allocation-rules')]);
      setSettings(settingsRes.data || {});
      setRules(rulesRes.data.rules || []);
      setDemoBuffer(rulesRes.data.demo_buffer || 1);
    } catch (err) {}
    setLoading(false);
  };

  const checkDocuSignStatus = async () => {
    setCheckingDs(true);
    try {
      const res = await api.get('/api/docusign/status');
      setDsStatus(res.data);
    } catch (err) { toast.error('Failed to check DocuSign status'); }
    setCheckingDs(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', settings);
      toast.success('Settings saved!');
    } catch (err) { toast.error('Failed to save'); }
    setSaving(false);
  };

  const saveRules = async () => {
    setSaving(true);
    try {
      await api.post('/api/allocation-rules', { rules, demo_buffer: demoBuffer });
      toast.success('Allocation rules saved!');
    } catch (err) { toast.error('Failed to save rules'); }
    setSaving(false);
  };

  const addRule = () => setRules([...rules, { min_studies: 0, max_studies: 0, recommended_devices: 1 }]);
  const removeRule = (i) => setRules(rules.filter((_, idx) => idx !== i));
  const updateRule = (i, field, val) => {
    const updated = [...rules];
    updated[i] = { ...updated[i], [field]: parseInt(val) || 0 };
    setRules(updated);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Settings</h1><p className="text-sm text-muted-foreground mt-1">Configure global portal settings</p></div>

      {/* DocuSign Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">DocuSign Integration</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={checkDocuSignStatus} disabled={checkingDs}>
                <RefreshCw className={`w-3 h-3 mr-1 ${checkingDs ? 'animate-spin' : ''}`} /> Test Connection
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          {dsStatus && (
            <div className="p-3 rounded-lg border space-y-2 mb-4" style={{ borderColor: dsStatus.can_authenticate ? '#10b981' : '#f59e0b', backgroundColor: dsStatus.can_authenticate ? '#f0fdf4' : '#fffbeb' }}>
              <div className="flex items-center gap-2">
                {dsStatus.can_authenticate ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-amber-600" />}
                <span className="text-sm font-medium">{dsStatus.can_authenticate ? 'Connected & Authenticated' : 'Not Connected'}</span>
                <Badge variant="outline" className="text-[10px]">Source: {dsStatus.source}</Badge>
              </div>
              {dsStatus.error && <p className="text-xs text-rose-600">{dsStatus.error.substring(0, 300)}</p>}
              {dsStatus.error && (dsStatus.error.includes('consent') || dsStatus.error.includes('no_valid_keys')) && (
                <div className="text-xs space-y-1">
                  <p className="font-medium">Grant consent by visiting:</p>
                  <p className="text-primary break-all text-[10px]">https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={dsConfig.client_id || ''}&redirect_uri=https://developers.docusign.com/platform/auth/consent</p>
                </div>
              )}
            </div>
          )}

          {/* Credentials Form */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client ID (Integration Key)</Label>
              <Input value={dsConfig.client_id || ''} onChange={e => setDsConfig({...dsConfig, client_id: e.target.value})} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>User ID (API Username)</Label>
              <Input value={dsConfig.user_id || ''} onChange={e => setDsConfig({...dsConfig, user_id: e.target.value})} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input value={dsConfig.account_id || ''} onChange={e => setDsConfig({...dsConfig, account_id: e.target.value})} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Select value={dsConfig.base_url || 'https://demo.docusign.net/restapi'} onValueChange={v => {
                const isProduction = !v.includes('demo.');
                setDsConfig({...dsConfig, base_url: v, oauth_url: isProduction ? 'https://account.docusign.com' : 'https://account-d.docusign.com'});
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="https://demo.docusign.net/restapi">Demo (Sandbox)</SelectItem>
                  <SelectItem value="https://na1.docusign.net/restapi">Production (NA1)</SelectItem>
                  <SelectItem value="https://na2.docusign.net/restapi">Production (NA2)</SelectItem>
                  <SelectItem value="https://eu.docusign.net/restapi">Production (EU)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>OAuth URL</Label>
              <Select value={dsConfig.oauth_url || 'https://account-d.docusign.com'} onValueChange={v => setDsConfig({...dsConfig, oauth_url: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="https://account-d.docusign.com">Demo</SelectItem>
                  <SelectItem value="https://account.docusign.com">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Private Key Status</Label>
              <div className="flex items-center gap-2 h-9">
                {dsConfig.has_private_key ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> Key uploaded</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700"><XCircle className="w-3 h-3 mr-1" /> No key</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>RSA Private Key (PEM format — paste the full key including BEGIN/END lines)</Label>
            <textarea
              value={dsPrivateKey}
              onChange={e => setDsPrivateKey(e.target.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">Only paste when updating. Leave empty to keep existing key.</p>
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-semibold mb-3">CEO Co-Signer (Dual Signature)</h4>
            <p className="text-xs text-muted-foreground mb-3">If configured, the CEO will automatically receive the agreement for signing AFTER the distributor/hospital signs. Both signatures will appear on the final document.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CEO Email</Label>
                <Input value={dsConfig.ceo_email || ''} onChange={e => setDsConfig({...dsConfig, ceo_email: e.target.value})} placeholder="ceo@company.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEO Name</Label>
                <Input value={dsConfig.ceo_name || ''} onChange={e => setDsConfig({...dsConfig, ceo_name: e.target.value})} placeholder="CEO Full Name" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Leave empty to send agreements with distributor signature only. Place /sn2/ anchor in the template for CEO signature position.</p>
          </div>
          <Button onClick={saveDsConfig} disabled={savingDs}><Save className="w-4 h-4 mr-2" /> {savingDs ? 'Saving...' : 'Save DocuSign Credentials'}</Button>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">General Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Demo Mode</Label><p className="text-xs text-muted-foreground">Enable demo DocuSign and mock email</p></div>
            <Switch checked={settings.demo_mode !== false} onCheckedChange={v => setSettings({...settings, demo_mode: v})} />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Token Expiry (days)</Label>
            <Input type="number" value={settings.token_expiry_days || 7} onChange={e => setSettings({...settings, token_expiry_days: parseInt(e.target.value) || 7})} />
          </div>
          <div className="space-y-2">
            <Label>Comprehensive Video Gate</Label>
            <Select value={settings.comprehensive_video_gate || 'compliance_approved'} onValueChange={v => setSettings({...settings, comprehensive_video_gate: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="compliance_approved">After Compliance Approved</SelectItem><SelectItem value="agreement_signed">After Agreement Signed</SelectItem></SelectContent>
            </Select>
          </div>
          <Button onClick={saveSettings} disabled={saving}><Save className="w-4 h-4 mr-2" /> Save Settings</Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader><CardTitle className="text-base">API Keys</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Configure third-party API keys. These are stored securely and used for integrations.</p>
          <div className="space-y-2">
            <Label>OpenAI Translation Key</Label>
            <div className="relative">
              <Input type={showFields.openai ? 'text' : 'password'} value={settings.openai_key || ''} onChange={e => setSettings({...settings, openai_key: e.target.value})} placeholder="sk-proj-..." className="pr-10" />
              <button type="button" onClick={() => toggleShow('openai')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" data-testid="toggle-openai-key">
                {showFields.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Used for translating onboarding forms to English</p>
          </div>
          <div className="space-y-2">
            <Label>GSTIN Verification API Key</Label>
            <div className="relative">
              <Input type={showFields.gstin ? 'text' : 'password'} value={settings.gstin_key || ''} onChange={e => setSettings({...settings, gstin_key: e.target.value})} placeholder="API key for GSTIN verification" className="pr-10" />
              <button type="button" onClick={() => toggleShow('gstin')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" data-testid="toggle-gstin-key">
                {showFields.gstin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Used for automatic GSTIN validation on onboarding form</p>
          </div>
          <div className="space-y-2">
            <Label>TURN Server URL</Label>
            <div className="relative">
              <Input type={showFields.turn_url ? 'text' : 'password'} value={settings.turn_url || ''} onChange={e => setSettings({...settings, turn_url: e.target.value})} placeholder="turn:server.com:3478" className="pr-10" />
              <button type="button" onClick={() => toggleShow('turn_url')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" data-testid="toggle-turn-url">
                {showFields.turn_url ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>TURN Username</Label>
              <div className="relative">
                <Input type={showFields.turn_user ? 'text' : 'password'} value={settings.turn_username || ''} onChange={e => setSettings({...settings, turn_username: e.target.value})} className="pr-10" />
                <button type="button" onClick={() => toggleShow('turn_user')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" data-testid="toggle-turn-user">
                  {showFields.turn_user ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>TURN Password</Label>
              <div className="relative">
                <Input type={showFields.turn_pass ? 'text' : 'password'} value={settings.turn_password || ''} onChange={e => setSettings({...settings, turn_password: e.target.value})} className="pr-10" />
                <button type="button" onClick={() => toggleShow('turn_pass')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" data-testid="toggle-turn-pass">
                  {showFields.turn_pass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving}><Save className="w-4 h-4 mr-2" /> Save API Keys</Button>
        </CardContent>
      </Card>

      {/* XAura AI Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <img src="/x-icon.png" alt="X" className="w-5 h-5" />
            <CardTitle className="text-base">XAura AI Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Configure the XAura AI concierge — model, API key, and role-specific system prompts.</p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Provider</Label>
              <Select value={xauraSettings.provider || 'openai'} onValueChange={v => setXauraSettings({...xauraSettings, provider: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary Model</Label>
              <Select value={xauraSettings.model || 'gpt-4o'} onValueChange={v => setXauraSettings({...xauraSettings, model: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(xauraSettings.provider || 'openai') === 'openai' ? (
                    <>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fallback Provider</Label>
              <Select value={xauraSettings.fallback_provider || 'openai'} onValueChange={v => setXauraSettings({...xauraSettings, fallback_provider: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground">Used when primary model fails (rate limit, context too large, etc.)</p>
            </div>
            <div className="space-y-2">
              <Label>Fallback Model</Label>
              <Select value={xauraSettings.fallback_model || 'gpt-4o-mini'} onValueChange={v => setXauraSettings({...xauraSettings, fallback_model: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(xauraSettings.fallback_provider || 'openai') === 'openai' ? (
                    <>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                      <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>OpenAI API Key</Label>
            <div className="relative">
              <Input type={showFields.xaura_key ? 'text' : 'password'} value={xauraSettings.openai_key || ''} onChange={e => setXauraSettings({...xauraSettings, openai_key: e.target.value})} placeholder="sk-proj-..." className="pr-10" />
              <button type="button" onClick={() => toggleShow('xaura_key')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showFields.xaura_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anthropic API Key</Label>
            <div className="relative">
              <Input type={showFields.anthropic_key ? 'text' : 'password'} value={xauraSettings.anthropic_key || ''} onChange={e => setXauraSettings({...xauraSettings, anthropic_key: e.target.value})} placeholder="sk-ant-..." className="pr-10" />
              <button type="button" onClick={() => toggleShow('anthropic_key')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showFields.anthropic_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Global Prompt Prefix (prepended to all role prompts)</Label>
            <textarea
              value={xauraSettings.global_prompt_prefix || ''}
              onChange={e => setXauraSettings({...xauraSettings, global_prompt_prefix: e.target.value})}
              rows={2}
              placeholder="e.g., Always respond in a professional and concise manner."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-3">
            <Label>Role-Specific System Prompts</Label>
            <p className="text-[10px] text-muted-foreground">Customize the AI's behavior for each user role.</p>
            {Object.entries(xauraSettings.system_prompts || {}).map(([role, prompt]) => (
              <div key={role} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] capitalize">{role.replace(/_/g, ' ')}</Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setEditingPromptRole(editingPromptRole === role ? null : role)}>
                    {editingPromptRole === role ? 'Collapse' : 'Edit'}
                  </Button>
                </div>
                {editingPromptRole === role ? (
                  <textarea
                    value={prompt}
                    onChange={e => setXauraSettings({
                      ...xauraSettings,
                      system_prompts: { ...xauraSettings.system_prompts, [role]: e.target.value }
                    })}
                    rows={4}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ) : (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{prompt}</p>
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* ═══ LIVE THINKING STATUS MODULE ═══ */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Live Thinking Status</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Configure how Aura narrates its work while processing user queries.</p>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dynamic', label: 'Dynamic', desc: 'AI generates status based on query context' },
                { id: 'static', label: 'Static', desc: 'Rotate through fixed fallback phrases' },
                { id: 'hybrid', label: 'Hybrid', desc: 'Dynamic first, fallback if classification fails' },
              ].map(m => (
                <button key={m.id} onClick={() => setXauraSettings({...xauraSettings, thinking_mode: m.id})}
                  className={`p-3 rounded-xl border text-left transition-all ${(xauraSettings.thinking_mode || 'dynamic') === m.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}`}>
                  <p className="text-xs font-semibold">{m.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* Tone */}
            <div className="flex items-center gap-3">
              <Label className="text-xs shrink-0">Tone</Label>
              <Select value={xauraSettings.tone || 'professional'} onValueChange={v => setXauraSettings({...xauraSettings, tone: v})}>
                <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="premium-medical">Premium Medical</SelectItem>
                  <SelectItem value="playful">Playful</SelectItem>
                </SelectContent>
              </Select>
              <Label className="text-xs shrink-0 ml-4">Speed</Label>
              <Input type="number" className="w-20 h-8 text-xs" min={1000} max={5000} step={100}
                value={xauraSettings.rotation_speed || 2000}
                onChange={e => setXauraSettings({...xauraSettings, rotation_speed: parseInt(e.target.value) || 2000})} />
              <span className="text-[9px] text-muted-foreground">ms</span>
            </div>

            {/* Category Phrases */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Category Status Phrases</Label>
                <Badge variant="outline" className="text-[9px]">{(xauraSettings.thinking_mode || 'dynamic') === 'static' ? 'Active' : 'Fallback'}</Badge>
              </div>
              <p className="text-[9px] text-muted-foreground">Custom phrases per domain. Used as fallbacks in Dynamic/Hybrid mode, or as primary in Static mode.</p>
              {[
                { id: 'ecg_clinical', label: 'ECG / Clinical', color: '#ef4444' },
                { id: 'agreements_compliance', label: 'Agreements / Compliance', color: '#f59e0b' },
                { id: 'client_onboarding', label: 'Client Onboarding', color: '#3b82f6' },
                { id: 'device_onboarding', label: 'Device Onboarding', color: '#8b5cf6' },
                { id: 'inventory_tracking', label: 'Inventory / Tracking', color: '#06b6d4' },
                { id: 'logistics_shipment', label: 'Logistics / Shipment', color: '#10b981' },
                { id: 'qc_qa', label: 'QC / QA', color: '#ec4899' },
                { id: 'general', label: 'General AI', color: '#6b7280' },
              ].map(cat => {
                const phrases = (xauraSettings.category_phrases || {})[cat.id] || [];
                const isOpen = editingPromptRole === `cat_${cat.id}`;
                return (
                  <div key={cat.id} className="border rounded-lg overflow-hidden">
                    <button onClick={() => setEditingPromptRole(isOpen ? null : `cat_${cat.id}`)}
                      className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/30 transition-colors">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-[11px] font-medium flex-1">{cat.label}</span>
                      <Badge variant="outline" className="text-[8px]">{phrases.length || 'default'}</Badge>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 border-t bg-muted/10">
                        <textarea rows={3} className="w-full mt-2 rounded-md border border-input bg-transparent px-3 py-2 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                          placeholder="One phrase per line. Leave empty for system defaults."
                          value={phrases.join('\n')}
                          onChange={e => setXauraSettings({
                            ...xauraSettings,
                            category_phrases: { ...(xauraSettings.category_phrases || {}), [cat.id]: e.target.value.split('\n').filter(l => l.trim()) }
                          })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Static fallback phrases */}
            <div className="space-y-2">
              <Label className="text-xs">Fallback Phrases (Static Mode)</Label>
              <p className="text-[9px] text-muted-foreground">Used when classification confidence is low or in Static mode. One per line.</p>
              <textarea rows={4}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                value={(xauraSettings.thinking_words || ['Understanding your question','Looking into this now','Reviewing the right details','Checking the key information','Bringing the pieces together','Preparing a clear response']).join('\n')}
                onChange={e => setXauraSettings({...xauraSettings, thinking_words: e.target.value.split('\n').filter(w => w.trim())})} />
            </div>

            {/* Cross-category toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-xs">Allow cross-category blending</Label>
                <p className="text-[9px] text-muted-foreground">Include secondary category phrases for mixed queries</p>
              </div>
              <Switch checked={xauraSettings.allow_secondary_mix !== false} onCheckedChange={v => setXauraSettings({...xauraSettings, allow_secondary_mix: v})} />
            </div>
          </div>

          <Button onClick={saveXauraSettings} disabled={savingXaura}><Save className="w-4 h-4 mr-2" /> {savingXaura ? 'Saving...' : 'Save XAura Settings'}</Button>
        </CardContent>
      </Card>

      {/* XAura Usage Dashboard */}
      <Card>
        <CardContent className="pt-6">
          <XAuraUsagePanel />
        </CardContent>
      </Card>

      {/* AI Packaging References */}
      <Card data-testid="ai-packaging-refs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <CardTitle className="text-base">AI Packaging — Reference Images</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Upload reference images for each packaging slot. AI vision compares actual uploads against these during QC analysis.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PACK_SLOTS.map(slot => {
              const ref = packRefs.find(r => r.slot_key === slot.key);
              const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
              return (
                <div key={slot.key} className={`border-2 rounded-xl overflow-hidden transition-all ${ref ? 'border-indigo-200 bg-indigo-50/30' : 'border-dashed border-border'}`}>
                  {ref ? (
                    <div className="relative group">
                      <img src={`${BACKEND}${ref.file_url}`} alt={slot.name} className="w-full h-32 object-cover" />
                      <button onClick={() => deletePackRef(slot.key)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 className="w-3 h-3" /></button>
                      <div className="p-2.5">
                        <p className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {slot.name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{slot.desc}</p>
                        <label className="text-[10px] text-indigo-600 underline cursor-pointer mt-1 inline-block">Replace<input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={e => e.target.files[0] && uploadPackRef(slot.key, e.target.files[0])} /></label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 min-h-[160px] cursor-pointer hover:border-indigo-300 transition-colors">
                      {packUploading[slot.key] ? <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mb-2" /> : <Upload className="w-6 h-6 text-muted-foreground/40 mb-2" />}
                      <p className="text-xs font-medium text-muted-foreground">{slot.name}</p>
                      <p className="text-[9px] text-muted-foreground/70 text-center mt-1">{slot.desc}</p>
                      <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={e => e.target.files[0] && uploadPackRef(slot.key, e.target.files[0])} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">{packRefs.length}/{PACK_SLOTS.length} reference images uploaded</p>
        </CardContent>
      </Card>

      {/* Allocation Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Device Allocation Rules</CardTitle>
            <Button variant="outline" size="sm" onClick={addRule}><Plus className="w-3 h-3 mr-1" /> Add Tier</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Demo Buffer (extra devices)</Label>
            <Input type="number" min="0" max="5" value={demoBuffer} onChange={e => setDemoBuffer(parseInt(e.target.value) || 0)} className="w-24" />
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Min Studies/Mo</TableHead><TableHead>Max Studies/Mo</TableHead><TableHead>Recommended Devices</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rules.map((r, i) => (
                <TableRow key={i}>
                  <TableCell><Input type="number" value={r.min_studies} onChange={e => updateRule(i, 'min_studies', e.target.value)} className="w-24" /></TableCell>
                  <TableCell><Input type="number" value={r.max_studies} onChange={e => updateRule(i, 'max_studies', e.target.value)} className="w-24" /></TableCell>
                  <TableCell><Input type="number" value={r.recommended_devices} onChange={e => updateRule(i, 'recommended_devices', e.target.value)} className="w-24" /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => removeRule(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button onClick={saveRules} disabled={saving}><Save className="w-4 h-4 mr-2" /> Save Allocation Rules</Button>
        </CardContent>
      </Card>
    </div>
  );
}
