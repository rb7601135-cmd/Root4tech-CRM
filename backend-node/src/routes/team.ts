import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { recordAuditLog } from '../utils/audit';

export const teamRouter = Router();

function formatUser(u: any) {
  return {
    id: Number(u.id),
    email: u.email,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
    phone: u.phone,
    avatar: u.avatar,
    is_active: u.is_active,
    is_superuser: u.is_superuser,
    is_staff: u.is_staff,
    two_factor_enabled: u.two_factor_enabled,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

// GET /api/team/
teamRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { search, role } = req.query;
  const user = req.user!;

  const where: any = {};
  if (!user.is_superuser && user.role !== 'Administrator') {
    where.is_active = true;
  }

  if (typeof role === 'string' && role.trim()) {
    where.role = role.trim();
  }

  if (typeof search === 'string' && search.trim()) {
    const s = search.trim();
    where.OR = [
      { first_name: { contains: s, mode: 'insensitive' } },
      { last_name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { username: { contains: s, mode: 'insensitive' } },
    ];
  }

  try {
    const users = await prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return res.json({ results: users.map(formatUser) });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch team members.' });
  }
});

// POST /api/team/ (Admin only)
teamRouter.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { email, first_name, last_name, role, phone, password } = req.body;
  if (!email || !role) {
    return res.status(400).json({ detail: 'Email and role are required.' });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(400).json({ email: ['User with this email already exists.'] });
    }

    const username = email.split('@')[0];
    const passwordHash = hashPassword(password || 'Root4tech1234!');

    const newUser = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        username,
        first_name: first_name || '',
        last_name: last_name || '',
        role: role || 'Salesperson',
        phone: phone || '',
        password: passwordHash,
        is_active: true,
        is_staff: role === 'Administrator',
        is_superuser: false,
        two_factor_enabled: false,
        two_factor_secret: '',
        date_joined: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'TEAM_MEMBER_CREATED',
      module: 'ACCOUNTS',
      entityId: String(newUser.id),
      description: `Admin created team member ${newUser.email} (${newUser.role})`,
      ipAddress: req.ip,
    });

    return res.status(201).json(formatUser(newUser));
  } catch (err) {
    console.error('Create team error:', err);
    return res.status(500).json({ detail: 'Failed to create team member.' });
  }
});

// PATCH /api/team/:id/ (Admin only)
teamRouter.patch('/:id/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Invalid user ID' });

  const { first_name, last_name, role, phone, is_active } = req.body;
  const updateData: any = {};
  if (first_name !== undefined) updateData.first_name = first_name;
  if (last_name !== undefined) updateData.last_name = last_name;
  if (role !== undefined) updateData.role = role;
  if (phone !== undefined) updateData.phone = phone;
  if (is_active !== undefined) updateData.is_active = Boolean(is_active);

  try {
    const updated = await prisma.user.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'TEAM_MEMBER_UPDATED',
      module: 'ACCOUNTS',
      entityId: String(id),
      description: `Updated member profile ${updated.email}`,
      ipAddress: req.ip,
    });

    return res.json(formatUser(updated));
  } catch (err) {
    return res.status(404).json({ detail: 'User not found.' });
  }
});

// POST /api/team/:id/toggle_active/ (Admin only)
teamRouter.post('/:id/toggle_active/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Invalid user ID' });

  try {
    const user = await prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!user) return res.status(404).json({ detail: 'User not found.' });

    const newActive = !user.is_active;
    const updated = await prisma.user.update({
      where: { id: BigInt(id) },
      data: { is_active: newActive },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'TEAM_MEMBER_STATUS_TOGGLED',
      module: 'ACCOUNTS',
      entityId: String(id),
      description: `User ${user.email} active status toggled to ${newActive}`,
      ipAddress: req.ip,
    });

    return res.json({
      message: `User ${newActive ? 'activated' : 'deactivated'} successfully.`,
      user: formatUser(updated),
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to toggle status.' });
  }
});

