import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { Database, Trash2, RotateCcw, Camera, History, Users, Shield, AlertTriangle, RefreshCw, Download, ChevronRight, Server } from 'lucide-react';

const fmtBytes = (b) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : b > 1024 ? `${(b/1024).toFixed(1)} KB` : `${b} B`;
const fmtTime = (t) => t ? new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-';

export default function DBManagerPage() {
  const { api, user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [stats, setStats] = useState({});
  const [logs, setLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [users, setUsers] = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetDialog, setResetDialog] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetKeepEmail, setResetKeepEmail] = useState('superadmin@xelements.ai');
  const [snapshotName, setSnapshotName] = useState('');
  const [viewCol, setViewCol] = useState(null);
  const [viewDocs, setViewDocs] = useState([]);
  const [viewTotal, setViewTotal] = useState(0);
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState(null);
  const [overwriteConfirm, setOverwriteConfirm] = useState('');
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'marketing_associate', password: '' });
  const [pwReset, setPwReset] = useState({ userId: '', password: '' });

  const load = useCallback(async () => {
    try {
      const [colRes, logRes, snapRes, userRes, sysRes] = await Promise.allSettled([
        api.get('/api/dbmanager/collections'),
        api.get('/api/dbmanager/logs?limit=50'),
        api.get('/api/dbmanager/snapshots'),
        api.get('/api/dbmanager/users'),
        api.get('/api/dbmanager/system-info'),
      ]);
      if (colRes.status === 'fulfilled') { setCollections(colRes.value.data.collections || []); setStats(colRes.value.data); }
      if (logRes.status === 'fulfilled') setLogs(logRes.value.data || []);
      if (snapRes.status === 'fulfilled') setSnapshots(snapRes.value.data || []);
      if (userRes.status === 'fulfilled') setUsers(userRes.value.data || []);
      if (sysRes.status === 'fulfilled') setSysInfo(sysRes.value.data);
    } catch {}
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const cleanCollection = async (name) => {
    if (!window.confirm(`Delete ALL documents in "${name}"?`)) return;
    try {
      const res = await api.post(`/api/dbmanager/collections/${name}/clean`, { force: true });
      toast.success(`${name}: ${res.data.deleted} docs deleted`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const resetAll = async () => {
    if (resetConfirm !== 'RESET_ALL') { toast.error('Type RESET_ALL to confirm'); return; }
    try {
      const res = await api.post('/api/dbmanager/reset-all', {
        confirm: 'RESET_ALL', new_password: resetPassword || undefined,
        keep_email: resetKeepEmail, keep_users: false,
      });
      toast.success(`Reset complete: ${res.data.total_deleted} docs deleted, ${res.data.users_deleted} users removed`);
      setResetDialog(false); setResetConfirm(''); setResetPassword('');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Reset failed'); }
  };

  const createSnapshot = async () => {
    try {
      const res = await api.post('/api/dbmanager/snapshot', { name: snapshotName || undefined });
      toast.success(`Snapshot "${res.data.name}" created: ${res.data.total_docs} docs`);
      setSnapshotName(''); load();
    } catch (err) { toast.error('Snapshot failed'); }
  };

  const restoreSnapshot = async (id, name, mode = 'replace') => {
    if (!window.confirm(`Restore snapshot "${name}"? Mode: ${mode}. This will ${mode === 'replace' ? 'DELETE existing data first' : 'merge with existing data'}.`)) return;
    try {
      const res = await api.post(`/api/dbmanager/snapshots/${id}/restore`, { mode });
      toast.success(`Restored ${res.data.total_docs} docs from "${name}"`);
      load();
    } catch (err) { toast.error('Restore failed'); }
  };

  const viewCollection = async (name) => {
    try {
      const res = await api.get(`/api/dbmanager/collections/${name}?limit=20`);
      setViewCol(name); setViewDocs(res.data.documents || []); setViewTotal(res.data.total);
    } catch (err) { toast.error('Failed to load'); }
  };

  const createUser = async () => {
    try {
      await api.post('/api/dbmanager/users/create', newUser);
      toast.success(`User ${newUser.email} created`);
      setNewUser({ email: '', name: '', role: 'marketing_associate', password: '' }); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const resetUserPw = async () => {
    try {
      await api.post(`/api/dbmanager/users/${pwReset.userId}/reset-password`, { password: pwReset.password });
      toast.success('Password reset'); setPwReset({ userId: '', password: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto" data-testid="db-manager-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}><Database className="w-6 h-6 text-primary" /> DB Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Full database control — {stats.total_collections || 0} collections, {stats.total_docs || 0} documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh</Button>
          <Button variant="destructive" size="sm" onClick={() => setResetDialog(true)}><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Full Reset</Button>
        </div>
      </div>

      {/* System Info */}
      {sysInfo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'DB Size', value: `${sysInfo.db_size_mb} MB`, icon: Database },
            { label: 'Objects', value: sysInfo.objects, icon: Server },
            { label: 'Collections', value: sysInfo.collections, icon: Database },
            { label: 'Indexes', value: sysInfo.indexes, icon: Shield },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <s.icon className="w-5 h-5 text-primary/60" />
              <div><p className="text-lg font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="collections">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        {/* Collections Tab */}
        <TabsContent value="collections" className="space-y-2 mt-4">
          {collections.map(col => (
            <div key={col.name} className={`flex items-center justify-between p-3 rounded-lg border ${col.protected ? 'bg-amber-50/50 border-amber-200' : 'hover:bg-muted/50'}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{col.name}</span>
                    {col.protected && <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">Protected</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{col.count} docs · {fmtBytes(col.size_bytes)} · {col.indexes} indexes</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7" onClick={() => viewCollection(col.name)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                {!col.protected && col.count > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => cleanCollection(col.name)}><Trash2 className="w-3.5 h-3.5" /></Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Snapshots Tab */}
        <TabsContent value="snapshots" className="space-y-4 mt-4">
          <Card><CardContent className="p-4 flex gap-2">
            <Input placeholder="Snapshot name (optional)" value={snapshotName} onChange={e => setSnapshotName(e.target.value)} className="flex-1" />
            <Button onClick={createSnapshot}><Camera className="w-4 h-4 mr-1" /> Create Snapshot</Button>
          </CardContent></Card>
          {snapshots.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No snapshots yet</p> :
            snapshots.map(s => (
              <Card key={s._id}><CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.total_docs} docs · {s.collections?.length} collections · {fmtTime(s.created_at)} · by {s.created_by}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => restoreSnapshot(s._id, s.name, 'replace')}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore</Button>
                  <Button variant="outline" size="sm" onClick={() => restoreSnapshot(s._id, s.name, 'merge')}>Merge</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => { await api.delete(`/api/dbmanager/snapshots/${s._id}`); toast.success('Deleted'); load(); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent></Card>
            ))
          }
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Create User</CardTitle></CardHeader><CardContent className="flex gap-2 flex-wrap">
            <Input placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-48" />
            <Input placeholder="Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-40" />
            <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['super_admin','marketing_admin','marketing_associate','compliance_admin','inventory_admin','finance_admin','qcqa_tester','db_manager'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-36" />
            <Button onClick={createUser}>Create</Button>
          </CardContent></Card>
          {users.map(u => (
            <div key={u._id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{u.name} <span className="text-muted-foreground">({u.email})</span></p>
                  <div className="flex gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                    <Badge variant={u.is_active ? "default" : "destructive"} className="text-[10px]">{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 items-center">
                <Input placeholder="New password" className="w-32 h-8 text-xs" value={pwReset.userId === u._id ? pwReset.password : ''} onChange={e => setPwReset({ userId: u._id, password: e.target.value })} />
                <Button variant="outline" size="sm" className="h-8" disabled={pwReset.userId !== u._id || !pwReset.password} onClick={resetUserPw}>Reset PW</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <div className="space-y-1">
            {logs.length === 0 ? <p className="text-center text-muted-foreground py-8">No logs yet</p> :
              logs.map((log, i) => (
                <div key={log._id || i} className="flex items-center gap-3 p-2.5 rounded border text-sm">
                  <History className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{log.action}</span>
                    {log.collection && <span className="text-muted-foreground"> · {log.collection}</span>}
                    {log.docs_deleted > 0 && <span className="text-destructive"> · {log.docs_deleted} deleted</span>}
                    {log.total_docs > 0 && <span className="text-primary"> · {log.total_docs} docs</span>}
                    {log.target_email && <span className="text-muted-foreground"> · {log.target_email}</span>}
                    {log.snapshot_name && <span className="text-primary"> · {log.snapshot_name}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{log.actor} · {fmtTime(log.timestamp)}</span>
                </div>
              ))
            }
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4 mt-4">
          {/* Export / Download */}
          <Card><CardContent className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Download className="w-4 h-4 text-primary" /> Export & Download</h3>
            <p className="text-xs text-muted-foreground">Download a complete backup of all data. Use the ZIP for organized folders or Excel for spreadsheet viewing.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Download as Excel</p>
                  <p className="text-xs text-muted-foreground">One sheet per collection. Good for viewing/filtering data.</p>
                </div>
                  <Button variant="outline" onClick={() => {
                  toast.info('Generating Excel...');
                  const token = localStorage.getItem('beatx_token');
                  const url = `${process.env.REACT_APP_BACKEND_URL}/api/dbmanager/export/excel?token=${token}`;
                  window.open(url, '_blank');
                }}><Download className="w-4 h-4 mr-1" /> Excel (.xlsx)</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Download as ZIP</p>
                  <p className="text-xs text-muted-foreground">Organized folders per collection. Includes full backup for restore.</p>
                </div>
                <Button variant="outline" onClick={() => {
                  toast.info('Generating ZIP...');
                  const token = localStorage.getItem('beatx_token');
                  const url = `${process.env.REACT_APP_BACKEND_URL}/api/dbmanager/export/zip?token=${token}`;
                  window.open(url, '_blank');
                }}><Download className="w-4 h-4 mr-1" /> ZIP (.zip)</Button>
              </div>
            </div>
          </CardContent></Card>

          {/* Import from backup */}
          <Card><CardContent className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><RotateCcw className="w-4 h-4 text-primary" /> Import from Backup</h3>
            <p className="text-xs text-muted-foreground">Upload a backup file to restore data. Merge adds only new records. Replace overwrites everything.</p>
            <div className="flex gap-2 items-center">
              <input type="file" accept=".json,.zip,.xlsx" id="import-file" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportFile(file);
                setImportMode('choose');
                e.target.value = '';
              }} />
              <Button variant="outline" onClick={() => document.getElementById('import-file')?.click()}><RotateCcw className="w-4 h-4 mr-1" /> Upload Backup File</Button>
              <span className="text-xs text-muted-foreground">Accepts .json, .zip, or .xlsx</span>
            </div>
          </CardContent></Card>

          {/* Danger Zone */}
          <Card><CardContent className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Danger Zone</h3>
            <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
              <div>
                <p className="font-medium text-sm">Full Database Reset</p>
                <p className="text-xs text-muted-foreground">Deletes all data. Keeps only the specified admin user and system config.</p>
              </div>
              <Button variant="destructive" onClick={() => setResetDialog(true)}>Reset All Data</Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Create Full Snapshot</p>
                <p className="text-xs text-muted-foreground">Saves a copy of ALL collections for later restore.</p>
              </div>
              <Button variant="outline" onClick={createSnapshot}><Camera className="w-4 h-4 mr-1" /> Snapshot Now</Button>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Full Reset Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Full Database Reset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">This will delete ALL data (distributors, agreements, devices, messages, etc.) and remove all users except the one specified below.</p>
            <div className="space-y-2">
              <label className="text-xs font-medium">Keep admin email</label>
              <Input value={resetKeepEmail} onChange={e => setResetKeepEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">New password for admin (optional)</label>
              <Input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Leave empty to keep current" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Type <code className="bg-destructive/10 px-1.5 py-0.5 rounded text-destructive">RESET_ALL</code> to confirm</label>
              <Input value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder="RESET_ALL" className="border-destructive/30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={resetAll} disabled={resetConfirm !== 'RESET_ALL'}>Reset Everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Mode Dialog */}
      {importMode === 'choose' && importFile && (
        <Dialog open={true} onOpenChange={(o) => { if (!o) { setImportMode(null); setImportFile(null); setOverwriteConfirm(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Import Backup — Choose Mode</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">File: <strong>{importFile.name}</strong> ({(importFile.size / 1024).toFixed(0)} KB)</p>
            <div className="space-y-3 py-2">
              <button onClick={async () => {
                setImportMode(null);
                toast.info(`Importing ${importFile.name} (merge mode)...`);
                const formData = new FormData(); formData.append('file', importFile);
                try {
                  const res = await api.post('/api/dbmanager/import-backup?mode=merge', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
                  const d = res.data;
                  toast.success(`Merge complete: ${d.total_added} added, ${d.total_skipped} skipped (duplicates), ${d.collections_processed} collections`);
                  if (d.total_skipped > 0) toast.info(`Skipped collections: ${Object.entries(d.skipped || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
                  if (d.errors) toast.warning(`Errors: ${Object.keys(d.errors).join(', ')}`);
                  load();
                } catch (err) { toast.error('Import failed: ' + (err.response?.data?.detail || err.message)); }
                setImportFile(null);
              }} className="w-full p-4 border-2 border-primary/20 rounded-lg text-left hover:bg-primary/5 transition-colors">
                <p className="font-semibold text-sm text-primary">Merge (Recommended)</p>
                <p className="text-xs text-muted-foreground mt-1">Adds new records only. Existing data stays untouched. Duplicates are skipped safely.</p>
              </button>
              <div className="w-full p-4 border border-destructive/30 rounded-lg space-y-3">
                <div>
                  <p className="font-semibold text-sm text-destructive">Replace (Overwrite)</p>
                  <p className="text-xs text-muted-foreground mt-1">Deletes ALL existing data first, then imports from backup. This cannot be undone.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-destructive">Type <code className="bg-destructive/10 px-1 rounded">OVERWRITE</code> to enable</label>
                  <Input value={overwriteConfirm} onChange={e => setOverwriteConfirm(e.target.value)} placeholder="OVERWRITE" className="h-8 text-sm border-destructive/30" />
                </div>
                <Button variant="destructive" size="sm" disabled={overwriteConfirm !== 'OVERWRITE'} className="w-full" onClick={async () => {
                  setImportMode(null); setOverwriteConfirm('');
                  toast.info(`Importing ${importFile.name} (replace mode — all existing data will be deleted)...`);
                  const formData = new FormData(); formData.append('file', importFile);
                  try {
                    const res = await api.post('/api/dbmanager/import-backup?mode=replace', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
                    toast.success(`Replace complete: ${res.data.total_added} documents imported across ${res.data.collections_processed} collections`);
                    if (res.data.errors) toast.warning(`Errors: ${Object.keys(res.data.errors).join(', ')}`);
                    load();
                  } catch (err) { toast.error('Import failed: ' + (err.response?.data?.detail || err.message)); }
                  setImportFile(null);
                }}>Replace All Data</Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setImportMode(null); setImportFile(null); setOverwriteConfirm(''); }}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Collection Dialog */}
      <Dialog open={!!viewCol} onOpenChange={o => { if (!o) setViewCol(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewCol} ({viewTotal} docs)</DialogTitle></DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto max-h-[60vh]">{JSON.stringify(viewDocs, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
