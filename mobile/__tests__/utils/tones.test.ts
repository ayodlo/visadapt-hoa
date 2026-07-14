import {
  issueStatusTone,
  issuePriorityTone,
  archStatusTone,
  violationStatusTone,
  chargeStatusTone,
  paymentStatusTone,
  announcementPriorityTone,
} from '@/utils/tones';

describe('issueStatusTone', () => {
  it('maps resolved/closed to success', () => {
    expect(issueStatusTone('RESOLVED')).toBe('success');
    expect(issueStatusTone('CLOSED')).toBe('success');
  });

  it('maps submitted/under review to warning', () => {
    expect(issueStatusTone('SUBMITTED')).toBe('warning');
    expect(issueStatusTone('UNDER_REVIEW')).toBe('warning');
  });

  it('defaults other statuses to info', () => {
    expect(issueStatusTone('ASSIGNED')).toBe('info');
  });
});

describe('issuePriorityTone', () => {
  it('maps urgent/high to danger', () => {
    expect(issuePriorityTone('URGENT')).toBe('danger');
    expect(issuePriorityTone('HIGH')).toBe('danger');
  });

  it('maps medium to warning', () => {
    expect(issuePriorityTone('MEDIUM')).toBe('warning');
  });

  it('defaults everything else to default', () => {
    expect(issuePriorityTone('LOW')).toBe('default');
  });
});

describe('archStatusTone', () => {
  it('maps approved to success', () => {
    expect(archStatusTone('APPROVED')).toBe('success');
  });

  it('maps denied/withdrawn to danger', () => {
    expect(archStatusTone('DENIED')).toBe('danger');
    expect(archStatusTone('WITHDRAWN')).toBe('danger');
  });

  it('maps needs more information to warning', () => {
    expect(archStatusTone('NEEDS_MORE_INFORMATION')).toBe('warning');
  });

  it('defaults other statuses to info', () => {
    expect(archStatusTone('SUBMITTED')).toBe('info');
  });
});

describe('violationStatusTone', () => {
  it('maps resolved/closed to success', () => {
    expect(violationStatusTone('RESOLVED')).toBe('success');
    expect(violationStatusTone('CLOSED')).toBe('success');
  });

  it('maps escalated to danger', () => {
    expect(violationStatusTone('ESCALATED')).toBe('danger');
  });

  it('maps notice sent to warning', () => {
    expect(violationStatusTone('NOTICE_SENT')).toBe('warning');
  });

  it('defaults other statuses to info', () => {
    expect(violationStatusTone('DRAFT')).toBe('info');
  });
});

describe('chargeStatusTone', () => {
  it('maps paid to success', () => {
    expect(chargeStatusTone('PAID')).toBe('success');
  });

  it('maps overdue to danger', () => {
    expect(chargeStatusTone('OVERDUE')).toBe('danger');
  });

  it('defaults everything else to warning', () => {
    expect(chargeStatusTone('PENDING')).toBe('warning');
  });
});

describe('paymentStatusTone', () => {
  it('maps paid to success', () => {
    expect(paymentStatusTone('PAID')).toBe('success');
  });

  it('maps failed to danger', () => {
    expect(paymentStatusTone('FAILED')).toBe('danger');
  });

  it('defaults everything else to warning', () => {
    expect(paymentStatusTone('PENDING')).toBe('warning');
  });
});

describe('announcementPriorityTone', () => {
  it('maps emergency to danger', () => {
    expect(announcementPriorityTone('EMERGENCY')).toBe('danger');
  });

  it('maps important to warning', () => {
    expect(announcementPriorityTone('IMPORTANT')).toBe('warning');
  });

  it('defaults normal to default', () => {
    expect(announcementPriorityTone('NORMAL')).toBe('default');
  });
});
