import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const calendarRouter = Router();

function formatEvent(e: any) {
  return {
    id: Number(e.id),
    title: e.title,
    description: e.description,
    event_type: e.event_type,
    status: e.status,
    start_time: e.start_time,
    end_time: e.end_time,
    client: e.client ? Number(e.client) : null,
    lead: e.lead ? Number(e.lead) : null,
    project: e.project ? Number(e.project) : null,
    assigned_to: e.assigned_to ? Number(e.assigned_to) : null,
    location_or_link: e.location_or_link,
    outcome_notes: e.outcome_notes,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

// GET /api/calendar-events/
calendarRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { status, event_type, start_date, end_date } = req.query;
  const where: any = {};

  if (typeof status === 'string' && status.trim()) where.status = status.trim();
  if (typeof event_type === 'string' && event_type.trim()) where.event_type = event_type.trim();

  if (typeof start_date === 'string' && start_date.trim()) {
    where.start_time = { gte: new Date(start_date.trim()) };
  }
  if (typeof end_date === 'string' && end_date.trim()) {
    where.end_time = { lte: new Date(end_date.trim()) };
  }

  try {
    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { start_time: 'asc' },
    });
    return res.json({ results: events.map(formatEvent) });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch calendar events.' });
  }
});

// POST /api/calendar-events/
calendarRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    title,
    description = '',
    event_type = 'Meeting',
    start_time,
    end_time,
    client,
    lead,
    project,
    assigned_to,
    location_or_link = '',
  } = req.body;

  if (!title || !start_time) {
    return res.status(400).json({ detail: 'Title and start_time are required.' });
  }

  try {
    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        event_type,
        status: 'Pending',
        start_time: new Date(start_time),
        end_time: end_time ? new Date(end_time) : new Date(new Date(start_time).getTime() + 60 * 60 * 1000),
        client: client ? BigInt(client) : null,
        lead: lead ? BigInt(lead) : null,
        project: project ? BigInt(project) : null,
        assigned_to: assigned_to ? BigInt(assigned_to) : BigInt(req.user!.id),
        location_or_link,
        outcome_notes: '',
        created_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return res.status(201).json(formatEvent(event));
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to create calendar event.' });
  }
});

// PATCH /api/calendar-events/:id/
calendarRouter.patch('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Event not found.' });

  const fields = ['title', 'description', 'event_type', 'status', 'location_or_link', 'outcome_notes'];
  const updateData: any = { updated_at: new Date() };
  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  }
  if (req.body.start_time !== undefined) updateData.start_time = new Date(req.body.start_time);
  if (req.body.end_time !== undefined) updateData.end_time = new Date(req.body.end_time);

  try {
    const updated = await prisma.calendarEvent.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return res.json(formatEvent(updated));
  } catch {
    return res.status(404).json({ detail: 'Event not found.' });
  }
});

// DELETE /api/calendar-events/:id/
calendarRouter.delete('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Event not found.' });

  try {
    await prisma.calendarEvent.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Event not found.' });
  }
});

// POST /api/calendar-events/:id/complete/
calendarRouter.post('/:id/complete/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { outcome_notes = '' } = req.body;

  try {
    const event = await prisma.calendarEvent.update({
      where: { id: BigInt(id) },
      data: {
        status: 'Completed',
        outcome_notes,
        updated_at: new Date(),
      },
    });

    return res.json(formatEvent(event));
  } catch {
    return res.status(404).json({ detail: 'Event not found.' });
  }
});

