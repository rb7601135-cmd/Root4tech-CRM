'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { api } from '@/lib/api';
import { Conversation, ChatMessage, ActionProposal } from '@/types/crm';
import { Button } from '@/components/ui/Button';
import {
  Sparkles,
  Send,
  Plus,
  Search,
  Trash2,
  Edit2,
  Archive,
  RotateCcw,
  Square,
  Copy,
  Check,
  Paperclip,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  TrendingUp,
  Users,
  Receipt,
  FolderKanban,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function AssistantPage() {
  const { user } = useAuth();
  const { currency } = useCompany();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState('');
  const [pendingProposals, setPendingProposals] = useState<Record<string, any>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Input & attachments
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ filename: string; text: string; size: number } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [showArchived]);

  // Load active conversation messages
  useEffect(() => {
    if (activeConversationId) {
      loadConversationDetails(activeConversationId);
    } else {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [activeConversationId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamDelta]);

  async function loadConversations() {
    setIsLoadingConvs(true);
    try {
      const data = await api.getConversations({ archived: showArchived, search: searchQuery || undefined });
      const convList = Array.isArray(data) ? data : data.results || [];
      setConversations(convList);
      if (convList.length > 0 && !activeConversationId) {
        setActiveConversationId(convList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConvs(false);
    }
  }

  async function loadConversationDetails(id: string) {
    try {
      const conv = await api.getConversation(id);
      setActiveConversation(conv);
      setMessages(conv.messages || []);
    } catch (err: any) {
      console.error('Failed to load conversation details:', err);
      setErrorMessage('Could not load conversation messages.');
    }
  }

  async function handleCreateNewConversation() {
    try {
      const newConv = await api.createConversation('New Conversation');
      setConversations([newConv, ...conversations]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setInputMessage('');
      setAttachedFile(null);
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
    }
  }

  async function handleRenameConversation(id: string) {
    if (!editingTitle.trim()) return;
    try {
      const updated = await api.updateConversation(id, { title: editingTitle.trim() });
      setConversations(conversations.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
      if (activeConversationId === id) {
        setActiveConversation((prev) => (prev ? { ...prev, title: updated.title } : prev));
      }
      setEditingConvId(null);
    } catch (err: any) {
      console.error('Failed to rename conversation:', err);
    }
  }

  async function handleToggleArchive(conv: Conversation) {
    try {
      await api.updateConversation(conv.id, { is_archived: !conv.is_archived });
      loadConversations();
    } catch (err: any) {
      console.error('Failed to archive conversation:', err);
    }
  }

  async function handleDeleteConversation(id: string) {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) return;
    try {
      await api.deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConversationId === id) {
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setErrorMessage(null);
    try {
      const res = await api.uploadAssistantDocument(file);
      setAttachedFile({
        filename: res.filename,
        text: res.extracted_text,
        size: res.file_size,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'File upload failed. Ensure file is .txt, .csv, .pdf, or .docx and <= 5 MB.');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSendMessage(overrideMsg?: string) {
    const msgToSend = (overrideMsg || inputMessage).trim();
    if (!msgToSend && !attachedFile) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      try {
        const newConv = await api.createConversation('New Conversation');
        setConversations([newConv, ...conversations]);
        setActiveConversationId(newConv.id);
        targetConvId = newConv.id;
      } catch (err) {
        setErrorMessage('Failed to initialize conversation.');
        return;
      }
    }

    // Append user message locally
    const userMsgObj: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation: targetConvId,
      role: 'user',
      content: msgToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsgObj]);
    setInputMessage('');
    const docContext = attachedFile ? attachedFile.text : '';
    setAttachedFile(null);
    setIsStreaming(true);
    setStreamDelta('');
    setErrorMessage(null);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    let accumulated = '';
    const newProposals: Record<string, any> = {};

    try {
      await api.streamAssistantMessage(
        targetConvId,
        msgToSend,
        docContext,
        (data) => {
          if (data.type === 'content') {
            accumulated += data.delta || '';
            setStreamDelta(accumulated);
          } else if (data.type === 'proposal') {
            if (data.action_token) {
              newProposals[data.action_token] = data;
              setPendingProposals((prev) => ({ ...prev, [data.action_token]: data }));
            }
          } else if (data.type === 'error') {
            setErrorMessage(data.error || 'AI generation encountered an error.');
          }
        },
        abortCtrl.signal
      );

      // Append assistant message locally
      if (accumulated || Object.keys(newProposals).length > 0) {
        const assistantMsgObj: ChatMessage = {
          id: `asst-${Date.now()}`,
          conversation: targetConvId,
          role: 'assistant',
          content: accumulated || 'Action prepared. Please review the proposal card below.',
          metadata: {
            proposals: Object.keys(newProposals),
          },
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsgObj]);
      }
      loadConversations();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.message || 'Error communicating with assistant.');
      }
    } finally {
      setIsStreaming(false);
      setStreamDelta('');
      abortControllerRef.current = null;
    }
  }

  function handleStopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      if (streamDelta) {
        setMessages((prev) => [
          ...prev,
          {
            id: `stop-${Date.now()}`,
            conversation: activeConversationId || '',
            role: 'assistant',
            content: streamDelta + ' *(Generation stopped by user)*',
            created_at: new Date().toISOString(),
          },
        ]);
        setStreamDelta('');
      }
    }
  }

  async function handleExecuteProposal(token: string, confirm: boolean) {
    try {
      const res = await api.executeActionProposal(token, confirm);
      if (confirm && res.success) {
        setPendingProposals((prev) => ({
          ...prev,
          [token]: {
            ...prev[token],
            status: 'EXECUTED',
            result: res.result,
          },
        }));
      } else {
        setPendingProposals((prev) => ({
          ...prev,
          [token]: {
            ...prev[token],
            status: 'CANCELLED',
          },
        }));
      }
    } catch (err: any) {
      alert(`Action execution failed: ${err.message || 'Unknown error'}`);
    }
  }

  function handleCopyMessage(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  // Filtered conversation list
  const filteredConvs = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-zinc-950 text-zinc-100 relative">
        {/* SIDEBAR: CONVERSATION HISTORY */}
        <aside className="w-80 border-r border-zinc-800/80 bg-zinc-900/60 flex flex-col shrink-0">
          {/* Header & New Chat Button */}
          <div className="p-3 border-b border-zinc-800/80 space-y-3">
            <button
              onClick={handleCreateNewConversation}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Conversation</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Archive Filter Toggle */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>{showArchived ? 'Archived Conversations' : 'Active Conversations'}</span>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                {showArchived ? 'Show Active' : 'Show Archived'}
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingConvs ? (
              <div className="p-4 text-center text-xs text-zinc-400">Loading history...</div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                No {showArchived ? 'archived' : 'active'} conversations found.
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isEditing = editingConvId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                      isActive
                        ? 'bg-zinc-800/90 text-white border border-zinc-700/80 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
                      <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-zinc-400'}`} />
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameConversation(conv.id);
                            if (e.key === 'Escape') setEditingConvId(null);
                          }}
                          onBlur={() => handleRenameConversation(conv.id)}
                          autoFocus
                          className="w-full bg-zinc-950 px-2 py-0.5 rounded border border-blue-500 text-xs text-white"
                        />
                      ) : (
                        <span className="truncate font-medium">{conv.title}</span>
                      )}
                    </div>

                    {/* Action buttons (Rename, Archive, Delete) */}
                    <div
                      className={`flex items-center gap-1 shrink-0 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      } transition-opacity`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setEditingConvId(conv.id);
                          setEditingTitle(conv.title);
                        }}
                        className="p-1 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-200"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(conv)}
                        className="p-1 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-200"
                        title={conv.is_archived ? 'Unarchive' : 'Archive'}
                      >
                        <Archive className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteConversation(conv.id)}
                        className="p-1 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
          {/* Top Bar */}
          <header className="h-14 px-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                R4
              </div>
              <div>
                <h2 className="text-xs font-semibold text-zinc-200 tracking-tight">
                  {activeConversation?.title || 'Root4Tech Smart CRM Assistant'}
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real CRM Integrations Active</span>
                  <span className="text-zinc-400">•</span>
                  <span>Currency: {currency}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-400">
                Two-Phase Security
              </span>
            </div>
          </header>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* If empty state, show helpful CRM starter prompts */}
            {messages.length === 0 && !streamDelta && (
              <div className="max-w-2xl mx-auto py-8 space-y-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/20">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    How can I assist your CRM today?
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                    Ask questions across leads, centralized clients, overdue invoices, project tasks, and pipeline analytics.
                  </p>
                </div>

                {/* Suggested prompt chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                  {[
                    {
                      label: 'Overdue Invoices',
                      prompt: 'Show me all overdue invoices and outstanding payment balances.',
                      icon: Receipt,
                    },
                    {
                      label: 'Sales Revenue Report',
                      prompt: 'What is our sales performance and revenue collected in PKR this month?',
                      icon: TrendingUp,
                    },
                    {
                      label: 'Delayed Projects',
                      prompt: 'Which client projects are currently behind schedule or past deadline?',
                      icon: FolderKanban,
                    },
                    {
                      label: 'Create New Lead',
                      prompt: 'Propose creating a new lead for NextGen Systems interested in Software Development.',
                      icon: Users,
                    },
                  ].map((chip) => {
                    const ChipIcon = chip.icon;
                    return (
                      <button
                        key={chip.label}
                        onClick={() => handleSendMessage(chip.prompt)}
                        className="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 group-hover:text-blue-400">
                          <ChipIcon className="w-3.5 h-3.5 text-blue-400" />
                          <span>{chip.label}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                          {chip.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rendered Messages */}
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs ${
                      isUser
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    {isUser ? user?.first_name?.[0] || 'U' : <Sparkles className="w-4 h-4" />}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`space-y-3 rounded-2xl p-4 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-md'
                        : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800 rounded-tl-none shadow-lg'
                    }`}
                  >
                    {/* Content formatted */}
                    <div className="whitespace-pre-wrap font-normal leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Proposal Action Cards if linked */}
                    {msg.metadata?.proposals?.map((token: string) => {
                      const proposal = pendingProposals[token];
                      if (!proposal) return null;
                      return (
                        <ActionProposalCard
                          key={token}
                          proposal={proposal}
                          onConfirm={() => handleExecuteProposal(token, true)}
                          onCancel={() => handleExecuteProposal(token, false)}
                        />
                      );
                    })}

                    {/* Message Action Footer (Copy, Feedback) */}
                    {!isUser && (
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                        <button
                          onClick={() => handleCopyMessage(msg.content, index)}
                          className="flex items-center gap-1 hover:text-zinc-200 p-1 rounded"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <span className="text-zinc-400">•</span>
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Verified DRF Engine
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Currently streaming response */}
            {isStreaming && (
              <div className="flex gap-3.5 max-w-3xl mr-auto">
                <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-3 rounded-2xl p-4 text-xs leading-relaxed bg-zinc-900/90 text-zinc-200 border border-zinc-800 rounded-tl-none shadow-lg">
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {streamDelta || 'Consulting CRM database...'}
                  </div>

                  {/* Render active proposals that arrived during stream */}
                  {Object.values(pendingProposals).map((prop: any) => (
                    <ActionProposalCard
                      key={prop.action_token}
                      proposal={prop}
                      onConfirm={() => handleExecuteProposal(prop.action_token, true)}
                      onCancel={() => handleExecuteProposal(prop.action_token, false)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error state */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-rose-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT BAR */}
          <footer className="p-4 border-t border-zinc-800/80 bg-zinc-900/60">
            {/* Attached file preview chip */}
            {attachedFile && (
              <div className="mb-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-medium truncate max-w-xs">{attachedFile.filename}</span>
                <span className="text-[10px] text-zinc-400">
                  ({Math.round(attachedFile.size / 1024)} KB)
                </span>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="hover:text-rose-400 text-zinc-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="relative flex items-center bg-zinc-950 border border-zinc-800 rounded-2xl shadow-inner focus-within:border-blue-500 transition-all">
              {/* Attachment Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile}
                className="p-3 text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50"
                title="Attach Document (.pdf, .txt, .csv, .docx)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Text Input */}
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isStreaming) handleSendMessage();
                  }
                }}
                placeholder={
                  isUploadingFile
                    ? 'Uploading & extracting text...'
                    : 'Ask anything about clients, leads, invoices, or type a request...'
                }
                rows={1}
                disabled={isUploadingFile}
                className="flex-1 bg-transparent py-3 px-2 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none resize-none max-h-32"
              />

              {/* Send or Stop Generation Button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="m-2 p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md transition"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() && !attachedFile}
                  className="m-2 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-40 disabled:hover:bg-blue-600 transition cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="mt-2 text-center text-[10px] text-zinc-400">
              Root4Tech AI Assistant executes authorized DRF tools. Consequential actions require explicit confirmation.
            </div>
          </footer>
        </main>
      </div>
    </AppLayout>
  );
}

// Two-Phase Consequential Action Confirmation Card Component
function ActionProposalCard({
  proposal,
  onConfirm,
  onCancel,
}: {
  proposal: any;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const preview = proposal.preview || proposal.preview_data || {};
  const isExecuted = proposal.status === 'EXECUTED';
  const isCancelled = proposal.status === 'CANCELLED';

  return (
    <div className="my-3 p-4 rounded-xl bg-zinc-950/90 border border-indigo-500/30 text-xs shadow-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>{preview.action_title || 'Proposed CRM Action'}</span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isExecuted
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : isCancelled
              ? 'bg-zinc-800 text-zinc-400'
              : 'bg-amber-950 text-amber-400 border border-amber-800'
          }`}
        >
          {isExecuted ? 'EXECUTED' : isCancelled ? 'CANCELLED' : 'REQUIRES CONFIRMATION'}
        </span>
      </div>

      {/* Summary */}
      <p className="text-zinc-200 font-medium">{preview.summary}</p>

      {/* Warnings if duplicates found */}
      {preview.warnings && preview.warnings.length > 0 && (
        <div className="p-2 rounded bg-amber-950/40 border border-amber-800/50 text-[11px] text-amber-300 space-y-1">
          {preview.warnings.map((w: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Result if executed */}
      {isExecuted && proposal.result && (
        <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{proposal.result.message}</span>
          </div>
          {proposal.result.view_url && (
            <Link
              href={proposal.result.view_url}
              className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-white underline"
            >
              <span>View Record</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {/* Action buttons (only if pending) */}
      {!isExecuted && !isCancelled && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onConfirm}
            className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            Confirm & Execute
          </button>
          <button
            onClick={onCancel}
            className="py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
