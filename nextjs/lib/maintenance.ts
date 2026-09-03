import { z } from 'zod';

/**
 * Maintenance request vocabulary and validation.
 *
 * One definition drives the Prisma enums, the form controls, and the server
 * schema, so a new category cannot appear in the UI without the server
 * accepting it. Prisma-free, so the client bundle can import it.
 */

export interface Choice {
  value: string;
  label: string;
}

export const CATEGORIES = [
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'ROOFING', label: 'Roofing' },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'IRRIGATION', label: 'Irrigation' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'DOORS_WINDOWS', label: 'Doors/Windows' },
  { value: 'FENCING', label: 'Fencing' },
  { value: 'COMMON_AREA', label: 'Common Area' },
  { value: 'POOL_SPA', label: 'Pool/Spa' },
  { value: 'LIGHTING', label: 'Lighting' },
  { value: 'TRASH_RECYCLING', label: 'Trash/Recycling' },
  { value: 'PEST_CONTROL', label: 'Pest Control' },
  { value: 'SECURITY_ACCESS', label: 'Security/Access Control' },
  { value: 'SNOW_ICE', label: 'Snow/Ice Removal' },
  { value: 'CLEANING_JANITORIAL', label: 'Cleaning/Janitorial' },
  { value: 'OTHER', label: 'Other' },
] as const satisfies readonly Choice[];

export const LOCATION_TYPES = [
  { value: 'INTERIOR', label: 'Interior' },
  { value: 'EXTERIOR', label: 'Exterior' },
  { value: 'COMMON_AREA', label: 'Common Area' },
  { value: 'BOTH', label: 'Both' },
  { value: 'NOT_SURE', label: 'Not Sure' },
] as const satisfies readonly Choice[];

export const ONGOING_STATUSES = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'INTERMITTENTLY', label: 'Intermittently' },
  { value: 'NOT_SURE', label: 'Not sure' },
] as const satisfies readonly Choice[];

export const URGENCIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'EMERGENCY', label: 'Emergency' },
] as const satisfies readonly Choice[];

export const PROPERTY_SCOPES = [
  { value: 'MY_UNIT', label: 'My property/unit' },
  { value: 'HOA_COMMON', label: 'HOA/common property' },
  { value: 'SHARED', label: 'Shared property' },
  { value: 'NOT_SURE', label: 'Not sure' },
] as const satisfies readonly Choice[];

export const ENTRY_PERMISSIONS = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'CONTACT_FIRST', label: 'Contact me first' },
] as const satisfies readonly Choice[];

export const CONTACT_METHODS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'TEXT', label: 'Text message' },
] as const satisfies readonly Choice[];

/**
 * Extract the `value`s as a tuple of string literals rather than `string[]`,
 * so the zod enums keep their literal union and stay assignable to the Prisma
 * enum types. A plain `.map()` widens to `string` and breaks that.
 */
type ChoiceValues<T extends readonly Choice[]> = { -readonly [K in keyof T]: T[K]['value'] };

function valuesOf<T extends readonly Choice[]>(choices: T): ChoiceValues<T> {
  return choices.map((c) => c.value) as ChoiceValues<T>;
}

const CATEGORY_VALUES = valuesOf(CATEGORIES);
const LOCATION_VALUES = valuesOf(LOCATION_TYPES);
const ONGOING_VALUES = valuesOf(ONGOING_STATUSES);
const URGENCY_VALUES = valuesOf(URGENCIES);
const SCOPE_VALUES = valuesOf(PROPERTY_SCOPES);
const ENTRY_VALUES = valuesOf(ENTRY_PERMISSIONS);
const CONTACT_VALUES = valuesOf(CONTACT_METHODS);

export const TITLE_MAX = 150;
export const DESCRIPTION_MAX = 5000;
export const ACCESS_INSTRUCTIONS_MAX = 1000;

