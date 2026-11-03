import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';
import { generateQuotationPDF } from '../utils/pdf';

export const quotationsRouter = Router();

function formatQuotation(q: any, items: any[] = []) {
  return {
    id: Number(q.id),
    quotation_number: q.quotation_number,
    title: q.title,
    client: q.client ? Number(q.client) : null,
    related_lead: q.related_lead ? Number(q.related_lead) : null,
    currency: q.currency,
    exchange_rate_to_base: Number(q.exchange_rate_to_base),
    subtotal: Number(q.subtotal),
    tax_rate: Number(q.tax_percentage || 0),
    tax_amount: Number(q.tax_amount),
    discount_amount: Number(q.discount_amount),
    total_amount: Number(q.total_amount),
    status: q.status,
    expiry_date: q.expiry_date,
    notes: q.internal_notes,
    terms_and_conditions: q.terms_and_conditions,
    salesperson: q.salesperson ? Number(q.salesperson) : null,
    created_at: q.created_at,
    updated_at: q.updated_at,
    items: items.map(it => ({
      id: Number(it.id),
      description: it.description,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      total: Number(it.line_total),
      item_order: it.item_order,
    })),
  };
}

// GET /api/quotations/
quotationsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { status, client, search } = req.query;
  const where: any = {};

  if (typeof status === 'string' && status.trim()) where.status = status.trim();
  if (typeof client === 'string' && client.trim()) where.client = BigInt(client.trim());

  if (typeof search === 'string' && search.trim()) {
    const s = search.trim();
    where.OR = [
      { quotation_number: { contains: s, mode: 'insensitive' } },
      { title: { contains: s, mode: 'insensitive' } },
    ];
  }

  try {
    const count = await prisma.quotation.count({ where });
    const quotations = await prisma.quotation.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    const quotationIds = quotations.map(q => q.id);
    const allItems = await prisma.quotationItem.findMany({
      where: { quotation: { in: quotationIds } },
      orderBy: { item_order: 'asc' },
    });

    const results = quotations.map(q => {
      const items = allItems.filter(it => it.quotation === q.id);
      return formatQuotation(q, items);
    });

    return res.json({ count, results });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch quotations.' });
  }
});

// POST /api/quotations/
quotationsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    client,
    title,
    currency = 'PKR',
    expiry_date,
    notes = '',
    terms_and_conditions = '',
    items = [],
    tax_rate = 0,
    discount_amount = 0,
  } = req.body;

  if (!client || !title) {
    return res.status(400).json({ detail: 'Client and title are required.' });
  }

  try {
    const totalQuotes = await prisma.quotation.count();
    const quotationNumber = `QUO-${String(totalQuotes + 1001).padStart(5, '0')}`;

    let subtotal = 0;
    const cleanItems = (items as any[]).map((it, idx) => {
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.unit_price) || 0;
      const total = qty * unit;
      subtotal += total;
      return {
        description: it.description || 'Service item',
        quantity: qty,
        unit_price: unit,
        total,
        item_order: idx + 1,
      };
    });

    const tax = (subtotal * Number(tax_rate)) / 100;
    const finalTotal = Math.max(0, subtotal + tax - Number(discount_amount));

    const quote = await prisma.quotation.create({
      data: {
        quotation_number: quotationNumber,
        client: BigInt(client),
        title,
        currency,
        exchange_rate_to_base: 1.0,
        exchange_rate_source: 'Official Bank Rate',
        discount_percentage: Number(req.body.discount_percentage || 0),
        client_snapshot: {},
        is_converted_to_project: false,
        is_converted_to_invoice: false,
        subtotal,
        tax_percentage: Number(tax_rate || 0),
        tax_amount: tax,
        discount_amount: Number(discount_amount || 0),
        total_amount: finalTotal,
        status: 'Draft',
        issue_date: new Date(),
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        internal_notes: notes || '',
        terms_and_conditions: terms_and_conditions || '',
        created_by: BigInt(req.user!.id),
        salesperson: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    for (const it of cleanItems) {
      await prisma.quotationItem.create({
        data: {
          quotation: quote.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.total,
          item_order: it.item_order,
        },
      });
    }

    const createdItems = await prisma.quotationItem.findMany({
      where: { quotation: quote.id },
      orderBy: { item_order: 'asc' },
    });

    return res.status(201).json(formatQuotation(quote, createdItems));
  } catch (err) {
    console.error('Create quote error:', err);
    return res.status(500).json({ detail: 'Failed to create quotation.' });
  }
});

// GET /api/quotations/:id/
quotationsRouter.get('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Quotation not found.' });

  try {
    const quote = await prisma.quotation.findUnique({ where: { id: BigInt(id) } });
    if (!quote) return res.status(404).json({ detail: 'Quotation not found.' });

    const items = await prisma.quotationItem.findMany({
      where: { quotation: quote.id },
      orderBy: { item_order: 'asc' },
    });

    return res.json(formatQuotation(quote, items));
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch quotation.' });
  }
});

// PATCH /api/quotations/:id/
quotationsRouter.patch('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Quotation not found.' });

  try {
    const updateData: any = { updated_at: new Date() };
    const fields = ['title', 'status', 'notes', 'terms_and_conditions'];
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }
    if (req.body.expiry_date !== undefined) {
      updateData.expiry_date = req.body.expiry_date ? new Date(req.body.expiry_date) : null;
    }

    const quote = await prisma.quotation.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    const items = await prisma.quotationItem.findMany({
      where: { quotation: quote.id },
      orderBy: { item_order: 'asc' },
    });

    return res.json(formatQuotation(quote, items));
  } catch {
    return res.status(404).json({ detail: 'Quotation not found.' });
  }
});

