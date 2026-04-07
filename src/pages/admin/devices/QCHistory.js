import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { CheckCircle, XCircle, AlertTriangle, Search, Download, FileText, Image, RefreshCw, ChevronDown, ArrowLeft, Eye } from 'lucide-react';
import DataTable from '../../../components/DataTable';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const resultBadge = (r) => {
  if (r === 'PASSED') return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1"><CheckCircle className="w-3 h-3" /> Passed</Badge>;
  if (r === 'NONCONFORMING') return <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] gap-1"><XCircle className="w-3 h-3" /> Non-Conforming</Badge>;
  return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1"><AlertTriangle className="w-3 h-3" /> In Progress</Badge>;
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export default function QCHistory() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [testerFilter, setTesterFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [exportOpen, setExportOpen] = useState(null); // test_id or 'bulk'

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('result', filter);
      if (testerFilter) params.set('tester', testerFilter);
      if (search) params.set('device_sn', search);
      const r = await api.get(`/api/devices-module/qc-history?${params}`);
      setTests(r.data || []);
    } catch { toast.error('Failed to load QC history'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const filteredTests = tests.filter(t => {
    if (search && !t.device_serial?.toLowerCase().includes(search.toLowerCase())) return false;
    if (testerFilter && !t.tester_email?.toLowerCase().includes(testerFilter.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    if (selected.size === filteredTests.length) setSelected(new Set());
    else setSelected(new Set(filteredTests.map(t => t._id)));
  };

  const downloadExport = async (testId, format) => {
    try {
      const r = await api.get(`/api/devices-module/qc-history/${testId}/export?format=${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url;
      const ext = format === 'html' ? 'html' : format === 'csv' ? 'csv' : 'json';
      a.download = `QC-Report-${testId.slice(0, 8)}.${ext}`;
      a.click(); window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${format.toUpperCase()} report`);
    } catch { toast.error('Download failed'); }
    setExportOpen(null);
  };

  const bulkExport = async (format) => {
    if (selected.size === 0) { toast.error('Select tests first'); return; }
    try {
      if (format === 'csv') {
        const r = await api.post('/api/devices-module/qc-history/bulk-export', { test_ids: [...selected] }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(r.data);
        const a = document.createElement('a'); a.href = url; a.download = 'QC-Bulk-Export.csv'; a.click(); window.URL.revokeObjectURL(url);
        toast.success(`Exported ${selected.size} tests as CSV`);
      } else {
        // For other formats, export individually
        for (const tid of selected) { await downloadExport(tid, format); }
      }
    } catch { toast.error('Bulk export failed'); }
    setExportOpen(null);
  };

  const passCount = tests.filter(t => t.result === 'PASSED').length;
  const failCount = tests.filter(t => t.result === 'NONCONFORMING').length;
  const progressCount = tests.filter(t => !t.result || t.result === 'IN_PROGRESS').length;

  return (
    <div className="space-y-5" data-testid="qc-history-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/devices')}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>QC/QA History</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{tests.length} total tests</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setFilter('PASSED')}>
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <div><p className="text-lg font-bold text-emerald-600">{passCount}</p><p className="text-[10px] text-muted-foreground">Passed</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setFilter('NONCONFORMING')}>
          <CardContent className="p-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-500" />
            <div><p className="text-lg font-bold text-rose-600">{failCount}</p><p className="text-[10px] text-muted-foreground">Non-Conforming</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setFilter('all')}>
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div><p className="text-lg font-bold text-amber-600">{progressCount}</p><p className="text-[10px] text-muted-foreground">In Progress</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters handled by DataTable — keep summary cards + custom tester filter */}
      <div className="flex items-center gap-2">
        <Input value={testerFilter} onChange={e => setTesterFilter(e.target.value)} placeholder="Filter by tester..." className="h-9 max-w-[200px]" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="PASSED">Passed Only</SelectItem>
            <SelectItem value="NONCONFORMING">Non-Conforming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        testId="qc-history-table"
        columns={[
          { key: 'device_serial', label: 'Device SN', render: (v) => <span className="font-mono font-medium">{v || '-'}</span> },
          { key: 'result', label: 'Result', render: (v) => resultBadge(v) },
          { key: 'tester_email', label: 'Tester', render: (v) => <span className="text-muted-foreground">{v?.split('@')[0] || '-'}</span> },
          { key: 'started_at', label: 'Date', render: (v) => <span>{fmtDate(v)}</span> },
          { key: 'test_duration_minutes', label: 'Duration', render: (v) => <span>{v || '-'}m</span> },
          { key: 'edf_count', label: 'EDF', render: (v) => <Badge variant="outline" className="text-[9px] gap-1"><FileText className="w-3 h-3" /> {v || 0}</Badge> },
          { key: 'image_count', label: 'Images', render: (v) => <Badge variant="outline" className="text-[9px] gap-1"><Image className="w-3 h-3" /> {v || 0}</Badge> },
          { key: '_actions', label: '', sortable: false, width: '80px', render: (_, t) => (
            <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDetail(t)}><Eye className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExportOpen(t._id)}><Download className="w-3.5 h-3.5" /></Button>
            </div>
          )},
        ]}
        data={filteredTests}
        loading={loading}
        searchFields={['device_serial', 'tester_email']}
        searchPlaceholder="Search device SN or tester..."
        emptyMessage="No QC tests found"
        onRowClick={(t) => setDetail(t)}
        onRefresh={load}
        selectable
        bulkActions={[{ label: `Export ${selected.size}`, onClick: () => setExportOpen('bulk') }]}
        exportable
        exportFilename="qc_history"
      />

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  QC Test — {detail.device_serial || detail._id?.slice(0, 8)}
                  <span className="ml-2">{resultBadge(detail.result)}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Device Serial:</span><p className="font-mono font-medium">{detail.device_serial}</p></div>
                  <div><span className="text-muted-foreground">Device MAC:</span><p className="font-mono">{detail.device_mac || '-'}</p></div>
                  <div><span className="text-muted-foreground">Tester:</span><p>{detail.tester_email}</p></div>
                  <div><span className="text-muted-foreground">Duration:</span><p>{detail.test_duration_minutes}m, {detail.num_runs} run(s)</p></div>
                  <div><span className="text-muted-foreground">Started:</span><p>{fmtDate(detail.started_at)}</p></div>
                  <div><span className="text-muted-foreground">Completed:</span><p>{fmtDate(detail.completed_at)}</p></div>
                  {detail.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span><p>{detail.notes}</p></div>}
                  {detail.nonconformance_reason && <div className="col-span-2"><span className="text-muted-foreground">Non-Conformance Reason:</span><p className="text-rose-600">{detail.nonconformance_reason}</p></div>}
                </div>

                {detail.artifacts?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Artifacts ({detail.artifacts.length})</h3>
                    <div className="space-y-2">
                      {detail.artifacts.map((a, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg border text-xs">
                          <Badge variant="outline" className="text-[9px]">{a.type}</Badge>
                          <span className="flex-1 truncate">{a.file_name}</span>
                          {a.file_url && (
                            <a href={`${BACKEND}${a.file_url}`} download className="text-primary hover:underline text-[11px]">Download</a>
                          )}
                          {a.type === 'IMAGE' && a.file_url && (
                            <img src={`${BACKEND}${a.file_url}`} alt="" className="w-16 h-10 object-cover rounded border" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => setExportOpen(detail._id)} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Export</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Format Dialog */}
      <Dialog open={!!exportOpen} onOpenChange={() => setExportOpen(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Choose Export Format</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              { fmt: 'json', label: 'JSON', desc: 'Full data' },
              { fmt: 'csv', label: 'CSV', desc: 'Spreadsheet' },
              { fmt: 'html', label: 'HTML', desc: 'Themed report' },
            ].map(f => (
              <button key={f.fmt}
                onClick={() => exportOpen === 'bulk' ? bulkExport(f.fmt) : downloadExport(exportOpen, f.fmt)}
                className="p-3 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all text-left">
                <p className="text-xs font-semibold">{f.label}</p>
                <p className="text-[9px] text-muted-foreground">{f.desc}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
