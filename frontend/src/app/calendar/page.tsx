'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import ClientSelector from '@/components/ui/ClientSelector';
import { api } from '@/lib/api';
import { CalendarEvent, CalendarEventType, CalendarEventStatus, Client, User } from '@/types/crm';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Video,
  PhoneCall,
  Users,
  Flag,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'today' | 'upcoming' | 'completed' | 'overdue'>('all');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('Client Meeting');
  const [startTime, setStartTime] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [locationOrLink, setLocationOrLink] = useState('Google Meet');

  // Complete Event Modal State
  const [completingEvent, setCompletingEvent] = useState<CalendarEvent | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const res = await api.getCalendarEvents();
      setEvents(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    api.getTeam().then((res) => {
      setTeamMembers(Array.isArray(res) ? res : res.results || []);
    }).catch(console.error);
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Event title is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await api.createCalendarEvent({
        title,
        description,
        event_type: eventType,
        start_time: new Date(startTime).toISOString(),
        client: selectedClient?.id || null,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        location_or_link: locationOrLink,
      });

      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setSelectedClient(null);
      loadEvents();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to create calendar event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingEvent) return;

    setIsSavingOutcome(true);
    try {
      await api.completeCalendarEvent(completingEvent.id, outcomeNotes);
      setCompletingEvent(null);
      setOutcomeNotes('');
      loadEvents();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const getEventIcon = (type: CalendarEventType) => {
    switch (type) {
      case 'Client Meeting':
        return <Users className="w-4 h-4 text-indigo-400" />;
      case 'Sales Call':
        return <PhoneCall className="w-4 h-4 text-emerald-400" />;
      case 'Demonstration':
        return <Video className="w-4 h-4 text-sky-400" />;
      case 'Project Milestone':
        return <Flag className="w-4 h-4 text-amber-400" />;
      case 'Task Deadline':
        return <Clock className="w-4 h-4 text-purple-400" />;
      case 'Follow-up Reminder':
      default:
        return <CalendarIcon className="w-4 h-4 text-blue-400" />;
    }
  };

  const getStatusBadge = (status: CalendarEventStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="w-3 h-3" /> Overdue
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" /> Scheduled
          </span>
        );
    }
  };

  // Filter events based on viewMode
  const now = new Date();
  const filteredEvents = events.filter((ev) => {
    const evDate = new Date(ev.start_time);
    if (viewMode === 'today') {
      return evDate.toDateString() === now.toDateString();
    }
    if (viewMode === 'upcoming') {
      return ev.status === 'Pending' && evDate >= now;
    }
    if (viewMode === 'completed') {
      return ev.status === 'Completed';
    }
    if (viewMode === 'overdue') {
      return ev.status === 'Overdue';
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <CalendarIcon className="w-7 h-7 text-indigo-400" />
              Calendar & Client Follow-ups
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Schedule meetings, demos, project milestones, and client follow-ups linked to CRM accounts.
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
            Schedule Event / Follow-up
          </Button>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-2 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl">
          {(['all', 'today', 'upcoming', 'overdue', 'completed'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                viewMode === mode
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {mode} {mode === 'overdue' && events.filter((e) => e.status === 'Overdue').length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                  {events.filter((e) => e.status === 'Overdue').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Events Timeline / List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-12 text-center text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p>Loading calendar events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800">
              <CalendarIcon className="w-10 h-10 mx-auto text-zinc-500 mb-2" />
              <p className="text-base font-semibold text-zinc-200">No events found</p>
              <p className="text-xs text-zinc-500 mt-1">Schedule client meetings or follow-up calls above.</p>
            </div>
          ) : (
            filteredEvents.map((ev) => (
              <div
                key={ev.id}
                className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                  ev.status === 'Overdue'
                    ? 'bg-rose-950/10 border-rose-900/40 hover:border-rose-700/60'
                    : ev.status === 'Completed'
                    ? 'bg-zinc-950/50 border-zinc-800/60 opacity-80'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 mt-0.5 shrink-0">
                    {getEventIcon(ev.event_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-100 text-sm">{ev.title}</h3>
                      {getStatusBadge(ev.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mt-1.5">
                      <span>
                        📅 {new Date(ev.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      {ev.client_details && (
                        <span>
                          🏢{' '}
                          <Link href={`/clients/${ev.client}`} className="text-indigo-400 hover:underline">
                            {ev.client_details.name} ({ev.client_details.client_id})
                          </Link>
                        </span>
                      )}
                      {ev.location_or_link && (
                        <span>📍 {ev.location_or_link}</span>
                      )}
                      <span>👤 {ev.assigned_to_details?.full_name || 'Unassigned'}</span>
                    </div>

                    {ev.description && (
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{ev.description}</p>
                    )}
                    {ev.outcome_notes && (
                      <div className="mt-2 text-xs bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-emerald-400">
                        <b>Outcome / Meeting Notes:</b> {ev.outcome_notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {ev.status !== 'Completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCompletingEvent(ev);
                        setOutcomeNotes('');
                      }}
                      className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Schedule Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-400" />
                Schedule Event / Follow-up
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milestone 1 Demo with Client Team"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Event Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as CalendarEventType)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Client Meeting">Client Meeting</option>
                    <option value="Sales Call">Sales Call</option>
                    <option value="Demonstration">Demonstration</option>
                    <option value="Project Milestone">Project Milestone</option>
                    <option value="Task Deadline">Task Deadline</option>
                    <option value="Follow-up Reminder">Follow-up Reminder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Scheduled Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Central Client Selector */}
              <ClientSelector
                selectedClientId={selectedClient?.id}
                onSelectClient={(c) => setSelectedClient(c)}
                label="Associated Client (Optional)"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Location / Link
                  </label>
                  <input
                    type="text"
                    value={locationOrLink}
                    onChange={(e) => setLocationOrLink(e.target.value)}
                    placeholder="e.g. Google Meet link or office"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Agenda / Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Meeting agenda and discussion topics"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500">
                  {isSubmitting ? 'Scheduling...' : 'Confirm Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Event Modal */}
      {completingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Complete: {completingEvent.title}</h3>
            <form onSubmit={handleCompleteEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Meeting Outcome / Follow-up Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Summarize the outcome, agreed next steps, or decision..."
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCompletingEvent(null)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSavingOutcome} className="bg-emerald-600 hover:bg-emerald-500">
                  {isSavingOutcome ? 'Saving...' : 'Mark Completed'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
