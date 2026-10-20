'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { Invoice, InvoiceStatus, Payment } from '@/types/crm';
import {
  Receipt,
  FileDown,
  Download,
  Printer,
  Send,
  Mail,
  X,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  CreditCard,
  Building,
  DollarSign,
  Plus,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Payment Recording Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isRecordingPay, setIsRecordingPay] = useState(false);
  const [payError, setPayError] = useState('');

  // Send Invoice Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadInvoice = async () => {
    setIsLoading(true);
    try {
      const data = await api.getInvoice(invoiceId);
      setInvoice(data);
      // default payment amount to remaining balance
      if (data) {
        setPayAmount(String(data.remaining_balance));
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to load invoice');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) loadInvoice();
  }, [invoiceId]);

  const handleOpenSendModal = () => {
    if (!invoice) return;
    const snap = (invoice.client_snapshot || {}) as Record<string, string>;
    const email = snap.email || invoice.client_details?.email || '';
    const name = snap.name || invoice.client_details?.name || 'Valued Client';
    setSendRecipient(email);
    setSendSubject(`Tax Invoice ${invoice.invoice_number} from Roo4Tech`);
    setSendMessage(
      `Dear ${name},\n\nPlease find attached the tax invoice ${invoice.invoice_number} (${invoice.title}).\n\nTotal Invoiced: ${Number(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${invoice.currency}\nBalance Due: ${Number(invoice.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${invoice.currency}\nDue Date: ${invoice.due_date || 'Due upon receipt'}\n\nPlease let us know once the transfer has been initiated.\n\nBest regards,\nRoo4Tech Finance Team\nhttps://roo4tech.com`
    );
    setIsSendModalOpen(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendRecipient) {
      alert('Please enter a recipient email address.');
      return;
    }
    setIsSending(true);
    setErrorMsg('');
    try {
      const res = await api.sendInvoice(invoiceId, {
        recipient_email: sendRecipient,
        subject: sendSubject,
        message: sendMessage,
      });
      setSuccessMsg(res.message);
      if (res.invoice) setInvoice(res.invoice);
      setIsSendModalOpen(false);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to send invoice email');
    } finally {
      setIsSending(false);
    }
  };

  const handleIssue = async () => {
    try {
      const updated = await api.issueInvoice(invoiceId);
      setInvoice(updated);
      setSuccessMsg('Invoice issued and client snapshot sealed.');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to issue invoice');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      setPayError('Please enter a valid payment amount greater than zero.');
      return;
    }

    setIsRecordingPay(true);
    setPayError('');
    try {
      const res = await api.recordPayment(invoiceId, {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        payment_date: payDate,
        transaction_reference: payRef,
        notes: payNotes,
      });

      setSuccessMsg(res.message);
      setInvoice(res.invoice);
      setIsPayModalOpen(false);
      setPayRef('');
      setPayNotes('');
    } catch (err: unknown) {
      setPayError((err as Error).message || 'Failed to record payment');
    } finally {
      setIsRecordingPay(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-zinc-400">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Loading invoice {invoiceId}...</p>
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-zinc-400">
          <p className="text-red-400 font-semibold mb-2">{errorMsg || 'Invoice not found'}</p>
          <Link href="/invoices" className="text-sm text-sky-400 hover:underline">
            ← Back to Invoices
          </Link>
        </div>
      </AppLayout>
    );
  }

  const snap = (invoice.client_snapshot || {}) as Record<string, string>;
  const clientName = snap.name || invoice.client_details?.name || 'Client';
  const clientCompany = snap.company_name || invoice.client_details?.company_name || '';
  const clientEmail = snap.email || invoice.client_details?.email || '';
  const clientPhone = snap.phone || invoice.client_details?.phone || '';
  const clientBilling = snap.billing_address || invoice.client_details?.billing_address || '';

  const isFullyPaid = Number(invoice.remaining_balance) <= 0 && Number(invoice.total_amount) > 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800 no-print">
          <div className="flex items-center gap-3">
            <Link
              href="/invoices"
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white font-mono">{invoice.invoice_number}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    invoice.status === 'Paid'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                      : invoice.status === 'Overdue'
                      ? 'bg-rose-950/40 text-rose-400 border-rose-800/40 animate-pulse'
                      : 'bg-zinc-800 text-zinc-200 border-zinc-700'
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{invoice.title}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Save as PDF */}
            <a
              href={api.getInvoicePdfUrl(invoice.id, true)}
              download={`${invoice.invoice_number}.pdf`}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
              title="Save branded tax invoice directly as PDF file"
            >
              <Download className="w-4 h-4" />
              Save as PDF
            </a>

            {/* 2. Print */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
              title="Print invoice or save via local printer"
            >
              <Printer className="w-4 h-4 text-zinc-400" />
              Print
            </button>

            {/* 3. Send to Client */}
            <button
              type="button"
              onClick={handleOpenSendModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
              title="Send tax invoice via email with attached PDF"
            >
              <Send className="w-4 h-4" />
              Send to Client
            </button>

            {invoice.status === 'Draft' && (
              <Button variant="outline" size="sm" onClick={handleIssue}>
                Issue Invoice
              </Button>
            )}

            {!isFullyPaid && (
              <Button
                size="sm"
                onClick={() => {
                  setPayAmount(String(invoice.remaining_balance));
                  setPayError('');
                  setIsPayModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Record Payment
              </Button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Financial Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Invoiced</p>
            <p className="text-xl font-bold text-white mt-1 font-mono">
              {Number(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
            </p>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Paid</p>
            <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
              {Number(invoice.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
            </p>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Balance Due</p>
            <p className={`text-xl font-bold mt-1 font-mono ${Number(invoice.remaining_balance) > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
              {Number(invoice.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
            </p>
          </div>
        </div>

        {/* Client & Metadata Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-sky-400" />
                Billed Client
              </span>
              <Link
                href={`/clients/${invoice.client}`}
                className="text-xs text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>{invoice.client_details?.client_id || 'CLI'}</span>
                <span>↗</span>
              </Link>
            </div>
            <div>
              <p className="font-semibold text-zinc-100 text-base">{clientName}</p>
              {clientCompany && <p className="text-xs text-zinc-300 mt-0.5">🏢 {clientCompany}</p>}
              <p className="text-xs text-zinc-400 mt-1">✉️ {clientEmail}</p>
              {clientPhone && <p className="text-xs text-zinc-400">📞 {clientPhone}</p>}
              {clientBilling && (
                <p className="text-xs text-zinc-400 mt-2 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-500 font-medium block">Billing Address:</span>
                  {clientBilling}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-semibold text-zinc-400 uppercase tracking-wider">Invoice Timeline & Terms</span>
              <span className="font-mono text-zinc-300 font-bold px-2 py-0.5 rounded bg-zinc-800">
                {invoice.currency}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-zinc-300 pt-1">
              <div>
                <span className="text-zinc-500 block">Issue Date:</span>
                <span className="font-medium text-zinc-200">{invoice.issue_date}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Due Date:</span>
                <span className="font-medium text-zinc-200">{invoice.due_date || 'Upon Receipt'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Quotation Ref:</span>
                <span className="font-medium text-zinc-200 font-mono">
                  {invoice.quotation ? `#${invoice.quotation}` : 'Direct'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Exchange Rate:</span>
                <span className="font-medium text-zinc-200 font-mono">
                  1 {invoice.currency} = {invoice.exchange_rate_to_base} PKR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 font-semibold text-sm text-zinc-200">
            Invoice Items
          </div>
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/50 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit Price ({invoice.currency})</th>
                <th className="px-5 py-3 text-right">Line Total ({invoice.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {invoice.items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="px-5 py-3.5 text-zinc-500 text-xs">{idx + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-200">{item.description}</td>
                  <td className="px-5 py-3.5 text-right font-mono">{item.quantity}</td>
                  <td className="px-5 py-3.5 text-right font-mono">
                    {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-zinc-100">
                    {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div className="p-5 bg-zinc-900/40 border-t border-zinc-800 flex justify-end">
            <div className="w-80 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">
                  {Number(invoice.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
                </span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount ({invoice.discount_percentage}%):</span>
                  <span className="font-mono">
                    -{Number(invoice.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
                  </span>
                </div>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Tax ({invoice.tax_percentage}%):</span>
                  <span className="font-mono">
                    +{Number(invoice.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm font-bold text-white">
                <span>Total Invoiced:</span>
                <span className="font-mono text-zinc-100 text-base">
                  {Number(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-emerald-400">
                <span>Total Paid:</span>
                <span className="font-mono">
                  -{Number(invoice.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
                </span>
              </div>
              <div className="pt-1.5 border-t border-zinc-800 flex justify-between text-sm font-bold">
                <span className={Number(invoice.remaining_balance) > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  Balance Due:
                </span>
                <span className={`font-mono text-base ${Number(invoice.remaining_balance) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {Number(invoice.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History Table */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <span className="font-semibold text-sm text-zinc-200 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Recorded Payments & Receipts
            </span>
            <span className="text-xs text-zinc-400 font-mono">{invoice.payments?.length || 0} payments</span>
          </div>

          {!invoice.payments || invoice.payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No payments recorded yet against this invoice.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/50 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3">Receipt #</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3 text-right">Amount ({invoice.currency})</th>
                  <th className="px-5 py-3 text-right">Receipt PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/40">
                    <td className="px-5 py-3.5 font-mono font-medium text-emerald-400">{p.receipt_number}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-400">{p.payment_date}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-300">{p.payment_method}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-400 font-mono">{p.transaction_reference || 'N/A'}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-400">
                      {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <a
                        href={api.getReceiptPdfUrl(p.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Receipt
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Record Payment
              </h2>
              <button onClick={() => setIsPayModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            {payError && (
              <div className="mt-3 p-2.5 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
                {payError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Payment Amount ({invoice.currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={Number(invoice.remaining_balance)}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-emerald-400 font-mono text-base font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Remaining balance: {Number(invoice.remaining_balance).toLocaleString()} {invoice.currency}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Wire Transfer">Wire Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Transaction Reference #
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIRE-88192 / Cheque #10293"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Payment remarks"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPayModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isRecordingPay} className="bg-emerald-600 hover:bg-emerald-500">
                  {isRecordingPay ? 'Recording...' : 'Confirm Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Invoice Email Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-print">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Send Tax Invoice to Client</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSendModalOpen(false)}
                className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Email Subject *
                </label>
                <input
                  type="text"
                  required
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Personalized Message
                </label>
                <textarea
                  rows={4}
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                />
              </div>

              <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center gap-2.5 text-zinc-300">
                <Receipt className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <span className="font-semibold block text-zinc-200">
                    📎 Attachment: {invoice.invoice_number}.pdf
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Officially branded tax invoice with itemized breakdown & bank details
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSending}
                  onClick={() => setIsSendModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSending}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                >
                  {isSending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Send Invoice & PDF
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
