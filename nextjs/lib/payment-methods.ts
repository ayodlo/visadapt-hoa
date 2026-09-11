/**
 * Payment methods an admin can record by hand.
 *
 * These are the ways money reaches an HOA *outside* Stripe — a cheque in the post,
 * cash at a board meeting, a wire straight to the association's bank. Card and
 * debit are deliberately absent: a card payment goes through Checkout, and letting
 * someone hand-enter one would be a way to mark a balance paid with no money
 * behind it, which is exactly what deleting /api/payments/me/pay was meant to stop.
 *
 * This lives apart from `lib/payments.ts` for the same reason `lib/roles.ts` lives
 * apart from `lib/auth.ts`: that module imports Prisma, so a client component
 * cannot import from it at runtime. The admin payments page needs this list to
 * build its dropdown.
 */
export const MANUAL_PAYMENT_METHODS = ['Check', 'Cash', 'Bank Transfer', 'Money Order'] as const;

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];
