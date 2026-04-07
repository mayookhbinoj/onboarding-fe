import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, KeyRound } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Force white/default theme on login page — reset everything
  useEffect(() => {
    localStorage.setItem('beatx-theme', 'default');
    document.body.classList.remove('dark-theme');
    // Reset all CSS variables to default light theme
    const root = document.documentElement;
    root.style.setProperty('--background', '210 40% 98%');
    root.style.setProperty('--foreground', '222 47% 11%');
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '222 47% 11%');
    root.style.setProperty('--popover', '0 0% 100%');
    root.style.setProperty('--popover-foreground', '222 47% 11%');
    root.style.setProperty('--primary', '217 91% 53%');
    root.style.setProperty('--primary-foreground', '0 0% 100%');
    root.style.setProperty('--muted', '210 40% 96%');
    root.style.setProperty('--muted-foreground', '215 16% 47%');
    root.style.setProperty('--border', '214 32% 91%');
    root.style.setProperty('--input', '214 32% 91%');
    root.style.setProperty('--accent', '199 89% 48%');
    root.style.setProperty('--ring', '217 91% 53%');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Reset theme to default white on every login
      localStorage.setItem('beatx-theme', 'default');
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials');
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail || !forgotEmail.includes('@')) { toast.error('Please enter a valid email'); return; }
    setForgotLoading(true);
    try {
      await axios.post(`${API}/api/auth/request-password-reset`, { email: forgotEmail });
      toast.success('If your email is registered, the Super Admin has been notified to reset your password.');
      setShowForgot(false);
      setForgotEmail('');
    } catch { toast.error('Request failed. Please try again.'); }
    setForgotLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Left — Exact background image from original design */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img src="/login-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/beatx-logo.jpeg" alt="BeatX" className="h-10 object-contain" />
          </div>
          <Card className="shadow-lg" data-testid="admin-login-card">
            <CardHeader>
              <CardTitle className="text-2xl" style={{ fontFamily: 'Space Grotesk' }}>Sign In</CardTitle>
              <CardDescription>Access the admin portal</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input data-testid="admin-login-email-input" id="email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      data-testid="admin-login-password-input"
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="toggle-password-visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setShowForgot(true); }}
                    className="text-xs text-primary hover:underline"
                    data-testid="forgot-password-link"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Button data-testid="admin-login-submit-button" type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgot} onOpenChange={setShowForgot}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Forgot Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your email address. The Super Admin will be notified to reset your password.</p>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="Enter your registered email" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForgot(false)}>Cancel</Button>
              <Button onClick={handleForgotPassword} disabled={forgotLoading}>{forgotLoading ? 'Sending...' : 'Request Reset'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
