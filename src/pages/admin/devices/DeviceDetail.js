import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Package, Camera, ShieldCheck, Truck, Clock, CheckCircle, Upload, RotateCcw, Pencil, RefreshCw, Trash2, Activity, Plus, Sparkles } from 'lucide-react';
import { DeviceStatusBadge } from './DevicesList';
import ECGViewer from './ECGViewer';

const ONBOARDING_CATEGORIES = [
  { key: 'SENSOR_FRONT', label: 'Sensor Front', hint: 'Top/front face showing BeatX Lite logo and power button' },
  { key: 'SENSOR_BACK', label: 'Sensor Back', hint: 'Underside showing product label (Model, SN, manufacturer), electrodes' },
  { key: 'GATEWAY_FRONT', label: 'Gateway Case Front', hint: 'Open charging cradle showing sensor dock, charging pins, LED slot' },
  { key: 'GATEWAY_BACK', label: 'Gateway Case Back', hint: 'Underside showing QR code, serial code, rubber feet' },
  { key: 'BOX_CONTENTS', label: 'Box Contents', hint: 'Open box with all components: sensor in case, charger accessory box' },
  { key: 'SEALED_BOX', label: 'Sealed Box', hint: 'Closed retail box (can be uploaded later)' },
];

export default function DeviceDetail() {
  const { id } = useParams();
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState([]);
  const [models, setModels] = useState([]);
  const [editDialog, setEditDialog] = useState(false);
  const [editType, setEditType] = useState('');
  const [editModel, setEditModel] = useState('');
  const [uploading, setUploading] = useState({});
  const [activeRound, setActiveRound] = useState(null);
  const [ecgViewerArtifact, setEcgViewerArtifact] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [slotAiLoading, setSlotAiLoading] = useState({});
  const [slotAiResults, setSlotAiResults] = useState({});
  // Device edit/delete
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (device?.status === 'PACKAGING' || device?.status === 'RETURNED_TO_INVENTORY') setActiveTab('images');
  }, [device?.status]);
  const load = async () => {
    try {
      const res = await api.get(`/api/devices-module/devices/${id}`);
      setDevice(res.data);
      setActiveRound(res.data.current_round || 1);
    } catch (err) { toast.error('Device not found'); }
    setLoading(false);
  };

  const loadMasterData = async () => {
    const [t, m] = await Promise.all([
      api.get('/api/devices-module/device-types'),
      api.get('/api/devices-module/device-models')
    ]);
    setTypes(t.data);
    setModels(m.data);
  };

  // AI Packaging QC
  const runAiPackagingQc = async () => {
    setAiLoading(true);
    try {
      const res = await api.post(`/api/devices-module/devices/${id}/ai-packaging-qc`);
      setAiAnalysis(res.data);
      toast.success('AI Packaging QC complete');
    } catch (err) { toast.error(err.response?.data?.detail || 'AI analysis failed'); }
    setAiLoading(false);
  };
  const cleanAiText = (t) => (t || '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^---+$/gm, '').replace(/^─+$/gm, '').trim();
  const runSlotAiQc = async (slotKey) => {
    setSlotAiLoading(prev => ({ ...prev, [slotKey]: true }));
    try {
      const res = await api.post(`/api/devices-module/devices/${id}/ai-packaging-qc/${slotKey}`);
      setSlotAiResults(prev => ({ ...prev, [slotKey]: cleanAiText(res.data.analysis) }));
      toast.success(`AI analysis complete for ${slotKey.replace(/_/g, ' ')}`);
    } catch (err) { toast.error(err.response?.data?.detail || 'AI analysis failed'); }
    setSlotAiLoading(prev => ({ ...prev, [slotKey]: false }));
  };
  const loadAiQc = async () => {
    try {
      const res = await api.get(`/api/devices-module/devices/${id}/ai-packaging-qc`);
      if (res.data?.analysis) setAiAnalysis(res.data);
      if (res.data?.slot_results) setSlotAiResults(Object.fromEntries(Object.entries(res.data.slot_results).map(([k, v]) => [k, cleanAiText(v.analysis)])));
    } catch {}
  };
  useEffect(() => { if (device?.status === 'PACKAGING' || device?.status === 'READY_TO_SHIP') loadAiQc(); }, [device?.status]);

  const markReadyToShip = async () => {
    try { await api.post(`/api/devices-module/devices/${id}/mark-ready-to-ship`); toast.success('Marked Ready to Ship!'); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const [activeTab, setActiveTab] = useState('overview');

  const reOnboard = async () => {
    // Create a new round for return images and switch to images tab
    try {
      await api.post(`/api/devices-module/devices/${id}/new-image-batch`);
      toast.success('Upload all 6 return condition images');
      setActiveTab('images');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const sendToReQC = async () => {
    try { await api.post(`/api/devices-module/devices/${id}/send-to-reqc`); toast.success('Device sent to Re-QC!'); load(); } catch (err) { toast.error(err.response?.data?.detail || 'All 6 return images required'); }
  };

  const submitToQC = async () => {
    try { await api.post(`/api/devices-module/devices/${id}/submit-qc`); toast.success('Submitted to QC!'); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Missing images for current round'); }
  };

  const triggerReQC = async () => {
    const reason = window.prompt('Reason for Re-QC (optional):') || 'Re-QC requested';
    try { await api.post(`/api/devices-module/devices/${id}/trigger-re-qc`, { reason }); toast.success('Device sent to Re-QC!'); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const openEdit = () => {
    setEditType(device.device_type_id || '');
    setEditModel(device.device_model_id || '');
    loadMasterData();
    setEditDialog(true);
  };

  const saveEdit = async () => {
    try {
      await api.put(`/api/devices-module/devices/${id}`, { device_type_id: editType, device_model_id: editModel });
      toast.success('Device updated!');
      setEditDialog(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const deleteDevice = async () => {
    if (!window.confirm(`Permanently delete device ${device.serial_number}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/devices-module/devices/${id}`);
      toast.success('Device deleted');
      navigate('/admin/devices');
    } catch (err) { toast.error(err.response?.data?.detail || 'Cannot delete this device'); }
  };

  const uploadImage = async (category) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.webp';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(prev => ({ ...prev, [category]: true }));
      const fd = new FormData();
      fd.append('category', category);
      fd.append('file', file);
      try {
        const res = await api.post(`/api/devices-module/devices/${id}/onboarding-media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success(`${category.replace(/_/g, ' ')} uploaded`);
        if (res.data?.auto_ready_to_ship) {
          toast.success('All images complete — device moved to Ready to Ship!');
        } else if (res.data?.auto_submitted_to_qc) {
          toast.success('All images uploaded — device auto-submitted to QC!');
        }
        load();
      } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
      setUploading(prev => ({ ...prev, [category]: false }));
    };
    input.click();
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!device) return <div className="text-center py-12 text-muted-foreground">Device not found</div>;

  const isInventory = ['inventory_admin', 'super_admin'].includes(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = isSuperAdmin && ['DRAFT', 'RETURNED_TO_INVENTORY'].includes(device.status);
  const canDelete = isSuperAdmin;
  const canUploadImages = isInventory && ['PACKAGING', 'RETURNED_TO_INVENTORY'].includes(device.status);
  const canDeleteImages = canUploadImages; // Delete only during active upload phases
  const canSubmitQC = isInventory && device.status === 'DRAFT';
  const canReOnboard = isInventory && device.status === 'RETURNED_TO_INVENTORY';
  const canReQC = isInventory && ['QC_PASSED', 'NONCONFORMING', 'READY_TO_SHIP', 'PACKAGING'].includes(device.status);
  const BACKEND = process.env.REACT_APP_BACKEND_URL;
  // Ensure current round always shows even if no images uploaded yet
  const mediaRounds = Object.keys(device.onboarding_media_by_round || {}).map(Number);
  const currentRound = device.current_round || 1;
  const rounds = [...new Set([...mediaRounds, currentRound])].sort();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight font-mono">{device.serial_number}</h1>
          <p className="text-sm text-muted-foreground">{device.device_type_name} — {device.model_number} {device.current_round > 1 ? `(Round ${device.current_round})` : ''}</p>
        </div>
        <DeviceStatusBadge status={device.status} />
        <div className="flex gap-2 flex-wrap">
          {canEdit && <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>}
          {/* Upload Return Images — creates a new round for return images */}
          {canReOnboard && <Button size="sm" onClick={reOnboard}><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Return Images</Button>}
          {/* Send to Re-QC — only after a NEW return round has 6 images */}
          {device.status === 'RETURNED_TO_INVENTORY' && isInventory && (() => {
            // Get the latest status_history entry for RETURNED_TO_INVENTORY
            const returnEntry = [...(device.status_history || [])].reverse().find(h => h.status === 'RETURNED_TO_INVENTORY');
            const returnTime = returnEntry ? new Date(returnEntry.timestamp) : new Date(0);
            // Check current round media — must have images uploaded AFTER the return
            const curMedia = (device.onboarding_media_by_round || {})[device.current_round || 1] || [];
            const recentMedia = curMedia.filter(m => m.uploaded_at && new Date(m.uploaded_at) > returnTime);
            const recentCats = new Set(recentMedia.map(m => m.category));
            return recentCats.size >= 6;
          })() && (
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={sendToReQC}>
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Send to Re-QC
            </Button>
          )}
          {canSubmitQC && <Button size="sm" onClick={submitToQC}><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Submit to QC</Button>}
          {device.status === 'QC_PASSED' && isInventory && <Button size="sm" onClick={markReadyToShip}><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Ready to Ship</Button>}
        </div>
      </div>

      {/* Return Images banner */}
      {device.status === 'RETURNED_TO_INVENTORY' && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-primary">Returned to Inventory — Upload Return Images</p>
              <p className="text-xs text-muted-foreground">
                Upload all 6 return condition images. Once uploaded, "Send to Re-QC" button will appear.
                {device.re_onboard_status?.progress_text && ` ${device.re_onboard_status.progress_text}`}
              </p>
            </div>
            {device.re_onboard_status?.progress_text && <Badge variant="outline" className="text-xs">{device.re_onboard_status.progress_text}</Badge>}
          </CardContent>
        </Card>
      )}

      {/* Packaging banner */}
      {device.status === 'PACKAGING' && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-primary">Packaging — Upload Onboarding Images</p>
              <p className="text-xs text-muted-foreground">
                Upload all 6 packaging images. AI QC runs automatically on each upload. All 6 must pass to mark Ready to Ship.
                {device.re_onboard_status?.progress_text && ` ${device.re_onboard_status.progress_text}`}
              </p>
            </div>
            {device.re_onboard_status?.progress_text && <Badge variant="outline" className="text-xs border-orange-300 text-primary">{device.re_onboard_status.progress_text}</Badge>}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="qc">QC/QA</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Device Info</CardTitle>
                {(() => {
                  const preQC = ['DRAFT', 'PENDING_QC'].includes(device.status);
                  const canEdit = (preQC && isInventory) || isSuperAdmin;
                  if (!canEdit || editing) return null;
                  return (
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditing(true); setEditData({ serial_number: device.serial_number, device_mac_id: device.device_mac_id || '', qr_number: device.qr_number || '' }); }}><Pencil className="w-3 h-3" /> Edit</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={async () => {
                        if (!window.confirm(`Delete device ${device.serial_number}? This cannot be undone.`)) return;
                        try { await api.delete(`/api/devices-module/devices/${id}`); toast.success('Device deleted'); navigate('/admin/devices'); } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed'); }
                      }}><Trash2 className="w-3 h-3" /> Delete</Button>
                    </div>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-4 gap-4 text-sm">
              {editing ? (
                <>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">Serial Number</p><Input value={editData.serial_number} onChange={e => setEditData(p => ({ ...p, serial_number: e.target.value.toUpperCase() }))} className="h-8 font-mono" /></div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">MAC ID</p><Input value={editData.device_mac_id} onChange={e => setEditData(p => ({ ...p, device_mac_id: e.target.value.toUpperCase() }))} className="h-8 font-mono" /></div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">QR Number</p><Input value={editData.qr_number} onChange={e => setEditData(p => ({ ...p, qr_number: e.target.value }))} className="h-8 font-mono" /></div>
                  <div className="flex items-end gap-2">
                    <Button size="sm" className="h-8" disabled={editSaving} onClick={async () => {
                      setEditSaving(true);
                      try { await api.put(`/api/devices-module/devices/${id}`, editData); toast.success('Device updated'); setEditing(false); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Update failed'); }
                      setEditSaving(false);
                    }}>{editSaving ? 'Saving...' : 'Save'}</Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <div><p className="text-xs text-muted-foreground">Serial Number</p><p className="font-mono font-medium">{device.serial_number}</p></div>
                  <div><p className="text-xs text-muted-foreground">Device Type</p><p>{device.device_type_name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Model</p><p>{device.model_number}</p></div>
                  {device.qr_number && <div><p className="text-xs text-muted-foreground">QR Number</p><p className="font-mono font-medium">{device.qr_number}</p></div>}
                  <div><p className="text-xs text-muted-foreground">MAC ID</p><p className="font-mono">{device.device_mac_id || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Current Round</p><p className="font-medium">{device.current_round || 1}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><DeviceStatusBadge status={device.status} /></div>
                  <div><p className="text-xs text-muted-foreground">Created</p><p>{device.created_at ? new Date(device.created_at).toLocaleString() : '-'}</p></div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Status Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-3">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {(device.status_history || []).map((h, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-background ${i === (device.status_history?.length || 0) - 1 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    <div className="flex items-center gap-2"><DeviceStatusBadge status={h.status} /></div>
                    <p className="text-xs text-muted-foreground">{h.actor} — {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}{h.notes ? ` — ${h.notes}` : ''}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab — grouped by round */}
        <TabsContent value="images" className="mt-4 space-y-4">
          {rounds.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <Button variant={activeRound === null ? 'default' : 'outline'} size="sm" onClick={() => setActiveRound(null)}>
                All Rounds
              </Button>
              {rounds.map(r => (
                <Button key={r} variant={activeRound === r ? 'default' : 'outline'} size="sm" onClick={() => setActiveRound(r)}>
                  {r === currentRound && device.status === 'RETURNED_TO_INVENTORY'
                    ? 'Return Images (Current)'
                    : r === currentRound
                    ? `Re-Packaging ${r} (Current)`
                    : r === 1 ? 'Initial Packaging' : `Re-Packaging ${r}`}
                </Button>
              ))}
            </div>
          )}

          {/* Add New Image Batch button — when current round has 6 images */}
          {canUploadImages && device.status === 'PACKAGING' && (() => {
            const curRoundMedia = (device.onboarding_media_by_round || {})[currentRound] || [];
            const curCats = new Set(curRoundMedia.map(m => m.category));
            return curCats.size >= 6;
          })() && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
              try {
                await api.post(`/api/devices-module/devices/${id}/new-image-batch`);
                toast.success('New image batch created');
                load();
              } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
            }}>
              <Plus className="w-3.5 h-3.5" /> New Image Batch
            </Button>
          )}

          {rounds.map(roundNum => {
            if (activeRound !== null && activeRound !== roundNum) return null;
            const roundMedia = (device.onboarding_media_by_round || {})[roundNum] || [];
            const roundMediaMap = {};
            for (const m of roundMedia) roundMediaMap[m.category] = m;

            return (
              <Card key={roundNum}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    {roundNum === currentRound && device.status === 'RETURNED_TO_INVENTORY'
                      ? 'Return Images'
                      : roundNum === currentRound
                      ? (roundNum === 1 ? 'Current Packaging' : `Re-Packaging ${roundNum} (Current)`)
                      : (roundNum === 1 ? 'Initial Packaging' : `Re-Packaging ${roundNum}`)}
                    <span className="text-xs text-muted-foreground font-normal">({new Set(roundMedia.map(m => m.category)).size}/{ONBOARDING_CATEGORIES.length})</span>
                    {roundNum === currentRound && <Badge variant="outline" className="text-[10px]">Current</Badge>}
                    {roundNum !== currentRound && roundMedia[0]?.uploaded_at && (
                      <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                        {new Date(roundMedia[0].uploaded_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {ONBOARDING_CATEGORIES.map(cat => {
                      // Get ALL images for this category in this round (append-only = may be multiple)
                      const catImages = roundMedia.filter(m => m.category === cat.key);
                      const hasImage = catImages.length > 0;
                      const isCurrentRound = roundNum === (device.current_round || 1);
                      return (
                        <div key={cat.key} className={`border-2 rounded-xl overflow-hidden ${hasImage ? 'border-emerald-200 bg-emerald-50/20' : 'border-dashed border-border'}`}>
                          {hasImage ? (
                            <div className="relative group">
                              <img src={`${BACKEND}${catImages[catImages.length - 1].file_url}`} alt={cat.label} className="w-full h-28 object-cover" />
                              {/* Delete button — only during active packaging/return upload on current round */}
                              {canDeleteImages && isCurrentRound && (
                                <button onClick={async () => {
                                  const imgId = catImages[catImages.length - 1]._id;
                                  try { await api.delete(`/api/devices-module/onboarding-media/${imgId}`); toast.success(`${cat.label} deleted`); load(); } catch { toast.error('Delete failed'); }
                                }} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 className="w-3 h-3" /></button>
                              )}
                              <div className="p-2">
                                <p className="text-[10px] font-medium text-emerald-700">{cat.label} <CheckCircle className="w-3 h-3 inline" /></p>
                                {cat.hint && <p className="text-[9px] text-muted-foreground/70 italic leading-tight">{cat.hint}</p>}
                                <p className="text-[10px] text-muted-foreground">{catImages.length} image(s)</p>
                                {/* Show all images if multiple */}
                                {catImages.length > 1 && (
                                  <div className="flex gap-1 mt-1 overflow-x-auto">
                                    {catImages.map((m, idx) => (
                                      <a key={m._id} href={`${BACKEND}${m.file_url}`} target="_blank" rel="noreferrer">
                                        <img src={`${BACKEND}${m.file_url}`} alt={`${cat.label} ${idx+1}`} className="w-8 h-8 object-cover rounded border shrink-0" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {canUploadImages && isCurrentRound && (
                                  <label className="text-[10px] text-primary underline mt-1 cursor-pointer">Add more<input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async (e) => {
                                    const file = e.target.files[0]; if (!file) return;
                                    const fd = new FormData(); fd.append('category', cat.key); fd.append('file', file);
                                    try { await api.post(`/api/devices-module/devices/${id}/onboarding-media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Uploaded'); load(); setSlotAiResults(prev => { const n = {...prev}; delete n[cat.key]; return n; }); runSlotAiQc(cat.key); } catch { toast.error('Failed'); }
                                    e.target.value = '';
                                  }} /></label>
                                )}
                                {/* Per-slot AI QC button */}
                                {['PACKAGING', 'READY_TO_SHIP'].includes(device.status) && (
                                  <div className="mt-1.5">
                                    <button onClick={() => runSlotAiQc(cat.key)} disabled={slotAiLoading[cat.key]} className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors" data-testid={`ai-qc-${cat.key}`}>
                                      {slotAiLoading[cat.key] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                      {slotAiLoading[cat.key] ? 'Analyzing...' : 'AI QC'}
                                    </button>
                                    {slotAiResults[cat.key] && (
                                      <div className={`mt-1 text-[9px] leading-relaxed p-1.5 rounded border whitespace-pre-wrap ${slotAiResults[cat.key].includes('PASS') && !slotAiResults[cat.key].includes('MISMATCH') && !slotAiResults[cat.key].includes('FAIL') && !slotAiResults[cat.key].includes('UNREADABLE') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : slotAiResults[cat.key].includes('FAIL') || slotAiResults[cat.key].includes('MISMATCH') || slotAiResults[cat.key].includes('UNREADABLE') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                        {slotAiResults[cat.key]}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full min-h-[140px] flex flex-col items-center justify-center p-3 text-center">
                              {canUploadImages && isCurrentRound ? (
                                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                                  {uploading[cat.key] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /> : <Upload className="w-6 h-6 text-muted-foreground/40 mb-1" />}
                                  <p className="text-xs font-medium text-muted-foreground">{cat.label}</p>
                                  {cat.hint && <p className="text-[9px] text-muted-foreground/60 italic leading-tight mt-0.5">{cat.hint}</p>}
                                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async (e) => {
                                    const file = e.target.files[0]; if (!file) return;
                                    setUploading(prev => ({ ...prev, [cat.key]: true }));
                                    const fd = new FormData(); fd.append('category', cat.key); fd.append('file', file);
                                    try {
                                      const res = await api.post(`/api/devices-module/devices/${id}/onboarding-media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                      toast.success(`${cat.label} uploaded`);
                                      if (res.data?.auto_ready_to_ship) toast.success('All images complete — moved to Ready to Ship!');
                                      else if (res.data?.auto_submitted_to_qc) toast.success('All images uploaded — auto-submitted to QC!');
                                      load();
                                      // Clear previous result and auto-trigger AI QC
                                      setSlotAiResults(prev => { const n = {...prev}; delete n[cat.key]; return n; });
                                      runSlotAiQc(cat.key);
                                    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
                                    setUploading(prev => ({ ...prev, [cat.key]: false }));
                                    e.target.value = '';
                                  }} />
                                </label>
                              ) : (
                                <>
                                  <Camera className="w-6 h-6 text-muted-foreground/20 mb-1" />
                                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                                  {cat.hint && <p className="text-[9px] text-muted-foreground/50 italic leading-tight mt-0.5">{cat.hint}</p>}
                                  <p className="text-[10px] text-muted-foreground/50">Not uploaded</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {rounds.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No images uploaded yet</CardContent></Card>
          )}

          {/* AI Packaging QC — shown when device is in PACKAGING or later */}
          {['PACKAGING', 'READY_TO_SHIP', 'ALLOCATED', 'SHIPPED', 'DELIVERED'].includes(device.status) && (() => {
            const totalSlots = ONBOARDING_CATEGORIES.length;
            const analyzedSlots = ONBOARDING_CATEGORIES.filter(c => slotAiResults[c.key]).length;
            const passedSlots = ONBOARDING_CATEGORIES.filter(c => {
              const r = slotAiResults[c.key];
              return r && r.includes('PASS') && !r.includes('FAIL') && !r.includes('MISMATCH') && !r.includes('UNREADABLE');
            }).length;
            const failedSlots = ONBOARDING_CATEGORIES.filter(c => {
              const r = slotAiResults[c.key];
              return r && (r.includes('FAIL') || r.includes('MISMATCH') || r.includes('UNREADABLE'));
            });
            const allPassed = passedSlots === totalSlots;
            const hasFails = failedSlots.length > 0;

            return (
              <Card className={`border-2 ${allPassed ? 'border-emerald-300 bg-emerald-50/30' : hasFails ? 'border-red-200 bg-red-50/20' : 'border-indigo-200 bg-indigo-50/20'}`} data-testid="ai-packaging-qc">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" /> AI Packaging QC</CardTitle>
                    <Badge variant="outline" className={`text-xs ${allPassed ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : hasFails ? 'bg-red-100 text-red-700 border-red-300' : 'text-muted-foreground'}`}>
                      {analyzedSlots}/{totalSlots} analyzed {allPassed ? '— ALL PASSED' : hasFails ? `— ${failedSlots.length} FAILED` : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Per-slot results summary */}
                  {analyzedSlots > 0 && (
                    <div className="space-y-2">
                      {ONBOARDING_CATEGORIES.map(cat => {
                        const result = slotAiResults[cat.key];
                        if (!result) return (
                          <div key={cat.key} className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" /> {cat.label} — Pending (upload image to trigger AI QC)
                          </div>
                        );
                        const isPassed = result.includes('PASS') && !result.includes('FAIL') && !result.includes('MISMATCH') && !result.includes('UNREADABLE');
                        return (
                          <div key={cat.key} className={`p-3 rounded-lg border text-xs ${isPassed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {isPassed ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] font-bold">X</span>}
                              <span className="font-semibold">{cat.label}</span>
                              <Badge className={`text-[8px] ml-auto ${isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{isPassed ? 'PASS' : 'FAIL'}</Badge>
                            </div>
                            <pre className="whitespace-pre-wrap text-[10px] leading-relaxed mt-1">{result}</pre>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {analyzedSlots === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">Upload packaging images above — AI QC runs automatically on each upload.</p>
                  )}

                  {/* Ready to Ship button — only when ALL 6 slots pass */}
                  {device.status === 'PACKAGING' && (
                    <div className="pt-3 border-t">
                      {allPassed ? (
                        <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
                          try { await api.post(`/api/devices-module/devices/${id}/mark-ready-to-ship`); toast.success('Device marked Ready to Ship!'); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
                        }} data-testid="ai-ready-to-ship-btn">
                          <Truck className="w-4 h-4" /> Mark Ready to Ship
                        </Button>
                      ) : hasFails ? (
                        <div className="text-center py-2">
                          <p className="text-xs text-red-600 font-medium">Cannot proceed — {failedSlots.length} slot(s) failed AI QC</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Re-upload failed images to re-trigger analysis</p>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-xs text-muted-foreground">Upload and pass AI QC for all {totalSlots} slots to enable "Ready to Ship"</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{totalSlots - analyzedSlots} slot(s) remaining</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* QC Tab */}
        <TabsContent value="qc" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">QC/QA Tests</CardTitle></CardHeader>
            <CardContent>
              {device.qc_tests?.length > 0 ? device.qc_tests.map(qt => (
                <div key={qt._id} className="border rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={qt.result === 'PASSED' ? 'bg-emerald-50 text-emerald-700' : qt.result === 'NONCONFORMING' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}>{qt.result || 'IN PROGRESS'}</Badge>
                    <span className="text-xs text-muted-foreground">{qt.started_at ? new Date(qt.started_at).toLocaleString() : ''}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Duration</p><p>{qt.test_duration_minutes ? `${qt.test_duration_minutes} min` : '-'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Tester</p><p>{qt.tester_email}</p></div>
                    <div><p className="text-xs text-muted-foreground">Runs</p><p>{qt.num_runs || '-'}</p></div>
                  </div>
                  {qt.nonconformance_reason && <p className="text-sm text-rose-700 mt-2">Reason: {qt.nonconformance_reason}</p>}
                  {qt.notes && <p className="text-sm text-muted-foreground mt-1">Notes: {qt.notes}</p>}
                  {qt.artifacts?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium mb-2">Artifacts & Evidence</p>
                      {qt.artifacts.filter(a => a.type === 'EDF').map(a => (
                        <div key={a._id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg mb-2">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0"><span className="text-[10px] font-bold text-primary">EDF</span></div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{a.file_name}</p></div>
                          <Button variant="outline" size="sm" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/5" onClick={() => setEcgViewerArtifact(a)}>
                            <Activity className="w-3 h-3 mr-1" /> View ECG
                          </Button>
                          <a href={`${BACKEND}${a.file_url}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline shrink-0">Download</a>
                        </div>
                      ))}
                      {qt.artifacts.filter(a => a.type === 'IMAGE').length > 0 && (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                          {qt.artifacts.filter(a => a.type === 'IMAGE').map(a => (
                            <a key={a._id} href={`${BACKEND}${a.file_url}`} target="_blank" rel="noreferrer" className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                              <img src={`${BACKEND}${a.file_url}`} alt={a.file_name} className="w-full h-20 object-cover" />
                              <p className="text-[10px] p-1 truncate text-muted-foreground">{a.file_name}</p>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )) : <p className="text-sm text-muted-foreground">No QC tests yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(device.audit_trail || []).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span className="font-medium">{a.action?.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground">{a.actor_email}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                  </div>
                ))}
                {(!device.audit_trail || device.audit_trail.length === 0) && <p className="text-sm text-muted-foreground">No audit entries</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Device</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Device Type</Label>
              <Select value={editType} onValueChange={v => { setEditType(v); setEditModel(''); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={editModel} onValueChange={setEditModel}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{models.filter(m => m.device_type_id === editType).map(m => <SelectItem key={m._id} value={m._id}>{m.model_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={saveEdit}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ECG Viewer */}
      {ecgViewerArtifact && (
        <ECGViewer
          artifactId={ecgViewerArtifact._id}
          fileName={ecgViewerArtifact.file_name}
          api={api}
          onClose={() => setEcgViewerArtifact(null)}
        />
      )}
    </div>
  );
}
