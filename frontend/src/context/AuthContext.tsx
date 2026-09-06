/**
 * PeoplePay585 — Auth Context
 * Provides authentication state and actions to the entire app.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/client';

interface User {
  id: number;
  email: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  isMinRole: (minRole: string) => boolean;
}

const ROLE_LEVELS: Record<string, number> = {
  employee: 1,
  hr_manager: 2,
  hr_payroll_user: 3,
  hr_payroll_manager: 4,
  admin: 5,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const savedToken = localStorage.getItem('pp585_token');
    const savedUser = localStorage.getItem('pp585_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      
      // Fetch latest user data in background
      api.get('/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(res => {
          setUser(res.data);
          localStorage.setItem('pp585_user', JSON.stringify(res.data));
        })
        .catch(err => {
          console.error('Failed to fetch user data', err);
        });
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, user: userData } = response.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('pp585_token', access_token);
    localStorage.setItem('pp585_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pp585_token');
    localStorage.removeItem('pp585_user');
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    const userRoles = user.roles || ((user as any).role ? [(user as any).role] : []);
    return userRoles.some((r: string) => roles.includes(r));
  };

  const isMinRole = (minRole: string) => {
    if (!user) return false;
    const userRoles = user.roles || ((user as any).role ? [(user as any).role] : []);
    return userRoles.some((r: string) => (ROLE_LEVELS[r] || 0) >= (ROLE_LEVELS[minRole] || 0));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        hasRole,
        isMinRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
