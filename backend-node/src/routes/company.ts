import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, requireAdmin, requireSalesManager, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const companyRouter = Router();

// GET /api/company/settings/
companyRouter.get('/settings/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          company_name: 'Root4Tech Solutions',
          email: 'contact@roo4tech.com',
          phone: '+92 300 1234567',
          website: 'https://roo4tech.com',
          address: 'Office 402, Technology Park, Shahrah-e-Faisal, Karachi, Pakistan',
          default_currency: 'PKR',
          theme_preference: 'dark',
          updated_at: new Date(),
        },
      });
    }

    return res.json({
      id: Number(settings.id),
      company_name: settings.company_name,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
      address: settings.address,
      default_currency: settings.default_currency,
      theme_preference: settings.theme_preference,
      logo: settings.logo,
      updated_at: settings.updated_at,
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch company settings.' });
  }
});

// PATCH /api/company/settings/ (Admin only)
companyRouter.patch('/settings/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const fields = ['company_name', 'email', 'phone', 'website', 'address', 'default_currency', 'theme_preference', 'logo'];
  const updateData: any = { updated_at: new Date(), updated_by: BigInt(req.user!.id) };
  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  }

  try {
    let settings = await prisma.companySettings.findFirst();
    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      settings = await prisma.companySettings.create({ data: updateData });
    }

    await recordAuditLog({
      userId: req.user!.id,
      action: 'COMPANY_SETTINGS_UPDATED',
      module: 'SETTINGS',
      entityId: String(settings.id),
      description: 'Company settings updated',
      ipAddress: req.ip,
    });

    return res.json({
      id: Number(settings.id),
      company_name: settings.company_name,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
      address: settings.address,
      default_currency: settings.default_currency,
      theme_preference: settings.theme_preference,
      logo: settings.logo,
      updated_at: settings.updated_at,
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to update company settings.' });
  }
});

// GET /api/company/exchange-rates/
companyRouter.get('/exchange-rates/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let rates = await prisma.exchangeRate.findMany({ orderBy: { currency_code: 'asc' } });
    if (rates.length === 0) {
      const defaultRates = [
        { currency_code: 'PKR', rate_to_base: 1.0, source: 'Base Currency (PKR)' },
        { currency_code: 'USD', rate_to_base: 278.5, source: 'Official Bank Rate' },
        { currency_code: 'GBP', rate_to_base: 352.0, source: 'Official Bank Rate' },
        { currency_code: 'EUR', rate_to_base: 301.0, source: 'Official Bank Rate' },
        { currency_code: 'AED', rate_to_base: 75.8, source: 'Official Bank Rate' },
        { currency_code: 'SAR', rate_to_base: 74.2, source: 'Official Bank Rate' },
        { currency_code: 'CAD', rate_to_base: 203.0, source: 'Official Bank Rate' },
      ];
      for (const dr of defaultRates) {
        await prisma.exchangeRate.create({
          data: {
            ...dr,
            updated_at: new Date(),
          },
        });
      }
      rates = await prisma.exchangeRate.findMany({ orderBy: { currency_code: 'asc' } });
    }

    return res.json({
      results: rates.map(r => ({
        id: Number(r.id),
        currency_code: r.currency_code,
        rate_to_base: Number(r.rate_to_base),
        source: r.source,
        is_active: true,
        updated_at: r.updated_at,
      })),
    });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch exchange rates.' });
  }
});

// PATCH /api/company/exchange-rates/:id/
companyRouter.patch('/exchange-rates/:id/', authenticateToken, requireSalesManager, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { rate_to_base, source } = req.body;
  const updateData: any = { updated_at: new Date() };
  if (rate_to_base !== undefined) updateData.rate_to_base = Number(rate_to_base);
  if (source !== undefined) updateData.source = source;

  try {
    const updated = await prisma.exchangeRate.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return res.json({
      id: Number(updated.id),
      currency_code: updated.currency_code,
      rate_to_base: Number(updated.rate_to_base),
      source: updated.source,
      is_active: true,
    });
  } catch {
    return res.status(404).json({ detail: 'Exchange rate not found.' });
  }
});

