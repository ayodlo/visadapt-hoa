import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  CONTACT_METHODS,
  DESCRIPTION_MAX,
  ENTRY_PERMISSIONS,
  LOCATION_TYPES,
  ONGOING_STATUSES,
  PROPERTY_SCOPES,
  TITLE_MAX,
  URGENCIES,
  formatRequestNumber,
  isEmergency,
  labelFor,
  maintenanceRequestSchema,
  needsAccessDetails,
  specificLocationsFor,
} from '@/lib/maintenance';

const valid = {
  category: 'PLUMBING',
  locationType: 'INTERIOR',
  title: 'Leaking kitchen tap',
  description: 'Water pools under the sink overnight.',
  residentUrgency: 'NORMAL',
  propertyScope: 'MY_UNIT',
};

describe('maintenanceRequestSchema', () => {
  it('accepts a minimal valid request', () => {
    expect(maintenanceRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('requires the fields the form marks required', () => {
    for (const key of ['category', 'locationType', 'title', 'description', 'residentUrgency', 'propertyScope']) {
      const { [key as keyof typeof valid]: _omitted, ...rest } = valid;
      expect(maintenanceRequestSchema.safeParse(rest).success, `${key} should be required`).toBe(false);
    }
  });

  it('rejects a blank title or description even when present', () => {
    expect(maintenanceRequestSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
    expect(maintenanceRequestSchema.safeParse({ ...valid, description: '' }).success).toBe(false);
  });

  it('enforces the documented length caps', () => {
    expect(maintenanceRequestSchema.safeParse({ ...valid, title: 'a'.repeat(TITLE_MAX) }).success).toBe(true);
    expect(maintenanceRequestSchema.safeParse({ ...valid, title: 'a'.repeat(TITLE_MAX + 1) }).success).toBe(false);
    expect(maintenanceRequestSchema.safeParse({ ...valid, description: 'a'.repeat(DESCRIPTION_MAX + 1) }).success).toBe(false);
  });

  it('rejects values outside the published vocabularies', () => {
    expect(maintenanceRequestSchema.safeParse({ ...valid, category: 'TELEPORTER' }).success).toBe(false);
    expect(maintenanceRequestSchema.safeParse({ ...valid, residentUrgency: 'CATASTROPHIC' }).success).toBe(false);
    expect(maintenanceRequestSchema.safeParse({ ...valid, locationType: 'MOON' }).success).toBe(false);
  });

  it('treats the optional detail fields as optional', () => {
    const parsed = maintenanceRequestSchema.safeParse({
      ...valid,
      specificLocation: 'Kitchen',
      firstObservedAt: new Date('2026-08-01T00:00:00Z').toISOString(),
      ongoingStatus: 'INTERMITTENTLY',
      entryPermission: 'CONTACT_FIRST',
      accessInstructions: 'Gate code 1234',
      petsOnProperty: true,
      preferredContactMethod: 'EMAIL',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-ISO firstObservedAt', () => {
    expect(maintenanceRequestSchema.safeParse({ ...valid, firstObservedAt: '2026-08-01' }).success).toBe(false);
  });

  it('has no field for community or submitter — those are server-assigned', () => {
    const parsed = maintenanceRequestSchema.parse({ ...valid, communityId: 'evil', submittedById: 'evil' } as never);
    expect(parsed).not.toHaveProperty('communityId');
    expect(parsed).not.toHaveProperty('submittedById');
  });
});

describe('needsAccessDetails', () => {
  it('applies to private property, not common areas', () => {
    expect(needsAccessDetails('MY_UNIT')).toBe(true);
    expect(needsAccessDetails('SHARED')).toBe(true);
    expect(needsAccessDetails('HOA_COMMON')).toBe(false);
    expect(needsAccessDetails('NOT_SURE')).toBe(false);
    expect(needsAccessDetails('')).toBe(false);
  });
});

describe('isEmergency', () => {
  it('only flags the emergency urgency', () => {
    expect(isEmergency('EMERGENCY')).toBe(true);
    for (const u of ['LOW', 'NORMAL', 'HIGH', '']) expect(isEmergency(u)).toBe(false);
  });
});

describe('specificLocationsFor', () => {
  it('returns choices matched to the issue location', () => {
    expect(specificLocationsFor('INTERIOR')).toContain('Kitchen');
    expect(specificLocationsFor('EXTERIOR')).toContain('Roof');
    expect(specificLocationsFor('COMMON_AREA')).toContain('Pool/Spa');
  });

  it('never leaks interior choices into an exterior request', () => {
    expect(specificLocationsFor('EXTERIOR')).not.toContain('Kitchen');
  });

  it('returns an empty list for an unknown location', () => {
    expect(specificLocationsFor('')).toEqual([]);
    expect(specificLocationsFor('NOWHERE')).toEqual([]);
  });
});

describe('formatRequestNumber', () => {
  it('is readable and zero-padded', () => {
    expect(formatRequestNumber(2026, 7)).toBe('MR-2026-0007');
    expect(formatRequestNumber(2026, 1234)).toBe('MR-2026-1234');
  });

  it('keeps sorting stable within a year', () => {
    expect(formatRequestNumber(2026, 2) < formatRequestNumber(2026, 10)).toBe(true);
  });

  it('does not truncate beyond four digits', () => {
    expect(formatRequestNumber(2026, 12345)).toBe('MR-2026-12345');
  });
});

describe('labelFor', () => {
  it('maps stored values to human labels', () => {
    expect(labelFor(CATEGORIES, 'DOORS_WINDOWS')).toBe('Doors/Windows');
    expect(labelFor(URGENCIES, 'EMERGENCY')).toBe('Emergency');
    expect(labelFor(PROPERTY_SCOPES, 'MY_UNIT')).toBe('My property/unit');
  });

  it('renders a dash for missing values rather than "null"', () => {
    expect(labelFor(ONGOING_STATUSES, null)).toBe('—');
    expect(labelFor(CONTACT_METHODS, undefined)).toBe('—');
  });

  it('falls back to the raw value if it is unknown', () => {
    expect(labelFor(ENTRY_PERMISSIONS, 'MAYBE')).toBe('MAYBE');
  });
});

describe('vocabularies', () => {
  it('covers every category the requirements list', () => {
    expect(CATEGORIES).toHaveLength(18);
    for (const label of ['Plumbing', 'Electrical', 'HVAC', 'Snow/Ice Removal', 'Security/Access Control', 'Other']) {
      expect(CATEGORIES.map((c) => c.label)).toContain(label);
    }
  });

  it('offers the five issue locations', () => {
    expect(LOCATION_TYPES.map((l) => l.label)).toEqual(['Interior', 'Exterior', 'Common Area', 'Both', 'Not Sure']);
  });
});
