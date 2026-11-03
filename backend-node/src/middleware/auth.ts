import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token';
import { prisma } from '../config/prisma';

export interface AuthenticatedUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string;
  is_active: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  avatar: string | null;
  two_factor_enabled: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export type AuthRequest = AuthenticatedRequest;
export const authenticateJWT = authenticateToken;

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
  }

  const payload = verifyToken(token);
  if (!payload || payload.token_type !== 'access') {
    return res.status(401).json({ detail: 'Given token not valid for any token type', code: 'token_not_valid' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(payload.user_id) },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'User account is inactive or no longer exists.' });
    }

    req.user = {
      id: Number(user.id),
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone: user.phone,
      is_active: user.is_active,
      is_superuser: user.is_superuser,
      is_staff: user.is_staff,
      avatar: user.avatar,
      two_factor_enabled: user.two_factor_enabled,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ detail: 'Authentication verification failed.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ detail: 'Authentication required.' });
  }
  if (req.user.role !== 'Administrator' && !req.user.is_superuser) {
    return res.status(403).json({ detail: 'Administrator permission required.' });
  }
  next();
}

export function requireSalesManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ detail: 'Authentication required.' });
  }
  if (req.user.role !== 'Administrator' && req.user.role !== 'Sales Manager' && !req.user.is_superuser) {
    return res.status(403).json({ detail: 'You do not have permission to perform this action.' });
  }
  next();
}
