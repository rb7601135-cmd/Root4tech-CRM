'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import ClientSelector from '@/components/ui/ClientSelector';
import { api } from '@/lib/api';
import { Invoice, InvoiceStatus, CurrencyCode, Client, CompanyService } from '@/types/crm';
import {
  Receipt,
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
  CreditCard,
  DollarSign,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [availableServices, setAvailableServices] = useState<CompanyService[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [title, setTitle] = useState('Professional IT Services & Software Development');
  const [currency, setCurrency] = useState<CurrencyCode>('PKR');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [discountPercentage, setDiscountPercentage] = useState('0');
  const [taxPercentage, setTaxPercentage] = useState('0');
  const [terms, setTerms] = useState(
    '1. Payment is strictly due by the specified due date.\n2. Please mention the invoice number in your wire/bank reference.\n3. Bank Account: Roo4Tech (Pvt) Ltd, Meezan Bank, IBAN: PK99MEZN0001234567890101'
  );
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<Array<{ description: string; quantity: string; unit_price: string }>>([
    { description: 'Cloud Architecture & Web App Development', quantity: '1', unit_price: '300000' },
  ]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (currencyFilter !== 'all') params.currency = currencyFilter;

      const res = await api.getInvoices(params);
      setInvoices(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [search, statusFilter, currencyFilter]);

  useEffect(() => {
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

  const handleLineItemChange = (index: number, field: string, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

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
      setFormError('Please verify all line items.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await api.createInvoice({
        client: selectedClient.id,
        title,
        currency,
        issue_date: issueDate,
        due_date: dueDate,
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
      setSelectedClient(null);
      setLineItems([{ description: '', quantity: '1', unit_price: '0' }]);
      loadInvoices();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Stats
  const totalInvoicedCount = invoices.length;
  const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;
  const paidCount = invoices.filter((i) => i.status === 'Paid').length;

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles: Record<InvoiceStatus, { bg: string; text: string; icon: React.ReactNode }> = {
      Draft: { bg: 'bg-zinc-800 text-zinc-300 border-zinc-700', text: 'Draft', icon: <Clock className="w-3 h-3" /> },
      Issued: { bg: 'bg-blue-950/40 text-blue-400 border-blue-800/40', text: 'Issued', icon: <Clock className="w-3 h-3" /> },
      'Partially Paid': { bg: 'bg-amber-950/40 text-amber-400 border-amber-800/40', text: 'Partially Paid', icon: <CreditCard className="w-3 h-3" /> },
      Paid: { bg: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40', text: 'Paid Full', icon: <CheckCircle2 className="w-3 h-3" /> },
      Overdue: { bg: 'bg-rose-950/40 text-rose-400 border-rose-800/40 animate-pulse', text: 'Overdue', icon: <AlertTriangle className="w-3 h-3" /> },
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
              <Receipt className="w-7 h-7 text-sky-400" />
              Invoices & Payment Management
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Issue branded tax invoices, record partial/full payments, and track overdue receivables with immutable snapshots.
            </p>
          </div>
          <Button
            onClick={() => {
              setFormError('');
              setIsModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
            className="shadow-lg shadow-sky-600/20 bg-sky-600 hover:bg-sky-500"
          >
            Create Invoice
          </Button>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Invoices</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{totalInvoicedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Paid In Full</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{paidCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Overdue Invoices</p>
              <p className="text-2xl font-bold text-rose-400 mt-1 font-mono">{overdueCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, title, client..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Issued">Issued</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-sky-500"
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

        {/* Invoices Table */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/90 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Client & Company</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total Amount</th>
                  <th className="px-5 py-3.5 text-right">Paid</th>
                  <th className="px-5 py-3.5 text-right">Balance Due</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-zinc-400">
                      <div className="inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <p>Loading invoices...</p>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-zinc-400">
                      <Receipt className="w-10 h-10 mx-auto text-zinc-400 mb-2" />
                      <p className="text-base font-semibold text-zinc-200">No invoices found</p>
                      <p className="text-xs text-zinc-400 mt-1">Create an invoice or convert an accepted quotation.</p>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`hover:bg-zinc-900/50 transition ${
                        inv.status === 'Overdue' ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="px-5 py-4 font-mono font-medium text-sky-400">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline flex items-center gap-1">
                          {inv.invoice_number}
                          <ArrowRight className="w-3 h-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/clients/${inv.client}`}
                          className="font-medium text-zinc-200 hover:text-sky-400 transition"
                        >
                          {inv.client_details?.name || 'Client'}
                        </Link>
                        <div className="text-xs text-zinc-400">
                          {inv.client_details?.company_name || inv.client_details?.client_id}
                        </div>
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(inv.status)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-zinc-100 font-mono">
                        {Number(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {inv.currency}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-emerald-400 font-mono">
                        {Number(inv.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold font-mono">
                        <span className={Number(inv.remaining_balance) > 0 ? 'text-rose-400' : 'text-zinc-500'}>
                          {Number(inv.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono">
                        <span className={inv.status === 'Overdue' ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                          {inv.due_date || 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={api.getInvoicePdfUrl(inv.id, true)}
                            download={`${inv.invoice_number}.pdf`}
                            className="p-1.5 hover:bg-sky-600/20 text-zinc-400 hover:text-sky-300 rounded-lg transition"
                            title="Save as PDF (Direct Download)"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <a
                            href={api.getInvoicePdfUrl(inv.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition"
                            title="Print / View Branded PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </a>
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-sky-300 rounded-lg transition"
                            title="View / Record Payment"
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

      {/* Create Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-sky-400" />
                New Tax Invoice
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Invoice Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Currency *
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-sky-500 font-semibold"
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Invoice Line Items *
                  </span>
                  <div className="flex items-center gap-2">
                    {availableServices.length > 0 && (
                      <select
                        onChange={(e) => {
                          const svcId = Number(e.target.value);
                          const svc = availableServices.find((s) => s.id === svcId);
                          if (svc) {
                            setLineItems([
                              ...lineItems,
                              {
                                description: svc.name + (svc.description ? ` - ${svc.description}` : ''),
                                quantity: '1',
                                unit_price: String(svc.default_unit_price),
                              },
                            ]);
                          }
                          e.target.value = '';
                        }}
                        defaultValue=""
                        className="px-2 py-1 bg-sky-950/40 border border-sky-800/60 rounded-lg text-xs text-sky-300 focus:outline-none focus:border-sky-500 font-medium"
                      >
                        <option value="" disabled>+ Add from Services Catalog...</option>
                        {availableServices.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.currency} {Number(s.default_unit_price).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
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
                        <div className="col-span-6 space-y-1">
                          {availableServices.length > 0 && (
                            <select
                              onChange={(e) => {
                                const svcId = Number(e.target.value);
                                const svc = availableServices.find((s) => s.id === svcId);
                                if (svc) {
                                  handleLineItemChange(idx, 'description', svc.name + (svc.description ? ` - ${svc.description}` : ''));
                                  handleLineItemChange(idx, 'unit_price', String(svc.default_unit_price));
                                }
                                e.target.value = '';
                              }}
                              defaultValue=""
                              className="w-full px-2 py-0.5 bg-zinc-950 border border-sky-900/40 rounded text-[11px] text-sky-300 focus:outline-none focus:border-sky-500 font-medium"
                            >
                              <option value="" disabled>✨ Auto-fill from Service Catalog...</option>
                              {availableServices.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.currency} {Number(s.default_unit_price).toLocaleString()})
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            required
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
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
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 text-right"
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
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 text-right"
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

              {/* Summary */}
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
                  <span className="text-sky-400 text-base font-mono">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
                </div>
              </div>

              {/* Terms */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Payment Instructions & Terms
                </label>
                <textarea
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-sky-500 font-sans"
                />
              </div>

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
                  className="bg-sky-600 hover:bg-sky-500"
                >
                  {isSubmitting ? 'Creating Invoice...' : 'Create Invoice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
