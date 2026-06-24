import { Resend } from 'resend';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

const FROM = process.env.EMAIL_FROM ?? 'CommunityHQ <noreply@communityhq.app>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

export async function sendPasswordResetEmail(to: string, firstName: string, token: string) {
  const resend = getResend();
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your CommunityHQ password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a1a">Reset your password</h2>
        <p style="color:#555">Hi ${firstName},</p>
        <p style="color:#555">You requested a password reset for your CommunityHQ account. Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0">
          Reset password
        </a>
        <p style="color:#999;font-size:13px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p style="color:#ccc;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
          CommunityHQ · Community Management Platform
        </p>
      </div>
    `,
  });
}
