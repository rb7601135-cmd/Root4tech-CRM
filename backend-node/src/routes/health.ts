import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  let dbStatus = 'healthy';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'unhealthy';
  }

  const isHealthy = dbStatus === 'healthy';
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'Root4Tech Smart CRM API',
    version: '3.0.0',
    database: dbStatus,
  });
});

