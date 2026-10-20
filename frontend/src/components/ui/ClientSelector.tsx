'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Client } from '@/types/crm';
import { api } from '@/lib/api';

interface ClientSelectorProps {
  selectedClientId?: number | null;
  onSelectClient: (client: Client | null) => void;
  required?: boolean;
  label?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function ClientSelector({
  selectedClientId,
  onSelectClient,
  required = false,
  label = 'Select Client *',
  error,
  disabled = false,
  placeholder = 'Search by name, company, email, phone, or CLI-ID...',
}: ClientSelectorProps) {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load selected client initially if selectedClientId is provided
  useEffect(() => {
    if (selectedClientId && (!selectedClient || selectedClient.id !== selectedClientId)) {
      api.getClient(selectedClientId)
        .then((client) => {
          setSelectedClient(client);
        })
        .catch(() => {
          // Ignore error if client not found
        });
    } else if (!selectedClientId && selectedClient) {
      setSelectedClient(null);
    }
  }, [selectedClientId]);

  // Search clients when query changes or on dropdown open
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.getClients({ search: query, page_size: 10 });
        const list = Array.isArray(res) ? res : res.results || [];
        setClients(list);
      } catch (err) {
        console.error('Failed to search clients:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (client: Client) => {
    setSelectedClient(client);
    setIsOpen(false);
    setQuery('');
    onSelectClient(client);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClient(null);
    onSelectClient(null);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      {/* Selected Client Card or Dropdown Trigger */}
      {selectedClient ? (
        <div className="p-3 bg-slate-900/90 border border-emerald-500/40 rounded-xl shadow-sm hover:border-emerald-500/70 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm shadow-inner">
                {selectedClient.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100 text-sm">{selectedClient.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-medium">
                    {selectedClient.client_id}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {selectedClient.company_name && (
                    <span className="text-slate-300 font-medium">🏢 {selectedClient.company_name}</span>
                  )}
                  <span>✉️ {selectedClient.email}</span>
                  {selectedClient.phone && <span>📞 {selectedClient.phone}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href={`/clients/${selectedClient.id}`}
                target="_blank"
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/80 transition-colors flex items-center gap-1"
                title="View full client profile in new tab"
              >
                <span>Profile</span>
                <span>↗</span>
              </Link>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                  title="Remove selected client"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div
            onClick={() => !disabled && setIsOpen(true)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border rounded-xl cursor-pointer text-sm transition-all ${
              isOpen
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : error
                ? 'border-red-500/80'
                : 'border-slate-800 hover:border-slate-700'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className="text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {placeholder}
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      {/* Search Dropdown Popup */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/60">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type name, company, email, phone or CLI-ID..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Searching central clients database...
              </div>
            ) : clients.length === 0 ? (
              <div className="p-5 text-center text-sm text-slate-400">
                <p>No clients matched &quot;{query}&quot;</p>
                <Link
                  href="/clients"
                  target="_blank"
                  className="text-xs text-indigo-400 hover:underline mt-1 inline-block"
                >
                  + Create or convert client in Client Management
                </Link>
              </div>
            ) : (
              clients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="p-3 hover:bg-slate-800/80 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-sm group-hover:text-indigo-300 transition-colors">
                          {c.name}
                        </span>
                        <span className="text-xs px-2 py-0.2 rounded-full bg-slate-800 text-indigo-300 font-mono border border-slate-700/60">
                          {c.client_id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap gap-x-2 mt-0.5">
                        {c.company_name && <span className="text-slate-300">🏢 {c.company_name}</span>}
                        <span>✉️ {c.email}</span>
                        {c.phone && <span>📞 {c.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Select →
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
