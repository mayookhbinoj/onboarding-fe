import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { toast } from 'sonner';
import { RotateCcw, Truck, CheckCircle, Package, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { DeviceStatusBadge } from './DevicesList';

export default function ReturnsManagement() {
  const { api, user } = useAuth();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revShipDialog, setRevShipDialog] = useState(null);
  const [carrier, setCarrier] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const res = await api.get('/api/devices-module/return-requests'); setReturns(res.data); } catch (err) {}
    setLoading(false);
  };

  const createReverseShipment = async () => {
    if (!carrier.trim() || !trackingId.trim()) { toast.error('Carrier and tracking required'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/devices-module/reverse-shipments', { return_request_id: revShipDialog._id, carrier_name: carrier, tracking_id: trackingId });
      toast.success('Reverse shipment created!');
      setRevShipDialog(null); setCarrier(''); setTrackingId('');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  const markReceived = async (revId) => {
    try {
      await api.post(`/api/devices-module/reverse-shipments/${revId}/mark-received`);
      toast.success('Return received! Devices moved to Returned to Inventory.');
      load();
    } catch (err) { toast.error('Failed'); }
  };

  const isInventory = ['inventory_admin', 'super_admin'].includes(user?.role);

  const filtered = returns.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !search || r.reason?.toLowerCase().includes(q) || r.devices?.some(d => d.serial_number?.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Returns Management</h1><p className="text-sm text-muted-foreground">Track return requests and reverse shipments</p></div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by device or reason..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="self-center">{filtered.length} return{filtered.length !== 1 ? 's' : ''}</Badge>
      </div>

      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><RotateCcw className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No return requests found</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => (
            <Card key={r._id} className="animate-row-in">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-xs ${r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{r.status}</Badge>
                      <span className="text-sm">{r.device_count} device(s)</span>
                      <span className="text-xs text-muted-foreground">by {r.created_by_email}</span>
                    </div>
                    {r.reason && <p className="text-xs text-muted-foreground">Reason: {r.reason}</p>}
                    <div className="flex gap-1 mt-2 flex-wrap">{r.devices?.map(d => (
                      <span key={d._id} className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{d.serial_number} <DeviceStatusBadge status={d.status} /></span>
                    ))}</div>
                    {r.reverse_shipment && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <p>Return Carrier: <strong>{r.reverse_shipment.carrier_name}</strong> | Tracking: <strong>{r.reverse_shipment.tracking_id}</strong></p>
                        <p>Status: <Badge variant="outline" className="text-[10px]">{r.reverse_shipment.status}</Badge></p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {r.status === 'OPEN' && isInventory && !r.reverse_shipment && <Button size="sm" onClick={() => setRevShipDialog(r)}><Truck className="w-3 h-3 mr-1" /> Create Return Shipment</Button>}
                    {r.reverse_shipment && r.reverse_shipment.status !== 'RETURN_DELIVERED_TO_INVENTORY' && isInventory && <Button size="sm" variant="outline" onClick={() => markReceived(r.reverse_shipment._id)}><CheckCircle className="w-3 h-3 mr-1" /> Mark Received</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!revShipDialog} onOpenChange={o => { if (!o) setRevShipDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Reverse Shipment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Carrier <span className="text-red-500">*</span></Label><Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g., BlueDart" /></div>
            <div className="space-y-2"><Label>Return Tracking ID <span className="text-red-500">*</span></Label><Input value={trackingId} onChange={e => setTrackingId(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={createReverseShipment} disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
