import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import StatusBadge from '../../components/StatusBadge';
import { toast } from 'sonner';
import { Package, Truck, CheckCircle, ChevronRight, ChevronLeft, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function InventoryQueue() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocationDialog, setAllocationDialog] = useState(null);
  const [finalQty, setFinalQty] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Two-step shipment flow
  const [shipStep, setShipStep] = useState(0); // 0=closed, 1=select devices, 2=shipping details
  const [shipTarget, setShipTarget] = useState(null); // the queue item being shipped
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState(new Set());
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [shipForm, setShipForm] = useState({ carrier: '', tracking_number: '', ship_date: '', notes: '' });

  useEffect(() => { loadQueue(); }, []);

  const loadQueue = async () => {
    try { const res = await api.get('/api/inventory/queue'); setQueue(res.data); } catch (err) {}
    setLoading(false);
  };

  const confirmAllocation = async () => {
    if (!allocationDialog) return;
    setSubmitting(true);
    try {
      await api.post('/api/inventory/confirm', { allocation_id: allocationDialog.allocation._id, final_qty: finalQty, override_reason: overrideReason });
      toast.success('Allocation confirmed!');
      setAllocationDialog(null);
      loadQueue();
    } catch (err) { toast.error('Failed to confirm'); }
    setSubmitting(false);
  };

  // Step 1: Open device selection
  const openShipmentFlow = async (queueItem) => {
    setShipTarget(queueItem);
    setSelectedDevices(new Set());
    setShipForm({ carrier: '', tracking_number: '', ship_date: '', notes: '' });
    setLoadingDevices(true);
    setShipStep(1);
    try {
      // Fetch available ready-to-ship devices from device inventory
      const res = await api.get('/api/devices-module/devices?status=READY_TO_SHIP');
      setAvailableDevices(res.data);
    } catch (err) {
      setAvailableDevices([]);
    }
    setLoadingDevices(false);
  };

  const toggleDevice = (id) => {
    setSelectedDevices(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Step 2: Proceed to shipping details
  const proceedToShippingDetails = () => {
    if (selectedDevices.size === 0) { toast.error('Select at least one device'); return; }
    setShipStep(2);
  };

  // Create shipment with selected devices
  const createShipment = async () => {
    if (!shipTarget || !shipForm.tracking_number?.trim()) { toast.error('Tracking number is required'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/inventory/shipment', {
        distributor_id: shipTarget.distributor._id,
        carrier: shipForm.carrier,
        tracking_number: shipForm.tracking_number,
        ship_date: shipForm.ship_date,
        notes: shipForm.notes,
        device_serials: Array.from(selectedDevices),
      });
      toast.success(`Shipment created with ${selectedDevices.size} device(s)!`);
      setShipStep(0);
      setShipTarget(null);
      loadQueue();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create shipment'); }
    setSubmitting(false);
  };

  const closeShipment = () => { setShipStep(0); setShipTarget(null); };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Distributor Allocation</h1><p className="text-sm text-muted-foreground mt-1">Confirm allocations and create shipments</p></div>

      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : queue.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No items in allocation queue</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {queue.map(q => (
            <Card key={q.allocation._id} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{q.distributor?.first_name} {q.distributor?.last_name}</p>
                    <p className="text-sm text-muted-foreground">{q.distributor?.company_name}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <StatusBadge status={q.distributor?.status} />
                      <Badge variant="outline" className="text-xs">Recommended: {q.allocation.recommended_qty} devices</Badge>
                      {q.allocation.final_qty != null && <Badge variant="secondary" className="text-xs">Confirmed: {q.allocation.final_qty}</Badge>}
                      <Badge variant="outline" className="text-xs">{q.allocation.studies_per_month} studies/mo</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {q.allocation.status === 'pending' && (
                      <Button size="sm" onClick={() => { setAllocationDialog(q); setFinalQty(q.allocation.recommended_qty); }}><CheckCircle className="w-3 h-3 mr-1" /> Confirm Qty</Button>
                    )}
                    {q.allocation.status === 'confirmed' && !q.shipment && (
                      <Button size="sm" onClick={() => openShipmentFlow(q)}><Truck className="w-3 h-3 mr-1" /> Create Shipment</Button>
                    )}
                    {q.shipment && (
                      <div className="text-right">
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200"><Truck className="w-3 h-3 mr-1" /> Shipped</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{q.shipment.carrier} — {q.shipment.tracking_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Allocation Confirm Dialog */}
      <Dialog open={!!allocationDialog} onOpenChange={(o) => { if (!o) setAllocationDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Device Allocation</DialogTitle></DialogHeader>
          {allocationDialog && (
            <div className="space-y-4">
              <div className="text-sm"><p>Distributor: <strong>{allocationDialog.distributor?.company_name}</strong></p><p>Studies/month: <strong>{allocationDialog.allocation.studies_per_month}</strong></p><p>Recommended: <strong>{allocationDialog.allocation.recommended_qty} devices</strong> (incl. {allocationDialog.allocation.demo_buffer} demo buffer)</p></div>
              <div className="space-y-2"><Label>Final Quantity</Label><Input type="number" min="1" value={finalQty} onChange={e => setFinalQty(parseInt(e.target.value) || 0)} /></div>
              {finalQty !== allocationDialog.allocation.recommended_qty && (<div className="space-y-2"><Label>Override Reason (required)</Label><Textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Reason for changing quantity" /></div>)}
              <DialogFooter><Button onClick={confirmAllocation} disabled={submitting || (finalQty !== allocationDialog.allocation.recommended_qty && !overrideReason)}>Confirm Allocation</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Two-Step Shipment Dialog */}
      <Dialog open={shipStep > 0} onOpenChange={(o) => { if (!o) closeShipment(); }}>
        <DialogContent className="max-w-2xl">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center gap-1 text-xs font-medium ${shipStep === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${shipStep === 1 ? 'bg-primary text-white' : 'bg-emerald-100 text-emerald-700'}`}>{shipStep > 1 ? '✓' : '1'}</div>
              Select Devices
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center gap-1 text-xs font-medium ${shipStep === 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${shipStep === 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>2</div>
              Shipping Details
            </div>
          </div>

          {/* Step 1: Select Devices */}
          {shipStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Box className="w-5 h-5" /> Select Devices for {shipTarget?.distributor?.company_name || 'Distributor'}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">Confirmed allocation: <strong>{shipTarget?.allocation?.final_qty || shipTarget?.allocation?.recommended_qty} devices</strong>. Select devices from Shipment Request inventory.</p>
              <div className="max-h-[40vh] overflow-y-auto border rounded-lg">
                {loadingDevices ? <div className="flex justify-center p-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : availableDevices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No devices available for shipment</div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Serial</TableHead><TableHead>Device</TableHead><TableHead>Model</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {availableDevices.map(d => (
                        <TableRow key={d._id} className={selectedDevices.has(d._id) ? 'bg-primary/5' : ''}>
                          <TableCell><Checkbox checked={selectedDevices.has(d._id)} onCheckedChange={() => toggleDevice(d._id)} /></TableCell>
                          <TableCell className="font-mono text-sm">{d.serial_number}</TableCell>
                          <TableCell className="text-sm">{d.device_type_name}</TableCell>
                          <TableCell className="text-sm">{d.model_number}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm"><strong>{selectedDevices.size}</strong> device(s) selected</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeShipment}>Cancel</Button>
                  <Button onClick={proceedToShippingDetails} disabled={selectedDevices.size === 0}>Next: Shipping Details <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Shipping Details */}
          {shipStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5" /> Shipping Details</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">Shipping <strong>{selectedDevices.size} device(s)</strong> to <strong>{shipTarget?.distributor?.company_name}</strong></p>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Courier / Carrier <span className="text-red-500">*</span></Label><Input value={shipForm.carrier} onChange={e => setShipForm({...shipForm, carrier: e.target.value})} placeholder="e.g., FedEx, DHL, BlueDart" /></div>
                <div className="space-y-2"><Label>Tracking Number <span className="text-red-500">*</span></Label><Input value={shipForm.tracking_number} onChange={e => setShipForm({...shipForm, tracking_number: e.target.value})} placeholder="Enter tracking / AWB number" /></div>
                <div className="space-y-2"><Label>Ship Date</Label><Input type="date" value={shipForm.ship_date} onChange={e => setShipForm({...shipForm, ship_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={shipForm.notes} onChange={e => setShipForm({...shipForm, notes: e.target.value})} rows={2} /></div>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setShipStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button onClick={createShipment} disabled={submitting || !shipForm.tracking_number?.trim() || !shipForm.carrier?.trim()}>
                  {submitting ? 'Creating...' : 'Confirm Shipment'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
