import React from 'react';

const statusContent = {
  missing_profile: {
    title: 'Profile Not Found',
    message:
      'Your login is valid, but no ARK ONE user profile exists yet. Please contact the app administrator to create or link your profile.',
  },
  pending_approval: {
    title: 'Approval Pending',
    message:
      'Your account is waiting for admin approval. You will be able to continue after approval is complete.',
  },
  missing_role: {
    title: 'Role Required',
    message:
      'Your account exists, but no role has been assigned yet. Please contact the app administrator to complete your access setup.',
  },
  rejected: {
    title: 'Access Rejected',
    message:
      'Your account approval was rejected. Please contact the app administrator if you believe this is an error.',
  },
  profile_load_failed: {
    title: 'Profile Check Failed',
    message:
      'We could not verify your ARK ONE profile. Please refresh and try again, or contact the app administrator.',
  },
  user_not_registered: {
    title: 'Access Restricted',
    message:
      'You are not registered to use this application. Please contact the app administrator to request access.',
  },
};

const UserNotRegisteredError = ({ error, user }) => {
  const content = statusContent[error?.type] || statusContent.user_not_registered;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-[#102969] rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">{content.title}</h1>
          <p className="text-slate-200 mb-8">
            {error?.message || content.message}
          </p>
          {user?.email && (
            <p className="mb-5 text-xs text-slate-300">
              Signed in as <span className="font-semibold text-white">{user.email}</span>
            </p>
          )}
          <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600">
            <p>If you believe this is an error, you can:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the app administrator for access</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
