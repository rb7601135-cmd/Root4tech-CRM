import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { verifyPassword, hashPassword } from '../utils/password';
import { generateTokens, verifyToken } from '../utils/token';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const authRouter = Router();

function formatUser(u: any) {
  return {
    id: Number(u.id),
    email: u.email,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
    phone: u.phone,
    avatar: u.avatar,
    is_active: u.is_active,
    is_superuser: u.is_superuser,
    is_staff: u.is_staff,
    two_factor_enabled: u.two_factor_enabled,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

// POST /api/auth/login/
authRouter.post('/login/', async (req, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
      },
    });

    if (!user) {
      return res.status(400).json({ detail: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(401).json({ detail: 'Account is deactivated. Contact an administrator.' });
    }

    const isValid = verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(400).json({ detail: 'Invalid email or password.' });
    }

    const tokens = generateTokens(user);

    await recordAuditLog({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      module: 'AUTH',
      entityId: String(user.id),
      description: `User ${user.email} (${user.role}) logged in successfully.`,
      ipAddress: req.ip,
    });

    return res.json({
      access: tokens.access,
      refresh: tokens.refresh,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ detail: 'Internal server error during login.' });
  }
});

// POST /api/auth/logout/
authRouter.post('/logout/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    await recordAuditLog({
      userId: req.user.id,
      action: 'AUTH_LOGOUT',
      module: 'AUTH',
      entityId: String(req.user.id),
      description: `User ${req.user.email} logged out.`,
      ipAddress: req.ip,
    });
  }
  return res.json({ message: 'Logged out successfully.' });
});

// POST /api/auth/token/refresh/
authRouter.post('/token/refresh/', async (req, res: Response) => {
  const { refresh } = req.body;
  if (!refresh) {
    return res.status(400).json({ detail: 'Refresh token is required.' });
  }

  const payload = verifyToken(refresh);
  if (!payload || payload.token_type !== 'refresh') {
    return res.status(401).json({ detail: 'Token is invalid or expired', code: 'token_not_valid' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(payload.user_id) },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'User is inactive or deleted.' });
    }

    const tokens = generateTokens(user);
    return res.json({ access: tokens.access });
  } catch {
    return res.status(500).json({ detail: 'Token refresh error.' });
  }
});

// GET /api/auth/me/
authRouter.get('/me/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(req.user!.id) },
    });
    if (!user) {
      return res.status(404).json({ detail: 'User not found.' });
    }
    return res.json(formatUser(user));
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to fetch user profile.' });
  }
});

// PATCH /api/auth/me/
authRouter.patch('/me/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const allowed = ['first_name', 'last_name', 'phone', 'two_factor_enabled'];
  const updateData: Record<string, any> = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updateData[key] = req.body[key];
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: BigInt(req.user!.id) },
      data: updateData,
    });
    return res.json(formatUser(updated));
  } catch (err) {
    return res.status(500).json({ detail: 'Failed to update profile.' });
  }
});

// POST /api/auth/change-password/
authRouter.post('/change-password/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json({ detail: 'Both current and new password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(req.user!.id) },
    });

    if (!user || !verifyPassword(old_password, user.password)) {
      return res.status(400).json({ old_password: ['Current password does not match.'] });
    }

    const newHash = hashPassword(new_password);
    await prisma.user.update({
      where: { id: BigInt(req.user!.id) },
      data: { password: newHash },
    });

    await recordAuditLog({
      userId: user.id,
      action: 'AUTH_PASSWORD_CHANGE',
      module: 'AUTH',
      entityId: String(user.id),
      description: 'Password changed successfully.',
      ipAddress: req.ip,
    });

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ detail: 'Password change failed.' });
  }
});

// POST /api/auth/password-reset/
authRouter.post('/password-reset/', async (req, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ email: ['This field is required.'] });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' }, is_active: true },
    });

    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password_reset_token: token,
          password_reset_expires_at: expiresAt,
        },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        module: 'AUTH',
        entityId: String(user.id),
        description: `Password reset requested for ${user.email}`,
        ipAddress: req.ip,
      });
    }

    return res.json({
      message: 'If the email is associated with an active account, reset instructions have been sent.',
    });
  } catch (err) {
    return res.status(500).json({ detail: 'Password reset request failed.' });
  }
});

// POST /api/auth/password-reset/confirm/
authRouter.post('/password-reset/confirm/', async (req, res: Response) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ detail: 'Token and new_password are required.' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        password_reset_token: token,
        password_reset_expires_at: { gte: new Date() },
        is_active: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    const newHash = hashPassword(new_password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        password_reset_token: null,
        password_reset_expires_at: null,
      },
    });

    await recordAuditLog({
      userId: user.id,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      module: 'AUTH',
      entityId: String(user.id),
      description: `Password reset completed for ${user.email}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Password has been reset successfully. You may now log in.' });
  } catch (err) {
    return res.status(500).json({ detail: 'Password reset confirmation failed.' });
  }
});

