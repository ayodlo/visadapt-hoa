/**
 * Bootstraps or promotes a SUPER_ADMIN account. SUPER_ADMIN is engineer-only and
 * is never assignable through the app UI/API (see lib/roles.ts) — this script is
 * the only way to create one.
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=... npx tsx prisma/create-super-admin.ts
 *
 * Optional: SUPER_ADMIN_FIRST_NAME, SUPER_ADMIN_LAST_NAME (used only when creating a new user).
 * If the email already exists, that account is promoted to SUPER_ADMIN (password left unchanged).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super';
  const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin';

  if (!email) throw new Error('SUPER_ADMIN_EMAIL is required');

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: 'SUPER_ADMIN' } });
    console.log(`Promoted existing user ${email} to SUPER_ADMIN.`);
    return;
  }

  if (!password || password.length < 8) {
    throw new Error('SUPER_ADMIN_PASSWORD (min 8 characters) is required to create a new account');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { firstName, lastName, email, passwordHash, role: 'SUPER_ADMIN' },
  });
  console.log(`Created SUPER_ADMIN account for ${email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