// DELETE /api/quotations/:id/
quotationsRouter.delete('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Quotation not found.' });

  try {
    await prisma.quotationItem.deleteMany({ where: { quotation: BigInt(id) } });
    await prisma.quotation.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Quotation not found.' });
  }
});

// POST /api/quotations/:id/issue/
quotationsRouter.post('/:id/issue/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const quote = await prisma.quotation.update({
      where: { id: BigInt(id) },
      data: { status: 'Sent', updated_at: new Date() },
    });
    const items = await prisma.quotationItem.findMany({ where: { quotation: BigInt(id) } });
    return res.json(formatQuotation(quote, items));
  } catch {
    return res.status(404).json({ detail: 'Quotation not found.' });
  }
});

// POST /api/quotations/:id/accept/
quotationsRouter.post('/:id/accept/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const quote = await prisma.quotation.update({
      where: { id: BigInt(id) },
      data: { status: 'Accepted', updated_at: new Date() },
    });
    const items = await prisma.quotationItem.findMany({ where: { quotation: BigInt(id) } });
    return res.json(formatQuotation(quote, items));
  } catch {
    return res.status(404).json({ detail: 'Quotation not found.' });
  }
});

// GET /api/quotations/:id/pdf/
quotationsRouter.get('/:id/pdf/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const quote = await prisma.quotation.findUnique({ where: { id: BigInt(id) } });
    if (!quote) return res.status(404).json({ detail: 'Quotation not found.' });

    const client = quote.client ? await prisma.client.findUnique({ where: { id: quote.client } }) : null;
    const items = await prisma.quotationItem.findMany({ where: { quotation: quote.id } });

    const pdfBuffer = await generateQuotationPDF({
      ...quote,
      client,
      items,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quotation_number}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF error:', err);
    return res.status(500).json({ detail: 'Failed to generate PDF.' });
  }
});

// POST /api/quotations/:id/send/
quotationsRouter.post('/:id/send/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const quote = await prisma.quotation.update({
      where: { id: BigInt(id) },
      data: { status: 'Sent', updated_at: new Date() },
    });
    const items = await prisma.quotationItem.findMany({ where: { quotation: BigInt(id) } });
    return res.json({
      message: 'Quotation sent successfully.',
      quotation: formatQuotation(quote, items),
    });
  } catch {
    return res.status(404).json({ detail: 'Quotation not found.' });
  }
});

// POST /api/quotations/:id/convert_to_project/
quotationsRouter.post('/:id/convert_to_project/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const quote = await prisma.quotation.findUnique({ where: { id: BigInt(id) } });
    if (!quote || !quote.client) return res.status(400).json({ detail: 'Valid quotation with client required.' });

    const projectCount = await prisma.project.count();
    const projectCode = `PRJ-${String(projectCount + 1001).padStart(5, '0')}`;

    const project = await prisma.project.create({
      data: {
        project_code: projectCode,
        project_name: quote.title,
        description: quote.internal_notes || '',
        start_date: new Date(),
        client: quote.client,
        quotation: quote.id,
        status: 'Planning',
        progress_percentage: 0,
        budget: quote.total_amount,
        currency: quote.currency,
        created_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const items = await prisma.quotationItem.findMany({ where: { quotation: quote.id } });
    return res.json({
      message: 'Project created from quotation.',
      project_id: Number(project.id),
      project_code: project.project_code,
      quotation: formatQuotation(quote, items),
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to convert quotation to project.' });
  }
});

// POST /api/quotations/:id/convert_to_invoice/
quotationsRouter.post('/:id/convert_to_invoice/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const quote = await prisma.quotation.findUnique({ where: { id: BigInt(id) } });
    if (!quote || !quote.client) return res.status(400).json({ detail: 'Valid quotation with client required.' });

    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${String(invoiceCount + 1001).padStart(5, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: invoiceNumber,
        client: quote.client,
        quotation: quote.id,
        title: quote.title,
        currency: quote.currency,
        exchange_rate_to_base: quote.exchange_rate_to_base,
        exchange_rate_source: quote.exchange_rate_source,
        discount_percentage: quote.discount_percentage,
        client_snapshot: quote.client_snapshot || {},
        subtotal: quote.subtotal,
        tax_percentage: quote.tax_percentage,
        tax_amount: quote.tax_amount,
        discount_amount: quote.discount_amount,
        total_amount: quote.total_amount,
        amount_paid: 0,
        remaining_balance: quote.total_amount,
        status: 'Issued',
        issue_date: new Date(),
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        internal_notes: quote.internal_notes,
        terms_and_conditions: quote.terms_and_conditions,
        created_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const quoteItems = await prisma.quotationItem.findMany({ where: { quotation: quote.id } });
    for (const it of quoteItems) {
      await prisma.invoiceItem.create({
        data: {
          invoice: invoice.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.line_total,
          item_order: it.item_order,
        },
      });
    }

    return res.json({
      message: 'Invoice created from quotation.',
      invoice_id: Number(invoice.id),
      invoice_number: invoice.invoice_number,
      quotation: formatQuotation(quote, quoteItems),
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to convert quotation to invoice.' });
  }
});
