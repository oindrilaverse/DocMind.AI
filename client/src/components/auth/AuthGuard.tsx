import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isInitialized, verifySession } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized) {
      verifySession();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-darkbg flex flex-col items-center justify-center">
        {/* Modern spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-darkborder rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-textmuted font-medium text-sm tracking-wide animate-pulse">
          Initializing session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
