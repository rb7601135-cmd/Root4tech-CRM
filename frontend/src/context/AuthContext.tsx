'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types/crm';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isSalesManager: boolean;
  isSalesperson: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('roo4tech_cached_user');
        }
        setIsLoading(false);
        return;
      }
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('roo4tech_cached_user', JSON.stringify(currentUser));
      }
    } catch {
      setUser(null);
      api.setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('roo4tech_cached_user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem('roo4tech_cached_user');
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } catch {}
    refreshUser();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const res = await api.login(credentials);
      setUser(res.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('roo4tech_cached_user', JSON.stringify(res.user));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('roo4tech_cached_user');
      }
      setIsLoading(false);
    }
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isAdmin = user?.role === 'Administrator';
  const isSalesManager = user?.role === 'Sales Manager';
  const isSalesperson = user?.role === 'Salesperson';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        hasRole,
        isAdmin,
        isSalesManager,
        isSalesperson,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
