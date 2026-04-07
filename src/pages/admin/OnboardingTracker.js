import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import DataTable from '../../components/DataTable';
import { UserPlus, FileText, ShieldCheck, Package, CheckCircle, Clock, DollarSign, Search, ArrowLeft, ChevronLeft, ChevronRight, ArrowUpDown, Filter, X } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

const PIPELINE_STEPS = [
  { key: 'invited', label: 'Invited', statuses: ['INVITED', 'LINK_OPENED'], color: '#0ea5e9' },
  { key: 'progress', label: 'In Progress', statuses: ['VIDEOS_VIEWED', 'FORM_IN_PROGRESS'], color: '#64748b' },
  { key: 'submitted', label: 'Submitted', statuses: ['FORM_SUBMITTED', 'FINANCE_PROFILE_REVIEW'], color: '#3b82f6' },
  { key: 'finance', label: 'Finance Review', statuses: ['FINANCE_PROFILE_APPROVED'], color: '#f59e0b' },
  { key: 'agreement', label: 'Agreement', statuses: ['AGREEMENT_DRAFT_GENERATED', 'AGREEMENT_SENT', 'AWAITING_SIGNATURE', 'SIGNED_RECEIVED'], color: '#f97316' },
  { key: 'compliance', label: 'Compliance', statuses: ['COMPLIANCE_REVIEW', 'COMPLIANCE_REJECTED'], color: '#a855f7' },
  { key: 'fulfillment', label: 'Fulfillment', statuses: ['COMPLIANCE_APPROVED', 'INVENTORY_PROCESSING', 'SHIPPED', 'SENT_TO_PROCUREMENT', 'FINANCE_NOTIFIED'], color: '#8b5cf6' },
  { key: 'complete', label: 'Complete', statuses: ['ONBOARDING_COMPLETE'], color: '#10b981' },
];

