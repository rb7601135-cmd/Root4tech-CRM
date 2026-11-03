import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';
import { generateInvoicePDF, generateReceiptPDF } from '../utils/pdf';

export const invoicesRouter = Router();
export const paymentsRouter = Router();

function formatInvoice(inv: any, items: any[] = [], payments: any[] = []) {
  return {
    id: Number(inv.id),
    invoice_number: inv.invoice_number,
    title: inv.title,
    client: inv.client ? Number(inv.client) : null,
    quotation: inv.quotation ? Number(inv.quotation) : null,
    project: inv.project ? Number(inv.project) : null,
    currency: inv.currency,
    exchange_rate_to_base: Number(inv.exchange_rate_to_base),
    subtotal: Number(inv.subtotal),
    tax_rate: Number(inv.tax_rate),
    tax_amount: Number(inv.tax_amount),
    discount_amount: Number(inv.discount_amount),
    total_amount: Number(inv.total_amount),
    amount_paid: Number(inv.amount_paid),
    remaining_balance: Number(inv.remaining_balance),
    status: inv.status,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    notes: inv.notes,
    terms_and_conditions: inv.terms_and_conditions,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
    items: items.map(it => ({
      id: Number(it.id),
      description: it.description,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      total: Number(it.total),
      item_order: it.item_order,
    })),
    payments: payments.map(p => ({
      id: Number(p.id),
      receipt_number: p.receipt_number,
      amount: Number(p.amount),
      currency: p.currency,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      transaction_reference: p.transaction_reference,
    })),
  };
}

// GET /api/invoices/
invoicesRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { status, client, search, overdue } = req.query;
  const where: any = {};

  if (typeof status === 'string' && status.trim()) where.status = status.trim();
  if (typeof client === 'string' && client.trim()) where.client = BigInt(client.trim());
  if (overdue === 'true') where.status = 'Overdue';

  if (typeof search === 'string' && search.trim()) {
    const s = search.trim();
    where.OR = [
      { invoice_number: { contains: s, mode: 'insensitive' } },
      { title: { contains: s, mode: 'insensitive' } },
    ];
  }

  try {
    const count = await prisma.invoice.count({ where });
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    const invIds = invoices.map(i => i.id);
    const allItems = await prisma.invoiceItem.findMany({
      where: { invoice: { in: invIds } },
      orderBy: { item_order: 'asc' },
    });

    const results = invoices.map(i => {
      const items = allItems.filter(it => it.invoice === i.id);
      return formatInvoice(i, items);
    });

    return res.json({ count, results });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch invoices.' });
  }
});

