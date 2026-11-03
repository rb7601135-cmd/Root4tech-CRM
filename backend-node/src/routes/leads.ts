import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const leadsRouter = Router();

function formatLead(l: any) {
  return {
    id: Number(l.id),
    lead_name: l.lead_name,
    company: l.company,
    email: l.email,
    normalized_email: l.normalized_email,
    phone: l.phone,
    website: l.website,
    interested_service: l.interested_service,
    estimated_budget: l.estimated_budget ? Number(l.estimated_budget) : null,
    lead_source: l.lead_source,
    status: l.status,
    priority: l.priority,
    next_follow_up_date: l.next_follow_up_date,
    notes: l.notes,
    assigned_salesperson_id: l.assigned_salesperson ? Number(l.assigned_salesperson) : null,
    converted_client_id: l.converted_client ? Number(l.converted_client) : null,
    converted_at: l.converted_at,
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

// GET /api/leads/check_duplicate/
leadsRouter.get('/check_duplicate/', authenticateToken, async (req, res: Response) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  const excludeId = req.query.exclude_id ? parseInt(req.query.exclude_id as string, 10) : null;

  if (!email) {
    return res.json({ duplicate_lead: false, duplicate_client: false });
  }

  try {
    const leadWhere: any = { normalized_email: email };
    if (excludeId) leadWhere.id = { not: BigInt(excludeId) };

    const lead = await prisma.lead.findFirst({ where: leadWhere });
    const client = await prisma.client.findFirst({ where: { normalized_email: email } });

    return res.json({
      duplicate_lead: !!lead,
      duplicate_client: !!client,
      lead: lead ? formatLead(lead) : undefined,
      client: client ? { id: Number(client.id), name: client.name, client_id: client.client_id } : undefined,
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Duplicate check error.' });
  }
});

// GET /api/leads/
leadsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { search, status, priority, source, assigned_to } = req.query;
  const where: any = {};

  if (typeof status === 'string' && status.trim()) where.status = status.trim();
  if (typeof priority === 'string' && priority.trim()) where.priority = priority.trim();
  if (typeof source === 'string' && source.trim()) where.lead_source = source.trim();
  if (typeof assigned_to === 'string' && assigned_to.trim()) {
    where.assigned_salesperson = BigInt(assigned_to.trim());
  }

  if (typeof search === 'string' && search.trim()) {
    const s = search.trim();
    where.OR = [
      { lead_name: { contains: s, mode: 'insensitive' } },
      { company: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { phone: { contains: s, mode: 'insensitive' } },
    ];
  }

  try {
    const count = await prisma.lead.count({ where });
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return res.json({ count, results: leads.map(formatLead) });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch leads.' });
  }
});

// POST /api/leads/
leadsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    lead_name,
    company,
    email,
    phone,
    website,
    interested_service,
    estimated_budget,
    lead_source,
    assigned_salesperson,
    status,
    priority,
    next_follow_up_date,
    notes,
  } = req.body;

  if (!lead_name || !email) {
    return res.status(400).json({ detail: 'Lead name and email are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const newLead = await prisma.lead.create({
      data: {
        lead_name: lead_name.trim(),
        company: company || '',
        email: email.trim(),
        normalized_email: normalizedEmail,
        phone: phone || '',
        website: website || '',
        interested_service: interested_service || '',
        estimated_budget: estimated_budget ? Number(estimated_budget) : null,
        lead_source: lead_source || 'Website',
        status: status || 'New',
        priority: priority || 'Medium',
        next_follow_up_date: next_follow_up_date ? new Date(next_follow_up_date) : null,
        notes: notes || '',
        assigned_salesperson: assigned_salesperson ? BigInt(assigned_salesperson) : null,
        created_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'LEAD_CREATED',
      module: 'LEADS',
      entityId: String(newLead.id),
      description: `Created lead ${newLead.lead_name} (${newLead.email})`,
      ipAddress: req.ip,
    });

    return res.status(201).json(formatLead(newLead));
  } catch (err) {
    console.error('Create lead error:', err);
    return res.status(500).json({ detail: 'Failed to create lead.' });
  }
});

