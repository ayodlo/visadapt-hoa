import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Reset your Portal HOA password',
    html: `
      <p>Hi ${firstName},</p>
      <p>Click the link below to reset your password. It expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export async function sendMaintenanceStatusEmail(
  to: string,
  firstName: string,
  requestTitle: string,
  newStatus: string,
  requestId: string
) {
  const label = STATUS_LABELS[newStatus] ?? newStatus;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Maintenance request updated: ${requestTitle}`,
    html: `
      <p>Hi ${firstName},</p>
      <p>Your maintenance request "<strong>${requestTitle}</strong>" has been updated to <strong>${label}</strong>.</p>
      <p><a href="${appUrl}/dashboard/maintenance/${requestId}">View your request</a></p>
    `,
  });
}

/**
 * Tell one staff member a request was submitted.
 *
 * Email rather than push alone: push is the established channel for the other
 * features, but `sendPushToUsers` no-ops for anyone without a registered token,
 * and tokens only exist for mobile app users -- while maintenance exists only on
 * the web. Without this, a web-only admin is told nothing.
 */
export async function sendNewMaintenanceRequestEmail(
  to: string,
  firstName: string,
  request: { id: string; title: string; requestNumber: string | null; submitterName: string },
  urgent: boolean
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const reference = request.requestNumber ? `${request.requestNumber}: ` : '';

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${urgent ? '[Emergency] ' : ''}New maintenance request: ${reference}${request.title}`,
    html: `
      <p>Hi ${firstName},</p>
      <p><strong>${request.submitterName}</strong> submitted a maintenance request${
        urgent ? ' and marked it an <strong>emergency</strong>' : ''
      }.</p>
      <p>${reference}<strong>${request.title}</strong></p>
      <p><a href="${appUrl}/dashboard/maintenance/${request.id}">Open the request</a></p>
    `,
  });
}
