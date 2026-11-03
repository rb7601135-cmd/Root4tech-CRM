import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const clientsRouter = Router();

function formatClient(c: any) {
  return {
    id: Number(c.id),
    client_id: c.client_id,
    name: c.name,
    company_name: c.company_name,
    email: c.email,
    normalized_email: c.normalized_email,
    phone: c.phone,
    website: c.website,
    billing_address: c.billing_address,
    service_interests: c.service_interests,
    client_status: c.client_status,
    notes: c.notes,
    assigned_team_member_id: c.assigned_team_member ? Number(c.assigned_team_member) : null,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

// GET /api/clients/check_duplicate/
clientsRouter.get('/check_duplicate/', authenticateToken, async (req, res: Response) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  const excludeId = req.query.exclude_id ? parseInt(req.query.exclude_id as string, 10) : null;

  if (!email) {
    return res.json({ duplicate: false });
  }

  try {
    const where: any = { normalized_email: email };
    if (excludeId) where.id = { not: BigInt(excludeId) };

    const client = await prisma.client.findFirst({ where });
    if (client) {
      return res.json({ duplicate: true, client: formatClient(client) });
    }
    return res.json({ duplicate: false });
  } catch (err) {
    return res.status(500).json({ detail: 'Duplicate check failed.' });
  }
});

// GET /api/clients/
clientsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { search, client_status } = req.query;
  const where: any = {};

  if (typeof client_status === 'string' && client_status.trim()) {
    where.client_status = client_status.trim();
  }

  if (typeof search === 'string' && search.trim()) {
    const s = search.trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { company_name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { client_id: { contains: s, mode: 'insensitive' } },
    ];
  }

  try {
    const count = await prisma.client.count({ where });
    const clients = await prisma.client.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      count,
      results: clients.map(formatClient),
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch clients.' });
  }
});

// POST /api/clients/
clientsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    company_name,
    email,
    phone,
    website,
    billing_address,
    service_interests,
    assigned_team_member,
    notes,
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ detail: 'Name and email are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const totalCount = await prisma.client.count();
    const clientId = `CLI-${String(totalCount + 1001).padStart(5, '0')}`;

    const newClient = await prisma.client.create({
      data: {
        client_id: clientId,
        name: name.trim(),
        company_name: company_name || '',
        email: email.trim(),
        normalized_email: normalizedEmail,
        phone: phone || '',
        website: website || '',
        billing_address: billing_address || '',
        service_interests: service_interests || '',
        client_status: 'Active',
        assigned_team_member: assigned_team_member ? BigInt(assigned_team_member) : null,
        notes: notes || '',
        created_by: BigInt(req.user!.id),
        updated_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'CLIENT_CREATED',
      module: 'CLIENTS',
      entityId: clientId,
      description: `Client ${newClient.name} (${clientId}) registered`,
      ipAddress: req.ip,
    });

    return res.status(201).json(formatClient(newClient));
  } catch (err) {
    console.error('Create client error:', err);
    return res.status(500).json({ detail: 'Failed to register client.' });
  }
});

// GET /api/clients/:id/
clientsRouter.get('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Client not found.' });

  try {
    const client = await prisma.client.findUnique({
      where: { id: BigInt(id) },
    });
    if (!client) return res.status(404).json({ detail: 'Client not found.' });

    const notes = await prisma.clientNote.findMany({
      where: { client: BigInt(id) },
      orderBy: { created_at: 'desc' },
    });

    const activities = await prisma.clientActivity.findMany({
      where: { client: BigInt(id) },
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      ...formatClient(client),
      notes_list: notes.map(n => ({
        id: Number(n.id),
        content: n.content,
        created_at: n.created_at,
        author: n.author ? Number(n.author) : null,
      })),
      activities: activities.map(a => ({
        id: Number(a.id),
        action_type: a.action_type,
        description: a.description,
        created_at: a.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Error fetching client detail.' });
  }
});

// PATCH /api/clients/:id/
clientsRouter.patch('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Client not found.' });

  const fields = [
    'name',
    'company_name',
    'email',
    'phone',
    'website',
    'billing_address',
    'service_interests',
    'client_status',
    'notes',
  ];
  const updateData: any = { updated_by: BigInt(req.user!.id), updated_at: new Date() };

  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  }
  if (req.body.email) {
    updateData.normalized_email = req.body.email.trim().toLowerCase();
  }
  if (req.body.assigned_team_member !== undefined) {
    updateData.assigned_team_member = req.body.assigned_team_member ? BigInt(req.body.assigned_team_member) : null;
  }

  try {
    const updated = await prisma.client.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return res.json(formatClient(updated));
  } catch (err) {
    return res.status(404).json({ detail: 'Client not found or update error.' });
  }
});

// DELETE /api/clients/:id/
clientsRouter.delete('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Client not found.' });

  try {
    await prisma.client.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Client not found.' });
  }
});

// POST /api/clients/:id/archive/
clientsRouter.post('/:id/archive/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Client not found.' });

  try {
    const client = await prisma.client.findUnique({ where: { id: BigInt(id) } });
    if (!client) return res.status(404).json({ detail: 'Client not found.' });

    const newStatus = client.client_status === 'Archived' ? 'Active' : 'Archived';
    const updated = await prisma.client.update({
      where: { id: BigInt(id) },
      data: { client_status: newStatus, updated_at: new Date() },
    });

    return res.json({
      message: `Client ${newStatus === 'Archived' ? 'archived' : 'restored'} successfully.`,
      client: formatClient(updated),
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to toggle client archive.' });
  }
});

// POST /api/clients/:id/add_note/
clientsRouter.post('/:id/add_note/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body;
  if (!content) return res.status(400).json({ detail: 'Content is required.' });

  try {
    const note = await prisma.clientNote.create({
      data: {
        client: BigInt(id),
        author: BigInt(req.user!.id),
        content,
        created_at: new Date(),
      },
    });

    await prisma.clientActivity.create({
      data: {
        client: BigInt(id),
        user: BigInt(req.user!.id),
        action_type: 'NOTE_ADDED',
        description: content.slice(0, 100),
        created_at: new Date(),
      },
    });

    return res.status(201).json({
      id: Number(note.id),
      content: note.content,
      created_at: note.created_at,
    });
  } catch {
    return res.status(500).json({ detail: 'Failed to add note.' });
  }
});

