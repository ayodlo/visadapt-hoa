import { PrismaClient } from '@prisma/client';
import { resetDemoCommunity } from '../lib/demo-seed';
import { DEMO_ACCOUNTS, DEMO_COMMUNITY_NAME, DEMO_PASSWORD } from '../lib/demo';

/**
 * Create or reset the public demo community: `npm run seed:demo`.
 *
 * Safe against any database, production included — it only touches the demo
 * community and the demo users (see lib/demo-seed.ts). The Prisma CLI does not
 * read .env.local, so export DATABASE_URL first.
 */
const prisma = new PrismaClient();

async function main() {
  const result = await resetDemoCommunity(prisma);
  console.log(`Reset "${DEMO_COMMUNITY_NAME}": ${result.residents} residents, ${result.charges} charges, ${result.payments} payments.`);
  console.log(`Logins (password "${DEMO_PASSWORD}"):`);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.label.padEnd(13)} ${a.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
