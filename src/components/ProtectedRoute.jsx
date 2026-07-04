import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import {
  canUserAccess,
  getRoleHome,
  getRoleLabel,
  normalizeRole,
} from '@/lib/roleAccess';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-[#08153d]">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-[#ff5a00] rounded-full animate-spin"></div>
  </div>
);

const AccessDenied = ({ user, permission }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-6 text-white">
    <div className="max-w-lg rounded-2xl border border-red-400/30 bg-[#102969]/90 p-6 shadow-xl text-center">
      <h1 className="text-2xl font-bold text-red-200">Access Restricted</h1>

      <p className="mt-3 text-slate-200">
        Your role does not have permission to open this module.
      </p>

      <p className="mt-2 text-sm text-slate-300">
        Role:{' '}
        <span className="font-semibold text-white">
          {getRoleLabel(user?.role)}
        </span>
      </p>

      <p className="text-xs text-slate-400 mt-1">
        Required permission: {permission}
      </p>

      <a
        href={`#${getRoleHome(user?.role)}`}
        className="mt-5 inline-flex rounded-md bg-[#ff5a00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e24f00]"
      >
        Go to my dashboard
      </a>
    </div>
  </div>
);

export default function ProtectedRoute({
  permission,
  children,
  fallback = <DefaultFallback />,
  unauthenticatedElement = <Navigate to="/welcome" replace />,
}) {
  const {
    user,
    isAuthenticated,
    isLoadingAuth,
    authChecked,
    authError,
    checkUserAuth,
  } = useAuth();

  const location = useLocation();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) return fallback;

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }

    return unauthenticatedElement;
  }

  if (!isAuthenticated) return unauthenticatedElement;

  const normalizedRole = normalizeRole(user?.role);

  if (normalizedRole === 'system_admin') {
    return children || <Outlet />;
  }

  if (permission && !canUserAccess(user, permission)) {
    return (
      <AccessDenied
        user={user}
        permission={permission}
        from={location.pathname}
      />
    );
  }

  return children || <Outlet />;
}