import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '@prisma/client';
import { DEMO_ACCOUNTS, DEMO_COMMUNITY_ID, DEMO_COMMUNITY_NAME, DEMO_PASSWORD } from './demo';

/**
 * Wipe and rebuild the public demo community.
 *
 * Safe to run against production: every delete below is scoped to the demo
 * community or to the fixed demo user ids, never a whole table. (prisma/seed.ts
 * is NOT safe there — it clears announcements, charges, issues and more for every
 * community.) Runs in one transaction so visitors never see a half-empty demo.
 *
 * Dates are relative to the moment of the reset, so the demo always looks current:
 * dues for this month, an event next week, a violation with a deadline ahead.
 *
 * Callers: `npm run seed:demo` (prisma/seed-demo.ts) and the nightly
 * /api/cron/demo-reset.
 */

type Tx = Prisma.TransactionClient;

const C = DEMO_COMMUNITY_ID;
const DAY = 24 * 60 * 60 * 1000;

const [RESIDENT, BOARD, ADMIN] = DEMO_ACCOUNTS;

// The neighbours. Fixed ids so a reset is an upsert, not a new set of rows.
const NEIGHBOURS = [
  { id: 'demo_user_r01', firstName: 'Maya', lastName: 'Okafor' },
  { id: 'demo_user_r02', firstName: 'Daniel', lastName: 'Brennan' },
  { id: 'demo_user_r03', firstName: 'Sofia', lastName: 'Marquez' },
  { id: 'demo_user_r04', firstName: 'Ethan', lastName: 'Liu' },
  { id: 'demo_user_r05', firstName: 'Grace', lastName: 'Whitfield' },
  { id: 'demo_user_r06', firstName: 'Marcus', lastName: 'Bell' },
  { id: 'demo_user_r07', firstName: 'Hannah', lastName: 'Novak' },
  { id: 'demo_user_r08', firstName: 'Omar', lastName: 'Haddad' },
  { id: 'demo_user_r09', firstName: 'Claire', lastName: 'Donovan' },
  { id: 'demo_user_r10', firstName: 'Victor', lastName: 'Ramos' },
  { id: 'demo_user_r11', firstName: 'Nina', lastName: 'Albright' },
].map((n) => ({ ...n, email: `${n.firstName}.${n.lastName}@demo.portalhoa.local`.toLowerCase() }));

const SECOND_BOARD = { id: 'demo_user_b02', firstName: 'Samuel', lastName: 'Ortega', email: 'samuel.ortega@demo.portalhoa.local' };

/** Every user the reset owns: the three logins, the neighbours, the second board member. */
export const DEMO_USER_IDS = [...DEMO_ACCOUNTS.map((a) => a.id), ...NEIGHBOURS.map((n) => n.id), SECOND_BOARD.id];

// Residents in a stable order. Index 0 is the demo login, so it gets the richest history.
const RESIDENTS = [
  { id: RESIDENT.id, firstName: RESIDENT.firstName, lastName: RESIDENT.lastName, email: RESIDENT.email },
  ...NEIGHBOURS,
];

const STREETS = ['Willow Creek Drive', 'Heron Lane', 'Juniper Court', 'Cattail Way'];

export type DemoResetResult = { residents: number; charges: number; payments: number };

export async function resetDemoCommunity(prisma: PrismaClient): Promise<DemoResetResult> {
  // Hash outside the transaction — it is the slowest step and holds no locks.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  return prisma.$transaction((tx) => rebuild(tx, passwordHash), { maxWait: 10_000, timeout: 120_000 });
}

