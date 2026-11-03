import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest, authenticateJWT, requireSalesManager } from '../middleware/auth';

export const automationRouter = Router();

automationRouter.use(authenticateJWT);
automationRouter.use(requireSalesManager);

const DEFAULT_RULES = [
  { rule_type: 'LEAD_FOLLOW_UP', name: 'Lead Follow-up Reminder', days_trigger: 0, send_in_app: true, is_active: true },
  { rule_type: 'QUOTATION_EXPIRY', name: 'Quotation Expiry Reminder', days_trigger: 3, send_in_app: true, is_active: true },
  { rule_type: 'INVOICE_DUE', name: 'Invoice Due Date Reminder', days_trigger: 3, send_in_app: true, is_active: true },
  { rule_type: 'INVOICE_OVERDUE', name: 'Invoice Overdue Alert', days_trigger: 0, send_in_app: true, is_active: true },
  { rule_type: 'PROJECT_DEADLINE', name: 'Project Deadline Reminder', days_trigger: 3, send_in_app: true, is_active: true },
  { rule_type: 'TASK_OVERDUE', name: 'Task Overdue Alert', days_trigger: 0, send_in_app: true, is_active: true },
];

function formatRule(r: any) {
  return {
    id: Number(r.id),
    rule_type: r.rule_type,
    name: r.name,
    is_active: r.is_active,
    days_trigger: r.days_trigger,
    send_in_app: r.send_in_app,
    send_email: r.send_email,
    updated_at: r.updated_at,
  };
}

function formatLog(l: any) {
  return {
    id: Number(l.id),
    rule_type: l.rule_type,
    entity_type: l.entity_type,
    entity_id: l.entity_id,
    dedup_key: l.dedup_key,
    status: l.status,
    message: l.message,
    executed_at: l.executed_at,
  };
}

// GET /api/automation/rules/
automationRouter.get('/rules/', async (_req: AuthRequest, res: Response) => {
  try {
    let rules = await prisma.automationRule.findMany({
      orderBy: { rule_type: 'asc' },
    });

    if (rules.length === 0) {
      for (const dr of DEFAULT_RULES) {
        await prisma.automationRule.create({
          data: {
            ...dr,
            send_email: false,
            updated_at: new Date(),
          },
        }).catch(() => {});
      }
      rules = await prisma.automationRule.findMany({
        orderBy: { rule_type: 'asc' },
      });
    }

    return res.json(rules.map(formatRule));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/automation/rules/:id/
automationRouter.patch('/rules/:id/', async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const { is_active, days_trigger, send_in_app, send_email, name } = req.body;

    const data: any = { updated_at: new Date() };
    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (days_trigger !== undefined) data.days_trigger = Number(days_trigger);
    if (send_in_app !== undefined) data.send_in_app = Boolean(send_in_app);
    if (send_email !== undefined) data.send_email = Boolean(send_email);
    if (name !== undefined) data.name = String(name);

    const updated = await prisma.automationRule.update({
      where: { id },
      data,
    });

    return res.json(formatRule(updated));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/automation/logs/
automationRouter.get('/logs/', async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.automationLog.findMany({
      take: 100,
      orderBy: { executed_at: 'desc' },
    });
    return res.json(logs.map(formatLog));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/automation/run/
automationRouter.post('/run/', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const results = {
      lead_follow_ups: 0,
      quotation_expiries: 0,
      invoice_due_dates: 0,
      invoice_overdues: 0,
      project_deadlines: 0,
      task_overdues: 0,
    };

    // Lead follow up rule
    const leadRule = await prisma.automationRule.findFirst({
      where: { rule_type: 'LEAD_FOLLOW_UP', is_active: true },
    });
    if (leadRule) {
      const leads = await prisma.lead.findMany({
        where: {
          next_follow_up_date: { lte: now },
          status: { in: ['New', 'Contacted', 'Qualified', 'Proposal'] },
        },
      });

      for (const lead of leads) {
        const dedupKey = `LEAD_FOLLOW_UP:${lead.id}:${lead.next_follow_up_date?.toISOString().slice(0, 10) || todayStr}`;
        const existing = await prisma.automationLog.findUnique({ where: { dedup_key: dedupKey } });
        if (!existing) {
          const recipientId = lead.assigned_salesperson || (await prisma.user.findFirst({ where: { role: 'Administrator' } }))?.id;
          if (recipientId && leadRule.send_in_app) {
            await prisma.notification.create({
              data: {
                recipient: BigInt(recipientId),
                title: `Follow-up Due: ${lead.lead_name}`,
                message: `Scheduled follow-up for lead '${lead.lead_name}' (${lead.company || ''}) is due today.`,
                notification_type: 'LEAD',
                link: `/leads/${lead.id}`,
                is_read: false,
                created_at: new Date(),
              },
            }).catch(() => {});
          }

          await prisma.automationLog.create({
            data: {
              rule_type: leadRule.rule_type,
              entity_type: 'Lead',
              entity_id: String(lead.id),
              dedup_key: dedupKey,
              status: 'SUCCESS',
              message: `Sent follow-up reminder for lead ${lead.lead_name}`,
              executed_at: new Date(),
            },
          }).catch(() => {});
          results.lead_follow_ups++;
        }
      }
    }

    return res.json({
      message: 'Automation cycle executed successfully.',
      results,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
