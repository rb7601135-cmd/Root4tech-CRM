'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CompanySettings } from '@/types/crm';
import { api } from '@/lib/api';

interface CompanyContextType {
  settings: CompanySettings | null;
  isLoading: boolean;
  currency: string;
  refreshSettings: () => Promise<void>;
  formatCurrency: (amount: number | string | null | undefined) => string;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSettings = async () => {
    try {
      const data = await api.getCompanySettings();
      setSettings(data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('roo4tech_cached_settings', JSON.stringify(data));
      }
    } catch {
      // Fallback defaults if no cache exists
      if (!settings) {
        const fallback: CompanySettings = {
          id: 1,
          company_name: 'Roo4Tech',
          logo: null,
          logo_url: null,
          email: 'contact@roo4tech.com',
          phone: '+92 300 8472910',
          website: 'https://roo4tech.com',
          address: 'Arfa Software Technology Park, Ferozepur Road, Lahore, Pakistan',
          default_currency: 'PKR',
          theme_preference: 'dark',
          updated_at: new Date().toISOString(),
        };
        setSettings(fallback);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem('roo4tech_cached_settings');
      if (cached) {
        setSettings(JSON.parse(cached));
      }
    } catch {}
    refreshSettings();
  }, []);

  const currency = settings?.default_currency || 'PKR';

  const formatCurrency = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined || amount === '') return `${currency} 0`;
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return `${currency} 0`;
    return `${currency} ${num.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
  };

  return (
    <CompanyContext.Provider
      value={{
        settings,
        isLoading,
        currency,
        refreshSettings,
        formatCurrency,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
