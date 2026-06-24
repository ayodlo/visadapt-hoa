import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { loginSchema, registerSchema, updateProfileSchema, changePasswordSchema } from '../schemas/auth';
import { AppError } from '../middleware/errorHandler';

function signToken(userId: string, role: string) {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions
  );
}

function safeUser(user: { id: string; email: string; name: string; role: string; createdAt: Date; updatedAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return next(new AppError(409, 'Email already in use'));

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { email: data.email, name: data.name, password: hashed },
    });

    res.status(201).json({ token: signToken(user.id, user.role), user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return next(new AppError(401, 'Invalid email or password'));

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) return next(new AppError(401, 'Invalid email or password'));

    res.json({ token: signToken(user.id, user.role), user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return next(new AppError(404, 'User not found'));
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email } = updateProfileSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.userId) {
      return next(new AppError(409, 'Email already in use'));
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, email },
    });
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return next(new AppError(404, 'User not found'));

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return next(new AppError(400, 'Current password is incorrect'));

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}
