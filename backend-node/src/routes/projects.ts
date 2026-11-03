import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const projectsRouter = Router();
export const tasksRouter = Router();

function formatProject(p: any, milestones: any[] = [], tasks: any[] = []) {
  return {
    id: Number(p.id),
    project_code: p.project_code,
    project_name: p.project_name,
    client: p.client ? Number(p.client) : null,
    quotation: p.quotation ? Number(p.quotation) : null,
    project_manager: p.project_manager ? Number(p.project_manager) : null,
    status: p.status,
    progress_percentage: p.progress_percentage,
    budget: Number(p.budget),
    currency: p.currency,
    start_date: p.start_date,
    due_date: p.due_date,
    created_at: p.created_at,
    updated_at: p.updated_at,
    milestones: milestones.map(m => ({
      id: Number(m.id),
      title: m.title,
      description: m.description,
      due_date: m.due_date,
      is_completed: m.is_completed,
    })),
    tasks: tasks.map(t => ({
      id: Number(t.id),
      title: t.title,
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      assigned_to: t.assigned_to ? Number(t.assigned_to) : null,
    })),
  };
}

function formatTask(t: any, checklists: any[] = [], comments: any[] = []) {
  return {
    id: Number(t.id),
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    project: t.project ? Number(t.project) : null,
    milestone: t.milestone ? Number(t.milestone) : null,
    assigned_to: t.assigned_to ? Number(t.assigned_to) : null,
    created_by: t.created_by ? Number(t.created_by) : null,
    created_at: t.created_at,
    updated_at: t.updated_at,
    checklists: checklists.map(c => ({
      id: Number(c.id),
      description: c.description,
      is_completed: c.is_completed,
      item_order: c.item_order,
    })),
    comments: comments.map(cm => ({
      id: Number(cm.id),
      content: cm.content,
      author: cm.author ? Number(cm.author) : null,
      created_at: cm.created_at,
    })),
  };
}

// GET /api/projects/
projectsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { status, client, search } = req.query;
  const where: any = {};

  if (typeof status === 'string' && status.trim()) where.status = status.trim();
  if (typeof client === 'string' && client.trim()) where.client = BigInt(client.trim());
  if (typeof search === 'string' && search.trim()) {
    const s = search.trim();
    where.OR = [
      { project_code: { contains: s, mode: 'insensitive' } },
      { project_name: { contains: s, mode: 'insensitive' } },
    ];
  }

  try {
    const count = await prisma.project.count({ where });
    const projects = await prisma.project.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    const pIds = projects.map(p => p.id);
    const milestones = await prisma.projectMilestone.findMany({ where: { project: { in: pIds } } });
    const tasks = await prisma.task.findMany({ where: { project: { in: pIds } } });

    const results = projects.map(p => {
      const pMilestones = milestones.filter(m => m.project === p.id);
      const pTasks = tasks.filter(t => t.project === p.id);
      return formatProject(p, pMilestones, pTasks);
    });

    return res.json({ count, results });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch projects.' });
  }
});

// POST /api/projects/
projectsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    title,
    project_name,
    client,
    budget = 0,
    currency = 'PKR',
    start_date,
    due_date,
    status = 'Planning',
  } = req.body;

  const name = project_name || title;
  if (!name || !client) {
    return res.status(400).json({ detail: 'Project name and client are required.' });
  }

  try {
    const count = await prisma.project.count();
    const projectCode = `PRJ-${String(count + 1001).padStart(5, '0')}`;

    const project = await prisma.project.create({
      data: {
        project_code: projectCode,
        project_name: name.trim(),
        description: (req.body.description || '').trim(),
        client: BigInt(client),
        status,
        progress_percentage: 0,
        budget: Number(budget),
        currency,
        start_date: start_date ? new Date(start_date) : new Date(),
        due_date: due_date ? new Date(due_date) : null,
        created_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'PROJECT_CREATED',
      module: 'PROJECTS',
      entityId: projectCode,
      description: `Project ${name} (${projectCode}) created`,
      ipAddress: req.ip,
    });

    return res.status(201).json(formatProject(project));
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to create project.' });
  }
});

// GET /api/projects/:id/
projectsRouter.get('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Project not found.' });

  try {
    const project = await prisma.project.findUnique({ where: { id: BigInt(id) } });
    if (!project) return res.status(404).json({ detail: 'Project not found.' });

    const milestones = await prisma.projectMilestone.findMany({ where: { project: project.id } });
    const tasks = await prisma.task.findMany({ where: { project: project.id } });

    return res.json(formatProject(project, milestones, tasks));
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch project.' });
  }
});

// PATCH /api/projects/:id/
projectsRouter.patch('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Project not found.' });

  const fields = ['project_name', 'status', 'progress_percentage', 'budget'];
  const updateData: any = { updated_at: new Date() };
  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  }
  if (req.body.due_date !== undefined) {
    updateData.due_date = req.body.due_date ? new Date(req.body.due_date) : null;
  }

  try {
    const project = await prisma.project.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return res.json(formatProject(project));
  } catch {
    return res.status(404).json({ detail: 'Project not found.' });
  }
});

// DELETE /api/projects/:id/
projectsRouter.delete('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Project not found.' });

  try {
    await prisma.projectMilestone.deleteMany({ where: { project: BigInt(id) } });
    await prisma.project.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Project not found.' });
  }
});

