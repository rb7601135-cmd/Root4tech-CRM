'use client';

import React, { useState, useMemo } from 'react';
import { CompanyService } from '@/types/crm';
import { Search, X, CheckSquare, Square, Boxes, Check, Sparkles } from 'lucide-react';

interface MultiServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: CompanyService[];
  currency?: string;
  themeColor?: 'indigo' | 'sky';
  onSelectServices: (selected: CompanyService[]) => void;
}

export default function MultiServiceModal({
  isOpen,
  onClose,
  services,
  currency = 'PKR',
  themeColor = 'indigo',
  onSelectServices,
}: MultiServiceModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [services]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        search === '' ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
        (s.category && s.category.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'all' || s.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [services, search, selectedCategory]);

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredServices.map((s) => s.id);
    const allSelected = filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleConfirm = () => {
    const selected = services.filter((s) => selectedIds.includes(s.id));
    if (selected.length > 0) {
      onSelectServices(selected);
    }
    setSelectedIds([]);
    onClose();
  };

  const isAllFilteredSelected =
    filteredServices.length > 0 &&
    filteredServices.every((s) => selectedIds.includes(s.id));

  const isSky = themeColor === 'sky';
  const primaryBg = isSky ? 'bg-sky-600 hover:bg-sky-500' : 'bg-indigo-600 hover:bg-indigo-500';
  const accentText = isSky ? 'text-sky-400' : 'text-indigo-400';
  const ringFocus = isSky ? 'focus:border-sky-500' : 'focus:border-indigo-500';
  const badgeActive = isSky
    ? 'bg-sky-600 text-white'
    : 'bg-indigo-600 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isSky ? 'bg-sky-950/60 text-sky-400 border border-sky-800/60' : 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/60'}`}>
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Select Services from Catalog</h3>
              <p className="text-xs text-zinc-400">
                Pick one or multiple services to insert as item rows
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/30 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search services by name, category, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none ${ringFocus}`}
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-zinc-500 text-[11px] mr-1">Category:</span>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                  selectedCategory === 'all'
                    ? badgeActive
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                All ({services.length})
              </button>
              {categories.map((cat) => {
                const count = services.filter((s) => s.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                      selectedCategory === cat
                        ? badgeActive
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Select Bar */}
          <div className="flex items-center justify-between text-xs pt-1 text-zinc-400">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="hover:text-zinc-200 font-medium flex items-center gap-1.5 transition"
            >
              {isAllFilteredSelected ? (
                <>
                  <CheckSquare className={`w-3.5 h-3.5 ${accentText}`} /> Deselect All Filtered
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" /> Select All ({filteredServices.length})
                </>
              )}
            </button>
            <span className="font-medium text-zinc-300">
              <span className={`font-bold ${accentText}`}>{selectedIds.length}</span> of {services.length} selected
            </span>
          </div>
        </div>

        {/* Services List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredServices.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No services match your search or category filter.
            </div>
          ) : (
            filteredServices.map((service) => {
              const isSelected = selectedIds.includes(service.id);
              return (
                <div
                  key={service.id}
                  onClick={() => toggleSelect(service.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                    isSelected
                      ? isSky
                        ? 'bg-sky-950/40 border-sky-600/70 shadow-sm'
                        : 'bg-indigo-950/40 border-indigo-600/70 shadow-sm'
                      : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="pt-0.5">
                    {isSelected ? (
                      <CheckSquare className={`w-4 h-4 ${accentText}`} />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-zinc-100">
                          {service.name}
                        </span>
                        {service.category && (
                          <span className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700/60 rounded text-[10px] text-zinc-400 uppercase font-mono">
                            {service.category}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-zinc-200 shrink-0">
                        {service.currency || currency}{' '}
                        {Number(service.default_unit_price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {service.description && (
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {selectedIds.length === 0
              ? 'Click any service to select it'
              : `${selectedIds.length} service${selectedIds.length > 1 ? 's' : ''} ready to add`}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleConfirm}
              className={`px-4 py-2 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md ${primaryBg}`}
            >
              <Check className="w-3.5 h-3.5" />
              Add {selectedIds.length > 0 ? `(${selectedIds.length}) ` : ''}Services to Rows
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
