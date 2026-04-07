import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import DataTable from '../../../components/DataTable';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, Eye, CheckCircle, AlertTriangle, Clock, CalendarClock } from 'lucide-react';
import { DeviceStatusBadge } from './DevicesList';

export default function MarketingReadyToShip() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [allocDialog, setAllocDialog] = useState(false);
  const [allocForm, setAllocForm] = useState({ allocated_to_type: 'DISTRIBUTOR', allocated_to_id: '', allocated_to_name: '', contact_name: '', contact_phone: '', contact_email: '', notes: '', shipping_address: { address_line1: '', city: '', state: '', postal_code: '', country: 'India' } });
  const [distributors, setDistributors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  // Readiness alerts
  const [readiness, setReadiness] = useState(null);
  const [prepDialog, setPrepDialog] = useState(false);
  const [prepForm, setPrepForm] = useState({ device_count: '', deadline: '', entity_name: '', entity_type: 'distributor', notes: '' });
  const [prepSubmitting, setPrepSubmitting] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const [devRes, distRes, readRes] = await Promise.all([
        api.get('/api/devices-module/marketing/ready-to-ship'),
        api.get('/api/distributors').catch(() => ({ data: [] })),
        api.get('/api/device-readiness').catch(() => ({ data: null })),
      ]);
      setDevices(devRes.data);
      setDistributors(distRes.data);
      if (readRes.data) setReadiness(readRes.data);
    } catch (err) {}
    setLoading(false);
  };

  const submitPrepRequest = async () => {
    if (!prepForm.device_count || !prepForm.entity_name) { toast.error('Device count and entity name required'); return; }
    setPrepSubmitting(true);
    try {
      await api.post('/api/prep-requests', prepForm);
      toast.success('Prep request sent to Inventory!');
      setPrepDialog(false);
      setPrepForm({ device_count: '', deadline: '', entity_name: '', entity_type: 'distributor', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setPrepSubmitting(false);
  };

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    if (selected.size === devices.length) setSelected(new Set());
    else setSelected(new Set(devices.map(d => d._id)));
  };

  const openAllocDialog = (selectedIds) => {
    const ids = Array.isArray(selectedIds) ? selectedIds : [...(selectedIds || [])];
    if (!ids || ids.length === 0) { toast.error('Select at least one device'); return; }
    setSelected(new Set(ids));
    setAllocDialog(true);
  };

  const submitAllocation = async () => {
    if (!allocForm.allocated_to_name.trim()) { toast.error('Distributor/Hospital name required'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/devices-module/allocations', { ...allocForm, device_unit_ids: Array.from(selected) });
      toast.success(`${selected.size} devices allocated! Ship request created.`);
      setAllocDialog(false);
      setSelected(new Set());
      setAllocForm({ allocated_to_type: 'DISTRIBUTOR', allocated_to_id: '', allocated_to_name: '', contact_name: '', contact_phone: '', contact_email: '', notes: '', shipping_address: { address_line1: '', city: '', state: '', postal_code: '', country: 'India' } });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Allocation failed'); }
    setSubmitting(false);
  };

  const selectDistributor = (distId) => {
    const dist = distributors.find(d => d._id === distId);
    if (dist) {
      const update = {
        ...allocForm,
        allocated_to_id: distId,
        allocated_to_name: dist.company_name || `${dist.first_name} ${dist.last_name}`,
        contact_name: `${dist.first_name} ${dist.last_name}`,
        contact_email: dist.email,
        contact_phone: dist.mobile || '',
      };
      setAllocForm(update);
      // Fetch distributor's form data to get saved address
      api.get(`/api/distributors/${distId}`).then(res => {
        const form = res.data?.form_submission?.data;
        if (form) {
          setAllocForm(prev => ({
            ...prev,
            shipping_address: {
              address_line1: form.registered_address || form.communication_address || prev.shipping_address.address_line1,
              city: form.city || prev.shipping_address.city,
              state: form.state || prev.shipping_address.state,
              postal_code: form.pincode || prev.shipping_address.postal_code,
              country: form.country || prev.shipping_address.country || 'India',
            },
            contact_phone: form.phone || dist.mobile || prev.contact_phone,
          }));
        }
      }).catch(() => {});
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Shipment Request</h1><p className="text-sm text-muted-foreground">{devices.length} devices available for allocation</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPrepDialog(true)}><CalendarClock className="w-4 h-4 mr-2" /> Request Devices</Button>
          <Button onClick={openAllocDialog} disabled={selected.size === 0}><Truck className="w-4 h-4 mr-2" /> Allocate {selected.size > 0 ? `(${selected.size})` : ''}</Button>
        </div>
      </div>

      {/* Device Readiness Alert */}
      {readiness?.is_low && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-800">Low Ready-to-Ship Inventory</p>
                <p className="text-xs text-amber-700 mt-1">
                  <span className="font-mono font-bold">{readiness.ready_to_ship}</span> devices available vs <span className="font-mono font-bold">{readiness.combined_demand}</span> total demand — shortfall of <span className="font-mono font-bold text-red-600">{readiness.shortfall}</span> devices
                </p>
                {readiness.demand_breakdown?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {readiness.demand_breakdown.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                        <Badge variant="outline" className="text-[9px]">{item.type}</Badge>
                        <span className="font-medium">{item.name}</span>
                        <span>needs <strong>{item.recommended}</strong></span>
                        {item.shipped > 0 && <Badge className="text-[8px] bg-emerald-100 text-emerald-700 border-emerald-300">shipped: {item.shipped}</Badge>}
                        <span className="text-amber-500">remaining: <strong>{item.pending}</strong></span>
                      </div>
                    ))}
                  </div>
                )}
                {readiness.pending_preps?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <p className="text-[10px] font-medium text-amber-800">Pending Prep Requests:</p>
                    {readiness.pending_preps.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-700 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{p.device_count} devices for {p.entity_name}</span>
                        {p.deadline && <span className="text-amber-500">by {p.deadline}</span>}
                        <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {readiness && !readiness.is_low && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle className="w-4 h-4" />
            <span>Inventory healthy: <strong>{readiness.ready_to_ship}</strong> devices ready, <strong>{readiness.combined_demand}</strong> demand</span>
          </CardContent>
        </Card>
      )}

      <DataTable
        testId="ready-to-ship-table"
        columns={[
          { key: 'serial_number', label: 'Serial Number', render: (v) => <span className="font-mono font-medium">{v}</span> },
          { key: 'device_type_name', label: 'Device Type' },
          { key: 'model_number', label: 'Model' },
          { key: '_qc', label: 'QC Status', render: (_, d) => d.qc_test ? <Badge className="bg-emerald-50 text-emerald-700 text-xs">Passed</Badge> : <span className="text-muted-foreground">-</span> },
          { key: '_images', label: 'Images', render: (_, d) => <span className="text-muted-foreground">{d.onboarding_media?.length || 0}/6</span> },
          { key: '_view', label: '', sortable: false, width: '40px', render: (_, d) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/admin/devices/${d._id}`); }}><Eye className="w-3 h-3" /></Button> },
        ]}
        data={devices}
        loading={loading}
        selectable
        bulkActions={[
          { label: 'Allocate Selected', onClick: openAllocDialog, variant: 'default' },
        ]}
        searchFields={['serial_number', 'device_type_name', 'model_number']}
        searchPlaceholder="Search devices..."
        emptyMessage="No devices ready to ship"
        onRefresh={load}
        exportable
        exportFilename="ready_to_ship"
      />

      {/* Allocation Dialog */}
      <Dialog open={allocDialog} onOpenChange={setAllocDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Allocate {selected.size} Device(s)</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Select Distributor</Label>
              <Select value={allocForm.allocated_to_id || '_manual'} onValueChange={v => { if (v === '_manual') { setAllocForm({...allocForm, allocated_to_id: '', allocated_to_name: '', contact_name: '', contact_email: '', contact_phone: ''}); } else { selectDistributor(v); } }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select or enter manually" /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto z-[9999]">
                  <SelectItem value="_manual">-- Enter manually --</SelectItem>
                  {distributors.map(d => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.company_name || `${d.first_name} ${d.last_name}`} ({d.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Name <span className="text-red-500">*</span></Label><Input value={allocForm.allocated_to_name} onChange={e => setAllocForm({...allocForm, allocated_to_name: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-xs">Contact</Label><Input value={allocForm.contact_name} onChange={e => setAllocForm({...allocForm, contact_name: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={allocForm.contact_phone} onChange={e => setAllocForm({...allocForm, contact_phone: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={allocForm.contact_email} onChange={e => setAllocForm({...allocForm, contact_email: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Shipping Address</Label><Input value={allocForm.shipping_address.address_line1} onChange={e => setAllocForm({...allocForm, shipping_address: {...allocForm.shipping_address, address_line1: e.target.value}})} placeholder="Address line" /></div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={allocForm.shipping_address.city} onChange={e => setAllocForm({...allocForm, shipping_address: {...allocForm.shipping_address, city: e.target.value}})} placeholder="City" />
              <Input value={allocForm.shipping_address.state} onChange={e => setAllocForm({...allocForm, shipping_address: {...allocForm.shipping_address, state: e.target.value}})} placeholder="State" />
              <Input value={allocForm.shipping_address.postal_code} onChange={e => setAllocForm({...allocForm, shipping_address: {...allocForm.shipping_address, postal_code: e.target.value}})} placeholder="PIN" />
            </div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea value={allocForm.notes} onChange={e => setAllocForm({...allocForm, notes: e.target.value})} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={submitAllocation} disabled={submitting}>{submitting ? 'Creating...' : 'Create Allocation + Ship Request'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prep Request Dialog */}
      <Dialog open={prepDialog} onOpenChange={setPrepDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5" /> Request Devices to be Ready</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Create a prep request for Inventory to prepare devices before an onboarding completes.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Device Count <span className="text-red-500">*</span></Label><Input type="number" min="1" value={prepForm.device_count} onChange={e => setPrepForm({...prepForm, device_count: parseInt(e.target.value) || ''})} /></div>
              <div className="space-y-1"><Label className="text-xs">Deadline</Label><Input type="date" value={prepForm.deadline} onChange={e => setPrepForm({...prepForm, deadline: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">For Distributor/Hospital <span className="text-red-500">*</span></Label><Input value={prepForm.entity_name} onChange={e => setPrepForm({...prepForm, entity_name: e.target.value})} placeholder="Entity name" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Entity Type</Label>
              <Select value={prepForm.entity_type} onValueChange={v => setPrepForm({...prepForm, entity_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="distributor">Distributor</SelectItem><SelectItem value="hospital">Hospital</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea value={prepForm.notes} onChange={e => setPrepForm({...prepForm, notes: e.target.value})} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={submitPrepRequest} disabled={prepSubmitting}>{prepSubmitting ? 'Sending...' : 'Send to Inventory'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