const getStepIdx = (status) => {
  for (let i = PIPELINE_STEPS.length - 1; i >= 0; i--) {
    if (PIPELINE_STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
};

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PAGE_SIZE = 25;

export default function OnboardingTracker() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStep, setFilterStep] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [sortField, setSortField] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    api.get('/api/distributors').then(res => {
      setClients(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let result = clients.filter(c => {
      const name = (c.company_name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
      const email = (c.email || '').toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
      const stepIdx = getStepIdx(c.status);
      const matchesStep = filterStep === 'all' || PIPELINE_STEPS[parseInt(filterStep)]?.key === PIPELINE_STEPS[stepIdx]?.key;
      const matchesEntity = filterEntity === 'all' || c.entity_type === filterEntity;
      return matchesSearch && matchesStep && matchesEntity;
    });

    result.sort((a, b) => {
      let va, vb;
      if (sortField === 'name') {
        va = (a.company_name || `${a.first_name || ''} ${a.last_name || ''}`).toLowerCase();
        vb = (b.company_name || `${b.first_name || ''} ${b.last_name || ''}`).toLowerCase();
      } else if (sortField === 'status') {
        va = getStepIdx(a.status);
        vb = getStepIdx(b.status);
      } else if (sortField === 'days_idle') {
        va = daysSince(a.updated_at) || 9999;
        vb = daysSince(b.updated_at) || 9999;
      } else {
        va = a[sortField] || '';
        vb = b[sortField] || '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [clients, search, filterStep, filterEntity, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterStep, filterEntity]);

  // Stage summary counts
  const stageCounts = useMemo(() => {
    const counts = {};
    PIPELINE_STEPS.forEach(s => { counts[s.key] = 0; });
    clients.forEach(c => {
      const idx = getStepIdx(c.status);
      counts[PIPELINE_STEPS[idx].key]++;
    });
    return counts;
  }, [clients]);

  const hasActiveFilters = search || filterStep !== 'all' || filterEntity !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFilterStep('all');
    setFilterEntity('all');
  };

  const SortIcon = ({ field }) => (
    <ArrowUpDown className={`w-3 h-3 ml-1 inline-block cursor-pointer transition-colors ${sortField === field ? 'text-primary' : 'text-muted-foreground/40'}`} onClick={() => toggleSort(field)} />
  );

  if (loading) {
    return (
      <div className="space-y-6" data-testid="onboarding-tracker-loading">
        <Skeleton className="h-9 w-64" />
        <div className="flex gap-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 flex-1" />)}</div>
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="onboarding-tracker-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} data-testid="tracker-back-btn">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Client Onboarding Tracker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{clients.length} total clients</p>
        </div>
      </div>

      {/* Stage summary cards */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {PIPELINE_STEPS.map((step, i) => (
          <button
            key={step.key}
            data-testid={`tracker-stage-${step.key}`}
            onClick={() => setFilterStep(filterStep === String(i) ? 'all' : String(i))}
            className={`rounded-lg border p-2 text-center transition-all hover:shadow-sm cursor-pointer ${filterStep === String(i) ? 'ring-2 ring-offset-1 bg-white shadow-sm' : 'bg-card'}`}
            style={filterStep === String(i) ? { ringColor: step.color, borderColor: step.color } : {}}
          >
            <p className="text-lg font-semibold" style={{ color: step.color }}>{stageCounts[step.key]}</p>
            <p className="text-[9px] text-muted-foreground leading-tight">{step.label}</p>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="tracker-search"
            placeholder="Search name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5" data-testid="tracker-toggle-filters">
          <Filter className="w-3.5 h-3.5" /> Filters
          {hasActiveFilters && <Badge className="ml-1 h-4 w-4 p-0 text-[9px] justify-center rounded-full">!</Badge>}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs text-muted-foreground">
            <X className="w-3 h-3" /> Clear
          </Button>
        )}
        <Badge variant="outline" className="text-[10px] shrink-0 ml-auto">{filtered.length} of {clients.length}</Badge>
      </div>

      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="p-3 flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Stage</Label>
              <Select value={filterStep} onValueChange={setFilterStep}>
                <SelectTrigger className="w-40 h-8 text-xs" data-testid="tracker-filter-stage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {PIPELINE_STEPS.map((step, i) => <SelectItem key={step.key} value={String(i)}>{step.label} ({stageCounts[step.key]})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Entity Type</Label>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-40 h-8 text-xs" data-testid="tracker-filter-entity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="unregistered">Unregistered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <DataTable
        testId="onboarding-tracker-table"
        columns={[
          { key: '_name', label: 'Client', render: (_, c) => {
            const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
            return <div><p className="text-xs font-medium truncate max-w-[180px]">{name || '-'}</p><p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{c.email}</p></div>;
          }},
          { key: 'status', label: 'Stage', render: (v) => {
            const stepIdx = getStepIdx(v);
            const step = PIPELINE_STEPS[stepIdx];
            return <Badge variant="outline" className="text-[9px]" style={{ borderColor: step.color + '50', color: step.color, backgroundColor: step.color + '08' }}>{step.label}</Badge>;
          }},
          { key: '_detail', label: 'Status Detail', render: (_, c) => <span className="text-[10px] text-muted-foreground">{(c.status || '').replace(/_/g, ' ')}</span> },
          { key: 'entity_type', label: 'Type', render: (v) => <span className="text-[10px] capitalize">{v === 'private' ? 'Unregistered' : v || '-'}</span> },
          { key: 'updated_at', label: 'Last Updated', render: (v) => <span className="text-[10px]">{formatDate(v)}</span> },
          { key: '_idle', label: 'Days Idle', render: (_, c) => {
            const idle = daysSince(c.updated_at);
            return idle !== null ? <span className={`text-[10px] font-medium ${idle > 7 ? 'text-rose-500' : idle > 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{idle}d</span> : '-';
          }},
          { key: '_progress', label: 'Progress', width: '120px', render: (_, c) => {
            const stepIdx = getStepIdx(c.status);
            const step = PIPELINE_STEPS[stepIdx];
            const progress = ((stepIdx + 1) / PIPELINE_STEPS.length) * 100;
            return <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${PIPELINE_STEPS[0].color}, ${step.color})` }} /></div>;
          }},
        ]}
        data={filtered}
        loading={loading}
        searchFields={['first_name', 'last_name', 'company_name', 'email']}
        searchPlaceholder="Search name, company, or email..."
        emptyMessage="No clients match your filters"
        onRowClick={(c) => navigate(`/admin/distributors/${c._id}`)}
        pageSize={PAGE_SIZE}
        exportable
        exportFilename="onboarding_tracker"
      />
    </div>
  );
}
