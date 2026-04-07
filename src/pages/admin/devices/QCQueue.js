import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Play, Eye } from 'lucide-react';
import { DeviceStatusBadge } from './DevicesList';

export default function QCQueue() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const res = await api.get('/api/devices-module/qc/queue'); setQueue(res.data); } catch (err) {}
    setLoading(false);
  };

  const startQC = async (deviceId) => {
    try {
      const res = await api.post('/api/devices-module/qc-tests/start', { device_id: deviceId });
      toast.success('QC test started!');
      navigate(`/admin/devices/qc-test/${deviceId}/${res.data._id}`);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to start QC'); }
  };

  const pending = queue.filter(d => d.status === 'PENDING_QC');
  const inProgress = queue.filter(d => d.status === 'QC_IN_PROGRESS');

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>QC/QA Queue</h1><p className="text-sm text-muted-foreground">{queue.length} devices pending quality check</p></div>

      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div> : (
        <>
          {inProgress.length > 0 && (
            <div><h2 className="text-sm font-semibold mb-2 text-blue-700">In Progress ({inProgress.length})</h2>
              <div className="space-y-4">
                {inProgress.map(d => (
                  <Card key={d._id} className="border-primary/30 bg-primary/5 animate-row-in">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-mono font-medium">{d.serial_number}</p>
                        <p className="text-sm text-muted-foreground">{d.device_type_name} — {d.model_number}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DeviceStatusBadge status={d.status} />
                        <Button size="sm" onClick={() => navigate(`/admin/devices/qc-test/${d._id}/${d.active_qc_test?._id}`)}><Eye className="w-3 h-3 mr-1" /> Continue</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div><h2 className="text-sm font-semibold mb-2">Pending QC ({pending.length})</h2>
            {pending.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p>No devices pending QC</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {pending.map(d => (
                  <Card key={d._id} className="hover:shadow-sm transition-shadow animate-row-in">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-mono font-medium">{d.serial_number}</p>
                        <p className="text-sm text-muted-foreground">{d.device_type_name} — {d.model_number}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DeviceStatusBadge status={d.status} />
                        <Button size="sm" onClick={() => startQC(d._id)}><Play className="w-3 h-3 mr-1" /> Start QC</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
