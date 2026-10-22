'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { api } from '@/lib/api';
import { AuditLog, ExchangeRate, AutomationRule, AutomationLog } from '@/types/crm';
import {
  Building2,
  Upload,
  Shield,
  Activity,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Palette,
  Lock,
  Coins,
  Bot,
  Play,
  RefreshCw,
  Check,
  Plus,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const { settings, refreshSettings, currency } = useCompany();

  const [companyName, setCompanyName] = useState('Roo4Tech');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('PKR');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setEmail(settings.email);
      setPhone(settings.phone);
      setWebsite(settings.website);
      setAddress(settings.address);
      setDefaultCurrency(settings.default_currency);
      setLogoPreview(settings.logo_url);
    }
  }, [settings]);

  const loadAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (logSearch) params.search = logSearch;
      if (logModule) params.module = logModule;

      const res = await api.getAuditLogs(params);
      setAuditLogs(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadExchangeRates = async () => {
    setRatesLoading(true);
    try {
      const res = await api.getExchangeRates();
      setExchangeRates(Array.isArray(res) ? res : (res as { results?: ExchangeRate[] }).results || []);
    } catch (err) {
      console.error('Failed to load exchange rates', err);
    } finally {
      setRatesLoading(false);
    }
  };

  const loadAutomations = async () => {
    setAutomationsLoading(true);
    try {
      const [rulesRes, logsRes] = await Promise.all([
        api.getAutomationRules(),
        api.getAutomationLogs(),
      ]);
      setAutomationRules(Array.isArray(rulesRes) ? rulesRes : (rulesRes as { results?: AutomationRule[] }).results || []);
      setAutomationLogs(Array.isArray(logsRes) ? logsRes : (logsRes as { results?: AutomationLog[] }).results || []);
    } catch (err) {
      console.error('Failed to load automations', err);
    } finally {
      setAutomationsLoading(false);
    }
  };

  // Multi-Currency Exchange Rates State
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [editingRateVal, setEditingRateVal] = useState<string>('');
  const [rateSaving, setRateSaving] = useState(false);

  // Automation Rules & Engine State
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [automationsLoading, setAutomationsLoading] = useState(true);
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);
  const [automationResultMsg, setAutomationResultMsg] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logSearch, setLogSearch] = useState('');
  const [logModule, setLogModule] = useState('');

  useEffect(() => {
    loadExchangeRates();
    loadAutomations();
  }, []);


  const handleSaveRate = async (id: number) => {
    if (!editingRateVal || isNaN(Number(editingRateVal))) return;
    setRateSaving(true);
    try {
      await api.updateExchangeRate(id, { rate_to_base: editingRateVal });
      setEditingRateId(null);
      loadExchangeRates();
    } catch (err) {
      console.error('Failed to update exchange rate', err);
    } finally {
      setRateSaving(false);
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      await api.updateAutomationRule(rule.id, { is_active: !rule.is_active });
      loadAutomations();
    } catch (err) {
      console.error('Failed to toggle automation rule', err);
    }
  };

  const handleRunAutomations = async () => {
    setIsRunningAutomation(true);
    setAutomationResultMsg(null);
    try {
      const res = await api.runAutomations();
      setAutomationResultMsg(res.message || 'Automations executed successfully');
      loadAutomations();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setAutomationResultMsg(e.message || 'Failed to trigger automations');
    } finally {
      setIsRunningAutomation(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [logSearch, logModule]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation: max 2MB
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Logo image file cannot exceed 2 MB.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) {
      setErrorMessage('Allowed formats: PNG, JPG, JPEG, WEBP, SVG.');
      return;
    }

    setErrorMessage(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('company_name', companyName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('website', website);
      formData.append('address', address);
      formData.append('default_currency', defaultCurrency);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      await api.updateCompanySettings(formData);
      setSaveSuccess(true);
      refreshSettings();
      loadAuditLogs();
    } catch (err: unknown) {
      const apiErr = err as { data?: { logo?: string[]; detail?: string }; message?: string };
      setErrorMessage(
        apiErr.data?.logo?.[0] || apiErr.data?.detail || apiErr.message || 'Failed to update settings.'
      );
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Company Settings & Security
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Configure Roo4Tech branding, currency defaults, account security, and audit logs.
          </p>
        </div>

        {/* Company Profile & Logo Upload */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Company Identity & Branding</h2>
            </div>
            {!isAdmin && (
              <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                Admin Editable Only
              </span>
            )}
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Company settings saved successfully!</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Logo Upload Section */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                Company Logo
              </label>
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <span className="font-black text-2xl text-blue-400">R4</span>
                  )}
                </div>

                {isAdmin && (
                  <div className="space-y-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer transition border border-zinc-700">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload New Logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Supported: PNG, JPG, SVG, WEBP • Max size: 2 MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Company Name</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Default Currency
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  placeholder="PKR"
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono disabled:opacity-60"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">Default set to PKR for Roo4Tech operations.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Official Email</label>
                <input
                  type="email"
                  disabled={!isAdmin}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Phone</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Website</label>
                <input
                  type="url"
                  disabled={!isAdmin}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Office Address</label>
              <textarea
                rows={2}
                disabled={!isAdmin}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 disabled:opacity-60"
              />
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-2">
                <Button type="submit" size="sm" isLoading={isSaving}>
                  Save Company Settings
                </Button>
              </div>
            )}
          </form>
        </div>

        {/* Account Password & Security Link */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Personal Password & Account Credentials</h2>
              <p className="text-xs text-zinc-400">
                Password management has been centralized in your personal User Profile page.
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <span>Go to My Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Multi-Currency & Exchange Rates */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Multi-Currency & Exchange Rates</h2>
                <p className="text-xs text-zinc-400">
                  Roo4Tech company base currency is <strong className="text-amber-400">PKR</strong>. Rates define 1 unit of foreign currency in PKR.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadExchangeRates}
              isLoading={ratesLoading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Rates
            </Button>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            {ratesLoading ? (
              <div className="p-6 text-center text-xs text-zinc-400">Loading exchange rates...</div>
            ) : exchangeRates.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">No currency rates found.</div>
            ) : (
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Currency</th>
                    <th className="px-4 py-2.5">Exchange Rate (in PKR)</th>
                    <th className="px-4 py-2.5">Last Updated</th>
                    {isAdmin && <th className="px-4 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                  {exchangeRates.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 font-bold text-amber-400 font-sans">
                        {r.currency_code}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-zinc-100">
                        {editingRateId === r.id ? (
                          <div className="flex items-center gap-2">
                            <span>1 {r.currency_code} =</span>
                            <input
                              type="number"
                              step="0.0001"
                              value={editingRateVal}
                              onChange={(e) => setEditingRateVal(e.target.value)}
                              className="w-28 px-2 py-1 bg-zinc-950 border border-amber-500/60 rounded text-xs text-white"
                            />
                            <span>PKR</span>
                          </div>
                        ) : (
                          <span>1 {r.currency_code} = {Number(r.rate_to_base).toFixed(4)} PKR</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {new Date(r.updated_at).toLocaleString()}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 text-right font-sans">
                          {editingRateId === r.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                isLoading={rateSaving}
                                onClick={() => handleSaveRate(r.id)}
                                icon={<Check className="w-3.5 h-3.5" />}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingRateId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingRateId(r.id);
                                setEditingRateVal(String(r.rate_to_base));
                              }}
                            >
                              Edit Rate
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>


        {/* CRM Automation Rules & Engine */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">CRM Workflow Automations</h2>
                <p className="text-xs text-zinc-400">
                  Automated background workflows for overdue invoices, proposal follow-ups, and milestone alerts.
                </p>
              </div>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                onClick={handleRunAutomations}
                isLoading={isRunningAutomation}
                icon={<Play className="w-3.5 h-3.5" />}
              >
                Run Automations Now
              </Button>
            )}
          </div>

          {automationResultMsg && (
            <div className="p-3 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-xs text-indigo-200">
              {automationResultMsg}
            </div>
          )}

          <div className="space-y-2.5">
            {automationsLoading ? (
              <div className="p-6 text-center text-xs text-zinc-400">Loading automation workflows...</div>
            ) : automationRules.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">No automation rules configured.</div>
            ) : (
              automationRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-xl bg-zinc-800/30 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-200">{rule.name}</span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-1.5 py-0.5 rounded font-mono">
                        {rule.rule_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Trigger: {rule.days_trigger} days • Channels: {rule.send_in_app ? 'In-App' : ''} {rule.send_email ? 'Email' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      rule.is_active
                        ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}>
                      {rule.is_active ? 'Active' : 'Disabled'}
                    </span>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleRule(rule)}
                      >
                        {rule.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 12: Audit Logs Viewer */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">System Audit Trail</h2>
                <p className="text-xs text-zinc-400">
                  Immutable record of auth events, lead conversions, client changes, and role assignments.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Filter logs..."
                  className="pl-8 pr-3 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200"
                />
              </div>

              <select
                value={logModule}
                onChange={(e) => setLogModule(e.target.value)}
                className="px-2.5 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300"
              >
                <option value="">All Modules</option>
                <option value="AUTH">Authentication</option>
                <option value="LEADS">Leads</option>
                <option value="CLIENTS">Clients</option>
                <option value="TEAM">Team</option>
                <option value="SETTINGS">Settings</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            {logsLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400">Loading audit trail...</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">No audit records match the filters.</div>
            ) : (
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">Module</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 text-zinc-400 shrink-0">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300 font-sans">
                        {log.user_details?.email || 'System'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px]">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-blue-400 font-semibold">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300 font-sans">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

    </AppLayout>
  );
}
