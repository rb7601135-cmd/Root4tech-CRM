import { prisma } from '../config/prisma';

export async function recordAuditLog(options: {
  userId?: number | bigint | string | null;
  user?: number | bigint | string | null;
  action: string;
  module: string;
  entityId?: string;
  entity_id?: string;
  description: string;
  ipAddress?: string;
}) {
  try {
    const rawUser = options.userId ?? options.user;
    await prisma.auditLog.create({
      data: {
        user: rawUser ? BigInt(rawUser) : null,
        action: options.action,
        module: options.module,
        entity_id: options.entityId || options.entity_id || '',
        description: options.description,
        ip_address: options.ipAddress || null,
        created_at: new Date(),
      },
    });
  } catch (err) {
    // Non-blocking audit logger
    console.warn('Audit log write warning:', err);
  }
}
