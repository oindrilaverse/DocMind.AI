import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Brain, Lock, Mail, AlertTriangle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const { login, isLoggingIn, loginError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!email || !password) {
      setValidationError('Please fill in all fields');
      return;
    }

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      // Handled by react-query error state
    }
  };

  const getErrorMessage = () => {
    if (validationError) return validationError;
    if (loginError) {
      return (loginError as any).response?.data?.message || 'Invalid email or password';
    }
    return '';
  };

  const errorMessage = getErrorMessage();

  return (
    <div className="min-h-screen bg-darkbg flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Glow decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20 mb-3 shadow-lg shadow-primary/5">
            <Brain className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-textmain">DocMind AI</h1>
          <p className="text-textmuted text-sm mt-1.5 font-medium">Phase 1: Document Management System</p>
        </div>

        <div className="glass-panel rounded-3xl p-8 shadow-2xl relative">
          <h2 className="text-xl font-semibold text-textmain mb-6">Welcome Back</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/50 p-4 rounded-xl text-red-200 text-sm">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-textmuted mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <Mail className="h-5 h-5 text-textmuted" />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isLoggingIn}
                  className="block w-full pl-11 pr-4 py-3 bg-darkbg border border-darkborder rounded-xl text-textmain placeholder-textmuted focus:outline-none focus:border-primary transition duration-150 disabled:opacity-50 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-textmuted mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <Lock className="h-5 h-5 text-textmuted" />
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoggingIn}
                  className="block w-full pl-11 pr-4 py-3 bg-darkbg border border-darkborder rounded-xl text-textmain placeholder-textmuted focus:outline-none focus:border-primary transition duration-150 disabled:opacity-50 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-xl font-medium tracking-wide shadow-lg shadow-primary/20 transition duration-150 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none disabled:transform-none text-sm mt-2"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-textmuted">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline font-semibold transition duration-150">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
