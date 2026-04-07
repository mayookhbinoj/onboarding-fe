import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';

// Error Boundary — catches rendering crashes
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('App error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#64748b', marginBottom: 16 }}>Please refresh the page to try again.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Eagerly loaded — needed immediately
import LoginPage from './pages/LoginPage';

// Lazy-loaded — only when user is authenticated
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const DistributorsList = lazy(() => import('./pages/admin/DistributorsList'));
const DistributorDetail = lazy(() => import('./pages/admin/DistributorDetail'));
const CreateInvite = lazy(() => import('./pages/admin/CreateInvite'));
const ManageInvites = lazy(() => import('./pages/admin/ManageInvites'));
const FormEditor = lazy(() => import('./pages/admin/FormEditor'));
const DuplicateReview = lazy(() => import('./pages/admin/DuplicateReview'));
const ComplianceQueue = lazy(() => import('./pages/admin/ComplianceQueue'));
const FinanceQueue = lazy(() => import('./pages/admin/FinanceQueue'));
const UsersManagement = lazy(() => import('./pages/admin/UsersManagement'));
const VideosManagement = lazy(() => import('./pages/admin/VideosManagement'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage'));
const MessagesPage = lazy(() => import('./pages/admin/MessagesPage'));
const HospitalsList = lazy(() => import('./pages/admin/HospitalsList'));
const HospitalDetail = lazy(() => import('./pages/admin/HospitalDetail'));
const TemplateManagement = lazy(() => import('./pages/admin/TemplateManagement'));
const AgreementHistory = lazy(() => import('./pages/admin/AgreementHistory'));
const BusinessAssociates = lazy(() => import('./pages/admin/BusinessAssociates'));
const ProfilePage = lazy(() => import('./pages/admin/ProfilePage'));
const InstructionsPage = lazy(() => import('./pages/admin/InstructionsPage'));
const DeletionApprovals = lazy(() => import('./pages/admin/DeletionApprovals'));
const DistributorPortal = lazy(() => import('./pages/distributor/DistributorPortal'));
const DevicesList = lazy(() => import('./pages/admin/devices/DevicesList'));
const DeviceOnboard = lazy(() => import('./pages/admin/devices/DeviceOnboard'));
const DeviceDetail = lazy(() => import('./pages/admin/devices/DeviceDetail'));
const QCQueue = lazy(() => import('./pages/admin/devices/QCQueue'));
const PackagingQueue = lazy(() => import('./pages/admin/devices/PackagingQueue'));
const QCTestForm = lazy(() => import('./pages/admin/devices/QCTestForm'));
const MarketingReadyToShip = lazy(() => import('./pages/admin/devices/MarketingReadyToShip'));
const AllocationsList = lazy(() => import('./pages/admin/devices/AllocationsList'));
const ShipRequests = lazy(() => import('./pages/admin/devices/ShipRequests'));
const ReturnsManagement = lazy(() => import('./pages/admin/devices/ReturnsManagement'));
const QCHistory = lazy(() => import('./pages/admin/devices/QCHistory'));
const OnboardingTracker = lazy(() => import('./pages/admin/OnboardingTracker'));
const CallHistory = lazy(() => import('./pages/admin/CallHistory'));
const XAuraReview = lazy(() => import('./pages/admin/XAuraReview'));
const HelpUsImprove = lazy(() => import('./pages/admin/HelpUsImprove'));
const UserComments = lazy(() => import('./pages/admin/UserComments'));
const DeletionLog = lazy(() => import('./pages/admin/DeletionLog'));
const DBManagerPage = lazy(() => import('./pages/admin/DBManagerPage'));

import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css';

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/admin" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/admin" /> : <LoginPage />} />
        <Route path="/portal/:token" element={<DistributorPortal />} />
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="distributors" element={<DistributorsList />} />
          <Route path="distributors/:id" element={<DistributorDetail />} />
          <Route path="business-associates" element={<BusinessAssociates />} />
          <Route path="create-invite" element={<ProtectedRoute roles={['marketing_associate','marketing_admin','super_admin']}><CreateInvite /></ProtectedRoute>} />
          <Route path="manage-invites" element={<ProtectedRoute roles={['marketing_associate','marketing_admin','super_admin']}><ManageInvites /></ProtectedRoute>} />
          <Route path="form-editor/:inviteId" element={<ProtectedRoute roles={['marketing_associate','marketing_admin','super_admin']}><FormEditor /></ProtectedRoute>} />
          <Route path="duplicate-review" element={<ProtectedRoute roles={['marketing_admin','marketing_associate','compliance_admin','finance_admin','super_admin']}><DuplicateReview /></ProtectedRoute>} />
          <Route path="compliance" element={<ProtectedRoute roles={['compliance_admin','super_admin']}><ComplianceQueue /></ProtectedRoute>} />
          <Route path="finance" element={<ProtectedRoute roles={['finance_admin','super_admin']}><FinanceQueue /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute roles={['super_admin','marketing_admin']}><UsersManagement /></ProtectedRoute>} />
          <Route path="videos" element={<ProtectedRoute roles={['super_admin']}><VideosManagement /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['super_admin']}><SettingsPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="instructions" element={<InstructionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="onboarding-tracker" element={<OnboardingTracker />} />
          <Route path="call-history" element={<ProtectedRoute roles={['super_admin']}><CallHistory /></ProtectedRoute>} />
          <Route path="xaura-review" element={<ProtectedRoute roles={['super_admin']}><XAuraReview /></ProtectedRoute>} />
          <Route path="help-improve" element={<HelpUsImprove />} />
          <Route path="user-comments" element={<ProtectedRoute roles={['super_admin']}><UserComments /></ProtectedRoute>} />
          <Route path="deletion-log" element={<ProtectedRoute roles={['super_admin']}><DeletionLog /></ProtectedRoute>} />
          <Route path="db-manager" element={<ProtectedRoute roles={['db_manager', 'super_admin']}><DBManagerPage /></ProtectedRoute>} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="hospitals" element={<ProtectedRoute roles={['compliance_admin','super_admin']}><HospitalsList /></ProtectedRoute>} />
          <Route path="hospitals/:id" element={<HospitalDetail />} />
          <Route path="templates" element={<ProtectedRoute roles={['compliance_admin','super_admin']}><TemplateManagement /></ProtectedRoute>} />
          <Route path="agreement-history" element={<ProtectedRoute roles={['compliance_admin','super_admin']}><AgreementHistory /></ProtectedRoute>} />
          <Route path="deletion-approvals" element={<ProtectedRoute roles={['finance_admin','compliance_admin','super_admin']}><DeletionApprovals /></ProtectedRoute>} />
          {/* Device Inventory Module */}
          <Route path="devices" element={<DevicesList />} />
          <Route path="devices/new" element={<ProtectedRoute roles={['inventory_admin','super_admin']}><DeviceOnboard /></ProtectedRoute>} />
          <Route path="devices/:id" element={<DeviceDetail />} />
          <Route path="devices/qc-queue" element={<ProtectedRoute roles={['qcqa_tester','super_admin']}><QCQueue /></ProtectedRoute>} />
          <Route path="devices/qc-history" element={<ProtectedRoute roles={['qcqa_tester','super_admin','marketing_admin']}><QCHistory /></ProtectedRoute>} />
          <Route path="devices/packaging" element={<ProtectedRoute roles={['inventory_admin','super_admin']}><PackagingQueue /></ProtectedRoute>} />
          <Route path="devices/qc-test/:deviceId/:testId" element={<ProtectedRoute roles={['qcqa_tester','super_admin','marketing_admin','marketing_associate']}><QCTestForm /></ProtectedRoute>} />
          <Route path="devices/ready-to-ship" element={<ProtectedRoute roles={['marketing_associate','marketing_admin','super_admin']}><MarketingReadyToShip /></ProtectedRoute>} />
          <Route path="devices/allocations" element={<AllocationsList />} />
          <Route path="devices/ship-requests" element={<ProtectedRoute roles={['inventory_admin','super_admin']}><ShipRequests /></ProtectedRoute>} />
          <Route path="devices/returns" element={<ReturnsManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Suspense>
  );
}

// Wrap socket + theme only around authenticated content
function AuthenticatedProviders({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  return (
    <ThemeProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedProviders>
          <AppRoutes />
          <Toaster position="top-right" closeButton duration={4000} />
        </AuthenticatedProviders>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
