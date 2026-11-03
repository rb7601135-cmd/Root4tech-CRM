import { app } from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`🚀 Roo4Tech CRM Node Backend running on port ${config.port}`);
  console.log(`📋 Health Check: http://localhost:${config.port}/api/health/`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

