import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function DeviceOnboard() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [serial, setSerial] = useState('');
  const [macId, setMacId] = useState('');
  const [qrNumber, setQrNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [serialFormat, setSerialFormat] = useState({ format_type: 'none', length: 0 });

  // Bulk upload state
  const [bulkType, setBulkType] = useState('');
  const [bulkModel, setBulkModel] = useState('');
  const [bulkModels, setBulkModels] = useState([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateRows, setTemplateRows] = useState('50');
  const [templateFormat, setTemplateFormat] = useState('xlsx');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResult, setBulkResult] = useState(null); // { success, errors, devices_created }
  const [bulkFading, setBulkFading] = useState(false);

  useEffect(() => {
    api.get('/api/devices-module/device-types').then(r => setTypes(r.data)).catch(() => {});
    api.get('/api/devices-module/serial-format').then(r => setSerialFormat(r.data)).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (bulkType) api.get(`/api/devices-module/device-models?device_type_id=${bulkType}`).then(r => setBulkModels(r.data)).catch(() => {});
    else setBulkModels([]);
  }, [bulkType, api]);

  useEffect(() => {
    if (selectedType) {
      api.get(`/api/devices-module/device-models?device_type_id=${selectedType}`).then(r => setModels(r.data)).catch(() => {});
    } else { setModels([]); }
  }, [selectedType, api]);

  const serialError = (() => {
    if (!serial.trim()) return '';
    const s = serial.trim().toUpperCase();
    const { format_type, length } = serialFormat;
    if (format_type === 'none' || !length) return '';
    if (length > 0 && s.length !== length) return `Must be exactly ${length} characters (currently ${s.length})`;
    if (format_type === 'numeric' && !s.match(/^\d+$/)) return 'Must be numeric only';
    if (format_type === 'alphanumeric' && !s.replace(/-/g, '').replace(/_/g, '').match(/^[A-Z0-9]+$/)) return 'Must be alphanumeric only';
    return '';
  })();

  const serialHint = (() => {
    const { format_type, length } = serialFormat;
    if (format_type === 'none' || !length) return '';
    const parts = [];
    if (length > 0) parts.push(`${length} characters`);
    if (format_type === 'numeric') parts.push('numeric only');
    else if (format_type === 'alphanumeric') parts.push('alphanumeric');
    return `Format: ${parts.join(', ')}`;
  })();

  const createDevice = async () => {
    if (!selectedType || !selectedModel || !serial.trim() || !macId.trim()) { toast.error('All fields are required'); return; }
    if (serialError) { toast.error(serialError); return; }
    const macClean = macId.trim().toUpperCase().replace(/-/g, ':').replace(/\./g, ':');
    const macRegex = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$|^[0-9A-F]{12}$/;
    if (!macRegex.test(macClean)) { toast.error('Invalid MAC ID format. Use XX:XX:XX:XX:XX:XX'); return; }
    setCreating(true);
    try {
      const res = await api.post('/api/devices-module/devices', { device_type_id: selectedType, device_model_id: selectedModel, serial_number: serial.trim(), device_mac_id: macClean, qr_number: qrNumber.trim() });
      try {
        await api.post(`/api/devices-module/devices/${res.data._id}/submit-qc`);
        toast.success(`Device ${serial} created and submitted to QC!`);
      } catch { toast.success(`Device ${serial} created!`); }
      navigate('/admin/devices');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create device'); }
    setCreating(false);
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.post('/api/devices-module/bulk-template', { device_type_id: bulkType, device_model_id: bulkModel, row_count: parseInt(templateRows) || 50, format: templateFormat }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `bulk_onboard_template.${templateFormat}`; a.click();
      URL.revokeObjectURL(url);
      setTemplateOpen(false);
      toast.success('Template downloaded');
    } catch { toast.error('Failed to generate template'); }
  };

  const uploadBulk = async () => {
    if (!bulkFile || !bulkType || !bulkModel) { toast.error('Select device type, model, and file'); return; }
    setBulkUploading(true); setBulkProgress(0); setBulkResult(null); setBulkFading(false);
    try {
      const fd = new FormData(); fd.append('file', bulkFile); fd.append('device_type_id', bulkType); fd.append('device_model_id', bulkModel);
      const res = await api.post('/api/devices-module/bulk-upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: p => { if (p.total) setBulkProgress(Math.round((p.loaded / p.total) * 100)); }
      });
      setBulkProgress(100); setBulkFading(true);
      setTimeout(() => { setBulkUploading(false); setBulkProgress(0); setBulkFading(false); }, 800);
      setBulkResult({ success: true, devices_created: res.data.devices_created });
      toast.success(`${res.data.devices_created} devices onboarded to Pending QC!`);
      setBulkFile(null);
    } catch (err) {
      setBulkUploading(false); setBulkProgress(0);
      const detail = err.response?.data?.detail;
      if (detail?.errors) {
        setBulkResult({ success: false, errors: detail.errors, message: detail.message, total_rows: detail.total_rows });
        toast.error(detail.message);
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Upload failed');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/devices')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1"><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Onboard New Device</h1><p className="text-sm text-muted-foreground">Register a device unit with serial number and MAC ID</p></div>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Device</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
        </TabsList>
        <TabsContent value="single">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Device Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {types.length === 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              No device names or models configured yet. Contact your Super Admin to set them up in Settings.
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Device Name — select only */}
            <div className="space-y-2">
              <Label>Device Name <span className="text-red-500">*</span></Label>
              <Select value={selectedType} onValueChange={v => { setSelectedType(v); setSelectedModel(''); }}>
                <SelectTrigger data-testid="device-type-select"><SelectValue placeholder="Select device name" /></SelectTrigger>
                <SelectContent>
                  {types.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Model Number — select only */}
            <div className="space-y-2">
              <Label>Model Number <span className="text-red-500">*</span></Label>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedType}>
                <SelectTrigger data-testid="device-model-select"><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {models.map(m => <SelectItem key={m._id} value={m._id}>{m.model_number}{m.description ? ` — ${m.description}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Serial Number with format hint */}
            <div className="space-y-2">
              <Label>Serial Number <span className="text-red-500">*</span></Label>
              <Input
                value={serial}
                onChange={e => {
                  let val = e.target.value.toUpperCase();
                  if (serialFormat.format_type === 'numeric') val = val.replace(/[^0-9]/g, '');
                  if (serialFormat.format_type === 'alphanumeric') val = val.replace(/[^A-Z0-9-_]/g, '');
                  if (serialFormat.length > 0) val = val.slice(0, serialFormat.length);
                  setSerial(val);
                }}
                placeholder={serialFormat.length > 0 ? `${serialFormat.length} chars` : 'Enter serial'}
                className={`font-mono ${serialError ? 'border-red-400' : ''}`}
                maxLength={serialFormat.length > 0 ? serialFormat.length : undefined}
                data-testid="serial-number-input"
              />
              {serialHint && !serialError && <p className="text-[10px] text-muted-foreground">{serialHint}</p>}
              {serialError && <p className="text-[10px] text-red-500">{serialError}</p>}
            </div>
          </div>

          {/* MAC ID */}
          <div className="space-y-2">
            <Label>Device MAC ID <span className="text-red-500">*</span></Label>
            <Input value={macId} onChange={e => {
              let raw = e.target.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 12);
              let formatted = '';
              for (let i = 0; i < raw.length; i++) {
                if (i > 0 && i % 2 === 0) formatted += ':';
                formatted += raw[i];
              }
              setMacId(formatted);
            }} placeholder="AA:BB:CC:DD:EE:FF" className="font-mono tracking-wider" maxLength={17} data-testid="mac-id-input" />
            <p className="text-[10px] text-muted-foreground">BLE MAC address — format: XX:XX:XX:XX:XX:XX</p>
          </div>

          {/* QR Number */}
          <div className="space-y-2">
            <Label>QR Number</Label>
            <Input value={qrNumber} onChange={e => setQrNumber(e.target.value.toUpperCase())} placeholder="e.g., MQZSRTN" className="font-mono" data-testid="qr-number-input" />
            <p className="text-[10px] text-muted-foreground">Gateway case QR serial code — validated during packaging QC</p>
          </div>

          <Button data-testid="submit-to-qc-btn" onClick={createDevice} disabled={creating || !selectedType || !selectedModel || !serial.trim() || !macId.trim() || !!serialError}>
            {creating ? 'Submitting...' : 'Submit to QC'}
          </Button>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="bulk">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Bulk Upload</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">Upload multiple devices at once using a CSV or Excel template. All rows are validated before processing — it's all or nothing.</p>

            {/* Step 1: Select Device & Model */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Device Name <span className="text-red-500">*</span></Label>
                <Select value={bulkType} onValueChange={v => { setBulkType(v); setBulkModel(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select device name" /></SelectTrigger>
                  <SelectContent>{types.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model Number <span className="text-red-500">*</span></Label>
                <Select value={bulkModel} onValueChange={setBulkModel} disabled={!bulkType}>
                  <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>{bulkModels.map(m => <SelectItem key={m._id} value={m._id}>{m.model_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2: Download Template */}
            <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
              <p className="text-sm font-medium">Step 1: Download Template</p>
              <p className="text-[10px] text-muted-foreground">Select device & model above, then download a pre-filled template.</p>
              <Button variant="outline" size="sm" disabled={!bulkType || !bulkModel} onClick={() => setTemplateOpen(true)} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Download Template</Button>
            </div>

            {/* Step 3: Upload Completed File */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Step 2: Upload Completed File</p>
              <label className="cursor-pointer">
                <div className="relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center hover:border-primary/50 transition-colors overflow-hidden" style={{ minHeight: 100 }}>
                  {bulkUploading && (
                    <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-700 ${bulkFading ? 'opacity-0' : 'opacity-100'}`}>
                      <div className="absolute inset-0 bg-primary/8 transition-all duration-300 ease-out" style={{ width: `${bulkProgress}%` }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.12) 40%, hsl(var(--primary) / 0.25) 50%, hsl(var(--primary) / 0.12) 60%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmerSweep 1.8s ease-in-out infinite' }} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-sm font-semibold text-primary">{bulkProgress < 100 ? `Uploading... ${bulkProgress}%` : 'Validating...'}</p>
                        <div className="w-40 h-1 bg-primary/10 rounded-full mt-2 overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${bulkProgress}%` }} /></div>
                      </div>
                    </div>
                  )}
                  <Upload className="w-7 h-7 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">{bulkFile ? bulkFile.name : 'Click to select completed template'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Accepts .csv, .xlsx files</p>
                </div>
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={e => { setBulkFile(e.target.files[0] || null); setBulkResult(null); e.target.value = ''; }} disabled={bulkUploading} />
              </label>
              {bulkFile && !bulkUploading && (
                <Button onClick={uploadBulk} disabled={!bulkType || !bulkModel} className="w-full gap-1.5"><Upload className="w-4 h-4" /> Upload & Validate {bulkFile.name}</Button>
              )}
            </div>

            {/* Results */}
            {bulkResult && (
              <div className={`p-4 rounded-xl border ${bulkResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                {bulkResult.success ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">{bulkResult.devices_created} devices onboarded to Pending QC</p>
                      <p className="text-[10px] text-emerald-600">All devices created successfully. Onboarding count updated.</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="text-sm font-semibold text-red-800">{bulkResult.message}</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {bulkResult.errors?.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-red-100/50 rounded">
                          <Badge className="text-[9px] bg-red-200 text-red-800 shrink-0">Row {err.row}</Badge>
                          <span className="font-medium text-red-700">{err.field}:</span>
                          <span className="text-red-600">{err.error}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-red-500 mt-2">Fix the errors above and re-upload. No devices were created.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      {/* Template Config Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Template Configuration</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Number of Rows</Label>
              <Input type="number" min="1" max="500" value={templateRows} onChange={e => setTemplateRows(e.target.value)} className="text-center" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select value={templateFormat} onValueChange={setTemplateFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {serialFormat.format_type !== 'none' && (
              <p className="text-[10px] text-muted-foreground p-2 bg-muted rounded-lg">Serial format: {serialFormat.format_type}, {serialFormat.length} characters</p>
            )}
          </div>
          <DialogFooter><Button size="sm" onClick={downloadTemplate} className="gap-1"><Download className="w-3.5 h-3.5" /> Download</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`@keyframes shimmerSweep { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
