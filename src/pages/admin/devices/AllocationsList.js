import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import { Textarea } from '../../../components/ui/textarea';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Progress } from '../../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Package, RotateCcw, Eye, Truck, MapPin, ChevronDown, ChevronUp, Activity, Clock, CheckCircle, Search } from 'lucide-react';
import { DeviceStatusBadge } from './DevicesList';

const SHIPMENT_STATUS_COLOR = {
  NOT_YET_SHIPPED: 'bg-slate-100 text-slate-700',
  INITIATED: 'bg-blue-50 text-blue-700',
  AWAITING_PICKUP: 'bg-amber-50 text-amber-700',
  PICKED_UP: 'bg-sky-50 text-sky-700',
  IN_TRANSIT: 'bg-indigo-50 text-indigo-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  LOST: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};
const SHIPMENT_STATUSES = ['NOT_YET_SHIPPED','INITIATED','AWAITING_PICKUP','PICKED_UP','IN_TRANSIT','DELIVERED','LOST','CANCELLED'];

function getSensorDayInfo(devices) {
  const info = [];
  for (const d of (devices || [])) {
    const testDuration = d.qc_test_duration_minutes || d.test_duration_minutes;
    const sensorDays = testDuration ? Math.round(testDuration / 60 / 24 * 100) / 100 : null;
    info.push({ serial: d.serial_number, status: d.status, testDuration, sensorDays, deviceType: d.device_type_name || '', model: d.model_number || '' });
  }
  return info;
}

export default function AllocationsList() {
  const { api, user } = useAuth();
  const navigate = useNavigate();

  // Shipment Status state
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [returnDialog, setReturnDialog] = useState(null);
  const [returnDevices, setReturnDevices] = useState(new Set());
  const [returnReason, setReturnReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ship Requests state (for inventory_admin / super_admin)
  const [shipRequests, setShipRequests] = useState([]);
  const [srLoading, setSrLoading] = useState(true);
  const [shipDialog, setShipDialog] = useState(null);
  const [carrier, setCarrier] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [srSubmitting, setSrSubmitting] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const isMarketing = ['marketing_associate', 'marketing_admin', 'super_admin'].includes(user?.role);
  const isInventoryOrSuper = ['inventory_admin', 'super_admin'].includes(user?.role);

  useEffect(() => {
    loadAllocations();
    if (isInventoryOrSuper) loadShipRequests();
  }, []);

  const loadAllocations = async () => {
    try { const res = await api.get('/api/devices-module/allocations'); setAllocations(res.data); } catch (err) {}
    setLoading(false);
  };

  const loadShipRequests = async () => {
    try { const res = await api.get('/api/devices-module/ship-requests'); setShipRequests(res.data); } catch (err) {}
    setSrLoading(false);
  };

  const openReturnDialog = (alloc) => {
    const delivered = alloc.devices?.filter(d => d.status === 'DELIVERED') || [];
    if (delivered.length === 0) { toast.error('No delivered devices to return'); return; }
    setReturnDialog(alloc);
    setReturnDevices(new Set());
    setReturnReason('');
  };

  const submitReturn = async () => {
    if (returnDevices.size === 0) { toast.error('Select devices to return'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/devices-module/return-requests', { device_unit_ids: Array.from(returnDevices), reason: returnReason });
      toast.success('Return request created!');
      setReturnDialog(null);
      loadAllocations();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  const createShipment = async () => {
    if (!carrier.trim() || !trackingId.trim()) { toast.error('Carrier and tracking ID required'); return; }
    setSrSubmitting(true);
    try {
      await api.post('/api/devices-module/shipments', { ship_request_id: shipDialog._id, carrier_name: carrier, tracking_id: trackingId });
      toast.success('Shipment created!');
      setShipDialog(null); setCarrier(''); setTrackingId('');
      loadShipRequests(); loadAllocations();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSrSubmitting(false);
  };

  const updateShipmentStatus = async () => {
    if (!newStatus) return;
    try {
      await api.put(`/api/devices-module/shipments/${statusDialog._id}/status`, { new_status: newStatus, notes: '' });
      toast.success(`Status updated to ${newStatus}`);
      setStatusDialog(null); setNewStatus('');
      loadShipRequests(); loadAllocations();
    } catch (err) { toast.error('Failed'); }
  };

  // Group allocations by target
  const grouped = {};
  for (const a of allocations) {
    const key = a.allocated_to_name || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  }

  const openRequests = shipRequests.filter(sr => sr.status === 'OPEN' && !sr.shipment);
  const activeShipments = shipRequests.filter(sr => sr.shipment && sr.shipment.status !== 'DELIVERED');
  const [expandedSrId, setExpandedSrId] = useState(null);

  // Shipment progress steps for the linear progress bar
  const SHIP_STEPS = ['NOT_YET_SHIPPED','INITIATED','AWAITING_PICKUP','PICKED_UP','IN_TRANSIT','DELIVERED'];
  const getShipProgress = (status) => {
    const idx = SHIP_STEPS.indexOf(status);
    if (idx < 0) return 0;
    return Math.round((idx / (SHIP_STEPS.length - 1)) * 100);
  };

  // ── Shipment Status content (shared by both views) ──
  const ShipmentStatusContent = () => (
    <>
      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : allocations.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No allocations yet</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([name, allocs]) => {
            const totalDevices = allocs.reduce((sum, a) => sum + (a.devices?.length || 0), 0);
            const deliveredCount = allocs.reduce((sum, a) => sum + (a.devices?.filter(d => d.status === 'DELIVERED').length || 0), 0);
            const shippedCount = allocs.reduce((sum, a) => sum + (a.devices?.filter(d => ['SHIPPED', 'DELIVERED'].includes(d.status)).length || 0), 0);
            return (
              <Card key={name}>
                <CardContent className="p-0">
                  <div className="p-4 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{name}</p>
                        <p className="text-xs text-muted-foreground">{totalDevices} device(s) — {deliveredCount} delivered, {shippedCount - deliveredCount} in transit</p>
                      </div>
                      {isMarketing && deliveredCount > 0 && <Button variant="outline" size="sm" onClick={() => openReturnDialog(allocs[0])}><RotateCcw className="w-3 h-3 mr-1" /> Return</Button>}
                    </div>
                  </div>
                  {allocs.map(a => {
                    const isExpanded = expandedId === a._id;
                    const sensorInfo = getSensorDayInfo(a.devices);
                    return (
                      <div key={a._id} className="border-b last:border-0">
                        <div className="p-4 cursor-pointer hover:bg-muted/10" onClick={() => setExpandedId(isExpanded ? null : a._id)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                              <div>
                                <div className="flex items-center gap-2">
                                  {a.shipment ? (
                                    <Badge className={`text-xs ${SHIPMENT_STATUS_COLOR[a.shipment.status] || ''}`}><Truck className="w-3 h-3 mr-1" />{(a.shipment.status || '').replace(/_/g, ' ')}</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-slate-50"><Clock className="w-3 h-3 mr-1" />Awaiting Shipment</Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">{a.devices?.length} device(s)</span>
                                </div>
                                {a.shipment && <p className="text-xs text-muted-foreground mt-0.5">{a.shipment.carrier_name} — {a.shipment.tracking_id}{a.shipment.shipped_at && ` — Shipped ${new Date(a.shipment.shipped_at).toLocaleDateString()}`}</p>}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</p>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="sr-dropdown-enter px-4 pb-4">
                            {/* Animated progress bar for shipment status */}
                            {a.shipment && (() => {
                              const shipProg = getShipProgress(a.shipment.status);
                              const sStatus = a.shipment.status;
                              return (
                                <div className="mb-4 px-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium">Shipment Tracking</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{a.shipment.carrier_name}</span>
                                      <span className="font-mono">{a.shipment.tracking_id}</span>
                                    </div>
                                  </div>
                                  <div className="relative" style={{ padding: '0 8px' }}>
                                    <div className="h-2 bg-muted rounded-full" />
                                    <div
                                      className="absolute top-0 h-2 rounded-full progress-bar-animate"
                                      style={{
                                        left: '8px', right: '8px',
                                        width: (() => { const idx = SHIP_STEPS.indexOf(sStatus); const t = SHIP_STEPS.length - 1; return t <= 0 ? '100%' : `${(idx / t) * 100}%`; })(),
                                        background: shipProg >= 100 ? 'linear-gradient(90deg, #059669, #10b981)' : shipProg > 50 ? 'linear-gradient(90deg, #0d9488, #14b8a6)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                      }}
                                    />
                                    <div className="absolute top-0 left-[8px] right-[8px] flex justify-between items-center h-2">
                                      {SHIP_STEPS.map((step, si) => {
                                        const isActive = SHIP_STEPS.indexOf(sStatus) >= si;
                                        const isCurrent = sStatus === step;
                                        return <div key={step} className={`rounded-full step-dot-animate ${isCurrent ? 'w-4 h-4 bg-primary shadow-lg shadow-primary/30 -mt-1' : isActive ? 'w-3 h-3 bg-primary/60 -mt-0.5' : 'w-2.5 h-2.5 bg-muted-foreground/20'}`} style={{ animationDelay: `${si * 0.1}s` }} />;
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex justify-between mt-3" style={{ padding: '0 8px' }}>
                                    {SHIP_STEPS.map((step, si) => (
                                      <span key={step} className={`text-[8px] text-center leading-tight ${sStatus === step ? 'font-bold text-primary' : SHIP_STEPS.indexOf(sStatus) >= si ? 'text-foreground/80' : 'text-muted-foreground/60'}`}>
                                        {step.replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="bg-muted/30 rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader><TableRow className="text-xs"><TableHead>Serial Number</TableHead><TableHead>Device Type</TableHead><TableHead>Model</TableHead><TableHead>Device Status</TableHead><TableHead>QC Duration</TableHead><TableHead>Sensor Days</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {sensorInfo.map(s => (
                                    <TableRow key={s.serial} className="text-xs">
                                      <TableCell className="font-mono font-medium">{s.serial}</TableCell>
                                      <TableCell>{s.deviceType}</TableCell>
                                      <TableCell>{s.model}</TableCell>
                                      <TableCell><DeviceStatusBadge status={s.status} /></TableCell>
                                      <TableCell>{s.testDuration ? `${s.testDuration} min` : '—'}</TableCell>
                                      <TableCell>{s.sensorDays !== null ? <span className="inline-flex items-center gap-1"><Activity className="w-3 h-3 text-primary" /><span className="font-medium">{s.sensorDays} days</span></span> : '—'}</TableCell>
                                      <TableCell><Button variant="ghost" size="sm" className="h-6 px-2" onClick={e => { e.stopPropagation(); navigate(`/admin/devices/${a.devices?.find(d => d.serial_number === s.serial)?._id}`); }}><Eye className="w-3 h-3" /></Button></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {a.shipping_address?.address_line1 && (
                              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span>{a.shipping_address.address_line1}, {a.shipping_address.city} {a.shipping_address.state} {a.shipping_address.postal_code}</span></div>
                            )}
                            {a.shipment?.events?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium mb-2">Shipment Timeline</p>
                                <div className="relative pl-4 space-y-1.5">
                                  <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
                                  {a.shipment.events.map((ev, idx) => (
                                    <div key={idx} className="relative flex items-center gap-2 text-xs">
                                      <div className={`absolute -left-4 w-2.5 h-2.5 rounded-full border border-background ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                                      <Badge variant="outline" className="text-[10px]">{(ev.status || '').replace(/_/g, ' ')}</Badge>
                                      <span className="text-muted-foreground">{ev.event_time ? new Date(ev.event_time).toLocaleString() : ''}</span>
                                      {ev.notes && <span className="text-muted-foreground">— {ev.notes}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );

  // ── Ship Requests content (inventory/super admin) — with inline tracking ──
  const ShipRequestsContent = () => (
    <>
      {srLoading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : shipRequests.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Truck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No ship requests</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {shipRequests.map(sr => {
            const isExpSr = expandedSrId === sr._id;
            const shipStatus = sr.shipment?.status || 'NOT_YET_SHIPPED';
            const progress = getShipProgress(shipStatus);
            const alloc = sr.allocation;

            return (
              <Card key={sr._id} className="overflow-hidden transition-shadow duration-200 hover:shadow-md" data-testid={`ship-request-${sr._id}`}>
                <CardContent className="p-0">
                  {/* Header row — click to expand */}
                  <div
                    className={`p-4 cursor-pointer transition-colors duration-150 ${isExpSr ? 'bg-muted/20' : 'hover:bg-muted/10'}`}
                    onClick={() => setExpandedSrId(isExpSr ? null : sr._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`transition-transform duration-300 ${isExpSr ? 'rotate-180' : ''}`}>
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{sr.status}</Badge>
                            <span className="text-sm font-medium">{alloc?.allocated_to_name}</span>
                            {sr.shipment && (
                              <Badge className={`text-xs ${SHIPMENT_STATUS_COLOR[shipStatus] || ''}`}>
                                <Truck className="w-3 h-3 mr-1" />{shipStatus.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {alloc?.shipping_address?.address_line1 || 'No address'}, {alloc?.shipping_address?.city} {alloc?.shipping_address?.state}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Devices: {sr.devices?.map(d => d.serial_number).join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        {sr.status === 'OPEN' && !sr.shipment && <Button size="sm" onClick={() => setShipDialog(sr)}><Truck className="w-3 h-3 mr-1" /> Create Shipment</Button>}
                        {sr.shipment && sr.shipment.status !== 'DELIVERED' && <Button variant="outline" size="sm" onClick={() => setStatusDialog(sr.shipment)}>Update Status</Button>}
                      </div>
                    </div>
                  </div>

                  {/* Expanded dropdown with animations */}
                  {isExpSr && (
                    <div className="sr-dropdown-enter border-t">
                      <div className="px-4 pb-4 pt-3">
                        {/* Device status badges */}
                        <div className="flex gap-1 mb-4">
                          {sr.devices?.map(d => <DeviceStatusBadge key={d._id} status={d.status} />)}
                        </div>

                        {sr.shipment ? (
                          <div className="space-y-5">
                            {/* Shipment info */}
                            <div className="p-3 bg-muted/30 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-medium">Carrier: <strong>{sr.shipment.carrier_name}</strong></p>
                                  <p className="text-xs text-muted-foreground">Tracking: <span className="font-mono">{sr.shipment.tracking_id}</span></p>
                                </div>
                                <Badge className={`text-xs ${SHIPMENT_STATUS_COLOR[shipStatus] || ''}`}>{shipStatus.replace(/_/g, ' ')}</Badge>
                              </div>
                              {sr.shipment.shipped_at && <p className="text-[10px] text-muted-foreground">Shipped: {new Date(sr.shipment.shipped_at).toLocaleString()}</p>}
                            </div>

                            {/* Animated linear progress bar with step dots */}
                            <div className="px-2">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full progress-bar-animate"
                                  style={{
                                    width: `${progress}%`,
                                    background: progress >= 100
                                      ? 'linear-gradient(90deg, #059669, #10b981)'
                                      : progress > 50
                                        ? 'linear-gradient(90deg, #0d9488, #14b8a6)'
                                        : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                  }}
                                />
                              </div>
                              <div className="flex justify-between mt-2.5 px-1">
                                {SHIP_STEPS.map((step, i) => {
                                  const isActive = SHIP_STEPS.indexOf(shipStatus) >= i;
                                  const isCurrent = shipStatus === step;
                                  return (
                                    <div key={step} className="flex flex-col items-center" style={{ width: `${100 / SHIP_STEPS.length}%` }}>
                                      <div
                                        className={`rounded-full step-dot-animate ${
                                          isCurrent
                                            ? 'w-3.5 h-3.5 bg-primary shadow-lg shadow-primary/30'
                                            : isActive
                                              ? 'w-2.5 h-2.5 bg-primary/60'
                                              : 'w-2 h-2 bg-muted-foreground/20'
                                        }`}
                                        style={{ animationDelay: `${i * 0.1}s` }}
                                      />
                                      <span className={`text-[8px] mt-1.5 text-center leading-tight ${
                                        isCurrent ? 'font-bold text-primary' : isActive ? 'text-foreground/80' : 'text-muted-foreground/60'
                                      }`}>
                                        {step.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Timeline events */}
                            {sr.shipment.events?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-2">Tracking Timeline</p>
                                <div className="relative pl-4 space-y-1.5">
                                  <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
                                  {sr.shipment.events.map((ev, idx) => (
                                    <div key={idx} className="relative flex items-center gap-2 text-xs">
                                      <div className={`absolute -left-4 w-2.5 h-2.5 rounded-full border border-background ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                                      <Badge variant="outline" className="text-[10px]">{(ev.status || '').replace(/_/g, ' ')}</Badge>
                                      <span className="text-muted-foreground">{ev.event_time ? new Date(ev.event_time).toLocaleString() : ''}</span>
                                      {ev.notes && <span className="text-muted-foreground">— {ev.notes}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Awaiting shipment creation. Click "Create Shipment" to assign a carrier and tracking number.
                          </div>
                        )}

                        {/* Shipping address */}
                        {alloc?.shipping_address?.address_line1 && (
                          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{alloc.shipping_address.address_line1}, {alloc.shipping_address.city} {alloc.shipping_address.state} {alloc.shipping_address.postal_code}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Shared animation styles for progress bars and dropdowns */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; max-height: 0; transform: translateY(-8px); }
          to { opacity: 1; max-height: 800px; transform: translateY(0); }
        }
        .sr-dropdown-enter {
          animation: slideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          overflow: hidden;
        }
        @keyframes progressGrow {
          from { width: 0%; }
        }
        .progress-bar-animate {
          animation: progressGrow 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes dotPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
        .step-dot-animate {
          animation: dotPop 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>

      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Shipment Status
        </h1>
        <p className="text-sm text-muted-foreground">
          {isInventoryOrSuper
            ? `${allocations.length} allocation(s), ${openRequests.length} open request(s), ${activeShipments.length} active shipment(s)`
            : `${allocations.length} allocation(s) across ${Object.keys(grouped).length} recipient(s)`}
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by recipient, serial, tracking..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="NOT_YET_SHIPPED">Not Yet Shipped</SelectItem>
            <SelectItem value="INITIATED">Initiated</SelectItem>
            <SelectItem value="AWAITING_PICKUP">Awaiting Pickup</SelectItem>
            <SelectItem value="PICKED_UP">Picked Up</SelectItem>
            <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="LOST">Lost</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isInventoryOrSuper ? (
        /* ── Single view for Inventory Admin / Super Admin — no tabs ── */
        <ShipRequestsContent />
      ) : (
        /* ── Status-only view for Marketing ── */
        <ShipmentStatusContent />
      )}

      {/* Return Dialog */}
      <Dialog open={!!returnDialog} onOpenChange={o => { if (!o) setReturnDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Initiate Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Select delivered devices to return:</p>
            {returnDialog && allocations
              .filter(a => a.allocated_to_name === returnDialog.allocated_to_name)
              .flatMap(a => a.devices || [])
              .filter(d => d.status === 'DELIVERED')
              .map(d => (
                <div key={d._id} className="flex items-center gap-2">
                  <Checkbox checked={returnDevices.has(d._id)} onCheckedChange={c => { const n = new Set(returnDevices); c ? n.add(d._id) : n.delete(d._id); setReturnDevices(n); }} />
                  <span className="text-sm font-mono">{d.serial_number}</span>
                </div>
              ))
            }
            <div className="space-y-1"><Label className="text-xs">Reason</Label><Textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={submitReturn} disabled={submitting || returnDevices.size === 0}>{submitting ? 'Creating...' : `Return ${returnDevices.size} device(s)`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Shipment Dialog */}
      <Dialog open={!!shipDialog} onOpenChange={o => { if (!o) setShipDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Shipment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">For: <strong>{shipDialog?.allocation?.allocated_to_name}</strong> ({shipDialog?.devices?.length} devices)</p>
            <div className="space-y-2"><Label>Carrier <span className="text-red-500">*</span></Label><Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g., BlueDart, FedEx, DTDC" /></div>
            <div className="space-y-2"><Label>Tracking ID <span className="text-red-500">*</span></Label><Input value={trackingId} onChange={e => setTrackingId(e.target.value)} placeholder="Enter tracking/AWB number" /></div>
          </div>
          <DialogFooter><Button onClick={createShipment} disabled={srSubmitting}>{srSubmitting ? 'Creating...' : 'Create Shipment'}</Button></DialogFooter>
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
