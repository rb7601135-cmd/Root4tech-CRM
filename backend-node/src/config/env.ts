import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'roo4tech-super-secure-jwt-secret-key-2026!@#',
  jwtAccessExpiry: '2h',
  jwtRefreshExpiry: '7d',
  corsOrigins: (process.env.CORS_ORIGIN || 'https://root4tech-crm-frontend.vercel.app,http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'PKR',
  companyName: process.env.COMPANY_NAME || 'Roo4Tech',
};

