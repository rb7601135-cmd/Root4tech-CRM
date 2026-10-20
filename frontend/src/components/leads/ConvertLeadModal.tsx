'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lead, Client } from '@/types/crm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import {
  UserCheck,
  AlertTriangle,
  Building,
  Mail,
  Phone,
  Globe,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface ConvertLeadModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (client: Client) => void;
}

export function ConvertLeadModal({
  lead,
  isOpen,
  onClose,
  onSuccess,
}: ConvertLeadModalProps) {
  const router = useRouter();
  const [billingAddress, setBillingAddress] = useState('');
  const [website, setWebsite] = useState(lead.website || '');
  const [serviceInterests, setServiceInterests] = useState(lead.interested_service || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate conflict state
  const [duplicateConflict, setDuplicateConflict] = useState<Client | null>(null);

  const handleConvert = async (confirmLinkToExisting: boolean = false) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: {
        billing_address?: string;
        website?: string;
        service_interests?: string;
        link_existing_client_id?: string;
        confirm_link?: boolean;
      } = {
        billing_address: billingAddress,
        website: website,
        service_interests: serviceInterests,
      };

      if (confirmLinkToExisting && duplicateConflict) {
        payload.link_existing_client_id = duplicateConflict.client_id;
        payload.confirm_link = true;
      }

      const res = await api.convertLead(lead.id, payload);

      if (res.conflict && res.duplicate_client) {
        setDuplicateConflict(res.duplicate_client);
        return;
      }

      if (res.client) {
        onSuccess(res.client);
        router.push(`/clients/${res.client.id}`);
      }
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { message?: string; duplicate_client?: Client; error?: string } };
      if (apiErr.status === 409 && apiErr.data?.duplicate_client) {
        setDuplicateConflict(apiErr.data.duplicate_client);
      } else {
        setError(apiErr.data?.error || apiErr.data?.message || (err as Error).message || 'Failed to convert lead');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Lead to Client"
      description="Create or link an authoritative Client record while preserving lead history."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* If duplicate conflict detected */}
        {duplicateConflict ? (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-200">
                  Existing Client Match Detected
                </h4>
                <p className="text-xs text-amber-300/80 mt-1">
                  A client with the email <strong className="text-white font-mono">{lead.email}</strong> already exists in Roo4Tech CRM. To prevent redundant records, you can link this lead to the existing client profile.
                </p>
              </div>
            </div>

            <div className="p-3 bg-zinc-900/90 rounded-lg border border-zinc-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Client ID:</span>
                <span className="font-mono text-blue-400 font-semibold">{duplicateConflict.client_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Client Name:</span>
                <span className="text-zinc-200 font-medium">{duplicateConflict.name}</span>
              </div>
              {duplicateConflict.company_name && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Company:</span>
                  <span className="text-zinc-200">{duplicateConflict.company_name}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDuplicateConflict(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleConvert(true)}
                isLoading={isSubmitting}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Link to Existing Client ({duplicateConflict.client_id})
              </Button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* Existing lead info preview (no need to re-enter) */}
            <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 text-xs space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Preserved Lead Information
              </span>
              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                <div className="flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-100">{lead.lead_name}</span>
                  {lead.company && <span className="text-zinc-400">({lead.company})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="truncate">{lead.email}</span>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{lead.phone}</span>
                  </div>
                )}
                {lead.interested_service && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="truncate">{lead.interested_service}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Client Information */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Billing Address <span className="text-zinc-400">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="e.g. Office 402, IT Tower, Hali Road, Gulberg III, Lahore"
                  className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://clientwebsite.com"
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Service Interests
                  </label>
                  <input
                    type="text"
                    value={serviceInterests}
                    onChange={(e) => setServiceInterests(e.target.value)}
                    placeholder="Web App, Next.js, Django"
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Confirmation actions */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <span className="text-[11px] text-zinc-400">
                Original lead notes and activity logs will be linked.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => handleConvert(false)}
                  isLoading={isSubmitting}
                  icon={<UserCheck className="w-4 h-4" />}
                >
                  Confirm & Convert
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
