import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { UserPlus, FileText, ShieldCheck, Package, CheckCircle, Clock, AlertTriangle, Users, DollarSign, ChevronRight, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

function DonutChart({ data, colors }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const [hover, setHover] = useState(null);

  // Build segments with angles for hover detection
  const segments = [];
  let cumDeg = 0;
  data.forEach((d, i) => {
    const deg = (d.count / total) * 360;
    segments.push({ ...d, color: colors[i % colors.length], startDeg: cumDeg, endDeg: cumDeg + deg, pct: ((d.count / total) * 100).toFixed(1) });
    cumDeg += deg;
  });

  const gradientSegments = segments.map(s => `${s.color} ${s.startDeg}deg ${s.endDeg}deg`).join(', ');

  const handleMouse = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 80, y = e.clientY - rect.top - 80;
    const dist = Math.sqrt(x * x + y * y);
    if (dist < 35 || dist > 80) { setHover(null); return; }
    let angle = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
    const seg = segments.find(s => angle >= s.startDeg && angle < s.endDeg);
    setHover(seg || null);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
      <div
        style={{ position: 'relative', width: 160, height: 160, cursor: 'pointer' }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setHover(null)}
      >
        <div style={{
          width: 160, height: 160, borderRadius: '50%',
          background: `conic-gradient(${gradientSegments})`,
          transition: 'transform .2s ease',
          transform: hover ? 'scale(1.03)' : 'scale(1)',
          boxShadow: hover ? '0 4px 20px rgba(0,0,0,.15)' : 'none',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 76, height: 76, borderRadius: '50%',
          background: 'hsl(var(--card))',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,.06)',
        }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{hover ? hover.count : total}</span>
          <span style={{ fontSize: 8, color: 'var(--muted-foreground)', fontWeight: 500 }}>{hover ? hover.label : 'Total'}</span>
        </div>
        {/* Hover tooltip */}
        {hover && (
          <div style={{
            position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) translateY(-100%)',
            background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
            borderRadius: 10, padding: '6px 12px', whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 10,
            animation: 'xaPillIn .2s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: hover.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{hover.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, paddingLeft: 14 }}>
              {hover.count} ({hover.pct}%)
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes xaPillIn { from { opacity:0; transform:translateX(-50%) translateY(-90%); } to { opacity:1; transform:translateX(-50%) translateY(-100%); } }`}</style>
    </div>
  );
}

const PIPELINE_STEPS = [
  { key: 'invited', label: 'Invited', statuses: ['INVITED', 'LINK_OPENED'], icon: UserPlus, color: '#0ea5e9' },
  { key: 'progress', label: 'In Progress', statuses: ['VIDEOS_VIEWED', 'FORM_IN_PROGRESS', 'COMPLIANCE_REJECTED'], icon: Clock, color: '#64748b' },
  { key: 'finance', label: 'Finance Review', statuses: ['FORM_SUBMITTED', 'FINANCE_PROFILE_REVIEW', 'FINANCE_PROFILE_APPROVED'], icon: DollarSign, color: '#f59e0b' },
  { key: 'agreement', label: 'Agreement', statuses: ['AGREEMENT_DRAFT_GENERATED', 'AGREEMENT_SENT', 'AWAITING_SIGNATURE'], icon: FileText, color: '#f97316' },
  { key: 'compliance', label: 'Compliance Review', statuses: ['SIGNED_RECEIVED', 'COMPLIANCE_REVIEW'], icon: ShieldCheck, color: '#a855f7' },
  { key: 'onboarded', label: 'Onboarded', statuses: ['COMPLIANCE_APPROVED', 'ONBOARDING_COMPLETE', 'INVENTORY_PROCESSING', 'SHIPPED', 'SENT_TO_PROCUREMENT', 'FINANCE_NOTIFIED'], icon: CheckCircle, color: '#10b981' },
];

const COLORS = ['#0ea5e9', '#64748b', '#f59e0b', '#f97316', '#a855f7', '#10b981'];

// Map raw DB status to display-friendly labels
const DEVICE_STATUS_LABELS = {
  DRAFT: 'PURCHASE',
  PENDING_QC: 'PENDING QC',
  QC_IN_PROGRESS: 'QC IN PROGRESS',
  QC_PASSED: 'QC PASSED',
  PACKAGING: 'PACKAGING',
  READY_TO_SHIP: 'READY TO SHIP',
  ALLOCATED: 'ALLOCATED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURN_REQUESTED: 'RETURN REQUESTED',
  RETURN_IN_TRANSIT: 'RETURN IN TRANSIT',
  RETURNED_TO_INVENTORY: 'RETURNED',
  NONCONFORMING: 'NON-CONFORMING',
};
const deviceLabel = (s) => DEVICE_STATUS_LABELS[s] || s.replace(/_/g, ' ');

export default function Dashboard() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/dashboard').catch(() => ({ data: null })),
      api.get('/api/distributors').catch(() => ({ data: [] })),
    ]).then(([dashRes, distRes]) => {
      setData(dashRes.data);
      setClients((distRes.data || []).slice(0, 20)); // latest 20
      setLoading(false);
    });
  }, [api]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!data) return null;

  const pipeline = data.pipeline || {};
  const kpiData = PIPELINE_STEPS.map(g => ({ ...g, count: g.statuses.reduce((sum, s) => sum + (pipeline[s] || 0), 0) }));
  const barData = kpiData.map(k => ({ name: k.label, value: k.count }));
  const chartData = kpiData.filter(k => k.count > 0);
  const isMarketing = ['marketing_admin', 'marketing_associate', 'super_admin'].includes(user?.role);

  // Find which pipeline step a client is at
  const getClientStep = (status) => {
    for (let i = PIPELINE_STEPS.length - 1; i >= 0; i--) {
      if (PIPELINE_STEPS[i].statuses.includes(status)) return i;
    }
    return 0;
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div><h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Dashboard</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">Onboarding pipeline overview</p></div>

      {/* KPI Cards — 6 pipeline stages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="admin-dashboard-kpi-cards">
        {kpiData.map(k => (
          <Card key={k.label} className="hover:shadow-md transition-shadow duration-200 cursor-pointer group" onClick={() => navigate('/admin/business-associates')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: k.color + '12' }}><k.icon className="w-4.5 h-4.5" style={{ color: k.color }} /></div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
              </div>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{k.count}</p>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card data-testid="admin-dashboard-status-chart">
          <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Pipeline Distribution</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div style={{ width: '100%', height: 200, minHeight: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-35} textAnchor="end" height={50} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} width={30} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Status Overview</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-6">
            {chartData.length > 0 ? (
              <>
                <DonutChart data={chartData} colors={COLORS} />
                <div className="overflow-hidden mt-3 relative">
                  <div className="flex items-center gap-6 pie-legend-scroll whitespace-nowrap" style={{ willChange: 'transform' }}>
                    {[...chartData, ...chartData].map((d, i) => {
                      const colorIdx = i % chartData.length;
                      return (
                        <div key={`${d.key}-${i}`} className="flex items-center gap-1.5 shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[colorIdx % COLORS.length] }} />
                          <span className="text-[11px] text-muted-foreground">{d.label}</span>
                          <span className="text-[11px] font-semibold">{d.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <style>{`
                    @keyframes pieLegendScroll {
                      0% { transform: translateX(0%); }
                      100% { transform: translateX(-50%); }
                    }
                    .pie-legend-scroll {
                      animation: pieLegendScroll 15s linear infinite;
                      backface-visibility: hidden;
                      -webkit-backface-visibility: hidden;
                    }
                    .pie-legend-scroll:hover {
                      animation-play-state: paused;
                    }
                  `}</style>
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Expanded Info: Devices + QC + Agreements + Shipments ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Device Inventory */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/devices')}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Package className="w-4 h-4 text-blue-500" /></div>
                <div>
                  <p className="text-sm font-semibold">{data.total_devices || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Total Devices</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              {Object.entries(data.device_stats || {}).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground truncate mr-2">{deviceLabel(status)}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / (data.total_devices || 1)) * 100}%` }} />
                    </div>
                    <span className="font-medium w-5 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* QC/QA Tests */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/devices/qc-queue')}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-emerald-500" /></div>
                <div>
                  <p className="text-sm font-semibold">{data.total_qc || 0}</p>
                  <p className="text-[10px] text-muted-foreground">QC Tests</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              {Object.entries(data.qc_stats || {}).sort((a,b) => b[1]-a[1]).map(([result, count]) => (
                <div key={result} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${result === 'PASSED' ? 'bg-emerald-400' : result === 'NONCONFORMING' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                    <span className="text-muted-foreground">{result.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Agreements */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/agreement-history')}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center"><FileText className="w-4 h-4 text-orange-500" /></div>
                <div>
                  <p className="text-sm font-semibold">{data.total_agreements || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Agreements</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              {Object.entries(data.agreement_stats || {}).sort((a,b) => b[1]-a[1]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${status === 'signed' ? 'bg-emerald-400' : status === 'sent' ? 'bg-blue-400' : status === 'draft' ? 'bg-slate-400' : 'bg-amber-400'}`} />
                    <span className="text-muted-foreground capitalize">{status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipments */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/devices/allocations')}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center"><Truck className="w-4 h-4 text-violet-500" /></div>
                <div>
                  <p className="text-sm font-semibold">{data.total_shipments || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Shipments</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              {Object.entries(data.shipment_stats || {}).length > 0 ? Object.entries(data.shipment_stats).sort((a,b) => b[1]-a[1]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${status === 'DELIVERED' ? 'bg-emerald-400' : status === 'SHIPPED' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                    <span className="text-muted-foreground">{status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              )) : <p className="text-[11px] text-muted-foreground">No shipments yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Recent Activity ═══ */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {data.recent_activity?.length > 0 ? (
            <div className="space-y-3">
              {data.recent_activity.slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-muted-foreground text-[11px] truncate">{a.actor_email}</span>
                  <span className="font-medium text-[11px]">{a.action?.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No activity yet</p>}
        </CardContent>
      </Card>
      {isMarketing && clients.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg" onClick={() => navigate('/admin/onboarding-tracker')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Client Onboarding Tracker</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{clients.length} clients</Badge>
                <span className="text-xs text-primary font-medium flex items-center gap-1">View All <ChevronRight className="w-3.5 h-3.5" /></span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <style>{`
              @keyframes trackerPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
              @keyframes trackerFill { from { width: 0; } }
              .tracker-bar { animation: trackerFill 0.6s ease-out forwards; }
              .tracker-dot-active { animation: trackerPulse 2s ease-in-out infinite; }
            `}</style>
            <div className="space-y-4">
              {/* Header row */}
              <div className="hidden sm:flex items-center gap-1 px-2 mb-2">
                <div className="w-32 sm:w-40 shrink-0" />
                {PIPELINE_STEPS.map((step, i) => (
                  <div key={step.key} className="flex-1 text-center">
                    <span className="text-[8px] text-muted-foreground leading-tight block">{step.label}</span>
                  </div>
                ))}
              </div>
              {/* Client rows */}
              {clients.map((c, ci) => {
                const stepIdx = getClientStep(c.status);
                const progress = ((stepIdx + 1) / PIPELINE_STEPS.length) * 100;
                const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`;
                return (
                  <div key={c._id} className="flex items-center gap-2 sm:gap-3 group cursor-pointer hover:bg-muted/30 rounded-lg p-1.5 sm:p-2 transition-colors" onClick={() => navigate(`/admin/distributors/${c._id}`)} style={{ animationDelay: `${ci * 50}ms` }}>
                    <div className="w-32 sm:w-40 shrink-0">
                      <p className="text-xs font-medium truncate">{name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                    </div>
                    {/* Progress bar with dots */}
                    <div className="flex-1 relative">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full tracker-bar" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${PIPELINE_STEPS[0].color}, ${PIPELINE_STEPS[stepIdx].color})`, animationDelay: `${ci * 80}ms` }} />
                      </div>
                      <div className="flex justify-between absolute inset-x-0 -top-1">
                        {PIPELINE_STEPS.map((step, i) => {
                          const isReached = i <= stepIdx;
                          const isCurrent = i === stepIdx;
                          return (
                            <div key={step.key} className="flex flex-col items-center" style={{ width: `${100/PIPELINE_STEPS.length}%` }}>
                              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-background transition-all duration-300 ${isCurrent ? 'tracker-dot-active scale-125' : ''}`} style={{ backgroundColor: isReached ? step.color : '#e2e8f0' }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Status badge */}
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] shrink-0 hidden sm:inline-flex" style={{ borderColor: PIPELINE_STEPS[stepIdx].color + '40', color: PIPELINE_STEPS[stepIdx].color }}>
                      {PIPELINE_STEPS[stepIdx].label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