/** Specific-location choices, keyed by the Issue Location answer. */
export const SPECIFIC_LOCATIONS: Record<string, string[]> = {
  INTERIOR: ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Garage', 'Basement', 'Attic', 'Hallway', 'Laundry room', 'Other'],
  EXTERIOR: ['Roof', 'Siding', 'Driveway', 'Walkway', 'Yard/Lawn', 'Fence', 'Patio/Deck', 'Exterior lighting', 'Gutters', 'Other'],
  COMMON_AREA: ['Pool/Spa', 'Clubhouse', 'Gym', 'Parking lot', 'Mailboxes', 'Playground', 'Elevator', 'Lobby', 'Grounds', 'Other'],
  BOTH: ['Building envelope', 'Entryway', 'Balcony/Patio', 'Utilities', 'Other'],
  NOT_SURE: ['Not sure', 'Other'],
};

export function specificLocationsFor(locationType: string): string[] {
  return SPECIFIC_LOCATIONS[locationType] ?? [];
}

/** Step 3 only applies when a private property is involved. */
export function needsAccessDetails(propertyScope: string): boolean {
  return propertyScope === 'MY_UNIT' || propertyScope === 'SHARED';
}

/** The emergency warning is advisory, never a blocker. */
export function isEmergency(urgency: string): boolean {
  return urgency === 'EMERGENCY';
}

export const EMERGENCY_WARNING =
  'This form is not an emergency dispatch service and is not monitored around the clock. ' +
  'If anyone is in danger, or there is a fire, gas leak, or flooding, contact emergency services first.';

/**
 * Server-side shape. The client validates the same rules step by step, but this
 * is the authority — communityId, propertyId, and submitter are never taken
 * from the request body, so they are deliberately absent here.
 */
export const maintenanceRequestSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  locationType: z.enum(LOCATION_VALUES),
  specificLocation: z.string().trim().max(120).optional().nullable(),
  title: z.string().trim().min(1, 'Request title is required').max(TITLE_MAX),
  description: z.string().trim().min(1, 'Description is required').max(DESCRIPTION_MAX),
  firstObservedAt: z.string().datetime({ offset: true }).nullable().optional(),
  ongoingStatus: z.enum(ONGOING_VALUES).optional().nullable(),
  residentUrgency: z.enum(URGENCY_VALUES),
  propertyScope: z.enum(SCOPE_VALUES),
  entryPermission: z.enum(ENTRY_VALUES).optional().nullable(),
  accessInstructions: z.string().trim().max(ACCESS_INSTRUCTIONS_MAX).optional().nullable(),
  petsOnProperty: z.boolean().optional().nullable(),
  preferredContactMethod: z.enum(CONTACT_VALUES).optional().nullable(),
  /** Chosen by the resident from their own properties; ownership is re-checked server-side. */
  propertyId: z.string().optional().nullable(),
});

export type MaintenanceRequestInput = z.infer<typeof maintenanceRequestSchema>;

/**
 * Staff quick entry: title, description, and a triage priority.
 *
 * Deliberately separate from the resident schema rather than making its fields
 * optional. A resident submission is fully validated server-side, as required —
 * and a staff-logged request does not invent a `residentUrgency` or
 * `propertyScope` that no resident ever answered.
 */
export const staffQuickRequestSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(TITLE_MAX),
  description: z.string().trim().min(1, 'Description is required').max(DESCRIPTION_MAX),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

/**
 * Human-readable request number, e.g. `MR-2026-0007`.
 *
 * The sequence is per year and derived from a count, so it stays readable for
 * residents quoting it back to staff. Uniqueness is enforced by the database.
 */
export function formatRequestNumber(year: number, sequence: number): string {
  return `MR-${year}-${String(sequence).padStart(4, '0')}`;
}

export function labelFor(choices: readonly Choice[], value: string | null | undefined): string {
  if (!value) return '—';
  return choices.find((c) => c.value === value)?.label ?? value;
}