// GET /api/company/services/
companyRouter.get('/services/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { active_only, category, search } = req.query;
  const where: any = {};
  if (active_only === 'true') where.is_active = true;
  if (typeof category === 'string' && category.trim()) where.category = category.trim();
  if (typeof search === 'string' && search.trim()) {
    where.name = { contains: search.trim(), mode: 'insensitive' };
  }

  try {
    const services = await prisma.companyService.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return res.json({
      results: services.map(s => ({
        id: Number(s.id),
        name: s.name,
        category: s.category,
        description: s.description,
        default_unit_price: Number(s.default_unit_price),
        currency: s.currency,
        unit: s.billing_type,
        billing_type: s.billing_type,
        is_active: s.is_active,
      })),
    });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch services.' });
  }
});

// POST /api/company/services/
companyRouter.post('/services/', authenticateToken, requireSalesManager, async (req: AuthenticatedRequest, res: Response) => {
  const { name, category = 'General', description = '', default_unit_price = 0, currency = 'PKR', unit = 'project', billing_type } = req.body;
  if (!name) return res.status(400).json({ detail: 'Service name is required.' });

  try {
    const svc = await prisma.companyService.create({
      data: {
        name,
        category,
        description,
        default_unit_price: Number(default_unit_price),
        currency,
        billing_type: billing_type || unit || 'project',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await recordAuditLog({
      userId: req.user!.id,
      action: 'SERVICE_CREATED',
      module: 'SERVICES',
      entityId: String(svc.id),
      description: `Service '${svc.name}' added to catalog (${svc.currency} ${svc.default_unit_price})`,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      id: Number(svc.id),
      name: svc.name,
      category: svc.category,
      description: svc.description,
      default_unit_price: Number(svc.default_unit_price),
      currency: svc.currency,
      unit: svc.billing_type,
      billing_type: svc.billing_type,
      is_active: svc.is_active,
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to create service.' });
  }
});

// PATCH /api/company/services/:id/
companyRouter.patch('/services/:id/', authenticateToken, requireSalesManager, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const fields = ['name', 'category', 'description', 'currency', 'is_active'];
  const updateData: any = { updated_at: new Date() };
  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  }
  if (req.body.billing_type !== undefined) updateData.billing_type = req.body.billing_type;
  if (req.body.unit !== undefined) updateData.billing_type = req.body.unit;
  if (req.body.default_unit_price !== undefined) {
    updateData.default_unit_price = Number(req.body.default_unit_price);
  }

  try {
    const updated = await prisma.companyService.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return res.json({
      id: Number(updated.id),
      name: updated.name,
      category: updated.category,
      description: updated.description,
      default_unit_price: Number(updated.default_unit_price),
      currency: updated.currency,
      unit: updated.billing_type,
      billing_type: updated.billing_type,
      is_active: updated.is_active,
    });
  } catch {
    return res.status(404).json({ detail: 'Service not found.' });
  }
});

// DELETE /api/company/services/:id/
companyRouter.delete('/services/:id/', authenticateToken, requireSalesManager, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    await prisma.companyService.delete({ where: { id: BigInt(id) } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ detail: 'Service not found.' });
  }
});

// GET /api/company/audit-logs/
companyRouter.get('/audit-logs/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { module, action, search } = req.query;
  const where: any = {};
  if (typeof module === 'string' && module.trim()) where.module = { equals: module.trim(), mode: 'insensitive' };
  if (typeof action === 'string' && action.trim()) where.action = { contains: action.trim(), mode: 'insensitive' };
  if (typeof search === 'string' && search.trim()) {
    where.description = { contains: search.trim(), mode: 'insensitive' };
  }

  try {
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return res.json({
      count: logs.length,
      results: logs.map(l => ({
        id: Number(l.id),
        user: l.user ? Number(l.user) : null,
        action: l.action,
        module: l.module,
        entity_id: l.entity_id,
        description: l.description,
        ip_address: l.ip_address,
        created_at: l.created_at,
      })),
    });
  } catch {
    return res.status(500).json({ detail: 'Failed to fetch audit logs.' });
  }
});
