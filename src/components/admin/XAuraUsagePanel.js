import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RefreshCw, Zap, DollarSign, MessageSquare, TrendingUp, TrendingDown, Users, Brain, Sparkles, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n, d = 0) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(d);
};

const PROVIDER_COLORS = { openai: '#10a37f', anthropic: '#d97757' };
const MODEL_COLORS = ['#10a37f', '#d97757', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];
const RANGE_OPTIONS = [
  { value: '1', label: 'Today' },
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '0', label: 'All Time' },
];

const SkeletonCard = () => (
  <div className="rounded-2xl border bg-card p-5 animate-pulse">
    <div className="h-3 w-20 bg-muted rounded mb-3" />
    <div className="h-8 w-28 bg-muted rounded mb-2" />
    <div className="h-2 w-16 bg-muted/60 rounded" />
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-md shadow-lg p-3 text-xs" style={{ minWidth: 160 }}>
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4 py-0.5">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-medium" style={{ color: p.color }}>{typeof p.value === 'number' && p.name.includes('Cost') ? `$${p.value.toFixed(4)}` : fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function XAuraUsagePanel() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [provider, setProvider] = useState('all');
  const [sortKey, setSortKey] = useState('tokens');
  const [sortDir, setSortDir] = useState('desc');
  const [showAllUsers, setShowAllUsers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/xaura/usage?days=${days}&provider=${provider}`);
      setData(res.data);
    } catch { setData(null); }
    setLoading(false);
  }, [api, days, provider]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedUsers = data?.user_breakdown?.slice().sort((a, b) => {
    const m = sortDir === 'desc' ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * m;
  }) || [];

  const displayUsers = showAllUsers ? sortedUsers : sortedUsers.slice(0, 5);
  const s = data?.summary || {};
  const hasData = s.total_queries > 0;

  return (
    <div className="space-y-6" data-testid="xaura-usage-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>XAura Usage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time API consumption for OpenAI & Anthropic</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="usage-provider-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="usage-range-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 w-8 p-0" data-testid="usage-refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : !hasData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No usage data yet. Usage is tracked when XAura AI processes queries.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="overflow-hidden group hover:shadow-md transition-shadow" data-testid="usage-card-cost">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estimated Cost</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center"><DollarSign className="w-4 h-4 text-amber-600" /></div>
                </div>
                <p className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#f59e0b' }}>${s.total_cost?.toFixed(4)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{RANGE_OPTIONS.find(r => r.value === days)?.label || ''} period</p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden group hover:shadow-md transition-shadow" data-testid="usage-card-tokens">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Tokens</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center"><Zap className="w-4 h-4 text-indigo-600" /></div>
                </div>
                <p className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#6366f1' }}>{fmt(s.total_tokens)}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>In: {fmt(s.total_input_tokens)}</span>
                  <span>Out: {fmt(s.total_output_tokens)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden group hover:shadow-md transition-shadow" data-testid="usage-card-queries">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Queries</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-emerald-600" /></div>
                </div>
                <p className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#10b981' }}>{s.total_queries}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{data?.provider_breakdown?.length || 0} provider(s) active</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily Usage Chart */}
            <Card className="lg:col-span-2" data-testid="usage-daily-chart">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Daily Usage</p>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <AreaChart data={data.daily_usage} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradTokens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="tokens" name="Tokens" stroke="#6366f1" fill="url(#gradTokens)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="queries" name="Queries" stroke="#10b981" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Model Breakdown */}
            <Card data-testid="usage-model-breakdown">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Model Breakdown</p>
                {data.model_breakdown?.length > 0 ? (
                  <>
                    <div style={{ width: '100%', height: 140 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={data.model_breakdown} dataKey="tokens" nameKey="model" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                            {data.model_breakdown.map((_, i) => (
                              <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-3">
                      {data.model_breakdown.map((m, i) => (
                        <div key={m.model} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                          <span className="flex-1 truncate font-medium">{m.model}</span>
                          <Badge variant="secondary" className="text-[9px] font-mono">{fmt(m.tokens)}</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-xs text-muted-foreground text-center py-8">No model data</p>}
              </CardContent>
            </Card>
          </div>

          {/* Provider Breakdown */}
          {data.provider_breakdown?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.provider_breakdown.map(p => (
                <Card key={p.provider} className="hover:shadow-md transition-shadow" data-testid={`usage-provider-${p.provider}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${PROVIDER_COLORS[p.provider] || '#6b7280'}15` }}>
                      {p.provider === 'openai' ? <Sparkles className="w-5 h-5" style={{ color: PROVIDER_COLORS.openai }} /> : <Brain className="w-5 h-5" style={{ color: PROVIDER_COLORS.anthropic }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold capitalize">{p.provider}</p>
                      <p className="text-[10px] text-muted-foreground">{p.queries} queries</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{fmt(p.tokens)} tokens</p>
                      <p className="text-[10px] text-amber-600 font-medium">${p.cost.toFixed(4)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* User Breakdown Table */}
          {sortedUsers.length > 0 && (
            <Card data-testid="usage-user-table">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User Breakdown</p>
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{sortedUsers.length} user(s)</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {[
                          { key: 'name', label: 'User', align: 'left' },
                          { key: 'role', label: 'Role', align: 'left' },
                          { key: 'queries', label: 'Queries', align: 'right' },
                          { key: 'tokens', label: 'Tokens', align: 'right' },
                          { key: 'cost', label: 'Est. Cost', align: 'right' },
                        ].map(col => (
                          <th key={col.key} className={`pb-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => toggleSort(col.key)}>
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {sortKey === col.key && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                              {sortKey !== col.key && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayUsers.map((u, i) => (
                        <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`usage-user-row-${i}`}>
                          <td className="py-2.5 px-2 font-medium">{u.name}</td>
                          <td className="py-2.5 px-2"><Badge variant="secondary" className="text-[9px] capitalize">{u.role?.replace(/_/g, ' ')}</Badge></td>
                          <td className="py-2.5 px-2 text-right font-mono">{u.queries}</td>
                          <td className="py-2.5 px-2 text-right font-mono">{fmt(u.tokens)}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-amber-600">${u.cost.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedUsers.length > 5 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllUsers(!showAllUsers)} className="w-full mt-2 text-xs gap-1" data-testid="usage-show-all-users">
                    {showAllUsers ? <><ChevronUp className="w-3 h-3" /> Show Less</> : <><ChevronDown className="w-3 h-3" /> Show All ({sortedUsers.length})</>}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
