'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { api } from '@/lib/api';
import { CompanyService } from '@/types/crm';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Layers,
  Coins,
  Tag,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

const SERVICE_CATEGORIES = [
  'Development',
  'Mobile Apps',
  'UI/UX Design',
  'Cloud & DevOps',
  'Digital Marketing',
  'AI & Data',
  'Maintenance & Support',
  'Consulting',
];

const BILLING_TYPES = ['Fixed', 'Hourly', 'Monthly', 'Milestone'];

export default function ServicesPage() {
  const { isAdmin } = useAuth();
  const { currency } = useCompany();

  const [services, setServices] = useState<CompanyService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<CompanyService | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Development',
    description: '',
    default_unit_price: '0.00',
    currency: 'PKR',
    billing_type: 'Fixed',
    is_active: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadServices = async () => {
    setIsLoading(true);
    try {
      const res = await api.getServices();
      setServices(Array.isArray(res) ? res : (res as { results?: CompanyService[] }).results || []);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData({
      name: '',
      category: 'Development',
      description: '',
      default_unit_price: '0.00',
      currency: currency || 'PKR',
      billing_type: 'Fixed',
      is_active: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (svc: CompanyService) => {
    setEditingService(svc);
    setFormData({
      name: svc.name,
      category: svc.category || 'Development',
      description: svc.description || '',
      default_unit_price: String(svc.default_unit_price),
      currency: svc.currency || currency || 'PKR',
      billing_type: svc.billing_type || 'Fixed',
      is_active: svc.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Service name is required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingService) {
        await api.updateService(editingService.id, formData);
        setSuccessMsg(`Service "${formData.name}" updated successfully.`);
      } else {
        await api.createService(formData);
        setSuccessMsg(`Service "${formData.name}" added to catalog.`);
      }
      setIsModalOpen(false);
      loadServices();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const e = err as { message?: string; data?: Record<string, string[]> };
      setFormError(e.message || 'Failed to save service.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the service "${name}"?`)) return;
    try {
      await api.deleteService(id);
      setSuccessMsg(`Service "${name}" was deleted.`);
      loadServices();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to delete service:', err);
    }
  };

  const handleToggleActive = async (svc: CompanyService) => {
    try {
      await api.updateService(svc.id, { is_active: !svc.is_active });
      loadServices();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      const matchesSearch =
        search === '' ||
        svc.name.toLowerCase().includes(search.toLowerCase()) ||
        (svc.description && svc.description.toLowerCase().includes(search.toLowerCase())) ||
        (svc.category && svc.category.toLowerCase().includes(search.toLowerCase()));

      const matchesCat = categoryFilter === 'all' || svc.category === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && svc.is_active) ||
        (statusFilter === 'disabled' && !svc.is_active);

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [services, search, categoryFilter, statusFilter]);

  const activeCount = services.filter((s) => s.is_active).length;
  const categoriesList = Array.from(new Set(services.map((s) => s.category).filter(Boolean)));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-blue-400" />
              Company Services & Deliverables
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Manage standardized IT, design, and marketing service packages used across Quotations and Invoices.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={handleOpenAdd} icon={<Plus className="w-4 h-4" />}>
              Add New Service
            </Button>
          )}
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 shadow-lg animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Services in Catalog</p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">{services.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active & Billable</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{activeCount}</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Service Categories</p>
            <p className="text-2xl font-bold text-blue-400 mt-1 font-mono">{categoriesList.length}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search services by name, description, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="all">All Categories</option>
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'disabled')}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Services Table */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center text-zinc-400 text-xs">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p>Loading services catalog...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 space-y-3">
              <Briefcase className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-base font-semibold text-zinc-200">No services found</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {search || categoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'No services match your active filters. Try clearing filters.'
                  : 'Get started by creating your first standardized service package.'}
              </p>
              {isAdmin && (
                <Button size="sm" onClick={handleOpenAdd} icon={<Plus className="w-3.5 h-3.5" />}>
                  Create First Service
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Service & Scope</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Billing Model</th>
                    <th className="px-5 py-3.5 text-right">Default Rate</th>
                    <th className="px-5 py-3.5 text-center">Catalog Status</th>
                    {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {filteredServices.map((svc) => (
                    <tr key={svc.id} className="hover:bg-zinc-900/50 transition">
                      <td className="px-5 py-4 max-w-md">
                        <span className="font-semibold text-zinc-100 text-sm block">{svc.name}</span>
                        {svc.description && (
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                            {svc.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700/80 text-zinc-300 text-[11px] font-medium font-mono">
                          {svc.category || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-zinc-300 font-medium">{svc.billing_type || 'Fixed'}</span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {svc.currency || currency}{' '}
                        {Number(svc.default_unit_price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => isAdmin && handleToggleActive(svc)}
                          disabled={!isAdmin}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition ${
                            svc.is_active
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                          }`}
                        >
                          {svc.is_active ? '● Active' : '○ Disabled'}
                        </button>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(svc)}
                              className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-900 rounded-lg transition"
                              title="Edit Service"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteService(svc.id, svc.name)}
                              className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 rounded-lg transition"
                              title="Delete Service"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Service Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingService ? 'Edit Service Package' : 'Create New Service Package'}
      >
        <form onSubmit={handleSaveService} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Service Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cloud Architecture & Web App Development"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Billing Model
              </label>
              <select
                value={formData.billing_type}
                onChange={(e) => setFormData({ ...formData, billing_type: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
              >
                {BILLING_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b} Price
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Default Unit Price
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={formData.default_unit_price}
                onChange={(e) => setFormData({ ...formData, default_unit_price: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="PKR">PKR (Default Base)</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
                <option value="SAR">SAR</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Scope / Deliverables Description
            </label>
            <textarea
              rows={3}
              placeholder="Detailed description of what is included in this service package..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="service_is_active_input"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-blue-500 focus:ring-0"
            />
            <label htmlFor="service_is_active_input" className="text-xs text-zinc-300 cursor-pointer">
              Active in Quotation & Invoice Pickers
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              {editingService ? 'Update Service' : 'Save Service'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
