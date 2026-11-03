import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

export const realtimeRouter = Router();

function formatNotification(n: any) {
  return {
    id: Number(n.id),
    title: n.title,
    message: n.message,
    notification_type: n.notification_type,
    link: n.link,
    is_read: n.is_read,
    created_at: n.created_at,
  };
}

// GET /api/realtime/notifications/
realtimeRouter.get('/notifications/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { recipient: BigInt(req.user!.id) },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return res.json({ results: notifications.map(formatNotification) });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch notifications.' });
  }
});

// GET /api/realtime/notifications/unread_count/
realtimeRouter.get('/notifications/unread_count/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { recipient: BigInt(req.user!.id), is_read: false },
    });
    return res.json({ unread_count: count });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch unread count.' });
  }
});

// POST /api/realtime/notifications/:id/read/
realtimeRouter.post('/notifications/:id/read/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    await prisma.notification.update({
      where: { id: BigInt(id) },
      data: { is_read: true },
    });
    return res.json({ status: 'marked_read' });
  } catch {
    return res.status(404).json({ detail: 'Notification not found.' });
  }
});

// POST /api/realtime/notifications/mark_all_read/
realtimeRouter.post('/notifications/mark_all_read/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { recipient: BigInt(req.user!.id), is_read: false },
      data: { is_read: true },
    });
    return res.json({ status: 'all_marked_read' });
  } catch {
    return res.status(500).json({ detail: 'Failed to mark all as read.' });
  }
});

