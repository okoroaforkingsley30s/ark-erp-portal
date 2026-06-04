import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';

import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

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
import ArkConnect from '@/pages/ArkConnect';
import SLAAnalytics from '@/pages/SLAAnalytics';
import OfficialMailInbox from '@/pages/OfficialMailInbox';
import ProcurementLPO from '@/pages/ProcurementLPO';
import ChangePassword from '@/pages/ChangePassword';
import DataImport from '@/pages/DataImport';
import RepairRefurbish from '@/pages/RepairRefurbish';

const AuthenticatedApp = () => {
  const {
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    navigateToLogin,
  } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#ff5a00]/20 border-t-[#ff5a00] rounded-full animate-spin" />
          <p className="text-sm text-slate-200 font-medium">
            ARK ONE Portal
          </p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }

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

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />

        <Route path="/users" element={<UserManagement />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="/machines" element={<Machines />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/staff" element={<StaffDirectory />} />
        <Route path="/sites" element={<SiteMonitor />} />
        <Route path="/engineers" element={<EngineerBoard />} />
        <Route path="/spare-parts" element={<SparePartsInventory />} />
        <Route path="/field-ops" element={<FieldOperations />} />
        <Route path="/devices" element={<DeviceManagement />} />

        <Route path="/hr" element={<HRPortal />} />
        <Route path="/finance" element={<FinancePortal />} />
        <Route path="/crm" element={<CRMPortal />} />
        <Route path="/procurement" element={<ProcurementPortal />} />
        <Route path="/manager" element={<ManagerDashboard />} />

        <Route path="/live-map" element={<LiveMap />} />
        <Route path="/sla-analytics" element={<SLAAnalytics />} />

        <Route path="/ops-dashboard" element={<OperationsDashboard />} />
        <Route path="/banks" element={<BanksPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/branches/:id/devices" element={<BranchDevices />} />
        <Route path="/engineers-ops" element={<EngineersPage />} />
        <Route path="/bank-devices" element={<DevicesPage />} />
        <Route path="/device-status" element={<DeviceStatusBoard />} />
        <Route path="/device-assignment" element={<DeviceAssignment />} />
        <Route path="/regional-coverage" element={<RegionalCoverage />} />

        <Route path="/ark-connect" element={<ArkConnect />} />
        <Route path="/official-mail" element={<OfficialMailInbox />} />

        <Route path="/procurement-lpo" element={<ProcurementLPO />} />
        <Route path="/data-import" element={<DataImport />} />

        <Route path="/repair-refurbish" element={<RepairRefurbish />} />
        <Route path="/repair-jobs" element={<RepairRefurbish />} />
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