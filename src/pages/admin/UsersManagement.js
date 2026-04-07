import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Users, Shield, KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import DataTable from '../../components/DataTable';

const ROLE_LABELS = {
  super_admin: 'Super Admin', marketing_admin: 'Marketing Admin', marketing_associate: 'Marketing Associate',
  compliance_admin: 'Compliance Admin', inventory_admin: 'Inventory Admin', finance_admin: 'Finance Admin', qcqa_tester: 'QC/QA Tester',
};

export default function UsersManagement() {
  const { api, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'marketing_associate' });
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Password reset
  const [resetDialog, setResetDialog] = useState(null); // {userId, userName, email}
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Password reset requests
  const [resetRequests, setResetRequests] = useState([]);

  useEffect(() => { loadUsers(); loadResetRequests(); }, []);

  const loadUsers = async () => {
    try { const res = await api.get('/api/users'); setUsers(res.data); } catch {}
    setLoading(false);
  };

  const loadResetRequests = async () => {
    try { const res = await api.get('/api/password-reset-requests'); setResetRequests(res.data || []); } catch {}
  };

  const createUser = async () => {
    setCreating(true);
    try {
      await api.post('/api/users', form);
      toast.success('User created!');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'marketing_associate' });
      loadUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create user'); }
    setCreating(false);
  };

  const toggleActive = async (userId) => {
    try { await api.put(`/api/users/${userId}/toggle-active`); toast.success('User updated!'); loadUsers(); } catch { toast.error('Failed'); }
  };

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`Permanently delete user "${userName}"? This cannot be undone.`)) return;
    try { await api.delete(`/api/users/${userId}`); toast.success('User deleted'); loadUsers(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const resetUserPassword = async () => {
    if (!resetDialog || !newPassword) return;
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setResetting(true);
    try {
      await api.put(`/api/users/${resetDialog.userId}/reset-password`, { new_password: newPassword });
      toast.success(`Password reset for ${resetDialog.email}`);
      setResetDialog(null);
      setNewPassword('');
      loadResetRequests();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setResetting(false);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const availableRoles = currentUser?.role === 'marketing_admin' ? ['marketing_associate'] : Object.keys(ROLE_LABELS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>User Management</h1><p className="text-sm text-muted-foreground mt-1">Manage internal portal users</p></div>
        <Button onClick={() => setShowCreate(true)} data-testid="create-user-btn"><UserPlus className="w-4 h-4 mr-2" /> Create User</Button>
      </div>

      {/* Password Reset Requests */}
      {isSuperAdmin && resetRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Password Reset Requests ({resetRequests.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {resetRequests.map(req => (
              <div key={req._id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{req.name} <Badge variant="outline" className="text-[10px] ml-1">{ROLE_LABELS[req.role] || req.role}</Badge></p>
                  <p className="text-xs text-muted-foreground">{req.email} — requested {new Date(req.requested_at).toLocaleString()}</p>
                </div>
                <Button size="sm" onClick={() => { setResetDialog({ userId: req.user_id, userName: req.name, email: req.email }); setNewPassword(''); }} data-testid={`reset-pw-${req.email}`}>
                  <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Password
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            testId="users-table"
            columns={[
              { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v}</span> },
              { key: 'email', label: 'Email', render: (v) => <span className="text-muted-foreground">{v}</span> },
              { key: 'role', label: 'Role', render: (v) => <Badge variant="outline" className="text-xs">{ROLE_LABELS[v] || v}</Badge> },
              { key: 'is_active', label: 'Status', render: (v) => <Badge variant={v !== false ? 'default' : 'secondary'} className="text-xs">{v !== false ? 'Active' : 'Inactive'}</Badge> },
              { key: '_actions', label: 'Actions', sortable: false, render: (_, u) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); toggleActive(u._id); }}>{u.is_active !== false ? 'Disable' : 'Enable'}</Button>
                  {isSuperAdmin && <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setResetDialog({ userId: u._id, userName: u.name, email: u.email }); setNewPassword(''); }}><KeyRound className="w-3.5 h-3.5 mr-1" /> Password</Button>}
                  {isSuperAdmin && u.email !== currentUser?.email && <Button variant="ghost" size="sm" className="text-destructive" onClick={e => { e.stopPropagation(); deleteUser(u._id, u.name); }}>Delete</Button>}
                </div>
              )},
            ]}
            data={users}
            loading={loading}
            searchFields={['name', 'email', 'role']}
            searchPlaceholder="Search users..."
            statusOptions={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
            statusField="is_active"
            emptyMessage="No users found"
            onRefresh={loadUsers}
            exportable
            exportFilename="users"
          />
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{availableRoles.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button onClick={createUser} disabled={creating || !form.name || !form.email || !form.password}>{creating ? 'Creating...' : 'Create User'}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetDialog} onOpenChange={v => { if (!v) setResetDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{resetDialog?.userName}</p>
              <p className="text-xs text-muted-foreground">{resetDialog?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="pr-10"
                  data-testid="new-password-input"
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetDialog(null)}>Cancel</Button>
              <Button onClick={resetUserPassword} disabled={resetting || newPassword.length < 8}>{resetting ? 'Resetting...' : 'Reset Password'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
