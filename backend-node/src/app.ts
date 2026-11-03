import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { authRouter } from './routes/auth';
import { teamRouter } from './routes/team';
import { clientsRouter } from './routes/clients';
import { leadsRouter } from './routes/leads';
import { quotationsRouter } from './routes/quotations';
import { invoicesRouter, paymentsRouter } from './routes/invoices';
import { projectsRouter, tasksRouter } from './routes/projects';
import { dashboardRouter } from './routes/dashboard';
import { companyRouter } from './routes/company';
import { calendarRouter } from './routes/calendar';
import { realtimeRouter } from './routes/realtime';
import { automationRouter } from './routes/automation';
import { assistantRouter } from './routes/assistant';
import { healthRouter } from './routes/health';

// Global BigInt JSON serialization fix
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export const app: Express = express();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        config.corsOrigins.includes('*') ||
        config.corsOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');
      if (isAllowed) {
        callback(null, true);
      } else {
        // Fallback allow for frontend access
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With', 'Origin'],
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Helper to register routes on both /api and root /
function mount(pathPrefix: string, router: any) {
  app.use(`/api${pathPrefix}`, router);
  app.use(pathPrefix, router);
}

mount('/health', healthRouter);
mount('/auth', authRouter);
mount('/team', teamRouter);
mount('/clients', clientsRouter);
mount('/leads', leadsRouter);
mount('/company', companyRouter);
mount('/dashboard', dashboardRouter);
mount('/quotations', quotationsRouter);
mount('/invoices', invoicesRouter);
mount('/payments', paymentsRouter);
mount('/projects', projectsRouter);
mount('/tasks', tasksRouter);
mount('/calendar-events', calendarRouter);
mount('/automation', automationRouter);
mount('/realtime', realtimeRouter);
mount('/assistant', assistantRouter);

// Root route
app.get('/', (_req: Request, res: Response) => {
  return res.json({
    name: 'Root4Tech Smart CRM API',
    version: '3.0.0',
    runtime: 'Node.js Express + Prisma',
    endpoints: {
      health: '/api/health/',
      auth: '/api/auth/login/',
      dashboard: '/api/dashboard/stats/',
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  return res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  return res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

