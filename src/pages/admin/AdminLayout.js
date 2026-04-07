import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Activity, LayoutDashboard, Users, UserPlus, ShieldCheck, Package, DollarSign, Settings, Video, Bell, LogOut, Menu, X, ChevronRight, Cpu, FlaskConical, Truck, RotateCcw, Box, Building2, FileText, History, MessageCircle, Trash2, BookOpen, ThumbsUp, Lightbulb, MessageSquareText, Copy, Database } from 'lucide-react';
import { BeatXLogo } from '../../components/BeatXLogo';

import GlobalVoiceCall from './VoiceCall';
import GlobalVideoCall from './VideoCall';
import GlobalGroupCall from './GroupCall';
import XAuraChat from './XAuraChat';
import { requestNotificationPermission } from '../../utils/callNotifications';
const ROLE_LABELS = {
  super_admin: 'Super Admin',
  marketing_admin: 'Marketing Admin',
  marketing_associate: 'Marketing Associate',
  compliance_admin: 'Compliance Admin',
  inventory_admin: 'Inventory Admin',
  finance_admin: 'Finance Admin',
  qcqa_tester: 'QC/QA Tester',
};

export default function AdminLayout() {
  const { user, logout, api } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [actionCounts, setActionCounts] = useState({});
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [xauraOpen, setXauraOpen] = useState(false);
  const [xauraMode, setXauraMode] = useState('full');
  const [xauraDrop, setXauraDrop] = useState(null); // {x, y} where icon was dropped
  const [xauraNewSession, setXauraNewSession] = useState(0);
  const xauraDragRef = useRef(null);
  const longPressTimer = useRef(null);
  const [draggingXaura, setDraggingXaura] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const prevCountsRef = useRef('{}');
  const role = user?.role || '';

  // Batch-fetch all badge counts in one cycle to prevent flicker
  useEffect(() => {
    // Request browser notification permission for incoming calls
    requestNotificationPermission();

    const fetchCounts = async () => {
      if (!api) return;
      const nc = {};
      try {
        const [msgRes, notifRes] = await Promise.all([
          api.get('/api/messages/unread-total').catch(() => ({ data: {} })),
          api.get('/api/notifications/unread-count-v2').catch(() => ({ data: {} })),
        ]);
        const msgTotal = msgRes.data?.total || 0;
        const nCount = notifRes.data?.count || 0;

        const rolePromises = [];
        // Compliance review count + FINANCE_PROFILE_APPROVED count for Business Associates badge
        if (['compliance_admin','super_admin'].includes(role)) {
          rolePromises.push(api.get('/api/compliance/queue').then(r => {
            nc.compliance_review = (r.data||[]).filter(q => q.distributor?.status === 'COMPLIANCE_REVIEW').length;
          }).catch(() => {}));
          rolePromises.push(api.get('/api/distributors').then(r => {
            nc.finance_approved_count = (r.data||[]).filter(d => d.status === 'FINANCE_PROFILE_APPROVED').length;
          }).catch(() => {}));
        }
        // Finance profile reviews
        if (['finance_admin','super_admin'].includes(role)) {
          rolePromises.push(api.get('/api/finance/profile-reviews').then(r => { nc.finance_reviews = (r.data||[]).length; }).catch(() => {}));
        }
        // Deletion requests
        if (['finance_admin','compliance_admin','super_admin'].includes(role)) {
          rolePromises.push(api.get('/api/deletion-requests/count').then(r => { nc.deletion_requests = r.data?.count || 0; }).catch(() => {}));
        }
        // Prep requests + shipment alerts
        if (['inventory_admin','marketing_admin','marketing_associate','super_admin'].includes(role)) {
          rolePromises.push(
            api.get('/api/prep-requests').then(r => { nc.prep_requests = (r.data||[]).filter(x => x.status !== 'completed').length; }).catch(() => {}),
            api.get('/api/device-readiness').then(r => { if (r.data?.is_low) nc.shipment_alert = r.data.shortfall || 0; }).catch(() => {})
          );
        }
        // QC queue count
        if (['qcqa_tester','super_admin'].includes(role)) {
          rolePromises.push(api.get('/api/devices-module/qc/queue').then(r => { nc.qc_queue = (r.data||[]).length; }).catch(() => {}));
          rolePromises.push(api.get('/api/devices-module/devices').then(r => { nc.packaging_queue = (r.data||[]).filter(d => d.status === 'PACKAGING').length; nc.open_shipments = (r.data||[]).filter(d => d.status === 'SHIP_REQUESTED').length; }).catch(() => {}));
        }
        // Distributors/hospitals action counts
        if (['compliance_admin','super_admin','marketing_admin','marketing_associate'].includes(role)) {
          rolePromises.push(api.get('/api/action-required-counts').then(r => {
            nc.distributors_action = r.data?.distributors_action || r.data?.total || 0;
          }).catch(() => {}));
        }
        await Promise.all(rolePromises);
        // For compliance_admin, Business Associates badge = FINANCE_PROFILE_APPROVED count
        if (['compliance_admin'].includes(role)) {
          nc.distributors_action = nc.finance_approved_count || 0;
        }

        // Improvement feedback counts (all roles see their own, super_admin sees all)
        try {
          const impRes = await api.get('/api/improvements');
          const imps = impRes.data || [];
          nc.help_improve = imps.filter(i => i.status === 'open').length;
          if (role === 'super_admin') {
            nc.user_comments = imps.filter(i => i.status === 'open').length;
          }
        } catch {}

        // Single batched update — only if values changed (prevents flicker)
        const ncStr = JSON.stringify(nc);
        if (ncStr !== prevCountsRef.current) { prevCountsRef.current = ncStr; setActionCounts(nc); }
        setUnreadMessages(prev => prev !== msgTotal ? msgTotal : prev);
        setNotifCount(prev => prev !== nCount ? nCount : prev);
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, [api, role]);

  // Real-time socket updates for ALL badge types
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.type === 'unread:update' || data.type === 'message:new') {
        api.get('/api/messages/unread-total').then(r => setUnreadMessages(r.data.total || 0)).catch(() => {});
      }
      if (data.type === 'notification:new' || data.type === 'badge:refresh') {
        api.get('/api/notifications/unread-count-v2').then(r => setNotifCount(r.data.count || 0)).catch(() => {});
      }
      // Missed call notification toast
      if (data.type === 'notification:new' && data.call_event === 'missed') {
        toast.error(`${data.title}: ${data.body}`, { duration: 6000 });
      }
      if (data.type === 'call:ring' && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Incoming Voice Call', { body: `${data.from_user_name} is calling...`, icon: '/favicon.ico', tag: 'voice-call', requireInteraction: true });
      }
    };
    socket.addListener(handler);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    return () => socket.removeListener(handler);
  }, [socket, api]);

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin','marketing_admin','marketing_associate','compliance_admin','inventory_admin','finance_admin','qcqa_tester','db_manager'], end: true },
    { to: '/admin/messages', icon: MessageCircle, label: 'Messages', roles: ['super_admin','marketing_admin','marketing_associate','compliance_admin','inventory_admin','finance_admin','qcqa_tester'], badgeKey: 'messages' },
    { to: '/admin/devices/ready-to-ship', icon: Package, label: 'Shipment Request', roles: ['super_admin','marketing_associate','marketing_admin'], badgeKey: 'shipment_alert' },
    { to: '/admin/devices/allocations', icon: Truck, label: 'Shipment Status', roles: ['super_admin','marketing_associate','marketing_admin','inventory_admin'], badgeKey: 'open_shipments' },
    { to: '/admin/devices/packaging', icon: Package, label: 'Packaging', roles: ['super_admin','inventory_admin'], badgeKey: 'packaging_queue' },
    { to: '/admin/business-associates', icon: Users, label: 'Business Associates', roles: ['super_admin','marketing_admin','marketing_associate','compliance_admin','inventory_admin','finance_admin'], badgeKey: 'distributors_action' },
    { to: '/admin/users', icon: Users, label: 'User Management', roles: ['super_admin','marketing_admin'] },
    { to: '/admin/create-invite', icon: UserPlus, label: 'Create Invite', roles: ['super_admin','marketing_admin','marketing_associate'] },
    { to: '/admin/manage-invites', icon: FileText, label: 'Manage Invites', roles: ['super_admin','marketing_admin','marketing_associate'] },
    { to: '/admin/duplicate-review', icon: Copy, label: 'Duplicate Review', roles: ['super_admin','marketing_admin','marketing_associate','compliance_admin','finance_admin'] },
    { to: '/admin/devices/qc-queue', icon: FlaskConical, label: 'QC/QA Queue', roles: ['super_admin','qcqa_tester'], badgeKey: 'qc_queue' },
    { to: '/admin/devices/qc-history', icon: History, label: 'QC/QA History', roles: ['super_admin','qcqa_tester','marketing_admin'] },
    { to: '/admin/devices', icon: Cpu, label: 'Device Inventory', roles: ['super_admin','inventory_admin','qcqa_tester','marketing_associate','marketing_admin'], end: true, badgeKey: 'prep_requests' },
    { to: '/admin/devices/returns', icon: RotateCcw, label: 'Returns', roles: ['super_admin','inventory_admin','marketing_associate','marketing_admin'] },
    { to: '/admin/finance', icon: DollarSign, label: 'Finance Review', roles: ['super_admin','finance_admin'], badgeKey: 'finance_reviews' },
    { to: '/admin/compliance', icon: ShieldCheck, label: 'Compliance', roles: ['super_admin','compliance_admin'], badgeKey: 'compliance_review' },
    { to: '/admin/deletion-approvals', icon: Trash2, label: 'Deletion Approvals', roles: ['super_admin','finance_admin','compliance_admin'], badgeKey: 'deletion_requests' },
    { to: '/admin/xaura-review', icon: ThumbsUp, label: 'XAura Review', roles: ['super_admin'] },
    { to: '/admin/user-comments', icon: MessageSquareText, label: 'User Comments', roles: ['super_admin'], badgeKey: 'user_comments' },
    { to: '/admin/call-history', icon: Activity, label: 'Call History', roles: ['super_admin'] },
    { to: '/admin/videos', icon: Video, label: 'Media Library', roles: ['super_admin'] },
    { to: '/admin/instructions', icon: BookOpen, label: 'Instructions', roles: ['super_admin','marketing_admin','marketing_associate','compliance_admin','inventory_admin','finance_admin','qcqa_tester'] },
    { to: '/admin/settings', icon: Settings, label: 'Settings', roles: ['super_admin'] },
    { to: '/admin/deletion-log', icon: Trash2, label: 'Deletion Log', roles: ['super_admin'] },
    { to: '/admin/db-manager', icon: Database, label: 'DB Manager', roles: ['db_manager', 'super_admin'] },
    { to: '/admin/help-improve', icon: Lightbulb, label: 'Help Us Improve', roles: ['super_admin','marketing_admin','marketing_associate','compliance_admin','inventory_admin','finance_admin','qcqa_tester','db_manager'] },
  ].filter(item => item.roles.includes(role));

  const handleLogout = () => { localStorage.setItem('beatx-theme', 'default'); logout(); navigate('/login'); window.location.reload(); };

  // Memoize nav items to prevent unnecessary re-renders
  const navItemsKey = useMemo(() => navItems.map(n => `${n.to}:${n.badgeKey || ''}`).join(','), [role]);

  const sidebarContent = useMemo(() => (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-center">
        <BeatXLogo className="h-10" />
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {navItems.map(item => {
            const badgeCount = item.badgeKey === 'messages' ? unreadMessages : (item.badgeKey ? (actionCounts[item.badgeKey] || 0) : 0);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-testid={`admin-sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}-link`}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    isActive ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{badgeCount > 99 ? '99+' : badgeCount}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="p-3">
        <NavLink to="/admin/profile" className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg hover:bg-muted/50 transition-colors" onClick={() => setSidebarOpen(false)}>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{user?.name?.charAt(0) || 'U'}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{ROLE_LABELS[role] || role}</p>
          </div>
        </NavLink>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  ), [navItemsKey, actionCounts, unreadMessages, user?.name, role, location.pathname]);

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 left-0 z-50 h-screen bg-card border-r transition-all duration-200 overflow-y-auto ${sidebarOpen ? 'w-[264px] translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-0'}`}>
        <div className="lg:hidden absolute top-3 right-3 z-10"><Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}><X className="w-4 h-4" /></Button></div>
        <div className="w-[264px] min-w-[264px] h-full">
          {sidebarContent}
        </div>
      </aside>
      {/* Main */}
      <div className={`flex-1 min-w-0 transition-[margin] duration-200 ${sidebarOpen ? 'lg:ml-[264px]' : ''}`}>
        <header className="h-14 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-2 sm:px-4 gap-1.5 sm:gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSidebarOpen(prev => !prev)}><Menu className="w-5 h-5" /></Button>
          <div className="flex-1" />
          <button
            ref={xauraDragRef}
            onPointerDown={e => {
              const startX = e.clientX, startY = e.clientY;
              xauraDragRef.current._startX = startX;
              xauraDragRef.current._startY = startY;
              xauraDragRef.current._moved = false;
              longPressTimer.current = setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate(30);
                window.getSelection()?.removeAllRanges();
                setDraggingXaura(true);
                setDragPos({ x: startX - 20, y: startY - 20 });
                const onMove = (ev) => {
                  const cx = ev.clientX || (ev.touches?.[0]?.clientX ?? startX);
                  const cy = ev.clientY || (ev.touches?.[0]?.clientY ?? startY);
                  setDragPos({ x: cx - 20, y: cy - 20 });
                  xauraDragRef.current._moved = true;
                };
                const onUp = (ev) => {
                  const cx = ev.clientX || (ev.changedTouches?.[0]?.clientX ?? startX);
                  const cy = ev.clientY || (ev.changedTouches?.[0]?.clientY ?? startY);
                  setDraggingXaura(false);
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                  // Drop: open mini at this position — start new chat
                  setXauraDrop({ x: Math.max(0, cx - 180), y: Math.max(60, cy - 30) });
                  setXauraNewSession(n => n + 1);
                  setXauraMode('mini');
                  setXauraOpen(true);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }, 200);
            }}
            onPointerUp={() => {
              if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
              if (!draggingXaura && !xauraDragRef.current?._moved) {
                setXauraMode('full'); setXauraOpen(true);
              }
            }}
            onPointerLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
            className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors group select-none touch-none"
            data-testid="xaura-toggle" title="Click: full screen | Long-press & drag: mini window"
          >            <svg width="16" height="27" viewBox="0 0 40 68" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-200 group-hover:scale-110">
              <path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="currentColor" strokeWidth="6"/>
              <path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/>
            </svg>
          </button>
          <NavLink to="/admin/messages" className="relative shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground">
              <MessageCircle className="w-4 h-4" />
              {unreadMessages > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-[9px] text-primary-foreground rounded-full flex items-center justify-center font-bold">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
            </Button>
          </NavLink>
          <NavLink to="/admin/notifications" className="relative shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground">
              <Bell className="w-4 h-4" />
              {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-[9px] text-white rounded-full flex items-center justify-center font-bold">{notifCount > 9 ? '9+' : notifCount}</span>}
            </Button>
          </NavLink>
          <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0 hidden sm:inline-flex">{ROLE_LABELS[role]}</Badge>
        </header>
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
      <GlobalVoiceCall currentUserId={user?._id} />
      <GlobalVideoCall />
      <GlobalGroupCall />
      <XAuraChat
        open={xauraOpen}
        mode={xauraMode}
        onClose={() => { setXauraOpen(false); setXauraDrop(null); }}
        onModeChange={setXauraMode}
        dropPosition={xauraDrop}
        newSessionTrigger={xauraNewSession}
      />
      {/* Drag ghost */}
      {draggingXaura && (
        <div style={{ position: 'fixed', left: dragPos.x, top: dragPos.y, zIndex: 9999, pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }} className="animate-pulse">
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'hsl(var(--primary) / .12)', border: '2px solid hsl(var(--primary) / .4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <svg width="18" height="28" viewBox="0 0 40 68" fill="none"><path d="M3.21777 51.467L13.4517 40.5005C16.843 36.8664 22.5381 36.6696 26.1721 40.0609L37.1387 50.2948" stroke="currentColor" strokeWidth="6"/><path d="M35.9678 16.3743L25.7338 27.3409C22.3426 30.9749 16.6475 31.1717 13.0135 27.7804L2.04689 17.5465" stroke="hsl(var(--primary))" strokeWidth="6"/></svg>
          </div>
        </div>
      )}
    </div>
  );
}