async function rebuild(tx: Tx, passwordHash: string): Promise<DemoResetResult> {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * DAY);
  const daysAhead = (d: number) => new Date(now + d * DAY);
  const at = (d: Date, hours: number) => new Date(d.getTime() + hours * 60 * 60 * 1000);
  // A wall-clock time in the demo's (Pacific) timezone, `offset` days from today.
  // Fixed UTC-7: an hour off in winter is fine for sample events.
  const localAt = (offset: number, hour: number) => {
    const d = new Date(now);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset, hour + 7));
  };
  const monthStart = (offset: number) => {
    const d = new Date(now);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1, 12));
  };
  const monthName = (d: Date) => d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  // ── Community ────────────────────────────────────────────────────────────────
  await tx.community.upsert({
    where: { id: C },
    update: { name: DEMO_COMMUNITY_NAME, isDemo: true },
    create: { id: C, name: DEMO_COMMUNITY_NAME, isDemo: true },
  });

  // ── Wipe: community-scoped rows, children first ───────────────────────────────
  const inDemo = { where: { communityId: C } };
  const demoUsers = { where: { userId: { in: DEMO_USER_IDS } } };
  await tx.payment.deleteMany(inDemo); // allocations cascade
  await tx.charge.deleteMany(inDemo);
  await tx.autopayEnrollment.deleteMany(inDemo);
  await tx.duesRecord.deleteMany(inDemo);
  await tx.maintenanceRequest.deleteMany(inDemo); // attachments cascade
  await tx.violation.deleteMany(inDemo); // comments, activity, attachments, appeal cascade
  await tx.architecturalRequest.deleteMany(inDemo);
  await tx.issue.deleteMany(inDemo);
  await tx.document.deleteMany(inDemo);
  await tx.poll.deleteMany(inDemo); // options and votes cascade
  await tx.event.deleteMany(inDemo);
  await tx.announcement.deleteMany(inDemo); // reads cascade
  await tx.vendor.deleteMany(inDemo);
  await tx.property.deleteMany(inDemo);
  await tx.auditLog.deleteMany({ where: { OR: [{ communityId: C }, { userId: { in: DEMO_USER_IDS } }] } });
  await tx.pushToken.deleteMany(demoUsers);
  await tx.passwordResetToken.deleteMany(demoUsers);
  await tx.residentProfile.deleteMany(demoUsers);
  await tx.communityAssignment.deleteMany(demoUsers);

  // ── Users ───────────────────────────────────────────────────────────────────
  // Upsert restores anything a visitor changed (name, role) and the password.
  const upsertUser = (u: { id: string; firstName: string; lastName: string; email: string }, role: 'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN') => {
    const data = { firstName: u.firstName, lastName: u.lastName, email: u.email, role, passwordHash, communityId: role === 'RESIDENT' ? C : null, stripeCustomerId: null };
    return tx.user.upsert({ where: { id: u.id }, update: data, create: { id: u.id, ...data } });
  };
  for (const r of RESIDENTS) await upsertUser(r, 'RESIDENT');
  await upsertUser(BOARD, 'BOARD_MEMBER');
  await upsertUser(SECOND_BOARD, 'BOARD_MEMBER');
  await upsertUser(ADMIN, 'ADMIN');

  await tx.communityAssignment.createMany({
    data: [BOARD.id, SECOND_BOARD.id, ADMIN.id].map((userId) => ({ userId, communityId: C })),
  });

  await tx.residentProfile.createMany({
    data: RESIDENTS.map((r, i) => ({
      userId: r.id,
      phone: `555-01${String(20 + i).padStart(2, '0')}`,
      moveInDate: daysAgo(200 + i * 140),
    })),
  });

  // ── Properties ──────────────────────────────────────────────────────────────
  const propertyId = (i: number) => `demo_property_${i}`;
  await tx.property.createMany({
    data: RESIDENTS.map((r, i) => ({
      id: propertyId(i),
      streetAddress: `${120 + i * 8} ${STREETS[i % STREETS.length]}`,
      unitNumber: null,
      city: 'Cedar Falls',
      state: 'OR',
      zipCode: '97401',
      ownerId: r.id,
      communityId: C,
    })),
  });

  // ── Vendors ─────────────────────────────────────────────────────────────────
  await tx.vendor.createMany({
    data: [
      { id: 'demo_vendor_landscape', name: 'Evergreen Grounds Co.', contactName: 'Luis Ortega', email: 'service@evergreen.example', phone: '555-0140', category: 'Landscaping' },
      { id: 'demo_vendor_pool', name: 'Clearwater Pool Services', contactName: 'Dana Fitch', email: 'office@clearwater.example', phone: '555-0141', category: 'Pool' },
      { id: 'demo_vendor_electric', name: 'Bright Line Electric', contactName: 'Kofi Mensah', email: 'jobs@brightline.example', phone: '555-0142', category: 'Electrical' },
      { id: 'demo_vendor_gate', name: 'Sentinel Access Systems', contactName: 'Rachel Kim', email: 'support@sentinel.example', phone: '555-0143', category: 'Security' },
    ].map((v) => ({ ...v, communityId: C })),
  });

  // ── Announcements ───────────────────────────────────────────────────────────
  await tx.announcement.createMany({
    data: [
      {
        title: 'Welcome to Willow Creek on Portal HOA',
        body: 'Everything for the community now lives in one place: announcements, dues and payments, maintenance requests, architectural approvals, documents and votes. Have a look around. This is a demo community, so feel free to click anything; it resets every night.',
        priority: 'NORMAL' as const, audience: 'ALL_RESIDENTS' as const, isPinned: true, publishAt: daysAgo(21),
      },
      {
        title: 'Water main repair: Heron Lane, Thursday 9 AM to 1 PM',
        body: 'The city will shut off water to Heron Lane on Thursday from 9 AM to 1 PM to replace a valve. Other streets are not affected. Please store water ahead of time if you need it.',
        priority: 'EMERGENCY' as const, audience: 'SPECIFIC_LOCATION' as const, targetLocation: 'Heron Lane', isPinned: true, publishAt: daysAgo(1), expiresAt: daysAhead(4),
      },
      {
        title: 'Pool reopens for the season',
        body: 'Clearwater Pool Services finished the resurfacing ahead of schedule. The pool and spa are open daily from 7 AM to 9 PM. Please remember guests must be accompanied by a resident.',
        priority: 'NORMAL' as const, audience: 'ALL_RESIDENTS' as const, isPinned: false, publishAt: daysAgo(4),
      },
      {
        title: 'Reminder: annual meeting and board election',
        body: 'The annual members meeting is coming up. Two board seats are open this year. Candidate statements are in Documents, and voting is open in Polls until the meeting.',
        priority: 'IMPORTANT' as const, audience: 'ALL_RESIDENTS' as const, isPinned: false, publishAt: daysAgo(6), expiresAt: daysAhead(12),
      },
      {
        title: 'Parking: no overnight parking in guest spaces',
        body: 'Guest spaces by the clubhouse are for visitors only and may not be used between 11 PM and 6 AM. Vehicles left overnight may be towed under Rule 4.2.',
        priority: 'IMPORTANT' as const, audience: 'ALL_RESIDENTS' as const, isPinned: false, publishAt: daysAgo(10),
      },
      {
        title: 'Board only: reserve study draft is ready',
        body: 'The draft reserve study from Hartwell Consulting is in Documents under Financials. Please review the roofing and pool line items before the next work session.',
        priority: 'NORMAL' as const, audience: 'BOARD_MEMBERS' as const, isPinned: false, publishAt: daysAgo(3),
      },
    ].map((a) => ({ ...a, createdById: ADMIN.id, communityId: C })),
  });

  // ── Events ──────────────────────────────────────────────────────────────────
  await tx.event.createMany({
    data: [
      { title: 'Annual members meeting', description: 'Budget review, reserve study summary and the board election. Light dinner provided.', location: 'Clubhouse great room', startAt: localAt(12, 18), endAt: localAt(12, 20) },
      { title: 'Community garage sale', description: 'Set up in your driveway; we will advertise it across town. Sign up in the clubhouse.', location: 'Whole community', startAt: localAt(5, 8), endAt: localAt(5, 14) },
      { title: 'Pool party and potluck', description: 'Bring a dish to share. Lifeguard on duty until 7 PM.', location: 'Pool deck', startAt: localAt(19, 15), endAt: localAt(19, 19) },
      { title: 'Landscaping committee walk-through', description: 'Walk the common areas with Evergreen Grounds to plan the fall planting.', location: 'Meet at the front entrance', startAt: localAt(-8, 10), endAt: localAt(-8, 11) },
    ].map((e) => ({ ...e, createdById: ADMIN.id, communityId: C })),
  });

  // ── Polls ───────────────────────────────────────────────────────────────────
  await tx.poll.createMany({
    data: [
      { id: 'demo_poll_amenity', question: 'Which amenity should next year\'s budget prioritize?', description: 'Non-binding; the board will use the results when drafting the budget.', closesAt: daysAhead(10) },
      { id: 'demo_poll_meeting', question: 'Preferred time for board meetings?', description: null, closesAt: daysAgo(14) },
    ].map((p) => ({ ...p, createdById: BOARD.id, communityId: C })),
  });
  await tx.pollOption.createMany({
    data: [
      { id: 'demo_opt_gym', pollId: 'demo_poll_amenity', text: 'Upgrade the fitness room' },
      { id: 'demo_opt_play', pollId: 'demo_poll_amenity', text: 'New playground equipment' },
      { id: 'demo_opt_trail', pollId: 'demo_poll_amenity', text: 'Walking trail lighting' },
      { id: 'demo_opt_eve', pollId: 'demo_poll_meeting', text: 'Weekday evenings' },
      { id: 'demo_opt_sat', pollId: 'demo_poll_meeting', text: 'Saturday mornings' },
    ],
  });
  // The demo resident has not voted on the open poll, so a visitor can cast one.
  const amenityVotes = ['demo_opt_trail', 'demo_opt_gym', 'demo_opt_trail', 'demo_opt_play', 'demo_opt_trail', 'demo_opt_gym', 'demo_opt_trail'];
  const meetingVotes = ['demo_opt_eve', 'demo_opt_eve', 'demo_opt_sat', 'demo_opt_eve', 'demo_opt_sat', 'demo_opt_eve', 'demo_opt_eve', 'demo_opt_sat'];
  await tx.pollVote.createMany({
    data: [
      ...amenityVotes.map((optionId, i) => ({ pollId: 'demo_poll_amenity', optionId, userId: NEIGHBOURS[i].id })),
      ...meetingVotes.map((optionId, i) => ({ pollId: 'demo_poll_meeting', optionId, userId: RESIDENTS[i].id })),
    ],
  });

  // ── Documents ───────────────────────────────────────────────────────────────
  // External links only: the demo must not write to, or depend on, the S3 bucket.
  const DOCS = 'https://cdn.example.com/willow-creek';
  await tx.document.createMany({
    data: [
      { title: 'Declaration of CC&Rs', description: 'Covenants, conditions and restrictions for Willow Creek.', category: 'CC_AND_RS' as const, fileName: 'Willow-Creek-CCRs.pdf' },
      { title: 'Rules and regulations', description: 'Parking, pets, quiet hours, pool and clubhouse rules.', category: 'RULES_AND_REGS' as const, fileName: 'Rules-and-Regulations.pdf' },
      { title: 'Board meeting minutes, last month', description: 'Approved minutes including the pool resurfacing contract.', category: 'MEETING_MINUTES' as const, fileName: 'Board-Minutes.pdf' },
      { title: 'Current-year operating budget', description: 'Adopted budget with reserve contributions.', category: 'FINANCIALS' as const, fileName: 'Operating-Budget.pdf' },
      { title: 'Reserve study (draft)', description: 'Draft from Hartwell Consulting, for board review.', category: 'FINANCIALS' as const, fileName: 'Reserve-Study-Draft.pdf' },
      { title: 'Master insurance certificate', description: 'Certificate of insurance for lenders and escrow companies.', category: 'INSURANCE' as const, fileName: 'Insurance-Certificate.pdf' },
      { title: 'Architectural change request form', description: 'Use this when planning any exterior change.', category: 'COMMUNITY_FORMS' as const, fileName: 'Architectural-Request-Form.pdf' },
    ].map((d, i) => ({ ...d, fileUrl: `${DOCS}/${d.fileName}`, uploadedById: ADMIN.id, communityId: C, createdAt: daysAgo(40 - i * 5) })),
  });

  // ── Issues ──────────────────────────────────────────────────────────────────
  type IssueDef = {
    resident: number; category: 'LANDSCAPING' | 'MAINTENANCE' | 'PARKING' | 'SAFETY' | 'NOISE' | 'GATE_ACCESS' | 'TRASH' | 'OTHER';
    title: string; description: string; location: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_ON_VENDOR' | 'RESOLVED' | 'CLOSED';
    age: number; vendorId?: string; due?: number; reply?: string;
  };
  const issues: IssueDef[] = [
    { resident: 0, category: 'GATE_ACCESS', title: 'Back gate keypad not reading codes', description: 'The pedestrian gate by the trail rejects my code about half the time. Neighbors have mentioned the same thing.', location: 'Trail-side pedestrian gate', priority: 'MEDIUM', status: 'WAITING_ON_VENDOR', age: 6, vendorId: 'demo_vendor_gate', due: 4, reply: 'Sentinel has a replacement keypad on order and will install it this week. The gate stays unlocked during daylight hours until then.' },
    { resident: 0, category: 'LANDSCAPING', title: 'Dead tree branch over the sidewalk', description: 'A large dead branch is hanging over the sidewalk in front of the mailbox cluster.', location: 'Mailbox cluster, Willow Creek Drive', priority: 'HIGH', status: 'RESOLVED', age: 24, vendorId: 'demo_vendor_landscape', reply: 'Evergreen removed the branch and checked the rest of the tree. Thanks for flagging it.' },
    { resident: 2, category: 'SAFETY', title: 'Streetlight out at Juniper Court', description: 'The streetlight at the end of the cul-de-sac has been out for a week. It is very dark walking dogs at night.', location: 'Juniper Court cul-de-sac', priority: 'HIGH', status: 'IN_PROGRESS', age: 4, vendorId: 'demo_vendor_electric', due: 2 },
    { resident: 4, category: 'NOISE', title: 'Leaf blowers before 8 AM', description: 'A landscaping crew has been starting before 8 AM on weekdays.', location: 'Heron Lane', priority: 'LOW', status: 'UNDER_REVIEW', age: 2 },
    { resident: 6, category: 'TRASH', title: 'Overflowing bin at the dog park', description: 'The pet-waste bin is full by Saturday every week. Could we get a second one or more frequent pickup?', location: 'Dog park entrance', priority: 'MEDIUM', status: 'SUBMITTED', age: 1 },
    { resident: 8, category: 'PARKING', title: 'Car parked in guest space for two weeks', description: 'A silver sedan has not moved from guest space 3 in about two weeks.', location: 'Clubhouse guest parking', priority: 'LOW', status: 'CLOSED', age: 30, reply: 'The owner was contacted and the car has been moved.' },
  ];
  await tx.issue.createMany({
    data: issues.map((d, i) => ({
      id: `demo_issue_${i}`, residentId: RESIDENTS[d.resident].id, propertyId: propertyId(d.resident), vendorId: d.vendorId ?? null,
      assignedToId: d.status === 'SUBMITTED' ? null : ADMIN.id, category: d.category, title: d.title, description: d.description,
      location: d.location, priority: d.priority, status: d.status, preferredContactMethod: 'Email',
      dueDate: d.due === undefined ? null : daysAhead(d.due), communityId: C, createdAt: daysAgo(d.age), updatedAt: daysAgo(d.age),
    })),
  });
  await tx.issueActivity.createMany({
    data: issues.flatMap((d, i) => [
      { issueId: `demo_issue_${i}`, actorId: RESIDENTS[d.resident].id, action: 'created', details: 'Issue submitted', createdAt: daysAgo(d.age) },
      ...(d.status === 'SUBMITTED' ? [] : [{ issueId: `demo_issue_${i}`, actorId: ADMIN.id, action: 'status_changed', details: `Status updated to ${d.status.replace(/_/g, ' ').toLowerCase()}`, createdAt: at(daysAgo(d.age), 3) }]),
    ]),
  });
  await tx.issueComment.createMany({
    data: issues.flatMap((d, i) => (d.reply ? [{ issueId: `demo_issue_${i}`, authorId: ADMIN.id, body: d.reply, isInternal: false, createdAt: at(daysAgo(d.age), 26) }] : [])),
  });

  // ── Maintenance requests ────────────────────────────────────────────────────
  // requestNumber is left null on purpose: it is unique across ALL communities but
  // allocated per community (app/api/maintenance/route.ts), so seeded numbers here
  // would collide with a real community's first requests.
  await tx.maintenanceRequest.createMany({
    data: [
      { resident: 0, title: 'Irrigation leak by the side yard', description: 'Water pooling on the common strip next to my driveway whenever the sprinklers run.', status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const, category: 'IRRIGATION' as const, locationType: 'EXTERIOR' as const, residentUrgency: 'NORMAL' as const, propertyScope: 'HOA_COMMON' as const, age: 5 },
      { resident: 3, title: 'Clubhouse restroom faucet dripping', description: 'The left faucet in the women\'s restroom will not shut off fully.', status: 'OPEN' as const, priority: 'LOW' as const, category: 'PLUMBING' as const, locationType: 'COMMON_AREA' as const, residentUrgency: 'LOW' as const, propertyScope: 'HOA_COMMON' as const, age: 2 },
      { resident: 5, title: 'Fence panel down after the storm', description: 'A section of the perimeter fence behind my house blew down. The backyard is open to the trail.', status: 'SUBMITTED' as const, priority: 'HIGH' as const, category: 'FENCING' as const, locationType: 'EXTERIOR' as const, residentUrgency: 'HIGH' as const, propertyScope: 'SHARED' as const, age: 0 },
      { resident: 9, title: 'Pool gate not latching', description: 'The pool gate swings open instead of self-closing.', status: 'RESOLVED' as const, priority: 'URGENT' as const, category: 'POOL_SPA' as const, locationType: 'COMMON_AREA' as const, residentUrgency: 'EMERGENCY' as const, propertyScope: 'HOA_COMMON' as const, age: 15 },
    ].map(({ resident, age, ...m }) => ({
      ...m, requestNumber: null, preferredContactMethod: 'EMAIL' as const, propertyId: propertyId(resident),
      submittedById: RESIDENTS[resident].id, communityId: C, createdAt: daysAgo(age), updatedAt: daysAgo(age),
    })),
  });

  // ── Architectural requests ──────────────────────────────────────────────────
  type ArchDef = {
    resident: number; type: 'FENCE' | 'EXTERIOR_PAINT' | 'LANDSCAPING' | 'SOLAR' | 'ROOF' | 'SHED' | 'OTHER';
    status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'NEEDS_MORE_INFORMATION' | 'APPROVED' | 'DENIED' | 'WITHDRAWN';
    description: string; age: number; start?: number; rule?: string; decision?: string; comment?: string;
  };
  const arch: ArchDef[] = [
    { resident: 0, type: 'SOLAR', status: 'UNDER_REVIEW', age: 9, start: 30, description: 'Install 14 flush-mounted solar panels on the rear, south-facing roof slope. Black frames, no visible conduit on the front elevation.', rule: 'CC&Rs 7.3: Solar energy systems', comment: 'The committee will review this at the next meeting. Please confirm the panels will not be visible from the street.' },
    { resident: 0, type: 'EXTERIOR_PAINT', status: 'APPROVED', age: 60, description: 'Repaint body in Sherwin-Williams Repose Gray with Snowbound trim, both on the approved palette.', rule: 'Rules 3.1: Approved exterior colors', decision: 'Approved. Both colors are on the current palette.' },
    { resident: 1, type: 'FENCE', status: 'NEEDS_MORE_INFORMATION', age: 12, start: 21, description: 'Replace the side-yard fence with a 6 ft cedar privacy fence.', comment: 'Please attach a site plan showing where the fence meets the neighboring lot.' },
    { resident: 3, type: 'SHED', status: 'DENIED', age: 40, description: '10x14 storage shed in the back corner of the yard.', rule: 'CC&Rs 8.4: Accessory structures (max 100 sq ft)', decision: 'Denied: 140 sq ft exceeds the 100 sq ft limit. A smaller shed would likely be approved.' },
    { resident: 7, type: 'LANDSCAPING', status: 'SUBMITTED', age: 3, start: 14, description: 'Replace front lawn with drought-tolerant native plants and a gravel path.' },
  ];
  await tx.architecturalRequest.createMany({
    data: arch.map((d, i) => ({
      id: `demo_arch_${i}`, residentId: RESIDENTS[d.resident].id, propertyId: propertyId(d.resident), requestType: d.type,
      description: d.description, desiredStartDate: d.start === undefined ? null : daysAhead(d.start), status: d.status,
      governingRuleReference: d.rule ?? null, decisionReason: d.decision ?? null, communityId: C,
      createdAt: daysAgo(d.age), updatedAt: daysAgo(d.age),
    })),
  });
  await tx.architecturalRequestActivity.createMany({
    data: arch.flatMap((d, i) => [
      { requestId: `demo_arch_${i}`, actorId: RESIDENTS[d.resident].id, action: 'created', details: 'Request submitted for review', createdAt: daysAgo(d.age) },
      ...(d.status === 'SUBMITTED' ? [] : [{ requestId: `demo_arch_${i}`, actorId: BOARD.id, action: 'status_changed', details: `Status changed to ${d.status.replace(/_/g, ' ').toLowerCase()}`, createdAt: at(daysAgo(d.age), 48) }]),
    ]),
  });
  await tx.architecturalRequestComment.createMany({
    data: arch.flatMap((d, i) => (d.comment ? [{ requestId: `demo_arch_${i}`, authorId: BOARD.id, body: d.comment, isInternal: false, createdAt: at(daysAgo(d.age), 50) }] : [])),
  });

  // ── Violations ──────────────────────────────────────────────────────────────
  type ViolationDef = {
    resident: number; type: 'LANDSCAPING_MAINTENANCE' | 'PARKING' | 'NOISE' | 'PROPERTY_APPEARANCE' | 'UNAUTHORIZED_MODIFICATION' | 'PET_VIOLATION' | 'TRASH_AND_DEBRIS' | 'OTHER';
    status: 'DRAFT' | 'NOTICE_SENT' | 'RESIDENT_RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
    rule: string; description: string; steps: string; age: number; deadline?: number; response?: string;
    appeal?: { reason: string; status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED'; outcome?: string };
  };
  const violations: ViolationDef[] = [
    { resident: 0, type: 'TRASH_AND_DEBRIS', status: 'NOTICE_SENT', age: 3, deadline: 7, rule: 'Rules 5.2: Trash containers', description: 'Trash and recycling bins were left at the curb for several days after pickup.', steps: 'Store bins out of view from the street except on collection days.' },
    { resident: 2, type: 'PARKING', status: 'RESIDENT_RESPONDED', age: 9, deadline: 5, rule: 'Rules 4.2: Guest parking', description: 'A boat trailer has been parked in a guest space for over 72 hours.', steps: 'Move the trailer to approved storage.', response: 'Sorry about that, the storage lot had no space. It will be moved this weekend.' },
    { resident: 4, type: 'LANDSCAPING_MAINTENANCE', status: 'UNDER_REVIEW', age: 18, deadline: -2, rule: 'CC&Rs 6.1: Landscape maintenance', description: 'Front lawn is overgrown and weeds are spreading into the common strip.', steps: 'Mow, edge and remove weeds.', appeal: { reason: 'I was out of the country for a family emergency and a lawn service has now been booked. Please waive the fine.', status: 'UNDER_REVIEW' } },
    { resident: 6, type: 'NOISE', status: 'RESOLVED', age: 35, rule: 'Rules 2.4: Quiet hours', description: 'Amplified music past 11 PM on a weeknight, reported by two neighbors.', steps: 'Observe quiet hours from 10 PM to 7 AM.', response: 'Understood, it will not happen again.' },
    { resident: 10, type: 'UNAUTHORIZED_MODIFICATION', status: 'DRAFT', age: 1, deadline: 30, rule: 'CC&Rs 7.1: Architectural approval required', description: 'A pergola was built in the backyard without an architectural request.', steps: 'Submit an architectural request within 30 days or remove the structure.' },
  ];
  await tx.violation.createMany({
    data: violations.map((d, i) => ({
      id: `demo_violation_${i}`, residentId: RESIDENTS[d.resident].id, propertyId: propertyId(d.resident), createdById: ADMIN.id,
      violationType: d.type, ruleCitation: d.rule, description: d.description, resolutionSteps: d.steps,
      observedAt: daysAgo(d.age), deadline: d.deadline === undefined ? null : daysAhead(d.deadline), status: d.status,
      communityId: C, createdAt: daysAgo(d.age), updatedAt: daysAgo(d.age),
    })),
  });
  await tx.violationActivity.createMany({
    data: violations.flatMap((d, i) => [
      { violationId: `demo_violation_${i}`, actorId: ADMIN.id, action: 'created', details: d.status === 'DRAFT' ? 'Draft created' : 'Violation recorded', createdAt: daysAgo(d.age) },
      ...(d.status === 'DRAFT' ? [] : [{ violationId: `demo_violation_${i}`, actorId: ADMIN.id, action: 'notice_sent', details: 'Notice sent to resident', createdAt: at(daysAgo(d.age), 1) }]),
      ...(d.response ? [{ violationId: `demo_violation_${i}`, actorId: RESIDENTS[d.resident].id, action: 'resident_responded', details: 'Resident submitted a written response', createdAt: at(daysAgo(d.age), 30) }] : []),
    ]),
  });
  await tx.violationComment.createMany({
    data: violations.flatMap((d, i) => (d.response ? [{ violationId: `demo_violation_${i}`, authorId: RESIDENTS[d.resident].id, body: d.response, isInternal: false, createdAt: at(daysAgo(d.age), 30) }] : [])),
  });
  await tx.violationAppeal.createMany({
    data: violations.flatMap((d, i) => (d.appeal ? [{
      violationId: `demo_violation_${i}`, submittedById: RESIDENTS[d.resident].id, reason: d.appeal.reason, status: d.appeal.status,
      outcome: d.appeal.outcome ?? null, createdAt: at(daysAgo(d.age), 72),
    }] : [])),
  });

  // ── Charges, payments and allocations ───────────────────────────────────────
  // Monthly dues for the last two months, this month and next. Every PAID charge
  // has a payment and an allocation, so Charge.amountPaid equals the sum of its
  // allocations — the invariant lib/payments relies on.
  const DUES = 27500;
  const methods = ['Credit Card', 'Bank Transfer', 'Check'];
  const charges: Prisma.ChargeCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const allocations: Prisma.PaymentAllocationCreateManyInput[] = [];
  let seq = 0;

  const addCharge = (resident: number, description: string, amount: number, dueDate: Date, paid: number, paidAt?: Date) => {
    const chargeId = `demo_charge_${seq++}`;
    const status = paid >= amount ? 'PAID' : dueDate.getTime() < now ? 'OVERDUE' : 'PENDING';
    charges.push({ id: chargeId, residentId: RESIDENTS[resident].id, propertyId: propertyId(resident), communityId: C, description, amount, amountPaid: paid, dueDate, status, createdAt: new Date(dueDate.getTime() - 20 * DAY) });
    if (paid > 0) {
      const paymentId = `demo_payment_${seq}`;
      payments.push({
        id: paymentId, residentId: RESIDENTS[resident].id, propertyId: propertyId(resident), communityId: C, amount: paid,
        paymentMethod: methods[(resident + seq) % methods.length], status: 'PAID', paidAt: paidAt ?? new Date(dueDate.getTime() - 3 * DAY),
        confirmationNumber: `DEMO-${String(seq).padStart(6, '0')}`,
      });
      allocations.push({ paymentId, chargeId, amount: paid });
    }
  };

  RESIDENTS.forEach((_, r) => {
    for (const offset of [-2, -1, 0, 1]) {
      const due = monthStart(offset);
      const label = `${monthName(due)} HOA dues`;
      let paid = offset <= 0 ? DUES : 0;
      if (r === 8 && offset === 0) paid = 0; // one month behind
      if (r === 9 && offset >= -1 && offset <= 0) paid = 0; // two months behind
      if (r === 7 && offset === 0) paid = 10000; // partial payment
      addCharge(r, label, DUES, due, paid);
    }
    // Pool resurfacing special assessment, some paid early. Together with next
    // month's dues this gives the demo login an open balance to look at.
    addCharge(r, 'Special assessment: pool resurfacing', 15000, daysAhead(20), r >= 1 && r <= 4 ? 15000 : 0, daysAgo(r + 2));
  });
  addCharge(9, 'Late fee', 2500, new Date(monthStart(-1).getTime() + 15 * DAY), 0);

  await tx.charge.createMany({ data: charges });
  await tx.payment.createMany({ data: payments });
  await tx.paymentAllocation.createMany({ data: allocations });

  return { residents: RESIDENTS.length, charges: charges.length, payments: payments.length };
}
