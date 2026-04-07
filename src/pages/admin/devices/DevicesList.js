import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import DataTable from '../../../components/DataTable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Separator } from '../../../components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Plus, Package, ChevronRight, AlertTriangle, Clock, CheckCircle, CalendarClock, ArrowRight, Trash2, Settings, Save } from 'lucide-react';

const STATUS_COLORS = {
  DRAFT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PENDING_QC: 'bg-amber-50 text-amber-700 border-amber-200',
  QC_IN_PROGRESS: 'bg-purple-50 text-purple-700 border-purple-200',
  QC_PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NONCONFORMING: 'bg-rose-50 text-rose-700 border-rose-200',
  PACKAGING: 'bg-orange-50 text-orange-700 border-orange-200',
  READY_TO_SHIP: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ALLOCATED: 'bg-purple-50 text-purple-700 border-purple-200',
  SHIP_REQUESTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SHIPPED: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURN_REQUESTED: 'bg-orange-50 text-orange-700 border-orange-200',
  RETURN_IN_TRANSIT: 'bg-amber-50 text-amber-700 border-amber-200',
  RETURNED_TO_INVENTORY: 'bg-slate-50 text-slate-700 border-slate-200',
};

const STATUS_DISPLAY = {
  DRAFT: 'ONBOARDING',
};

export function DeviceStatusBadge({ status }) {
  const displayName = STATUS_DISPLAY[status] || (status || '').replace(/_/g, ' ');
  return <Badge variant="outline" className={`text-xs ${STATUS_COLORS[status] || 'bg-slate-50 text-slate-700'}`}>{displayName}</Badge>;
}

