import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { chargeBalance } from '@/lib/charges';
import { describeMethodLabel } from '@/lib/autopay';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim().toLowerCase() ?? '';
  // 'autopay_issues' is not a payment status — it selects residents whose
  // autopay is enabled but last failed, which is a different question from what
  // they owe. Kept in the same parameter because the UI presents them as one row
  // of tabs.
  const statusFilter = searchParams.get('status') ?? 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;

  const residents = await prisma.user.findMany({
    where: { role: 'RESIDENT', communityId },
    include: {
      charges: { orderBy: { dueDate: 'desc' } },
      autopayEnrollment: {
        select: {
          enabled: true,
          methodType: true,
          methodBrand: true,
          methodLast4: true,
          lastFailureAt: true,
          lastFailureMessage: true,
        },
      },
      payments: { where: { status: 'PAID' }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  // Build summaries
  let summaries = residents.map((r) => {
    const pendingCharges = r.charges.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');
    // chargeBalance, not c.amount: a charge carrying a partial payment owes only
    // the remainder, and reporting its face value would overstate every AR
    // figure on this page.
    const balance = pendingCharges.reduce((s, c) => s + chargeBalance(c), 0);
    const overdueAmount = r.charges
      .filter((c) => c.status === 'OVERDUE')
      .reduce((s, c) => s + chargeBalance(c), 0);
    const lastPayment = r.payments[0] ?? null;
    const autopay = r.autopayEnrollment;
    const derivedStatus = overdueAmount > 0 ? 'overdue' : balance > 0 ? 'pending' : 'paid';

    return {
      resident: { id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email },
      balance,
      overdueAmount,
      lastPaymentDate: lastPayment?.paidAt ?? null,
      derivedStatus,
      autopay: autopay
        ? {
            enabled: autopay.enabled,
            method: describeMethodLabel(autopay),
            // A failure recorded against a live enrolment is what the
            // "Autopay issues" view is for: the resident believes they are
            // paying automatically and they are not.
            hasIssue: Boolean(autopay.lastFailureAt),
            failureMessage: autopay.lastFailureMessage,
          }
        : null,
    };
  });

  // Search
  if (search) {
    summaries = summaries.filter(
      (s) =>
        s.resident.firstName.toLowerCase().includes(search) ||
        s.resident.lastName.toLowerCase().includes(search) ||
        s.resident.email.toLowerCase().includes(search)
    );
  }

  // Status filter
  if (statusFilter === 'autopay_issues') {
    summaries = summaries.filter((s) => s.autopay?.hasIssue);
  } else if (statusFilter !== 'all') {
    summaries = summaries.filter((s) => s.derivedStatus === statusFilter);
  }

  // Aggregates (before pagination)
  const totalBalance = summaries.reduce((s, r) => s + r.balance, 0);
  const overdueCount = summaries.filter((s) => s.overdueAmount > 0).length;
  const totalOverdue = summaries.reduce((s, r) => s + r.overdueAmount, 0);

  const total = summaries.length;
  const totalPages = Math.ceil(total / limit);
  const paginated = summaries.slice((page - 1) * limit, page * limit);

  return ok({ residents: paginated, total, totalPages, page, totalBalance, overdueCount, totalOverdue });
}
