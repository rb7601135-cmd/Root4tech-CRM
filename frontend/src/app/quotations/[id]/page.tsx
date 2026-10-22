'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { Quotation, QuotationStatus } from '@/types/crm';
import {
  FileSpreadsheet,
  FileDown,
  Download,
  Printer,
  Send,
  Mail,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FolderPlus,
  Receipt,
  Building,
  User,
  Calendar,
  Layers,
  ExternalLink,
  X,
} from 'lucide-react';

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Send Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadQuotation = async () => {
    setIsLoading(true);
    try {
      const data = await api.getQuotation(quotationId);
      setQuotation(data);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to load quotation');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (quotationId) loadQuotation();
  }, [quotationId]);

  const handleOpenSendModal = () => {
    if (!quotation) return;
    const snap = (quotation.client_snapshot || {}) as Record<string, string>;
    const email = snap.email || quotation.client_details?.email || '';
    const name = snap.name || quotation.client_details?.name || 'Valued Client';
    setSendRecipient(email);
    setSendSubject(`Quotation ${quotation.quotation_number} - ${quotation.title} from Roo4Tech`);
    setSendMessage(
      `Dear ${name},\n\nPlease find attached the quotation ${quotation.quotation_number} (${quotation.title}) for your review.\n\nTotal Proposal Value: ${Number(quotation.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${quotation.currency}\n\nWe look forward to collaborating with you. Please let us know if you have any questions.\n\nBest regards,\nRoo4Tech Solutions Team\nhttps://roo4tech.com`
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
      const res = await api.sendQuotation(quotationId, {
        recipient_email: sendRecipient,
        subject: sendSubject,
        message: sendMessage,
      });
      setSuccessMsg(res.message);
      if (res.quotation) setQuotation(res.quotation);
      setIsSendModalOpen(false);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to send quotation email');
    } finally {
      setIsSending(false);
    }
  };

  const handleIssue = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      const updated = await api.issueQuotation(quotationId);
      setQuotation(updated);
      setSuccessMsg('Quotation issued and client snapshot sealed.');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to issue quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      const updated = await api.acceptQuotation(quotationId);
      setQuotation(updated);
      setSuccessMsg('Quotation marked as Accepted. Ready for project or invoice conversion.');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to accept quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToProject = async () => {
    if (!confirm('Convert this accepted quotation into an active Project?')) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await api.convertQuotationToProject(quotationId);
      setSuccessMsg(res.message);
      if (res.quotation) setQuotation(res.quotation);
      setTimeout(() => {
        router.push(`/projects/${res.project_id}`);
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to convert quotation to project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!confirm('Convert this quotation into a formal Invoice?')) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await api.convertQuotationToInvoice(quotationId);
      setSuccessMsg(res.message);
      if (res.quotation) setQuotation(res.quotation);
      setTimeout(() => {
        router.push(`/invoices/${res.invoice_id}`);
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to convert quotation to invoice');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-zinc-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Loading quotation {quotationId}...</p>
        </div>
      </AppLayout>
    );
  }

  if (!quotation) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-zinc-400">
          <p className="text-red-400 font-semibold mb-2">{errorMsg || 'Quotation not found'}</p>
          <Link href="/quotations" className="text-sm text-indigo-400 hover:underline">
            ← Back to Quotations
          </Link>
        </div>
      </AppLayout>
    );
  }

  const snap = (quotation.client_snapshot || {}) as Record<string, string>;
  const clientName = snap.name || quotation.client_details?.name || 'Client';
  const clientCompany = snap.company_name || quotation.client_details?.company_name || '';
  const clientEmail = snap.email || quotation.client_details?.email || '';
  const clientPhone = snap.phone || quotation.client_details?.phone || '';
  const clientBilling = snap.billing_address || quotation.client_details?.billing_address || '';

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800 no-print">
          <div className="flex items-center gap-3">
            <Link
              href="/quotations"
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white font-mono">{quotation.quotation_number}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-200">
                  {quotation.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{quotation.title}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Save as PDF */}
            <a
              href={api.getQuotationPdfUrl(quotation.id, true)}
              download={`${quotation.quotation_number}.pdf`}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
              title="Save branded quotation directly as PDF file"
            >
              <Download className="w-4 h-4" />
              Save as PDF
            </a>

            {/* 2. Print */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
              title="Print quotation or save to local printer"
            >
              <Printer className="w-4 h-4 text-zinc-400" />
              Print
            </button>

            {/* 3. Send to Client */}
            <button
              type="button"
              onClick={handleOpenSendModal}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
              title="Send quotation via email with attached PDF"
            >
              <Send className="w-4 h-4" />
              Send to Client
            </button>

            {quotation.status !== 'Accepted' && quotation.status !== 'Cancelled' && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleAccept}
                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Mark Accepted
              </Button>
            )}

            {/* Conversions */}
            {!quotation.is_converted_to_invoice ? (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={handleConvertToInvoice}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Receipt className="w-4 h-4 mr-1.5" />
                Convert to Invoice
              </Button>
            ) : (
              <Link
                href={`/invoices/${quotation.converted_invoice_id}`}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 text-xs font-semibold hover:bg-emerald-900/40 flex items-center gap-1"
              >
                <Receipt className="w-3.5 h-3.5" />
                View Converted Invoice ↗
              </Link>
            )}

            {!quotation.is_converted_to_project ? (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={handleConvertToProject}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                <FolderPlus className="w-4 h-4 mr-1.5" />
                Convert to Project
              </Button>
            ) : (
              <Link
                href={`/projects/${quotation.converted_project_id}`}
                className="px-3 py-1.5 rounded-lg bg-blue-950/40 text-blue-300 border border-blue-800/60 text-xs font-semibold hover:bg-blue-900/40 flex items-center gap-1"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                View Converted Project ↗
              </Link>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Client & Metadata Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-400" />
                Central Client Profile
              </span>
              <Link
                href={`/clients/${quotation.client}`}
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>{quotation.client_details?.client_id || 'CLI'}</span>
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
              <span className="font-semibold text-zinc-400 uppercase tracking-wider">Proposal Terms & Currency</span>
              <span className="font-mono text-zinc-300 font-bold px-2 py-0.5 rounded bg-zinc-800">
                {quotation.currency}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-zinc-300 pt-1">
              <div>
                <span className="text-zinc-500 block">Issue Date:</span>
                <span className="font-medium text-zinc-200">{quotation.issue_date}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Expiry Date:</span>
                <span className="font-medium text-zinc-200">{quotation.expiry_date || '30 Days'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Salesperson:</span>
                <span className="font-medium text-zinc-200">
                  {quotation.salesperson_details?.full_name || 'Roo4Tech Sales'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Exchange Rate:</span>
                <span className="font-medium text-zinc-200 font-mono">
                  1 {quotation.currency} = {quotation.exchange_rate_to_base} PKR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 font-semibold text-sm text-zinc-200 flex items-center justify-between">
            <span>Scope of Work & Line Items</span>
            <span className="text-xs text-zinc-400 font-mono">{quotation.items.length} items</span>
          </div>
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/50 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit Price ({quotation.currency})</th>
                <th className="px-5 py-3 text-right">Line Total ({quotation.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {quotation.items.map((item, idx) => (
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
                  {Number(quotation.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
                </span>
              </div>
              {Number(quotation.discount_amount) > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount ({quotation.discount_percentage}%):</span>
                  <span className="font-mono">
                    -{Number(quotation.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
                  </span>
                </div>
              )}
              {Number(quotation.tax_amount) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Tax ({quotation.tax_percentage}%):</span>
                  <span className="font-mono">
                    +{Number(quotation.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm font-bold text-white">
                <span>Total Amount:</span>
                <span className="font-mono text-indigo-400 text-base">
                  {Number(quotation.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Terms & Conditions</h3>
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
              {quotation.terms_and_conditions || 'Standard company payment terms apply.'}
            </pre>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Internal Notes</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {quotation.internal_notes || 'No internal notes specified.'}
            </p>
          </div>
        </div>

        {/* Send Quotation Email Modal */}
        {isSendModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-print">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-sky-400" />
                  <h3 className="text-base font-bold text-white">Send Quotation to Client</h3>
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
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-sky-500"
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
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-sky-500"
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
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                  />
                </div>

                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center gap-2.5 text-zinc-300">
                  <FileSpreadsheet className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="font-semibold block text-zinc-200">
                      📎 Attachment: {quotation.quotation_number}.pdf
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      High-resolution branded PDF with breakdown & payment terms
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
                    className="bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20"
                  >
                    {isSending ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Send Email & PDF
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
