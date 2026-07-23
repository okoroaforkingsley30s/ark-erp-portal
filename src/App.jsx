import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { supabase } from "@/lib/supabaseClient";

import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getRoleHome, ROUTE_PERMISSIONS } from '@/lib/roleAccess';
import MobilePlatformBridge from '@/components/mobile/MobilePlatformBridge';

const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const Welcome = lazy(() => import('@/pages/Welcome'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Tickets = lazy(() => import('@/pages/Tickets'));
const TicketDetail = lazy(() => import('@/pages/TicketDetail'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const Departments = lazy(() => import('@/pages/Departments'));
const Workflows = lazy(() => import('@/pages/Workflows'));
const Reports = lazy(() => import('@/pages/Reports'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const Settings = lazy(() => import('@/pages/Settings'));
const Machines = lazy(() => import('@/pages/Machines'));
const Assets = lazy(() => import('@/pages/Assets'));
const StaffDirectory = lazy(() => import('@/pages/StaffDirectory'));
const SiteMonitor = lazy(() => import('@/pages/SiteMonitor'));
const EngineerBoard = lazy(() => import('@/pages/EngineerBoard'));
const SparePartsInventory = lazy(() => import('@/pages/SparePartsInventory'));
const PartsScreen = lazy(() => import('@/pages/PartsScreen'));
const FieldOperations = lazy(() => import('@/pages/FieldOperations'));
const DeviceManagement = lazy(() => import('@/pages/DeviceManagement'));
const HRPortal = lazy(() => import('@/pages/HRPortal'));
const FinancePortal = lazy(() => import('@/pages/FinancePortal'));
const FundRequests = lazy(() => import('@/pages/FundRequests'));
const CRMPortal = lazy(() => import('@/pages/CRMPortal'));
const CRMCommercialRegisters = lazy(() => import('@/pages/CRMCommercialRegisters'));
const CRMDepartmentHandoffs = lazy(() => import('@/pages/CRMDepartmentHandoffs'));
const ProcurementPortal = lazy(() => import('@/pages/ProcurementPortal'));
const ManagerDashboard = lazy(() => import('@/pages/ManagerDashboard'));
const LiveMap = lazy(() => import('@/pages/LiveMap'));
const BanksPage = lazy(() => import('@/pages/BanksPage'));
const BranchesPage = lazy(() => import('@/pages/BranchesPage'));
const BranchDevices = lazy(() => import('@/pages/BranchDevices'));
const EngineersPage = lazy(() => import('@/pages/EngineersPage'));
const DevicesPage = lazy(() => import('@/pages/DevicesPage'));
const DeviceAssignment = lazy(() => import('@/pages/DeviceAssignment'));
const RegionalCoverage = lazy(() => import('@/pages/RegionalCoverage'));
const OperationsDashboard = lazy(() => import('@/pages/OperationsDashboard'));
const OperationsPartRequests = lazy(() => import('@/pages/OperationsPartRequests'));
const OperationsFeed = lazy(() => import('@/pages/OperationsFeed'));
const InventoryPartRequests = lazy(() => import('@/pages/InventoryPartRequests'));
const RRConsumableRequests = lazy(() => import('@/pages/RRConsumableRequests'));
const ArkConnect = lazy(() => import('@/pages/ArkConnect'));
const SLAAnalytics = lazy(() => import('@/pages/SLAAnalytics'));
const OfficialMailInbox = lazy(() => import('@/pages/OfficialMailInbox'));
const ProcurementLPO = lazy(() => import('@/pages/ProcurementLPO'));
const ChangePassword = lazy(() => import('@/pages/ChangePassword'));
const DataImport = lazy(() => import('@/pages/DataImport'));
const RRPartRequests = lazy(() => import('@/pages/RRPartRequests'));
const RepairRefurbish = lazy(() => import('@/pages/RepairRefurbish'));
const InventoryAnalytics = lazy(() => import('@/pages/InventoryAnalytics'));
const AdminDiagnostics = lazy(() => import('@/pages/AdminDiagnostics'));

const RouteLoadingFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-4 border-[#ff5a00]/20 border-t-[#ff5a00] rounded-full animate-spin" />
      <span className="text-sm text-slate-500">Loading page…</span>
    </div>
  </div>
);

const updateUserActivity = async (user, online = true, login = false) => {
  if (!user?.email) return;

  await supabase.rpc("ark_update_user_activity", {
    p_last_seen: new Date().toISOString(),
    p_online_status: online ? "online" : "offline",
    p_record_login: login,
  });
};

const SecurePage = ({ path, children }) => (
  <ProtectedRoute permission={ROUTE_PERMISSIONS[path]}>{children}</ProtectedRoute>
);

const PublicOnlyPage = ({ children }) => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth && !user) return <RouteLoadingFallback />;
  if (isAuthenticated && user) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return children;
};

const ACCESS_STATE_TYPES = new Set([
  'user_not_registered',
  'missing_profile',
  'pending_approval',
  'missing_role',
  'rejected',
  'profile_load_failed',
]);

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  useEffect(() => {
    let interval;

    const startActivityTracking = async () => {
  const currentRoute = window.location.hash || '';

  if (
    currentRoute.includes('/create-password') ||
    currentRoute.includes('/reset-password') ||
    currentRoute.includes('/change-password') ||
    currentRoute.includes('/welcome') ||
    currentRoute.includes('/login')
  ) {
    return;
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) return;

  await updateUserActivity(user, true, true);

  interval = setInterval(() => {
    updateUserActivity(user, true, false);
  }, 60000);
};

    startActivityTracking();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  if (isLoadingPublicSettings || (isLoadingAuth && !user)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#ff5a00]/20 border-t-[#ff5a00] rounded-full animate-spin" />
          <p className="text-sm text-slate-200 font-medium">ARK ONE Portal</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (ACCESS_STATE_TYPES.has(authError.type)) {
      return <UserNotRegisteredError error={authError} user={user} />;
    }

    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/welcome" element={<PublicOnlyPage><Welcome /></PublicOnlyPage>} />
      <Route path="/login" element={<PublicOnlyPage><Welcome /></PublicOnlyPage>} />
      <Route path="/signin" element={<PublicOnlyPage><Welcome /></PublicOnlyPage>} />
      <Route path="/register" element={<PublicOnlyPage><Welcome /></PublicOnlyPage>} />
      <Route path="/signup" element={<PublicOnlyPage><Welcome /></PublicOnlyPage>} />
      <Route path="/create-password" element={<ChangePassword />} />
      <Route path="/reset-password" element={<ChangePassword />} />
      <Route path="/change-password" element={<ChangePassword />} />

      <Route element={<ProtectedRoute authenticationOnly />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<SecurePage path="/dashboard"><Dashboard /></SecurePage>} />
          <Route path="/tickets" element={<SecurePage path="/tickets"><Tickets /></SecurePage>} />
          <Route path="/tickets/:id" element={<SecurePage path="/tickets/:id"><TicketDetail /></SecurePage>} />

          <Route path="/users" element={<SecurePage path="/users"><UserManagement /></SecurePage>} />
          <Route path="/departments" element={<SecurePage path="/departments"><Departments /></SecurePage>} />
          <Route path="/workflows" element={<SecurePage path="/workflows"><Workflows /></SecurePage>} />
          <Route path="/reports" element={<SecurePage path="/reports"><Reports /></SecurePage>} />
          <Route path="/notifications" element={<SecurePage path="/notifications"><Notifications /></SecurePage>} />
          <Route path="/audit-logs" element={<SecurePage path="/audit-logs"><AuditLogs /></SecurePage>} />
          <Route path="/admin-diagnostics" element={<SecurePage path="/admin-diagnostics"><AdminDiagnostics /></SecurePage>} />
          <Route path="/settings" element={<SecurePage path="/settings"><Settings /></SecurePage>} />

          <Route path="/machines" element={<SecurePage path="/machines"><Machines /></SecurePage>} />
          <Route path="/assets" element={<SecurePage path="/assets"><Assets /></SecurePage>} />
          <Route path="/staff" element={<SecurePage path="/staff"><StaffDirectory /></SecurePage>} />
          <Route path="/sites" element={<SecurePage path="/sites"><SiteMonitor /></SecurePage>} />
          <Route path="/site-monitor" element={<SecurePage path="/site-monitor"><Navigate to="/sites" replace /></SecurePage>} />
          <Route path="/engineers" element={<SecurePage path="/engineers"><EngineerBoard /></SecurePage>} />
          <Route path="/spare-parts" element={<SecurePage path="/spare-parts"><SparePartsInventory mode="inventory" /></SecurePage>} />
          <Route
  path="/inventory-analytics"
  element={
    <SecurePage path="/inventory-analytics">
      <InventoryAnalytics />
    </SecurePage>
  }
/>
          <Route path="/part-requests" element={<SecurePage path="/part-requests"><SparePartsInventory mode="requests" /></SecurePage>} />
          <Route path="/parts" element={<SecurePage path="/parts"><PartsScreen /></SecurePage>} />
          <Route path="/inventory/part-requests" element={<SecurePage path="/inventory/part-requests"><InventoryPartRequests /></SecurePage>} />
          <Route path="/field-ops" element={<SecurePage path="/field-ops"><FieldOperations /></SecurePage>} />
          <Route path="/devices" element={<SecurePage path="/devices"><DeviceManagement /></SecurePage>} />

          <Route path="/hr" element={<SecurePage path="/hr"><HRPortal /></SecurePage>} />
          <Route path="/finance" element={<SecurePage path="/finance"><FinancePortal /></SecurePage>} /><Route
  path="/fund-requests"
  element={
    <SecurePage path="/fund-requests">
      <FundRequests />
    </SecurePage>
  }
/>
          <Route path="/crm" element={<SecurePage path="/crm"><CRMPortal /></SecurePage>} />
          <Route path="/crm-commercial" element={<SecurePage path="/crm-commercial"><CRMCommercialRegisters /></SecurePage>} />
          <Route path="/crm-handoffs" element={<SecurePage path="/crm-handoffs"><CRMDepartmentHandoffs /></SecurePage>} />
          <Route path="/procurement" element={<SecurePage path="/procurement"><ProcurementPortal /></SecurePage>} />
          <Route path="/manager" element={<SecurePage path="/manager"><ManagerDashboard /></SecurePage>} />

          <Route path="/live-map" element={<SecurePage path="/live-map"><LiveMap /></SecurePage>} />
          <Route path="/sla-analytics" element={<SecurePage path="/sla-analytics"><SLAAnalytics /></SecurePage>} />

          <Route path="/ops-dashboard" element={<SecurePage path="/ops-dashboard"><OperationsDashboard /></SecurePage>} />
          <Route path="/operations/part-requests" element={<SecurePage path="/operations/part-requests"><OperationsPartRequests /></SecurePage>} />
          <Route path="/operations-feed" element={<SecurePage path="/operations-feed"><OperationsFeed /></SecurePage>} />
          <Route path="/banks" element={<SecurePage path="/banks"><BanksPage /></SecurePage>} />
          <Route path="/branches" element={<SecurePage path="/branches"><BranchesPage /></SecurePage>} />
          <Route path="/branches/:id/devices" element={<SecurePage path="/branches/:id/devices"><BranchDevices /></SecurePage>} />
          <Route path="/engineers-ops" element={<SecurePage path="/engineers-ops"><EngineersPage /></SecurePage>} />
          <Route path="/bank-devices" element={<SecurePage path="/bank-devices"><DevicesPage /></SecurePage>} />
          <Route path="/device-status" element={<SecurePage path="/device-status"><DevicesPage /></SecurePage>} />
          <Route path="/device-assignment" element={<SecurePage path="/device-assignment"><DeviceAssignment /></SecurePage>} />
          <Route path="/regional-coverage" element={<SecurePage path="/regional-coverage"><RegionalCoverage /></SecurePage>} />

          <Route path="/ark-connect" element={<SecurePage path="/ark-connect"><ArkConnect /></SecurePage>} />
          <Route path="/official-mail" element={<SecurePage path="/official-mail"><OfficialMailInbox /></SecurePage>} />

          <Route path="/procurement-lpo" element={<SecurePage path="/procurement-lpo"><ProcurementLPO /></SecurePage>} />
          <Route path="/data-import" element={<SecurePage path="/data-import"><DataImport /></SecurePage>} />

          <Route path="/repair-refurbish" element={<SecurePage path="/repair-refurbish"><RepairRefurbish /></SecurePage>} />
          <Route path="/rr-part-requests" element={<SecurePage path="/rr-part-requests"><RRPartRequests /></SecurePage>} />
          <Route path="/rr-consumable-requests" element={<SecurePage path="/rr-consumable-requests"><RRConsumableRequests /></SecurePage>} />
          <Route path="/repair-jobs" element={<SecurePage path="/repair-jobs"><RepairRefurbish /></SecurePage>} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <MobilePlatformBridge />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
