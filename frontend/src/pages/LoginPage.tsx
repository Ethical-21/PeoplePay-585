/**
 * PeoplePay585 — Login Page
 * Styled per Excalidraw mockup: Welcome Back heading, Forgot Password link, HR Portal branding.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, Shield } from 'lucide-react';
import api from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-primary-400/10 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl mb-5 border border-white/20 shadow-lg shadow-primary-900/20">
            <Shield className="text-white" size={36} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">PeoplePay585</h1>
          <p className="text-primary-200 mt-1 text-sm font-medium">HR Portal — Payroll Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-primary-900/30 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to access your HR portal</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-danger-50 text-danger-600 text-sm p-3 rounded-lg mb-4 border border-danger-200">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="admin@peoplepay585.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-base bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    const forgotEmail = email || prompt('Enter your email address for password reset:');
                    if (forgotEmail) {
                      api.post('/auth/forgot-password', { email: forgotEmail })
                        .then(() => alert('If an account with this email exists, a reset link has been sent.'))
                        .catch(() => alert('Unable to process request. Please try again.'));
                    }
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-base bg-slate-50 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-base shadow-md shadow-primary-600/30"
            >
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center mb-2">Demo Credentials</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium text-slate-700">Admin</span>
                <p className="text-[10px] mt-0.5">admin@...com / admin123</p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium text-slate-700">HR Manager</span>
                <p className="text-[10px] mt-0.5">hr@...com / hr123</p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium text-slate-700">Payroll Mgr</span>
                <p className="text-[10px] mt-0.5">payroll@...com / payroll123</p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium text-slate-700">Employee</span>
                <p className="text-[10px] mt-0.5">employee@...com / employee123</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-primary-300 text-xs mt-6">
          PeoplePay585 — Odoo Hackathon 2026
        </p>
      </div>
    </div>
  );
}
