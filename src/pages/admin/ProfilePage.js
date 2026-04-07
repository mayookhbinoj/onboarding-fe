import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, THEMES } from '../../contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { toast } from 'sonner';
import { User, Mail, Shield, Key, Save, Phone, Palette, Check } from 'lucide-react';

const ROLE_LABELS = {
  super_admin: 'Super Admin', marketing_admin: 'Marketing Admin', marketing_associate: 'Marketing Associate',
  compliance_admin: 'Compliance Admin', inventory_admin: 'Inventory Admin', finance_admin: 'Finance Admin', qcqa_tester: 'QC/QA Tester',
};

export default function ProfilePage() {
  const { user, api } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/api/auth/profile', { name, phone });
      toast.success('Profile updated');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const changePw = async () => {
    if (!currentPw || !newPw || newPw.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await api.put('/api/auth/change-password', { current_password: currentPw, new_password: newPw });
      toast.success('Password changed'); setCurrentPw(''); setNewPw('');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>My Profile</h1><p className="text-sm text-muted-foreground">Manage your account settings</p></div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <Avatar className="w-20 h-20 text-2xl">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h2 className="text-lg font-semibold">{user?.name}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-1">{ROLE_LABELS[user?.role] || user?.role}</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." /></div>
            </div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label><Input value={user?.email || ''} disabled className="bg-muted" /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Role</Label><Input value={ROLE_LABELS[user?.role] || user?.role || ''} disabled className="bg-muted" /></div>
            <Button onClick={saveProfile} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save Profile'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4" /> Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></div>
          <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 6 characters" /></div>
          <Button variant="outline" onClick={changePw} disabled={saving || !currentPw || !newPw}>{saving ? 'Changing...' : 'Change Password'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Palette className="w-4 h-4" /> Theme</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">Choose a color theme for the application</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => { setTheme(key); toast.success(`Theme: ${t.name}`); }}
                className={`relative p-3 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-md ${theme === key ? 'border-primary shadow-md scale-[1.02]' : 'border-transparent bg-muted/30 hover:border-muted-foreground/20'}`}
              >
                {theme === key && <div className="absolute top-1.5 right-1.5"><Check className="w-4 h-4 text-primary" /></div>}
                <div className="flex gap-1 mb-2">
                  {t.preview.map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-xs font-medium">{t.name}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
