import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { Package, Search, Camera, CheckCircle, ArrowRight } from 'lucide-react';

export default function PackagingQueue() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/api/devices-module/devices').then(res => {
      const packaging = (res.data || []).filter(d => d.status === 'PACKAGING');
      setDevices(packaging);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  const filtered = devices.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.serial_number?.toLowerCase().includes(q) || d.mac_id?.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="packaging-queue">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Packaging Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Devices awaiting packaging images after QC pass</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by serial or MAC..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} device{filtered.length !== 1 ? 's' : ''}</Badge>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No devices in packaging queue</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Devices move here after QC pass</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((d, idx) => {
            const mediaByRound = d.onboarding_media_by_round || {};
            const currentRound = d.current_round || 1;
            const roundMedia = mediaByRound[currentRound] || [];
            const uploadedCats = new Set(roundMedia.map(m => m.category));
            const total = 6;
            const done = uploadedCats.size;
            const pct = (done / total) * 100;

            return (
              <Card key={d._id} className="animate-row-in cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/devices/${d._id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm font-mono">{d.serial_number}</p>
                        <Badge variant="outline" className="text-[10px]">{d.device_type_name}</Badge>
                        {d.mac_id && <Badge variant="outline" className="text-[10px] font-mono">{d.mac_id}</Badge>}
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : '#f97316' }} />
                        </div>
                        <span className="text-xs font-medium shrink-0">{done}/{total}</span>
                      </div>
                      {/* Image category status */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {['SENSOR_FRONT','SENSOR_BACK','GATEWAY_FRONT','GATEWAY_BACK','BOX_CONTENTS','SEALED_BOX'].map(cat => (
                          <div key={cat} className={`w-6 h-6 rounded flex items-center justify-center text-[8px] ${uploadedCats.has(cat) ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground/40'}`}>
                            {uploadedCats.has(cat) ? <CheckCircle className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pct === 100 ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Ready</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary border-primary/30">{done}/{total} images</Badge>
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
