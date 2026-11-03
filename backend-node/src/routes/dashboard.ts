import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

export const dashboardRouter = Router();

// GET /api/dashboard/stats/
dashboardRouter.get('/stats/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Leads
    const totalLeads = await prisma.lead.count();
    const leadsByStatusRaw = await prisma.lead.groupBy({
      by: ['status'],
      _count: true,
    });
    const leadsByStatus: Record<string, number> = {
      New: 0, Contacted: 0, Qualified: 0, Proposal: 0, Won: 0, Lost: 0,
    };
    leadsByStatusRaw.forEach(g => {
      leadsByStatus[g.status] = g._count;
    });

    // 2. Clients
    const totalClients = await prisma.client.count();
    const activeClients = await prisma.client.count({ where: { client_status: 'Active' } });
    const convertedClients = await prisma.client.count({ where: { client_status: 'Lead Converted' } });
    const archivedClients = await prisma.client.count({ where: { client_status: 'Archived' } });

    // 3. Quotations
    const totalQuotations = await prisma.quotation.count();
    const quotesByStatusRaw = await prisma.quotation.groupBy({
      by: ['status'],
      _count: true,
    });
    const quotationsByStatus: Record<string, number> = {
      Draft: 0, Sent: 0, Accepted: 0, Rejected: 0, Expired: 0,
    };
    quotesByStatusRaw.forEach(g => {
      quotationsByStatus[g.status] = g._count;
    });

    // 4. Invoices & Financials
    const totalInvoices = await prisma.invoice.count();
    const invoicesByStatusRaw = await prisma.invoice.groupBy({
      by: ['status'],
      _count: true,
    });
    const invoicesByStatus: Record<string, number> = {
      Draft: 0, Issued: 0, 'Partially Paid': 0, Paid: 0, Overdue: 0, Cancelled: 0,
    };
    invoicesByStatusRaw.forEach(g => {
      invoicesByStatus[g.status] = g._count;
    });

    const nonCancelledInvoices = await prisma.invoice.findMany({
      where: { status: { not: 'Cancelled' } },
    });

    let totalInvoicedPkr = 0;
    let totalPaidPkr = 0;
    let totalOutstandingPkr = 0;

    const currencyMap: Record<string, { total_invoiced: number; total_paid: number; total_outstanding: number }> = {};

    for (const inv of nonCancelledInvoices) {
      const curr = inv.currency || 'PKR';
      const rate = Number(inv.exchange_rate_to_base) || 1.0;
      const invoiced = Number(inv.total_amount) || 0;
      const paid = Number(inv.amount_paid) || 0;
      const outstanding = Number(inv.remaining_balance) || 0;

      if (!currencyMap[curr]) {
        currencyMap[curr] = { total_invoiced: 0, total_paid: 0, total_outstanding: 0 };
      }
      currencyMap[curr].total_invoiced += invoiced;
      currencyMap[curr].total_paid += paid;
      currencyMap[curr].total_outstanding += outstanding;

      totalInvoicedPkr += invoiced * rate;
      totalPaidPkr += paid * rate;
      totalOutstandingPkr += outstanding * rate;
    }

    const financialSummary = Object.entries(currencyMap).map(([currency, vals]) => ({
      currency,
      total_invoiced: vals.total_invoiced,
      total_paid: vals.total_paid,
      total_outstanding: vals.total_outstanding,
    }));

    // 5. Projects
    const totalProjects = await prisma.project.count();
    const activeProjects = await prisma.project.count({
      where: { status: { in: ['Planning', 'In Progress'] } },
    });
    const projectsByStatusRaw = await prisma.project.groupBy({
      by: ['status'],
      _count: true,
    });
    const projectsByStatus: Record<string, number> = {
      Planning: 0, 'In Progress': 0, Completed: 0, 'On Hold': 0, Cancelled: 0,
    };
    projectsByStatusRaw.forEach(g => {
      projectsByStatus[g.status] = g._count;
    });

    // 6. Calendar Events
    const now = new Date();
    const upcomingMeetings = await prisma.calendarEvent.count({
      where: { start_time: { gte: now }, status: { in: ['Pending', 'Confirmed'] } },
    });
    const overdueFollowUps = await prisma.calendarEvent.count({
      where: { status: 'Overdue' },
    });

    // 7. Recent Audit Logs
    const recentLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      leads: {
        total: totalLeads,
        by_status: leadsByStatus,
      },
      clients: {
        total: totalClients,
        active: activeClients,
        converted: convertedClients,
        archived: archivedClients,
      },
      quotations: {
        total: totalQuotations,
        by_status: quotationsByStatus,
      },
      invoices: {
        total: totalInvoices,
        by_status: invoicesByStatus,
        total_invoiced_pkr: totalInvoicedPkr,
        total_paid_pkr: totalPaidPkr,
        total_outstanding_pkr: totalOutstandingPkr,
        financial_summary: financialSummary,
      },
      projects: {
        total: totalProjects,
        active: activeProjects,
        by_status: projectsByStatus,
      },
      meetings: {
        upcoming: upcomingMeetings,
        overdue: overdueFollowUps,
      },
      recent_activities: recentLogs.map(l => ({
        id: Number(l.id),
        action: l.action,
        module: l.module,
        entity_id: l.entity_id,
        description: l.description,
        created_at: l.created_at,
      })),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ detail: 'Failed to generate dashboard statistics.' });
  }
});

