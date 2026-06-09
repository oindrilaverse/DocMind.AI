import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentDetailsPage } from './pages/DocumentDetailsPage';
import { SearchPage } from './pages/SearchPage';
import { ChatPage } from './pages/ChatPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { useAuthStore } from './store/auth.store';

export const App: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} 
      />

      {/* Protected App Routes */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        }
      />
      
      <Route
        path="/document/:id"
        element={
          <AuthGuard>
            <DocumentDetailsPage />
          </AuthGuard>
        }
      />

      <Route
        path="/search"
        element={
          <AuthGuard>
            <SearchPage />
          </AuthGuard>
        }
      />

      <Route
        path="/chat"
        element={
          <AuthGuard>
            <ChatPage />
          </AuthGuard>
        }
      />

      {/* Default Redirects */}
      <Route 
        path="/" 
        element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
      />
      
      {/* Catch-all */}
      <Route 
        path="*" 
        element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
      />
    </Routes>
  );
};
export default App;
