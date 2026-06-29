import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentDetailsPage } from './pages/DocumentDetailsPage';
import { SearchPage } from './pages/SearchPage';
import { ChatPage } from './pages/ChatPage';
// Phase 4: AI Evaluation Dashboard
import { EvaluationDashboardPage } from './pages/EvaluationDashboardPage';
import { BenchmarkPage } from './pages/BenchmarkPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { useAuthStore } from './store/auth.store';
import { api } from './lib/api';

export const App: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [connError, setConnError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await api.get('/health');
        if (response.data?.status !== 'ok') {
          setConnError('Backend returned abnormal status. Please check server configurations.');
        }
      } catch (err: any) {
        console.error('[DocMind API] Connectivity check failed:', err);
        if (!navigator.onLine) {
          setConnError('Network error: You are offline. Please check your internet connection.');
        } else if (err.code === 'ERR_NETWORK') {
          setConnError('Backend unavailable: The API server is unresponsive or offline.');
        } else if (err.response?.status === 404) {
          setConnError('Invalid API URL: The requested API path was not found (404). Check VITE_API_URL.');
        } else if (err.response?.status >= 500) {
          setConnError('Server error: The API server encountered an internal failure (500).');
        } else {
          setConnError(`Connection error: ${err.message}`);
        }
      }
    };
    checkHealth();
  }, []);

  return (
    <>
      {connError && (
        <div className="bg-red-950/80 border-b border-red-800/60 text-red-200 px-6 py-2.5 text-xs font-semibold flex items-center justify-between gap-4 sticky top-0 z-50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>{connError}</span>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="underline hover:text-white"
          >
            Retry Connection
          </button>
        </div>
      )}
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

      {/* Phase 4: AI Evaluation Dashboard */}
      <Route
        path="/evaluation"
        element={
          <AuthGuard>
            <EvaluationDashboardPage />
          </AuthGuard>
        }
      />

      {/* Phase 6: Cross-Encoder Reranking Benchmark */}
      <Route
        path="/benchmark"
        element={
          <AuthGuard>
            <BenchmarkPage />
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
    </>
  );
};
export default App;
