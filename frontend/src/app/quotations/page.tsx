'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import ClientSelector from '@/components/ui/ClientSelector';
import { api } from '@/lib/api';
import { Quotation, QuotationStatus, CurrencyCode, Client, User, CompanyService } from '@/types/crm';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  FileDown,
  Download,
  Printer,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Trash2,
  ArrowRight,
  Briefcase,
  Boxes,
} from 'lucide-react';
import MultiServiceModal from '@/components/ui/MultiServiceModal';

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [availableServices, setAvailableServices] = useState<CompanyService[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [title, setTitle] = useState('Custom Software Development & ERP Proposal');
  const [salesperson, setSalesperson] = useState<number | ''>('');
  const [currency, setCurrency] = useState<CurrencyCode>('PKR');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [discountPercentage, setDiscountPercentage] = useState('0');
  const [taxPercentage, setTaxPercentage] = useState('0');
  const [terms, setTerms] = useState(
    '1. Quotation valid for 30 days from issue.\n2. 50% advance required prior to development kickoff.\n3. Roo4Tech warrants high quality deliverables as per milestone scope.'
  );
  const [notes, setNotes] = useState('');
  const [isMultiServiceModalOpen, setIsMultiServiceModalOpen] = useState(false);
  const [lineItems, setLineItems] = useState<Array<{ service_id?: number | ''; description: string; quantity: string; unit_price: string }>>([
    { service_id: '', description: 'Web Application Architecture & Development', quantity: '1', unit_price: '250000' },
  ]);

  const handleAddMultipleServices = (selected: CompanyService[]) => {
    const newItems = selected.map((svc) => ({
      service_id: svc.id,
      description: svc.name + (svc.description ? ` - ${svc.description}` : ''),
      quantity: '1',
      unit_price: String(svc.default_unit_price),
    }));

    const isFirstRowEmptyOrDefault =
      lineItems.length === 1 &&
      (!lineItems[0].description.trim() ||
        (lineItems[0].description === 'Web Application Architecture & Development' && lineItems[0].unit_price === '250000' && !lineItems[0].service_id));

    if (isFirstRowEmptyOrDefault) {
      setLineItems(newItems);
    } else {
      setLineItems([...lineItems, ...newItems]);
    }
  };

  const loadQuotations = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (currencyFilter !== 'all') params.currency = currencyFilter;

      const res = await api.getQuotations(params);
      setQuotations(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [search, statusFilter, currencyFilter]);

  useEffect(() => {
    api.getTeam().then((res) => {
      setTeamMembers(Array.isArray(res) ? res : res.results || []);
    }).catch(console.error);

    api.getServices({ active_only: true }).then((res) => {
      setAvailableServices(Array.isArray(res) ? res : (res as { results?: CompanyService[] }).results || []);
    }).catch(console.error);
  }, []);

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: '1', unit_price: '0' }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  // Calculations
  const subtotal = lineItems.reduce((acc, item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unit_price) || 0;
    return acc + q * p;
  }, 0);
  const discountAmount = subtotal * ((parseFloat(discountPercentage) || 0) / 100);
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxable * ((parseFloat(taxPercentage) || 0) / 100);
  const grandTotal = taxable + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      setFormError('Please select a client from the central database.');
      return;
    }
    if (lineItems.some((item) => !item.description.trim() || parseFloat(item.unit_price) < 0)) {
      setFormError('Please ensure all line items have descriptions and valid unit prices.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await api.createQuotation({
        client: selectedClient.id,
        title,
        salesperson: salesperson ? Number(salesperson) : null,
        currency,
        issue_date: issueDate,
        expiry_date: expiryDate,
        discount_percentage: parseFloat(discountPercentage) || 0,
        tax_percentage: parseFloat(taxPercentage) || 0,
        terms_and_conditions: terms,
        internal_notes: notes,
        items: lineItems.map((item, idx) => ({
          item_order: idx + 1,
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
        })),
      });

      setIsModalOpen(false);
      // Reset form
      setSelectedClient(null);
      setLineItems([{ description: '', quantity: '1', unit_price: '0' }]);
      loadQuotations();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to create quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    const styles: Record<QuotationStatus, { bg: string; text: string; icon: React.ReactNode }> = {
      Draft: { bg: 'bg-zinc-800 text-zinc-300 border-zinc-700', text: 'Draft', icon: <Clock className="w-3 h-3" /> },
      Sent: { bg: 'bg-blue-950/40 text-blue-400 border-blue-800/40', text: 'Sent / Issued', icon: <Clock className="w-3 h-3" /> },
      Accepted: { bg: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40', text: 'Accepted', icon: <CheckCircle2 className="w-3 h-3" /> },
      Rejected: { bg: 'bg-rose-950/40 text-rose-400 border-rose-800/40', text: 'Rejected', icon: <XCircle className="w-3 h-3" /> },
      Expired: { bg: 'bg-amber-950/40 text-amber-400 border-amber-800/40', text: 'Expired', icon: <AlertCircle className="w-3 h-3" /> },
      Cancelled: { bg: 'bg-zinc-900 text-zinc-400 border-zinc-800', text: 'Cancelled', icon: <XCircle className="w-3 h-3" /> },
    };
    const s = styles[status] || styles.Draft;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.bg}`}>
        {s.icon}
        {s.text}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <FileSpreadsheet className="w-7 h-7 text-indigo-400" />
              Quotations & Proposals
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Multi-currency business proposals linked to central client records with branded PDF generation.
            </p>
          </div>
          <Button
            onClick={() => {
              setFormError('');
              setIsModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
            className="shadow-lg shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-500"
          >
            Create Quotation
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotation #, title, client..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent / Issued</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Expired">Expired</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Currencies</option>
              <option value="PKR">PKR - Pakistani Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="EUR">EUR - Euro</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="SAR">SAR - Saudi Riyal</option>
              <option value="CAD">CAD - Canadian Dollar</option>
            </select>
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/90 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5">Quote #</th>
                  <th className="px-5 py-3.5">Client & Company</th>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total Amount</th>
                  <th className="px-5 py-3.5">Issue Date</th>
                  <th className="px-5 py-3.5">Conversions</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-zinc-400">
                      <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <p>Loading quotations...</p>
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-zinc-400">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-zinc-400 mb-2" />
                      <p className="text-base font-semibold text-zinc-200">No quotations found</p>
                      <p className="text-xs text-zinc-400 mt-1">Create your first client quotation above.</p>
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-zinc-900/50 transition">
                      <td className="px-5 py-4 font-mono font-medium text-indigo-400">
                        <Link href={`/quotations/${q.id}`} className="hover:underline flex items-center gap-1">
                          {q.quotation_number}
                          <ArrowRight className="w-3 h-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/clients/${q.client}`}
                          className="font-medium text-zinc-200 hover:text-indigo-400 transition"
                        >
                          {q.client_details?.name || 'Client'}
                        </Link>
                        <div className="text-xs text-zinc-400">
                          {q.client_details?.company_name || q.client_details?.client_id}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs truncate text-zinc-300">
                        {q.title}
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(q.status)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-zinc-100 font-mono">
                        {Number(q.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {q.currency}
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-400">
                        {q.issue_date}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {q.is_converted_to_project && (
                          <span className="inline-block px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/40 mr-1">
                            Project
                          </span>
                        )}
                        {q.is_converted_to_invoice && (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                            Invoice
                          </span>
                        )}
                        {!q.is_converted_to_project && !q.is_converted_to_invoice && (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={api.getQuotationPdfUrl(q.id, true)}
                            download={`${q.quotation_number}.pdf`}
                            className="p-1.5 hover:bg-indigo-600/20 text-zinc-400 hover:text-indigo-300 rounded-lg transition"
                            title="Save as PDF (Direct Download)"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <a
                            href={api.getQuotationPdfUrl(q.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition"
                            title="Print / View Branded PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </a>
                          <Link
                            href={`/quotations/${q.id}`}
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-indigo-300 rounded-lg transition"
                            title="View Quotation Details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Quotation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                New Quotation / Proposal
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-5">
              {/* Central Client Selector */}
              <ClientSelector
                selectedClientId={selectedClient?.id}
                onSelectClient={(c) => setSelectedClient(c)}
                required
                label="Select Central Client *"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Quotation Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Assigned Salesperson
                  </label>
                  <select
                    value={salesperson}
                    onChange={(e) => setSalesperson(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned (Sales Team)</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Currency *
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="PKR">PKR (Default Base)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="CAD">CAD (Canadian Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Valid Until / Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-zinc-800/80">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    Service Line Items *
                    <span className="text-zinc-500 text-[11px] font-normal normal-case">({lineItems.length} items)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {availableServices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsMultiServiceModalOpen(true)}
                        className="px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 hover:text-indigo-200 border border-indigo-800/60 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        + Add Multiple Services
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Blank Item
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, idx) => {
                    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl"
                      >
                        <div className="col-span-6 space-y-1.5">
                          {availableServices.length > 0 && (
                            <select
                              value={item.service_id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  handleLineItemChange(idx, 'service_id', '');
                                  return;
                                }
                                const svcId = Number(val);
                                const svc = availableServices.find((s) => s.id === svcId);
                                if (svc) {
                                  handleLineItemChange(idx, 'service_id', svc.id);
                                  handleLineItemChange(idx, 'description', svc.name + (svc.description ? ` - ${svc.description}` : ''));
                                  handleLineItemChange(idx, 'unit_price', String(svc.default_unit_price));
                                } else {
                                  handleLineItemChange(idx, 'service_id', '');
                                }
                              }}
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-medium"
                            >
                              <option value="">-- Choose a Service from Catalog --</option>
                              {availableServices.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.currency} {Number(s.default_unit_price).toLocaleString()})
                                </option>
                              ))}
                              <option value="__custom__">✏️ Custom / Non-Catalog Item</option>
                            </select>
                          )}
                          <input
                            type="text"
                            required
                            placeholder="Service scope / item description"
                            value={item.description}
                            onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            required
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 text-right"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            placeholder="Price"
                            value={item.unit_price}
                            onChange={(e) => handleLineItemChange(idx, 'unit_price', e.target.value)}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 text-right"
                          />
                        </div>
                        <div className="col-span-1 text-right text-xs font-mono font-semibold text-zinc-200">
                          {lineTotal.toLocaleString()}
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            disabled={lineItems.length === 1}
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-1 text-zinc-400 hover:text-red-400 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Calculation Summary */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-zinc-300">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Discount (%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-right font-mono"
                    />
                    <span className="text-rose-400 font-mono">-{discountAmount.toFixed(2)} {currency}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-zinc-400">Tax / VAT (%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={taxPercentage}
                      onChange={(e) => setTaxPercentage(e.target.value)}
                      className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-right font-mono"
                    />
                    <span className="text-emerald-400 font-mono">+{taxAmount.toFixed(2)} {currency}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm font-bold text-white">
                  <span>Grand Total ({currency}):</span>
                  <span className="text-indigo-400 text-base font-mono">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
                </div>
              </div>

              {/* Terms and Internal Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Terms & Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Private notes (not visible to client in PDF)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500"
                >
                  {isSubmitting ? 'Saving Quotation...' : 'Save Quotation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Service Selection Modal */}
      <MultiServiceModal
        isOpen={isMultiServiceModalOpen}
        onClose={() => setIsMultiServiceModalOpen(false)}
        services={availableServices}
        currency={currency}
        themeColor="indigo"
        onSelectServices={handleAddMultipleServices}
      />
    </AppLayout>
  );
}
