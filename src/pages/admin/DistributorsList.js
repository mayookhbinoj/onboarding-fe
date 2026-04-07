import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import { useNavigate } from 'react-router-dom';
import { Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function DistributorsList({ embedded }) {
  const { api, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [distributors, setDistributors] = useState([]);
  const [trackingMap, setTrackingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionEntities, setActionEntities] = useState(new Set());
  const [pendingDeletions, setPendingDeletions] = useState({});
  const canDelete = ['super_admin', 'marketing_admin'].includes(currentUser?.role);

  const load = async () => {
    setLoading(true);
    try {
      const [d, t, a, pd] = await Promise.all([
        api.get('/api/distributors'), api.get('/api/compliance-tracking-list').catch(() => ({data:[]})),
        api.get('/api/action-required-entities').catch(() => ({data:[]})), api.get('/api/deletion-requests/my-pending').catch(() => ({data:[]}))
      ]);
      setDistributors(d.data);
      const tm = {}; for (const i of t.data) tm[i.tracking.distributor_id] = i.tracking; setTrackingMap(tm);
      setActionEntities(new Set(a.data.filter(e => e.category === 'distributor').map(e => e.entity_id)));
      const dm = {}; for (const r of pd.data) dm[r.entity_id] = r; setPendingDeletions(dm);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleService = async (id, current) => {
    const next = current === 'active' ? 'inactive' : 'active';
    try { await api.put('/api/compliance-tracking', { distributor_id: id, service_status: next }); setTrackingMap(prev => ({ ...prev, [id]: { ...prev[id], service_status: next } })); } catch {}
  };

  const deleteDistributor = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { const res = await api.post('/api/entity/delete', { entity_id: id, entity_type: 'distributor' }); res.data.immediate ? toast.success(res.data.message) : toast.info(res.data.message); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const STATUS_OPTIONS = [
    { value: 'INVITED', label: 'Invited' }, { value: 'FORM_SUBMITTED', label: 'Submitted' },
    { value: 'COMPLIANCE_APPROVED', label: 'Approved' }, { value: 'ONBOARDING_COMPLETE', label: 'Complete' },
  ];

  const isComplianceAdmin = ['compliance_admin', 'super_admin'].includes(currentUser?.role);

  return (
    <div className="space-y-4">
      {!embedded && <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Distributors</h1><p className="text-sm text-muted-foreground">{distributors.length} distributor(s)</p></div>}
      <DataTable
        testId="distributors-table"
        rowClassName={(d) => isComplianceAdmin && d.status === 'FINANCE_PROFILE_APPROVED' ? 'bg-amber-50/60 border-l-2 border-l-amber-400' : ''}
        columns={[
          { key: 'first_name', label: 'Name', render: (_, d) => <div className="flex items-center gap-2 font-medium">{d.first_name} {d.last_name}{actionEntities.has(d._id) && <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 animate-pulse">Action</Badge>}</div> },
          { key: 'company_name', label: 'Company', render: (v) => v || '-' },
          { key: 'entity_type', label: 'Type', render: (v) => <Badge variant="outline" className="text-xs capitalize">{v === 'private' ? 'Unregistered' : v === 'registered' ? 'Registered' : (v?.replace(/_/g, ' ') || '-')}</Badge> },
          { key: 'status', label: 'Pipeline', render: (v) => <StatusBadge status={v} /> },
          { key: '_service', label: 'Service', render: (_, d) => {
            const svc = trackingMap[d._id]?.service_status;
            return svc ? <button onClick={e => { e.stopPropagation(); toggleService(d._id, svc); }} className={`text-[10px] px-2 py-0.5 rounded-full border ${svc === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-600 border-red-200'}`}>{svc}</button> : <span className="text-muted-foreground text-xs">-</span>;
          }},
          { key: 'email', label: 'Email', render: (v) => <span className="text-muted-foreground text-xs">{v}</span> },
          { key: '_actions', label: '', sortable: false, width: '60px', render: (_, d) => (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              {pendingDeletions[d._id] && <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600">Pending</Badge>}
              {canDelete && !pendingDeletions[d._id] && <button onClick={() => deleteDistributor(d._id, d.company_name || d.first_name)} className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          )},
        ]}
        data={distributors}
        loading={loading}
        searchFields={['first_name', 'last_name', 'company_name', 'email']}
        searchPlaceholder="Search distributors..."
        statusOptions={STATUS_OPTIONS}
        statusField="status"
        emptyMessage="No distributors found"
        onRowClick={(d) => navigate(`/admin/distributors/${d._id}`)}
        onRefresh={load}
        exportable
        exportFilename="distributors"
      />
    </div>
  );
}