// POST /api/invoices/
invoicesRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    client,
    title,
    currency = 'PKR',
    due_date,
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
    const totalCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${String(totalCount + 1001).padStart(5, '0')}`;

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

    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: invoiceNumber,
        client: BigInt(client),
        title,
        currency,
        exchange_rate_to_base: 1.0,
        exchange_rate_source: 'Official Bank Rate',
        discount_percentage: Number(req.body.discount_percentage || 0),
        client_snapshot: {},
        subtotal,
        tax_percentage: Number(tax_rate || 0),
        tax_amount: tax,
        discount_amount: Number(discount_amount || 0),
        total_amount: finalTotal,
        amount_paid: 0,
        remaining_balance: finalTotal,
        status: 'Draft',
        issue_date: new Date(),
        due_date: due_date ? new Date(due_date) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        internal_notes: notes || '',
        terms_and_conditions: terms_and_conditions || '',
        created_by: BigInt(req.user!.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    for (const it of cleanItems) {
      await prisma.invoiceItem.create({
        data: {
          invoice: invoice.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.total,
          item_order: it.item_order,
        },
      });
    }

    const createdItems = await prisma.invoiceItem.findMany({ where: { invoice: invoice.id } });
    return res.status(201).json(formatInvoice(invoice, createdItems));
  } catch (err) {
    console.error('Create invoice error:', err);
    return res.status(500).json({ detail: 'Failed to create invoice.' });
  }
});

// GET /api/invoices/:id/
invoicesRouter.get('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Invoice not found.' });

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: BigInt(id) } });
    if (!invoice) return res.status(404).json({ detail: 'Invoice not found.' });

    const items = await prisma.invoiceItem.findMany({ where: { invoice: invoice.id } });
    const payments = await prisma.payment.findMany({ where: { invoice: invoice.id } });

    return res.json(formatInvoice(invoice, items, payments));
  } catch {
    return res.status(500).json({ detail: 'Error fetching invoice detail.' });
  }
});

// PATCH /api/invoices/:id/
invoicesRouter.patch('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Invoice not found.' });

  try {
    const updateData: any = { updated_at: new Date() };
    const fields = ['title', 'status', 'notes', 'terms_and_conditions'];
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }
    if (req.body.due_date !== undefined) {
      updateData.due_date = req.body.due_date ? new Date(req.body.due_date) : null;
    }

    const invoice = await prisma.invoice.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    const items = await prisma.invoiceItem.findMany({ where: { invoice: invoice.id } });
    return res.json(formatInvoice(invoice, items));
  } catch {
    return res.status(404).json({ detail: 'Invoice not found.' });
  }
});

// DELETE /api/invoices/:id/
invoicesRouter.delete('/:id/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).json({ detail: 'Invoice not found.' });

  try {
    await prisma.invoiceItem.deleteMany({ where: { invoice: BigInt(id) } });
    await prisma.invoice.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Invoice not found.' });
  }
});

// POST /api/invoices/:id/issue/
invoicesRouter.post('/:id/issue/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const invoice = await prisma.invoice.update({
      where: { id: BigInt(id) },
      data: { status: 'Issued', updated_at: new Date() },
    });
    const items = await prisma.invoiceItem.findMany({ where: { invoice: BigInt(id) } });
    return res.json(formatInvoice(invoice, items));
  } catch {
    return res.status(404).json({ detail: 'Invoice not found.' });
  }
});

// POST /api/invoices/:id/send/
invoicesRouter.post('/:id/send/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const invoice = await prisma.invoice.update({
      where: { id: BigInt(id) },
      data: { status: 'Issued', updated_at: new Date() },
    });
    const items = await prisma.invoiceItem.findMany({ where: { invoice: BigInt(id) } });
    return res.json({
      message: 'Invoice sent successfully.',
      invoice: formatInvoice(invoice, items),
    });
  } catch {
    return res.status(404).json({ detail: 'Invoice not found.' });
  }
});

// GET /api/invoices/:id/pdf/
invoicesRouter.get('/:id/pdf/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: BigInt(id) } });
    if (!invoice) return res.status(404).json({ detail: 'Invoice not found.' });

    const client = invoice.client ? await prisma.client.findUnique({ where: { id: invoice.client } }) : null;
    const items = await prisma.invoiceItem.findMany({ where: { invoice: invoice.id } });

    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber: invoice.invoice_number,
      title: invoice.title,
      clientName: client?.name || 'Valued Client',
      clientCompany: client?.company_name,
      clientEmail: client?.email,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date || undefined,
      currency: invoice.currency,
      items: items.map(it => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total: Number(it.line_total),
      })),
      totalAmount: Number(invoice.total_amount),
      amountPaid: Number(invoice.amount_paid),
      remainingBalance: Number(invoice.remaining_balance),
      status: invoice.status,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF error:', err);
    return res.status(500).json({ detail: 'Failed to generate PDF.' });
  }
});

// POST /api/invoices/:id/record_payment/
invoicesRouter.post('/:id/record_payment/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { amount, payment_method = 'Bank Transfer', transaction_reference = '', notes = '' } = req.body;

  const payAmount = Number(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: BigInt(id) } });
    if (!invoice) return res.status(404).json({ detail: 'Invoice not found.' });

    const remaining = Number(invoice.remaining_balance);
    if (payAmount > remaining) {
      return res.status(400).json({ error: `Payment amount (${payAmount}) exceeds remaining balance (${remaining}).` });
    }

    const paymentCount = await prisma.payment.count();
    const receiptNumber = `REC-${String(paymentCount + 1001).padStart(5, '0')}`;

    const payment = await prisma.payment.create({
      data: {
        receipt_number: receiptNumber,
        invoice: invoice.id,
        client: invoice.client,
        amount: payAmount,
        currency: invoice.currency,
        payment_date: new Date(),
        payment_method,
        transaction_reference,
        notes,
        recorded_by: BigInt(req.user!.id),
        created_at: new Date(),
      },
    });

    const newPaid = Number(invoice.amount_paid) + payAmount;
    const newRemaining = Math.max(0, Number(invoice.total_amount) - newPaid);
    const newStatus = newRemaining === 0 ? 'Paid' : 'Partially Paid';

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amount_paid: newPaid,
        remaining_balance: newRemaining,
        status: newStatus,
        updated_at: new Date(),
      },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'PAYMENT_RECORDED',
      module: 'INVOICES',
      entityId: receiptNumber,
      description: `Payment ${receiptNumber} of ${payAmount} ${invoice.currency} recorded for Invoice ${invoice.invoice_number}`,
      ipAddress: req.ip,
    });

    const items = await prisma.invoiceItem.findMany({ where: { invoice: invoice.id } });

    return res.json({
      message: `Payment ${receiptNumber} recorded successfully.`,
      payment: {
        id: Number(payment.id),
        receipt_number: payment.receipt_number,
        amount: Number(payment.amount),
        currency: payment.currency,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        transaction_reference: payment.transaction_reference,
      },
      invoice: formatInvoice(updatedInvoice, items),
    });
  } catch (err) {
    console.error('Record payment error:', err);
    return res.status(500).json({ detail: 'Failed to record payment.' });
  }
});

// GET /api/payments/
paymentsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { invoice, client } = req.query;
  const where: any = {};

  if (typeof invoice === 'string' && invoice.trim()) where.invoice = BigInt(invoice.trim());
  if (typeof client === 'string' && client.trim()) where.client = BigInt(client.trim());

  try {
    const count = await prisma.payment.count({ where });
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { payment_date: 'desc' },
    });

    return res.json({
      count,
      results: payments.map(p => ({
        id: Number(p.id),
        receipt_number: p.receipt_number,
        amount: Number(p.amount),
        currency: p.currency,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        transaction_reference: p.transaction_reference,
        notes: p.notes,
        invoice: p.invoice ? Number(p.invoice) : null,
        client: p.client ? Number(p.client) : null,
        recorded_by: p.recorded_by ? Number(p.recorded_by) : null,
        created_at: p.created_at,
      })),
    });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch payments.' });
  }
});

// GET /api/payments/:id/receipt_pdf/
paymentsRouter.get('/:id/receipt_pdf/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const payment = await prisma.payment.findUnique({ where: { id: BigInt(id) } });
    if (!payment) return res.status(404).json({ detail: 'Payment not found.' });

    const pdfBuffer = await generateReceiptPDF(payment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${payment.receipt_number}.pdf"`);
    return res.send(pdfBuffer);
  } catch {
    return res.status(500).json({ detail: 'Failed to generate receipt PDF.' });
  }
});
