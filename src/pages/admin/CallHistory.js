import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/badge';
import { Phone, Video, PhoneIncoming, PhoneOff, PhoneMissed } from 'lucide-react';
import DataTable from '../../components/DataTable';

const EVENT_LABELS = {
  call_initiated: { label: 'Ring', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: PhoneIncoming },
  call_accepted: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Phone },
  call_accept: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Phone },
  call_decline: { label: 'Declined', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: PhoneOff },
  call_end: { label: 'Ended', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: PhoneOff },
  call_busy: { label: 'Busy', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: PhoneMissed },
  call_missed: { label: 'Missed', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: PhoneMissed },
  call_cancelled: { label: 'Cancelled', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: PhoneOff },
  vcall_initiated: { label: 'Ring', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: PhoneIncoming },
  vcall_accepted: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Video },
  vcall_decline: { label: 'Declined', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: PhoneOff },
  vcall_end: { label: 'Ended', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: PhoneOff },
  vcall_busy: { label: 'Busy', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: PhoneMissed },
  vcall_missed: { label: 'Missed', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: PhoneMissed },
  vcall_cancelled: { label: 'Cancelled', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: PhoneOff },
};

const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';

export default function CallHistory() {
  const { api } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/api/call/history?limit=200'); setEvents(res.data || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const columns = [
    { key: 'timestamp', label: 'Time', render: (v) => <span className="text-muted-foreground">{fmtTime(v)}</span> },
    { key: 'call_type', label: 'Type', render: (v) => <Badge variant="outline" className={`text-[9px] gap-1 ${v === 'video' ? 'border-purple-200 text-purple-700' : 'border-blue-200 text-blue-700'}`}>{v === 'video' ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}{v === 'video' ? 'Video' : 'Voice'}</Badge> },
    { key: 'event', label: 'Event', render: (v) => { const info = EVENT_LABELS[v] || { label: v, color: 'bg-muted text-muted-foreground', icon: Phone }; const Icon = info.icon; return <Badge className={`text-[9px] gap-1 ${info.color}`}><Icon className="w-3 h-3" /> {info.label}</Badge>; } },
    { key: 'caller_name', label: 'Caller', render: (v, row) => <div><p className="font-medium">{v || '-'}</p><p className="text-[10px] text-muted-foreground">{row.caller_email || ''}</p></div> },
    { key: 'callee_name', label: 'Callee', render: (v, row) => <div><p className="font-medium">{v || '-'}</p><p className="text-[10px] text-muted-foreground">{row.callee_email || ''}</p></div> },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto" data-testid="call-history-page">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Call History</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Voice and video call event log</p>
      </div>
      <DataTable
        testId="call-history-table"
        columns={columns}
        data={events}
        loading={loading}
        searchFields={['caller_name', 'callee_name', 'caller_email', 'callee_email']}
        searchPlaceholder="Search by name or email..."
        statusOptions={[{ value: 'voice', label: 'Voice' }, { value: 'video', label: 'Video' }]}
        statusField="call_type"
        emptyMessage="No call events recorded yet"
        onRefresh={load}
        exportable
        exportFilename="call_history"
      />
    </div>
  );
}