// POST /api/projects/:id/add_milestone/
projectsRouter.post('/:id/add_milestone/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { title, description = '', due_date } = req.body;
  if (!title) return res.status(400).json({ detail: 'Milestone title is required.' });

  try {
    const milestone = await prisma.projectMilestone.create({
      data: {
        project: BigInt(id),
        title,
        description,
        due_date: due_date ? new Date(due_date) : null,
        deliverables: req.body.deliverables || '',
        budget_allocated: Number(req.body.budget_allocated || 0),
        is_completed: false,
        created_at: new Date(),
      },
    });

    return res.status(201).json({
      id: Number(milestone.id),
      title: milestone.title,
      description: milestone.description,
      due_date: milestone.due_date,
      is_completed: milestone.is_completed,
    });
  } catch {
    return res.status(500).json({ detail: 'Failed to add milestone.' });
  }
});

// GET /api/tasks/
tasksRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { project, status, priority, assigned_to } = req.query;
  const where: any = {};

  if (typeof project === 'string' && project.trim()) where.project = BigInt(project.trim());
  if (typeof status === 'string' && status.trim()) where.status = status.trim();
  if (typeof priority === 'string' && priority.trim()) where.priority = priority.trim();
  if (typeof assigned_to === 'string' && assigned_to.trim()) where.assigned_to = BigInt(assigned_to.trim());

  try {
    const count = await prisma.task.count({ where });
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    const tIds = tasks.map(t => t.id);
    const checklists = await prisma.taskChecklistItem.findMany({ where: { task: { in: tIds } } });
    const comments = await prisma.taskComment.findMany({ where: { task: { in: tIds } } });

    const results = tasks.map(t => {
      const c = checklists.filter(chk => chk.task === t.id);
      const cm = comments.filter(comm => comm.task === t.id);
      return formatTask(t, c, cm);
    });

    return res.json({ count, results });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch tasks.' });
  }
});

// POST /api/tasks/
tasksRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { title, description = '', project, assigned_to, priority = 'Medium', status = 'Todo', deadline } = req.body;
  if (!title || !project) {
    return res.status(400).json({ detail: 'Title and project are required.' });
  }

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description,
        project: BigInt(project),
        assigned_to: assigned_to ? BigInt(assigned_to) : null,
        priority,
        status,
        deadline: deadline ? new Date(deadline) : null,
        dependencies: '',
        created_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return res.status(201).json(formatTask(task));
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to create task.' });
  }
});

// GET /api/tasks/:id/
tasksRouter.get('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Task not found.' });

  try {
    const task = await prisma.task.findUnique({ where: { id: BigInt(id) } });
    if (!task) return res.status(404).json({ detail: 'Task not found.' });

    const checklists = await prisma.taskChecklistItem.findMany({ where: { task: task.id } });
    const comments = await prisma.taskComment.findMany({ where: { task: task.id } });

    return res.json(formatTask(task, checklists, comments));
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch task.' });
  }
});

// PATCH /api/tasks/:id/
tasksRouter.patch('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Task not found.' });

  const fields = ['title', 'description', 'status', 'priority'];
  const updateData: any = { updated_at: new Date() };
  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  }
  if (req.body.assigned_to !== undefined) {
    updateData.assigned_to = req.body.assigned_to ? BigInt(req.body.assigned_to) : null;
  }
  if (req.body.deadline !== undefined) {
    updateData.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
  }

  try {
    const task = await prisma.task.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return res.json(formatTask(task));
  } catch {
    return res.status(404).json({ detail: 'Task not found.' });
  }
});

// DELETE /api/tasks/:id/
tasksRouter.delete('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Task not found.' });

  try {
    await prisma.taskChecklistItem.deleteMany({ where: { task: BigInt(id) } });
    await prisma.taskComment.deleteMany({ where: { task: BigInt(id) } });
    await prisma.task.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Task not found.' });
  }
});

// POST /api/tasks/:id/add_comment/
tasksRouter.post('/:id/add_comment/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body;
  if (!content) return res.status(400).json({ detail: 'Content is required.' });

  try {
    const comment = await prisma.taskComment.create({
      data: {
        task: BigInt(id),
        author: BigInt(req.user!.id),
        content,
        created_at: new Date(),
      },
    });

    return res.status(201).json({
      id: Number(comment.id),
      content: comment.content,
      created_at: comment.created_at,
    });
  } catch {
    return res.status(500).json({ detail: 'Failed to post comment.' });
  }
});

// POST /api/tasks/:id/toggle_checklist/
tasksRouter.post('/:id/toggle_checklist/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ detail: 'item_id is required.' });

  try {
    const item = await prisma.taskChecklistItem.findUnique({ where: { id: BigInt(item_id) } });
    if (!item) return res.status(404).json({ detail: 'Checklist item not found.' });

    const updated = await prisma.taskChecklistItem.update({
      where: { id: BigInt(item_id) },
      data: { is_completed: !item.is_completed },
    });

    return res.json({ id: Number(updated.id), is_completed: updated.is_completed });
  } catch {
    return res.status(500).json({ detail: 'Failed to toggle checklist.' });
  }
});
