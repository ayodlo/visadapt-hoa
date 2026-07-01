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
    subject: 'Reset your CommunityHQ password',
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
  newStatus: string
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
      <p><a href="${appUrl}/dashboard/maintenance">View your requests</a></p>
    `,
  });
}
