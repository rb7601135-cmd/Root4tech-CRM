'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { Project, Task, ProjectMilestone, User, TaskPriority, TaskStatus } from '@/types/crm';
import {
  FolderKanban,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus,
  Building,
  UserCheck,
  CheckSquare,
  MessageSquare,
  AlertCircle,
  Flag,
  Calendar,
  Layers,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'milestones' | 'activity'>('tasks');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Task Modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState<number | ''>('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Milestone Modal
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mDeliverables, setMDeliverables] = useState('');
  const [mBudget, setMBudget] = useState('0');
  const [mDueDate, setMDueDate] = useState('');
  const [isSavingM, setIsSavingM] = useState(false);

  // Expanded task comments
  const [commentInput, setCommentInput] = useState<Record<number, string>>({});

  const loadProject = async () => {
    setIsLoading(true);
    try {
      const data = await api.getProject(projectId);
      setProject(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  useEffect(() => {
    api.getTeam().then((res) => {
      setTeamMembers(Array.isArray(res) ? res : res.results || []);
    }).catch(console.error);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setIsSavingTask(true);
    try {
      await api.createTask({
        project: Number(projectId),
        title: taskTitle,
        description: taskDesc,
        assigned_to: taskAssignee ? Number(taskAssignee) : null,
        priority: taskPriority,
        deadline: taskDeadline || null,
      });
      setIsTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      loadProject();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle.trim()) return;
    setIsSavingM(true);
    try {
      await api.addProjectMilestone(projectId, {
        title: mTitle,
        deliverables: mDeliverables,
        budget_allocated: parseFloat(mBudget) || 0,
        due_date: mDueDate || null,
      });
      setIsMilestoneModalOpen(false);
      setMTitle('');
      setMDeliverables('');
      loadProject();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingM(false);
    }
  };

  const handleTaskStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      loadProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleChecklist = async (taskId: number, itemId: number) => {
    try {
      await api.toggleTaskChecklist(taskId, itemId);
      loadProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (taskId: number) => {
    const content = commentInput[taskId];
    if (!content || !content.trim()) return;
    try {
      await api.addTaskComment(taskId, content.trim());
      setCommentInput({ ...commentInput, [taskId]: '' });
      loadProject();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading || !project) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-zinc-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Loading project {projectId}...</p>
        </div>
      </AppLayout>
    );
  }

  const getPriorityBadge = (p: TaskPriority) => {
    const colors: Record<TaskPriority, string> = {
      Low: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      Medium: 'bg-blue-950/40 text-blue-400 border-blue-800/40',
      High: 'bg-amber-950/40 text-amber-400 border-amber-800/40',
      Urgent: 'bg-rose-950/40 text-rose-400 border-rose-800/40 animate-pulse',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${colors[p] || colors.Medium}`}>
        {p}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Link href="/projects" className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                  {project.project_code}
                </span>
                <h1 className="text-xl font-bold text-white">{project.project_name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-200">
                  {project.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                <span>Client:</span>
                <Link href={`/clients/${project.client}`} className="text-zinc-200 hover:text-indigo-400 transition font-medium">
                  {project.client_details?.name} ({project.client_details?.client_id})
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsTaskModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
            >
              Add Task
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsMilestoneModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Milestone
            </Button>
          </div>
        </div>

        {/* Project Overview Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-zinc-950 border border-zinc-800 rounded-2xl">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Progress</span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono text-white">{project.progress_percentage}%</span>
              <div className="flex-1 h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, project.progress_percentage))}%` }}
                />
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Budget</span>
            <p className="text-lg font-bold text-zinc-100 font-mono mt-0.5">
              {Number(project.budget).toLocaleString()} {project.currency}
            </p>
          </div>

          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Project Manager</span>
            <p className="text-sm font-semibold text-zinc-200 mt-0.5">
              {project.project_manager_details?.full_name || 'Unassigned'}
            </p>
          </div>

          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Due Date</span>
            <p className="text-sm font-mono text-zinc-300 mt-0.5">
              {project.due_date || 'No deadline specified'}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'tasks' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            Tasks & Checklists ({project.tasks?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'milestones' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            Milestones ({project.milestones?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'activity' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            Activity Timeline ({project.activities?.length || 0})
          </button>
        </div>

        {/* TAB 1: Tasks */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {!project.tasks || project.tasks.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-2xl">
                No tasks created yet. Click &quot;Add Task&quot; above to create deliverables for your team.
              </div>
            ) : (
              project.tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <select
                        value={task.status}
                        onChange={(e) => handleTaskStatusChange(task.id, e.target.value as TaskStatus)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold focus:outline-none ${
                          task.status === 'Done'
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                            : task.status === 'In Progress'
                            ? 'bg-blue-950/40 border-blue-800/60 text-blue-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="In Review">In Review</option>
                        <option value="Done">Done</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                      <h4
                        className={`text-sm font-semibold ${
                          task.status === 'Done' ? 'line-through text-zinc-500' : 'text-zinc-100'
                        }`}
                      >
                        {task.title}
                      </h4>
                      {getPriorityBadge(task.priority)}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>👤 {task.assigned_to_details?.full_name || 'Unassigned'}</span>
                      {task.deadline && <span>📅 {task.deadline}</span>}
                    </div>
                  </div>

                  {task.description && <p className="text-xs text-zinc-400 leading-relaxed pl-1">{task.description}</p>}

                  {/* Checklist items */}
                  {task.checklists && task.checklists.length > 0 && (
                    <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                        Checklist ({task.checklists.filter((c) => c.is_completed).length}/{task.checklists.length})
                      </span>
                      {task.checklists.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none hover:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={() => item.id && handleToggleChecklist(task.id, item.id)}
                            className="rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0"
                          />
                          <span className={item.is_completed ? 'line-through text-zinc-500' : ''}>
                            {item.description}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Comments */}
                  <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                    {task.comments && task.comments.length > 0 && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {task.comments.map((comm) => (
                          <div key={comm.id} className="text-xs p-2 rounded-lg bg-zinc-900 text-zinc-300 flex justify-between">
                            <span>
                              <b className="text-zinc-200">{comm.author_details?.full_name}:</b> {comm.content}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(comm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a comment or update on this task..."
                        value={commentInput[task.id] || ''}
                        onChange={(e) => setCommentInput({ ...commentInput, [task.id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment(task.id)}
                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                      <Button size="sm" variant="outline" onClick={() => handleAddComment(task.id)}>
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: Milestones */}
        {activeTab === 'milestones' && (
          <div className="space-y-3">
            {!project.milestones || project.milestones.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-2xl">
                No milestones defined. Break this project down into billable deliverables with &quot;Add Milestone&quot;.
              </div>
            ) : (
              project.milestones.map((m) => (
                <div key={m.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-zinc-100 text-sm flex items-center gap-2">
                      {m.is_completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-zinc-500" />}
                      {m.title}
                    </h4>
                    {m.deliverables && <p className="text-xs text-zinc-400 mt-1">{m.deliverables}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 font-mono">
                      <span>Due: {m.due_date || 'N/A'}</span>
                      <span>Allocated: {Number(m.budget_allocated).toLocaleString()} {project.currency}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: Activity Timeline */}
        {activeTab === 'activity' && (
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
            {!project.activities || project.activities.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No activity logged yet.</p>
            ) : (
              project.activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 pb-3 border-b border-zinc-800/60 last:border-0 text-xs">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-zinc-200 font-medium">{act.description}</p>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Add Task to {project.project_code}</h3>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Task title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details and requirements"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Assignee</label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Deadline</label>
                <input
                  type="date"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSavingTask} className="bg-indigo-600 hover:bg-indigo-500">
                  {isSavingTask ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Milestone Modal */}
      {isMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Add Milestone</h3>
            <form onSubmit={handleCreateMilestone} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Milestone Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milestone 1: MVP Architecture Release"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Deliverables</label>
                <textarea
                  rows={2}
                  placeholder="Expected deliverables"
                  value={mDeliverables}
                  onChange={(e) => setMDeliverables(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Budget Allocated</label>
                  <input
                    type="number"
                    value={mBudget}
                    onChange={(e) => setMBudget(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={mDueDate}
                    onChange={(e) => setMDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsMilestoneModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSavingM} className="bg-indigo-600 hover:bg-indigo-500">
                  {isSavingM ? 'Saving...' : 'Add Milestone'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
