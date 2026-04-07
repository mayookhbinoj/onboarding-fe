import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { toast } from 'sonner';
import { Truck, Package, MapPin, CheckCircle } from 'lucide-react';
import { DeviceStatusBadge } from './DevicesList';

const SHIPMENT_STATUSES = ['NOT_YET_SHIPPED','INITIATED','AWAITING_PICKUP','PICKED_UP','IN_TRANSIT','DELIVERED','LOST','CANCELLED'];

export default function ShipRequests() {
  const { api } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shipDialog, setShipDialog] = useState(null);
  const [carrier, setCarrier] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const res = await api.get('/api/devices-module/ship-requests'); setRequests(res.data); } catch (err) {}
    setLoading(false);
  };

  const createShipment = async () => {
    if (!carrier.trim() || !trackingId.trim()) { toast.error('Carrier and tracking ID required'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/devices-module/shipments', { ship_request_id: shipDialog._id, carrier_name: carrier, tracking_id: trackingId });
      toast.success('Shipment created!');
      setShipDialog(null); setCarrier(''); setTrackingId('');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  const updateShipmentStatus = async () => {
    if (!newStatus) return;
    try {
      await api.put(`/api/devices-module/shipments/${statusDialog._id}/status`, { new_status: newStatus, notes: '' });
      toast.success(`Status updated to ${newStatus}`);
      setStatusDialog(null); setNewStatus('');
      load();
    } catch (err) { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Ship Requests</h1><p className="text-sm text-muted-foreground">Fulfill shipping requests from Marketing</p></div>

      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : requests.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Truck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No ship requests</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {requests.map(sr => (
            <Card key={sr._id} className="hover:shadow-sm animate-row-in">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{sr.status}</Badge>
                      <span className="text-sm font-medium">{sr.allocation?.allocated_to_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground"><MapPin className="w-3 h-3 inline mr-1" />{sr.allocation?.shipping_address?.address_line1 || 'No address'}, {sr.allocation?.shipping_address?.city} {sr.allocation?.shipping_address?.state}</p>
                    <p className="text-xs text-muted-foreground mt-1">Devices: {sr.devices?.map(d => d.serial_number).join(', ')}</p>
                    <div className="flex gap-1 mt-2">{sr.devices?.map(d => <DeviceStatusBadge key={d._id} status={d.status} />)}</div>
                    {sr.shipment && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <p>Carrier: <strong>{sr.shipment.carrier_name}</strong> | Tracking: <strong>{sr.shipment.tracking_id}</strong></p>
                        <p>Shipment Status: <Badge variant="outline" className="text-[10px] ml-1">{sr.shipment.status}</Badge></p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {sr.status === 'OPEN' && !sr.shipment && <Button size="sm" onClick={() => setShipDialog(sr)}><Truck className="w-3 h-3 mr-1" /> Create Shipment</Button>}
                    {sr.shipment && sr.shipment.status !== 'DELIVERED' && <Button variant="outline" size="sm" onClick={() => setStatusDialog(sr.shipment)}>Update Status</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Shipment Dialog */}
      <Dialog open={!!shipDialog} onOpenChange={o => { if (!o) setShipDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Shipment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">For: <strong>{shipDialog?.allocation?.allocated_to_name}</strong> ({shipDialog?.devices?.length} devices)</p>
            <div className="space-y-2"><Label>Carrier <span className="text-red-500">*</span></Label><Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g., BlueDart, FedEx, DTDC" /></div>
            <div className="space-y-2"><Label>Tracking ID <span className="text-red-500">*</span></Label><Input value={trackingId} onChange={e => setTrackingId(e.target.value)} placeholder="Enter tracking/AWB number" /></div>
          </div>
          <DialogFooter><Button onClick={createShipment} disabled={submitting}>{submitting ? 'Creating...' : 'Create Shipment'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={o => { if (!o) setStatusDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Shipment Status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Current: <Badge variant="outline">{statusDialog?.status}</Badge></p>
            <Select value={newStatus} onValueChange={setNewStatus}><SelectTrigger><SelectValue placeholder="Select new status" /></SelectTrigger><SelectContent>{SHIPMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>
          </div>
          <DialogFooter><Button onClick={updateShipmentStatus} disabled={!newStatus}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