// GET /api/leads/:id/
leadsRouter.get('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Lead not found.' });

  try {
    const lead = await prisma.lead.findUnique({ where: { id: BigInt(id) } });
    if (!lead) return res.status(404).json({ detail: 'Lead not found.' });

    const notes = await prisma.leadNote.findMany({
      where: { lead: BigInt(id) },
      orderBy: { created_at: 'desc' },
    });

    const activities = await prisma.leadActivity.findMany({
      where: { lead: BigInt(id) },
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      ...formatLead(lead),
      notes_list: notes.map(n => ({
        id: Number(n.id),
        content: n.content,
        created_at: n.created_at,
        author: n.author ? Number(n.author) : null,
      })),
      activities: activities.map(a => ({
        id: Number(a.id),
        action: a.action,
        description: a.description,
        created_at: a.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Error fetching lead detail.' });
  }
});

// PATCH /api/leads/:id/
leadsRouter.patch('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Lead not found.' });

  const fields = [
    'lead_name',
    'company',
    'email',
    'phone',
    'website',
    'interested_service',
    'estimated_budget',
    'lead_source',
    'status',
    'priority',
    'notes',
  ];
  const updateData: any = { updated_at: new Date() };

  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  }
  if (req.body.email) {
    updateData.normalized_email = req.body.email.trim().toLowerCase();
  }
  if (req.body.next_follow_up_date !== undefined) {
    updateData.next_follow_up_date = req.body.next_follow_up_date ? new Date(req.body.next_follow_up_date) : null;
  }
  if (req.body.assigned_salesperson !== undefined) {
    updateData.assigned_salesperson = req.body.assigned_salesperson ? BigInt(req.body.assigned_salesperson) : null;
  }

  try {
    const updated = await prisma.lead.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return res.json(formatLead(updated));
  } catch {
    return res.status(404).json({ detail: 'Lead not found.' });
  }
});

// DELETE /api/leads/:id/
leadsRouter.delete('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Lead not found.' });

  try {
    await prisma.lead.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Lead not found.' });
  }
});

// POST /api/leads/:id/add_note/
leadsRouter.post('/:id/add_note/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body;
  if (!content) return res.status(400).json({ detail: 'Content is required.' });

  try {
    const note = await prisma.leadNote.create({
      data: {
        lead: BigInt(id),
        author: BigInt(req.user!.id),
        content,
        created_at: new Date(),
      },
    });

    await prisma.leadActivity.create({
      data: {
        lead: BigInt(id),
        user: BigInt(req.user!.id),
        action: 'NOTE_ADDED',
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
    return res.status(500).json({ detail: 'Failed to add lead note.' });
  }
});

// POST /api/leads/:id/convert/
leadsRouter.post('/:id/convert/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { billing_address, website, service_interests, link_existing_client_id } = req.body;

  try {
    const lead = await prisma.lead.findUnique({ where: { id: BigInt(id) } });
    if (!lead) return res.status(404).json({ detail: 'Lead not found.' });

    let client: any;

    if (link_existing_client_id) {
      client = await prisma.client.findUnique({
        where: { id: BigInt(link_existing_client_id) },
      });
      if (!client) return res.status(400).json({ detail: 'Selected client does not exist.' });
    } else {
      const totalCount = await prisma.client.count();
      const clientId = `CLI-${String(totalCount + 1001).padStart(5, '0')}`;

      client = await prisma.client.create({
        data: {
          client_id: clientId,
          name: lead.lead_name,
          company_name: lead.company,
          email: lead.email,
          normalized_email: lead.normalized_email,
          phone: lead.phone,
          website: website || lead.website,
          billing_address: billing_address || '',
          service_interests: service_interests || lead.interested_service,
          client_status: 'Lead Converted',
          assigned_team_member: lead.assigned_salesperson,
          notes: lead.notes,
          created_by: BigInt(req.user!.id),
          updated_by: BigInt(req.user!.id),
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    await prisma.lead.update({
      where: { id: BigInt(id) },
      data: {
        status: 'Won',
        converted_client: client.id,
        converted_at: new Date(),
        converted_by: BigInt(req.user!.id),
        updated_at: new Date(),
      },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'LEAD_CONVERTED',
      module: 'LEADS',
      entityId: String(lead.id),
      description: `Lead #${lead.id} converted to client ${client.name} (${client.client_id})`,
      ipAddress: req.ip,
    });

    return res.json({
      message: 'Lead converted successfully.',
      client: {
        id: Number(client.id),
        client_id: client.client_id,
        name: client.name,
        company_name: client.company_name,
        email: client.email,
      },
    });
  } catch (err) {
    console.error('Lead convert error:', err);
    return res.status(500).json({ detail: 'Lead conversion failed.' });
  }
});

