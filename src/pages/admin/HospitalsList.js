import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/badge';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import { useNavigate } from 'react-router-dom';
import { Building2, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function HospitalsList({ embedded }) {
  const { api, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionEntities, setActionEntities] = useState(new Set());
  const [pendingDeletions, setPendingDeletions] = useState({});
  const canDelete = ['super_admin', 'marketing_admin'].includes(currentUser?.role);

  const load = async () => { setLoading(true); try { const [h, a, d] = await Promise.all([api.get('/api/hospitals'), api.get('/api/action-required-entities').catch(() => ({data:[]})), api.get('/api/deletion-requests/my-pending').catch(() => ({data:[]}))]); setHospitals(h.data); setActionEntities(new Set(a.data.filter(e => e.category === 'hospital').map(e => e.entity_id))); const map = {}; for (const r of d.data) map[r.entity_id] = r; setPendingDeletions(map); } catch {} setLoading(false); };
  useEffect(() => { load(); }, []);

  const deleteHospital = async (id, name) => {
    if (!window.confirm(`Delete hospital "${name}"?`)) return;
    try { const res = await api.post('/api/entity/delete', { entity_id: id, entity_type: 'hospital' }); res.data.immediate ? toast.success(res.data.message) : toast.info(res.data.message); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      {!embedded && <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Hospitals</h1><p className="text-sm text-muted-foreground">{hospitals.length} hospital(s)</p></div>}
      <DataTable
        testId="hospitals-table"
        columns={[
          { key: 'first_name', label: 'Name', render: (_, h) => <div className="flex items-center gap-2 font-medium">{h.first_name} {h.last_name}{actionEntities.has(h._id) && <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 animate-pulse">Action</Badge>}</div> },
          { key: 'company_name', label: 'Hospital', render: (v) => v || '-' },
          { key: 'entity_type', label: 'Type', render: (v) => <Badge variant="outline" className="text-xs">{v === 'government_hospital' ? 'Government' : 'Private'}</Badge> },
          { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
          { key: 'email', label: 'Email', render: (v) => <span className="text-muted-foreground">{v}</span> },
          { key: '_actions', label: '', sortable: false, width: '80px', render: (_, h) => (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              {pendingDeletions[h._id] && <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200">Pending Delete</Badge>}
              {canDelete && !pendingDeletions[h._id] && <button onClick={() => deleteHospital(h._id, h.company_name || `${h.first_name} ${h.last_name}`)} className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          )},
        ]}
        data={hospitals}
        loading={loading}
        searchFields={['first_name', 'last_name', 'company_name', 'email']}
        searchPlaceholder="Search hospitals..."
        emptyMessage="No hospitals found"
        onRowClick={(h) => navigate(`/admin/hospitals/${h._id}`)}
        onRefresh={load}
      />
    </div>
  );
}
