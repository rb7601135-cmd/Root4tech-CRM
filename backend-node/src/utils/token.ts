import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';

export interface TokenPayload {
  token_type: 'access' | 'refresh';
  user_id: number;
  email?: string;
  role?: string;
  jti: string;
}

export function generateTokens(user: { id: bigint | number; email: string; role: string }) {
  const userId = Number(user.id);
  const jtiAccess = crypto.randomUUID();
  const jtiRefresh = crypto.randomUUID();

  const accessPayload: TokenPayload = {
    token_type: 'access',
    user_id: userId,
    email: user.email,
    role: user.role,
    jti: jtiAccess,
  };

  const refreshPayload: TokenPayload = {
    token_type: 'refresh',
    user_id: userId,
    email: user.email,
    role: user.role,
    jti: jtiRefresh,
  };

  const access = jwt.sign(accessPayload, config.jwtSecret, { expiresIn: config.jwtAccessExpiry as any });
  const refresh = jwt.sign(refreshPayload, config.jwtSecret, { expiresIn: config.jwtRefreshExpiry as any });

  return { access, refresh };
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}