export default function DevicesList() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [prepRequests, setPrepRequests] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseCount, setRaiseCount] = useState('');
  const [raising, setRaising] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const [devRes, statRes, prepRes, readRes] = await Promise.all([
        api.get('/api/devices-module/devices'),
        api.get('/api/devices-module/dashboard-stats'),
        api.get('/api/prep-requests').catch(() => ({ data: [] })),
        api.get('/api/device-readiness').catch(() => ({ data: null })),
      ]);
      setDevices(devRes.data);
      setStats(statRes.data);
      setPrepRequests(prepRes.data.filter(p => p.status !== 'completed'));
      if (readRes.data) setReadiness(readRes.data);
    } catch (err) {}
    setLoading(false);
  };

  const updatePrepStatus = async (reqId, newStatus) => {
    try {
      await api.put(`/api/prep-requests/${reqId}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      load();
    } catch (err) { toast.error('Failed'); }
  };

  const raiseOnboard = async () => {
    const n = parseInt(raiseCount);
    if (!n || n <= 0) { toast.error('Enter a valid number'); return; }
    setRaising(true);
    try {
      const res = await api.post('/api/devices-module/raise-onboard-count', { count: n });
      toast.success(`Onboard count raised to ${res.data.count}`);
      setRaiseOpen(false); setRaiseCount('');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setRaising(false);
  };

  const filtered = devices.filter(d => {
    const matchSearch = !search || d.serial_number?.toLowerCase().includes(search.toLowerCase()) || d.mac_id?.toLowerCase().includes(search.toLowerCase()) || d.device_type_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const canCreate = ['inventory_admin', 'super_admin'].includes(user?.role);
  const isInventory = ['inventory_admin', 'super_admin'].includes(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';

  // Device Config dialog state (super_admin only)
  const [configOpen, setConfigOpen] = useState(false);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [deviceModels, setDeviceModels] = useState([]);
  const [serialFormat, setSerialFormat] = useState({ format_type: 'none', length: 0 });
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newModelNum, setNewModelNum] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelTypeId, setNewModelTypeId] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const loadDeviceConfig = async () => {
    try {
      const [t, m, f] = await Promise.all([
        api.get('/api/devices-module/device-types'),
        api.get('/api/devices-module/device-models'),
        api.get('/api/devices-module/serial-format'),
      ]);
      setDeviceTypes(t.data || []);
      setDeviceModels(m.data || []);
      setSerialFormat(f.data || { format_type: 'none', length: 0 });
    } catch {}
  };
  const openConfig = () => { loadDeviceConfig(); setConfigOpen(true); };
  const addDeviceName = async () => {
    if (!newDeviceName.trim()) return;
    setSavingConfig(true);
    try { await api.post('/api/devices-module/device-types', { name: newDeviceName.trim() }); toast.success('Device name added'); setNewDeviceName(''); loadDeviceConfig(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSavingConfig(false);
  };
  const deleteDeviceName = async (id) => {
    if (!window.confirm('Delete this device name and its models?')) return;
    try { await api.delete(`/api/devices-module/device-types/${id}`); toast.success('Deleted'); loadDeviceConfig(); } catch (e) { toast.error(e.response?.data?.detail || 'Cannot delete'); }
  };
  const addModel = async () => {
    if (!newModelNum.trim() || !newModelTypeId) return;
    setSavingConfig(true);
    try { await api.post('/api/devices-module/device-models', { device_type_id: newModelTypeId, model_number: newModelNum.trim(), description: newModelDesc.trim() }); toast.success('Model added'); setNewModelNum(''); setNewModelDesc(''); loadDeviceConfig(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSavingConfig(false);
  };
  const deleteModel = async (id) => {
    if (!window.confirm('Delete this model?')) return;
    try { await api.delete(`/api/devices-module/device-models/${id}`); toast.success('Deleted'); loadDeviceConfig(); } catch (e) { toast.error(e.response?.data?.detail || 'Cannot delete'); }
  };
  const saveSerialFormat = async () => {
    setSavingConfig(true);
    try { await api.put('/api/devices-module/serial-format', serialFormat); toast.success('Serial format saved'); } catch { toast.error('Failed'); }
    setSavingConfig(false);
  };

  const canDelete = ['marketing_admin', 'marketing_associate', 'super_admin'].includes(user?.role);
  const canManagePrep = isInventory || canDelete;

  const deletePrepRequest = async (reqId) => {
    if (!window.confirm('Delete this device request?')) return;
    try { await api.delete(`/api/prep-requests/${reqId}`); toast.success('Request deleted'); load(); } catch (err) { toast.error('Failed'); }
  };

  const PREP_STATUS_STYLE = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Device Inventory</h1><p className="text-sm text-muted-foreground mt-1">{stats.total || 0} total devices</p></div>
        <div className="flex gap-2">
          {isSuperAdmin && <Button variant="outline" onClick={() => setRaiseOpen(true)} data-testid="raise-onboard-btn" title="Raise Onboard Count"><Plus className="w-4 h-4 mr-1" /> Raise Onboard</Button>}
          {isSuperAdmin && <Button variant="outline" onClick={openConfig} data-testid="device-config-btn" title="Device Configuration"><Settings className="w-4 h-4" /></Button>}
          {canCreate && <Button onClick={() => navigate('/admin/devices/new')}><Plus className="w-4 h-4 mr-2" /> Onboard Device</Button>}
        </div>
      </div>

      {/* Prep Requests (visible to Inventory + Marketing/Super Admin) */}
      {canManagePrep && prepRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-sm text-amber-800">Device Prep Requests ({prepRequests.length})</h3>
              <Badge className="bg-red-500 text-white text-[10px] ml-1">HIGH PRIORITY</Badge>
            </div>
            <div className="space-y-2">
              {prepRequests.map(req => (
                <div key={req._id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-amber-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{req.device_count} device(s)</span>
                      <span className="text-xs text-muted-foreground">for</span>
                      <span className="text-sm font-medium">{req.entity_name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{req.entity_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {req.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Deadline: <strong>{req.deadline}</strong></span>}
                      <span>Requested by: {req.requested_by_email}</span>
                      {req.notes && <span>— {req.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${PREP_STATUS_STYLE[req.status] || ''}`}>{req.status === 'in_progress' ? 'In Progress' : req.status}</Badge>
                    {isInventory && req.status === 'pending' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updatePrepStatus(req._id, 'in_progress')}>
                        <ArrowRight className="w-3 h-3 mr-1" /> Start
                      </Button>
                    )}
                    {isInventory && req.status === 'in_progress' && (
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => updatePrepStatus(req._id, 'completed')}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Done
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deletePrepRequest(req._id)} title="Delete request">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Readiness Alert */}
      {isInventory && readiness?.is_low && (
        <Card className="border-red-300 bg-red-50/50">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Low Ready-to-Ship Inventory</p>
              <p className="text-xs text-red-700"><span className="font-mono font-bold">{readiness.ready_to_ship}</span> ready vs <span className="font-mono font-bold">{readiness.combined_demand}</span> demand — <span className="font-bold">{readiness.shortfall} device shortfall</span></p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/devices/new')} className="shrink-0"><Plus className="w-3 h-3 mr-1" /> Onboard Devices</Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-2">
        {['DRAFT','PENDING_QC','PACKAGING','READY_TO_SHIP','SHIPPED','DELIVERED','RETURNED_TO_INVENTORY'].map(s => (
          <Card key={s} className="cursor-pointer device-shimmer-card" onClick={() => setStatusFilter(s)}
            onMouseMove={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--shimmer-x', `${e.clientX - rect.left}px`);
              e.currentTarget.style.setProperty('--shimmer-y', `${e.clientY - rect.top}px`);
            }}>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{s === 'DRAFT' ? (stats.onboard_count || stats[s] || 0) : (stats[s] || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{STATUS_DISPLAY[s] || s.replace(/_/g, ' ')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <DataTable
        testId="devices-table"
        columns={[
          { key: 'serial_number', label: 'Serial Number', render: (v) => <span className="font-mono font-medium">{v}</span> },
          { key: 'device_type_name', label: 'Device Type' },
          { key: 'model_number', label: 'Model' },
          { key: 'status', label: 'Status', render: (v) => <DeviceStatusBadge status={v} /> },
          { key: 'onboarding_image_count', label: 'Images', render: (v) => <span className="text-muted-foreground">{v}/6</span> },
          { key: 'created_at', label: 'Created', render: (v) => <span className="text-muted-foreground">{v ? new Date(v).toLocaleDateString() : ''}</span> },
          { key: '_nav', label: '', sortable: false, width: '40px', render: () => <ChevronRight className="w-4 h-4 text-muted-foreground" /> },
        ]}
        data={devices}
        loading={loading}
        searchFields={['serial_number', 'mac_id', 'device_type_name', 'model_number']}
        searchPlaceholder="Search serial number, MAC, model..."
        statusOptions={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: STATUS_DISPLAY[s] || s.replace(/_/g, ' ') }))}
        statusField="status"
        emptyMessage="No devices found"
        onRowClick={(d) => navigate(`/admin/devices/${d._id}`)}
        onRefresh={load}
        exportable
        exportFilename="device_inventory"
      />

      {/* Device Configuration Dialog (Super Admin only) */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Settings className="w-4 h-4" /> Device Configuration</DialogTitle>
            <p className="text-xs text-muted-foreground">Manage device names, models, and serial number format.</p>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {/* Device Names */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Device Names</Label>
              <div className="flex gap-2">
                <Input value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} placeholder="e.g., BeatX Pro Monitor" className="max-w-xs" data-testid="new-device-name-input" />
                <Button size="sm" onClick={addDeviceName} disabled={savingConfig || !newDeviceName.trim()} data-testid="add-device-name-btn"><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
              {deviceTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {deviceTypes.map(t => (
                    <Badge key={t._id} variant="secondary" className="gap-1.5 py-1 px-3 text-xs">
                      {t.name}
                      <button onClick={() => deleteDeviceName(t._id)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors" data-testid={`delete-type-${t._id}`}><Trash2 className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Model Numbers */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Model Numbers</Label>
              <div className="flex gap-2 flex-wrap">
                <Select value={newModelTypeId} onValueChange={setNewModelTypeId}>
                  <SelectTrigger className="w-44 h-9 text-xs" data-testid="model-type-select"><SelectValue placeholder="Select device" /></SelectTrigger>
                  <SelectContent>{deviceTypes.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={newModelNum} onChange={e => setNewModelNum(e.target.value)} placeholder="Model number" className="w-32 h-9 text-xs" data-testid="new-model-num-input" />
                <Button size="sm" className="h-9" onClick={addModel} disabled={savingConfig || !newModelNum.trim() || !newModelTypeId} data-testid="add-model-btn"><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
              {deviceModels.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead className="text-xs">Device</TableHead><TableHead className="text-xs">Model</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {deviceModels.map(m => (
                      <TableRow key={m._id}>
                        <TableCell className="text-xs">{deviceTypes.find(t => t._id === m.device_type_id)?.name || '—'}</TableCell>
                        <TableCell className="text-xs font-mono font-medium">{m.model_number}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteModel(m._id)} data-testid={`delete-model-${m._id}`}><Trash2 className="w-3 h-3 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <Separator />

            {/* Serial Number Format */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Serial Number Format</Label>
              <p className="text-[11px] text-muted-foreground">Define the format for serial numbers during device onboarding.</p>
              <div className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Format Type</Label>
                  <Select value={serialFormat.format_type} onValueChange={v => setSerialFormat(p => ({ ...p, format_type: v }))}>
                    <SelectTrigger className="w-44 h-9 text-xs" data-testid="serial-format-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Format (free text)</SelectItem>
                      <SelectItem value="numeric">Numeric Only</SelectItem>
                      <SelectItem value="alphanumeric">Alphanumeric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {serialFormat.format_type !== 'none' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Character Length</Label>
                    <Input type="number" min="1" max="50" value={serialFormat.length || ''} onChange={e => setSerialFormat(p => ({ ...p, length: parseInt(e.target.value) || 0 }))} className="w-24 h-9 text-xs" data-testid="serial-format-length" />
                  </div>
                )}
                <Button size="sm" className="h-9" onClick={saveSerialFormat} disabled={savingConfig} data-testid="save-serial-format-btn"><Save className="w-3 h-3 mr-1" /> Save</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Raise Onboard Count Dialog */}
      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Raise Onboard Count</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">Enter the number of devices expected to be onboarded. This adds to the current count.</p>
            <Input type="number" min="1" value={raiseCount} onChange={e => setRaiseCount(e.target.value)} placeholder="e.g., 100" className="text-center text-lg font-mono" autoFocus data-testid="raise-count-input" />
            <Button className="w-full" onClick={raiseOnboard} disabled={raising || !raiseCount} data-testid="raise-count-submit">{raising ? 'Saving...' : 'Raise Count'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
