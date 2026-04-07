import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import StatusBadge from '../../components/StatusBadge';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable';
import { DollarSign, Download, CheckCircle, Eye, XCircle, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FinanceQueue() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [profileReviews, setProfileReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prLoading, setPrLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadQueue(); loadProfileReviews(); }, []);

  const loadQueue = async () => {
    try { const res = await api.get('/api/finance/queue'); setQueue(res.data); } catch (err) {}
    setLoading(false);
  };

  const loadProfileReviews = async () => {
    try { const res = await api.get('/api/finance/profile-reviews'); setProfileReviews(res.data); } catch (err) {}
    setPrLoading(false);
  };

  const approveProfile = async (id) => {
    try {
      const res = await api.post(`/api/finance/profile-reviews/${id}/approve`);
      toast.success(res.data.message);
      loadProfileReviews();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const rejectProfile = async () => {
    if (!rejectDialog) return;
    try {
      await api.post(`/api/finance/profile-reviews/${rejectDialog._id}/reject`, { reason: rejectReason });
      toast.success('Profile rejected');
      setRejectDialog(null); setRejectReason('');
      loadProfileReviews();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const markComplete = async (distributorId) => {
    try { await api.post(`/api/finance/mark-complete/${distributorId}`); toast.success('Onboarding marked complete!'); loadQueue(); } catch (err) { toast.error('Failed'); }
  };

  const exportCSV = async () => {
    try {
      const res = await api.get('/api/finance/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'finance_export.csv'; a.click();
      toast.success('CSV exported');
    } catch (err) { toast.error('Export failed'); }
  };

  const exportXLSX = async () => {
    try {
      const res = await api.get('/api/finance/export-xlsx', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'beatx_finance_export.xlsx'; a.click();
      toast.success('Excel exported');
    } catch (err) { toast.error('Export failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Finance</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">Profile reviews, approvals, and export</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-3.5 h-3.5 mr-1" /> CSV</Button>
          <Button size="sm" onClick={exportXLSX}><Download className="w-3.5 h-3.5 mr-1" /> Excel</Button>
        </div>
      </div>

      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews" className="gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" /> Profile Reviews
            {profileReviews.length > 0 && <Badge className="ml-1 h-5 min-w-[20px] bg-red-500 text-white text-[10px] rounded-full">{profileReviews.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Approved ({queue.length})</TabsTrigger>
        </TabsList>

        {/* ═══ Profile Reviews Tab ═══ */}
        <TabsContent value="reviews" className="mt-4">
          {prLoading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : profileReviews.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No profiles pending review</p><p className="text-xs mt-1">New profiles will appear here after onboarding form submission</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {profileReviews.map(entity => {
                const name = entity.company_name || `${entity.first_name || ''} ${entity.last_name || ''}`;
                const type = entity._entity_type || 'distributor';
                return (
                  <Card key={entity._id} className="border-amber-200/50 animate-row-in">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{name}</p>
                            <Badge variant="outline" className="text-[10px]">{type}</Badge>
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" />Pending Review</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{entity.email}</p>
                          {entity.gstin && <p className="text-xs text-muted-foreground mt-0.5">GSTIN: {entity.gstin}</p>}
                          {entity.company_name && <p className="text-xs text-muted-foreground">Company: {entity.company_name}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/distributors/${entity._id}`)}><Eye className="w-3 h-3 mr-1" /> View</Button>
                          <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setRejectDialog(entity); setRejectReason(''); }}><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveProfile(entity._id)}><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ Approved Queue Tab ═══ */}
        <TabsContent value="approved" className="mt-4">
          {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : queue.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><DollarSign className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No finance records yet</p></CardContent></Card>
          ) : (
            <DataTable
              testId="finance-approved-table"
              columns={[
                { key: 'distributor', label: 'Name', render: (d) => <span className="font-medium">{d?.first_name} {d?.last_name}</span> },
                { key: 'distributor', label: 'Company', render: (d) => d?.company_name || '-' },
                { key: 'distributor', label: 'Status', render: (d) => <StatusBadge status={d?.status} /> },
                { key: 'allocation', label: 'Devices', render: (a) => a?.final_qty || a?.recommended_qty || '-' },
                { key: 'shipment', label: 'Shipment', render: (s) => s ? <Badge className="bg-emerald-50 text-emerald-800 text-xs">{s.carrier} - {s.tracking_number}</Badge> : '-' },
                { key: '_actions', label: 'Actions', sortable: false, render: (_, q) => (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/distributors/${q.distributor._id}`)}><Eye className="w-3 h-3" /></Button>
                    {q.distributor.status === 'FINANCE_NOTIFIED' && <Button size="sm" onClick={() => markComplete(q.distributor._id)}><CheckCircle className="w-3 h-3 mr-1" /> Complete</Button>}
                  </div>
                )},
              ]}
              data={queue}
              loading={loading}
              emptyMessage="No finance records yet"
              onRefresh={loadQueue}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={o => { if (!o) setRejectDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Rejecting <strong>{rejectDialog?.company_name || `${rejectDialog?.first_name} ${rejectDialog?.last_name}`}</strong></p>
            <p className="text-xs text-muted-foreground">The entity will be returned to "Form Submitted" status for corrections.</p>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3} />
          </div>
          <DialogFooter><Button variant="destructive" onClick={rejectProfile} disabled={!rejectReason.trim()}>Reject Profile</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
