export const colors = {
  bg: '#f9fafb',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  primary: '#2563eb',
  primaryText: '#ffffff',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerText: '#991b1b',
  warning: '#d97706',
  warningBg: '#fef3c7',
  warningText: '#92400e',
  success: '#16a34a',
  successBg: '#dcfce7',
  successText: '#166534',
  info: '#2563eb',
  infoBg: '#dbeafe',
  infoText: '#1e40af',
  neutralBg: '#f3f4f6',
  neutralText: '#374151',
} as const;

export type Tone = 'default' | 'success' | 'danger' | 'warning' | 'info';

export const toneColors: Record<Tone, { bg: string; text: string }> = {
  default: { bg: colors.neutralBg, text: colors.neutralText },
  success: { bg: colors.successBg, text: colors.successText },
  danger: { bg: colors.dangerBg, text: colors.dangerText },
  warning: { bg: colors.warningBg, text: colors.warningText },
  info: { bg: colors.infoBg, text: colors.infoText },
};
