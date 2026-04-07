import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function DeletionApprovals() {
  const { api, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const res = await api.get('/api/deletion-requests'); setRequests(res.data); } catch (err) {}
    setLoading(false);
  };

  const approve = async (reqId) => {
    try {
      const res = await api.post(`/api/deletion-requests/${reqId}/approve`);
      toast.success(res.data.message);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const reject = async (reqId) => {
    if (!window.confirm('Reject this deletion request?')) return;
    try { await api.post(`/api/deletion-requests/${reqId}/reject`); toast.success('Rejected'); load(); } catch (err) { toast.error('Failed'); }
  };

  const myRole = user?.role;
  const canApprove = (req) => {
    if (myRole === 'finance_admin' && !req.finance_approved) return true;
    if (myRole === 'compliance_admin' && !req.compliance_approved) return true;
    if (myRole === 'super_admin') return !req.finance_approved || !req.compliance_approved;
    return false;
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Deletion Approvals</h1><p className="text-sm text-muted-foreground">Review and approve pending entity deletion requests</p></div>

      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : requests.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Trash2 className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" /><p>No pending deletion requests</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <Card key={req._id} className="border-red-200 bg-red-50/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <span className="font-semibold text-red-800">Deletion Request</span>
                      <Badge variant="outline" className="text-xs capitalize">{req.entity_type}</Badge>
                    </div>
                    <p className="text-sm font-medium">{req.entity_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Requested by: {req.requested_by_email} on {req.created_at ? new Date(req.created_at).toLocaleString() : ''}</p>
                    <div className="flex gap-3 mt-3">
                      <div className="flex items-center gap-1 text-xs">
                        {req.finance_approved ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/30" />}
                        <span className={req.finance_approved ? 'text-emerald-700' : 'text-muted-foreground'}>Finance {req.finance_approved ? `(${req.finance_approved_by})` : '— pending'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {req.compliance_approved ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/30" />}
                        <span className={req.compliance_approved ? 'text-emerald-700' : 'text-muted-foreground'}>Compliance {req.compliance_approved ? `(${req.compliance_approved_by})` : '— pending'}</span>
                      </div>
                    </div>
                  </div>
                  {canApprove(req) && (
                    <div className="flex gap-2 shrink-0">
                      <Button variant="destructive" size="sm" onClick={() => reject(req._id)}><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approve(req._id)}><CheckCircle className="w-3 h-3 mr-1" /> Approve Deletion</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
