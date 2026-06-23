import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";

import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PERMISSIONS } from '@/lib/roleAccess';

import Welcome from '@/pages/Welcome';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Tickets from '@/pages/Tickets';
import TicketDetail from '@/pages/TicketDetail';
import UserManagement from '@/pages/UserManagement';
import Departments from '@/pages/Departments';
import Workflows from '@/pages/Workflows';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import AuditLogs from '@/pages/AuditLogs';
import Settings from '@/pages/Settings';
import Machines from '@/pages/Machines';
import Assets from '@/pages/Assets';
import StaffDirectory from '@/pages/StaffDirectory';
import SiteMonitor from '@/pages/SiteMonitor';
import EngineerBoard from '@/pages/EngineerBoard';
import SparePartsInventory from '@/pages/SparePartsInventory';
import PartsScreen from "@/pages/PartsScreen";
import FieldOperations from '@/pages/FieldOperations';
import DeviceManagement from '@/pages/DeviceManagement';
import HRPortal from '@/pages/HRPortal';
import FinancePortal from '@/pages/FinancePortal';
import CRMPortal from '@/pages/CRMPortal';
import ProcurementPortal from '@/pages/ProcurementPortal';
import ManagerDashboard from '@/pages/ManagerDashboard';
import LiveMap from '@/pages/LiveMap';
import BanksPage from '@/pages/BanksPage';
import BranchesPage from '@/pages/BranchesPage';
import BranchDevices from '@/pages/BranchDevices';
import EngineersPage from '@/pages/EngineersPage';
import DevicesPage from '@/pages/DevicesPage';
import DeviceStatusBoard from '@/pages/DeviceStatusBoard';
import DeviceAssignment from '@/pages/DeviceAssignment';
import RegionalCoverage from '@/pages/RegionalCoverage';
import OperationsDashboard from '@/pages/OperationsDashboard';
import OperationsPartRequests from "@/pages/OperationsPartRequests";
import OperationsFeed from "@/pages/OperationsFeed";
import InventoryPartRequests from "@/pages/InventoryPartRequests";
import RRConsumableRequests from "@/pages/RRConsumableRequests";
import ArkConnect from '@/pages/ArkConnect';
import SLAAnalytics from '@/pages/SLAAnalytics';
import OfficialMailInbox from '@/pages/OfficialMailInbox';
import ProcurementLPO from '@/pages/ProcurementLPO';
import ChangePassword from '@/pages/ChangePassword';
import DataImport from '@/pages/DataImport';
import RRPartRequests from "@/pages/RRPartRequests";
import RepairRefurbish from '@/pages/RepairRefurbish';
import InventoryAnalytics from '@/pages/InventoryAnalytics';

const updateUserActivity = async (user, online = true, login = false) => {
  if (!user?.email) return;

  const updates = {
    last_seen: new Date().toISOString(),
    online_status: online,
  };

  if (login) updates.last_login = new Date().toISOString();

  await supabase
    .from("user_profiles")
    .update(updates)
    .eq("user_email", user.email);
};

const SecurePage = ({ path, children }) => (
  <ProtectedRoute permission={ROUTE_PERMISSIONS[path]}>{children}</ProtectedRoute>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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

  if (isLoadingPublicSettings || isLoadingAuth) {
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
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Welcome />} />
      <Route path="/signin" element={<Welcome />} />
      <Route path="/register" element={<Welcome />} />
      <Route path="/signup" element={<Welcome />} />
      <Route path="/create-password" element={<ChangePassword />} />
      <Route path="/reset-password" element={<ChangePassword />} />
      <Route path="/change-password" element={<ChangePassword />} />

      <Route element={<ProtectedRoute />}>
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
          <Route path="/settings" element={<SecurePage path="/settings"><Settings /></SecurePage>} />

          <Route path="/machines" element={<SecurePage path="/machines"><Machines /></SecurePage>} />
          <Route path="/assets" element={<SecurePage path="/assets"><Assets /></SecurePage>} />
          <Route path="/staff" element={<SecurePage path="/staff"><StaffDirectory /></SecurePage>} />
          <Route path="/sites" element={<SecurePage path="/sites"><SiteMonitor /></SecurePage>} />
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
          <Route path="/finance" element={<SecurePage path="/finance"><FinancePortal /></SecurePage>} />
          <Route path="/crm" element={<SecurePage path="/crm"><CRMPortal /></SecurePage>} />
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
          <Route path="/device-status" element={<SecurePage path="/device-status"><DeviceStatusBoard /></SecurePage>} />
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
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
