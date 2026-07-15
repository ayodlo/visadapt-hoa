import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

const residents = [
  { firstName: 'James', lastName: 'Carter', email: 'james.carter@example.com' },
  { firstName: 'Maria', lastName: 'Gonzalez', email: 'maria.gonzalez@example.com' },
  { firstName: 'David', lastName: 'Kim', email: 'david.kim@example.com' },
  { firstName: 'Sarah', lastName: 'Patel', email: 'sarah.patel@example.com' },
  { firstName: 'Michael', lastName: 'Thompson', email: 'michael.thompson@example.com' },
  { firstName: 'Emily', lastName: 'Robinson', email: 'emily.robinson@example.com' },
  { firstName: 'Robert', lastName: 'Davis', email: 'robert.davis@example.com' },
  { firstName: 'Jennifer', lastName: 'Wilson', email: 'jennifer.wilson@example.com' },
  { firstName: 'Christopher', lastName: 'Martinez', email: 'chris.martinez@example.com' },
  { firstName: 'Jessica', lastName: 'Anderson', email: 'jessica.anderson@example.com' },
  { firstName: 'Matthew', lastName: 'Taylor', email: 'matt.taylor@example.com' },
  { firstName: 'Ashley', lastName: 'Thomas', email: 'ashley.thomas@example.com' },
  { firstName: 'Daniel', lastName: 'Jackson', email: 'daniel.jackson@example.com' },
  { firstName: 'Amanda', lastName: 'White', email: 'amanda.white@example.com' },
  { firstName: 'Joshua', lastName: 'Harris', email: 'joshua.harris@example.com' },
  { firstName: 'Stephanie', lastName: 'Moore', email: 'stephanie.moore@example.com' },
  { firstName: 'Andrew', lastName: 'Lewis', email: 'andrew.lewis@example.com' },
  { firstName: 'Melissa', lastName: 'Clark', email: 'melissa.clark@example.com' },
  { firstName: 'Ryan', lastName: 'Walker', email: 'ryan.walker@example.com' },
  { firstName: 'Demo', lastName: 'Resident', email: 'resident@communityhq.local' },
];

const admins = [
  { firstName: 'Admin', lastName: 'User', email: 'admin@communityhq.local' },
  { firstName: 'Sandra', lastName: 'Brooks', email: 'sandra.brooks@communityhq.local' },
];

const boardMembers = [
  { firstName: 'Board', lastName: 'Member', email: 'board@communityhq.local' },
  { firstName: 'Thomas', lastName: 'Reed', email: 'thomas.reed@communityhq.local' },
  { firstName: 'Patricia', lastName: 'Hall', email: 'patricia.hall@communityhq.local' },
];

const vendors = [
  {
    name: 'Green Valley Landscaping',
    contactName: 'Kevin Green',
    email: 'kevin@greenvalley.com',
    phone: '555-101-0001',
    category: 'Landscaping',
  },
  {
    name: 'ProFix Plumbing',
    contactName: 'Alice Nguyen',
    email: 'alice@profix.com',
    phone: '555-101-0002',
    category: 'Plumbing',
  },
  {
    name: 'BrightSpark Electric',
    contactName: 'Carlos Rivera',
    email: 'carlos@brightspark.com',
    phone: '555-101-0003',
    category: 'Electrical',
  },
  {
    name: 'CleanPro Services',
    contactName: 'Helen Park',
    email: 'helen@cleanpro.com',
    phone: '555-101-0004',
    category: 'Cleaning',
  },
  {
    name: 'Apex Security Solutions',
    contactName: 'Marcus Webb',
    email: 'marcus@apexsec.com',
    phone: '555-101-0005',
    category: 'Security',
  },
];

const properties = [
  { streetAddress: '100 Maple Drive', unitNumber: null, city: 'Springfield', state: 'IL', zipCode: '62701' },
  { streetAddress: '200 Oak Avenue', unitNumber: 'Apt 2B', city: 'Springfield', state: 'IL', zipCode: '62701' },
  { streetAddress: '300 Pine Street', unitNumber: null, city: 'Springfield', state: 'IL', zipCode: '62702' },
  { streetAddress: '400 Elm Court', unitNumber: 'Unit 1', city: 'Springfield', state: 'IL', zipCode: '62702' },
  { streetAddress: '500 Cedar Lane', unitNumber: null, city: 'Springfield', state: 'IL', zipCode: '62703' },
  { streetAddress: '600 Birch Boulevard', unitNumber: 'Suite A', city: 'Springfield', state: 'IL', zipCode: '62703' },
  { streetAddress: '700 Willow Way', unitNumber: null, city: 'Springfield', state: 'IL', zipCode: '62704' },
  { streetAddress: '800 Spruce Circle', unitNumber: 'Apt 5C', city: 'Springfield', state: 'IL', zipCode: '62704' },
  { streetAddress: '900 Poplar Place', unitNumber: null, city: 'Springfield', state: 'IL', zipCode: '62705' },
  { streetAddress: '1000 Aspen Road', unitNumber: 'Unit 3', city: 'Springfield', state: 'IL', zipCode: '62705' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  console.log('Seeding community…');
  const community = await prisma.community.upsert({
    where: { id: 'community_default_seed' },
    update: {},
    create: { id: 'community_default_seed', name: 'CommunityHQ Demo' },
  });
  const communityId = community.id;

  console.log('Seeding residents…');
  const createdResidents = await Promise.all(
    residents.map((r) =>
      prisma.user.upsert({
        where: { email: r.email },
        update: {},
        create: { ...r, passwordHash, role: 'RESIDENT', communityId },
      })
    )
  );

  console.log('Seeding admins…');
  const createdAdmins = await Promise.all(
    admins.map((a) =>
      prisma.user.upsert({
        where: { email: a.email },
        update: {},
        create: { ...a, passwordHash, role: 'ADMIN' },
      })
    )
  );

  console.log('Seeding board members…');
  const createdBoardMembers = await Promise.all(
    boardMembers.map((b) =>
      prisma.user.upsert({
        where: { email: b.email },
        update: {},
        create: { ...b, passwordHash, role: 'BOARD_MEMBER' },
      })
    )
  );

  console.log('Assigning admins and board members to the community…');
  // ADMIN/BOARD_MEMBER get multi-community access via CommunityAssignment,
  // not the fixed User.communityId (that's RESIDENT-only) — see prisma/schema.prisma.
  await Promise.all(
    [...createdAdmins, ...createdBoardMembers].map((u) =>
      prisma.communityAssignment.upsert({
        where: { userId_communityId: { userId: u.id, communityId } },
        update: {},
        create: { userId: u.id, communityId },
      })
    )
  );

  console.log('Seeding vendors…');
  await Promise.all(
    vendors.map((v) =>
      prisma.vendor.upsert({
        where: { id: v.email },
        update: {},
        create: { ...v, communityId },
      }).catch(() =>
        prisma.vendor.create({ data: { ...v, communityId } })
      )
    )
  );

  console.log('Seeding properties…');
  const propertyOwners = [
    ...createdResidents.slice(0, 10),
  ];
  await Promise.all(
    properties.map((p, i) =>
      prisma.property.create({
        data: { ...p, ownerId: propertyOwners[i % propertyOwners.length].id, communityId },
      })
    )
  );

  console.log('Seeding resident profiles…');
  await Promise.all(
    createdResidents.map((r) =>
      prisma.residentProfile.upsert({
        where: { userId: r.id },
        update: {},
        create: { userId: r.id },
      })
    )
  );

  console.log('Seeding sample announcements…');
  const [firstAdmin] = createdAdmins;
  await prisma.announcement.deleteMany({});

  const now2 = new Date();
  function daysFromNow(d: number) { return new Date(now2.getTime() + d * 86400000); }
  function daysAgoFn(d: number) { return new Date(now2.getTime() - d * 86400000); }

  const announcementDefs: {
    title: string;
    body: string;
    priority: 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';
    audience: 'ALL_RESIDENTS' | 'BOARD_MEMBERS' | 'SPECIFIC_LOCATION';
    targetLocation?: string;
    isPinned: boolean;
    publishAt: Date;
    expiresAt?: Date;
    createdById: string;
  }[] = [
      {
        title: 'Welcome to CommunityHQ!',
        body: 'We are thrilled to launch CommunityHQ — your new all-in-one community management platform. Use it to stay informed about announcements, submit maintenance issues, track your HOA payments, and connect with your neighbors. If you have feedback or questions, please reach out to the management office.',
        priority: 'NORMAL',
        audience: 'ALL_RESIDENTS',
        isPinned: true,
        publishAt: daysAgoFn(30),
        createdById: firstAdmin.id,
      },
      {
        title: '⚠️ Emergency Water Shutoff — Wednesday 8 AM to 2 PM',
        body: 'The city water department has notified us of a mandatory water shutoff affecting the entire property this Wednesday from 8:00 AM to 2:00 PM for emergency main line repair. Please store water in advance. We apologize for the inconvenience and will update you when service is restored.',
        priority: 'EMERGENCY',
        audience: 'ALL_RESIDENTS',
        isPinned: true,
        publishAt: daysAgoFn(2),
        expiresAt: daysFromNow(3),
        createdById: firstAdmin.id,
      },
      {
        title: 'Board Meeting — July 15 at 7 PM',
        body: 'The quarterly board of directors meeting will be held on Tuesday, July 15th at 7:00 PM in the Community Room (Building A, Suite 100). All residents are welcome to attend. The agenda includes: Q2 financial review, reserve fund update, landscaping contract renewal, and open forum. Agenda packets will be posted to the Documents section 48 hours before the meeting.',
        priority: 'IMPORTANT',
        audience: 'ALL_RESIDENTS',
        isPinned: false,
        publishAt: daysAgoFn(5),
        expiresAt: daysFromNow(14),
        createdById: firstAdmin.id,
      },
      {
        title: 'Trash & Recycling Schedule Change — July Holiday Week',
        body: 'Due to the Independence Day holiday, trash and recycling pickup will be delayed by one day during the week of July 4th. Your normal Monday pickup will occur on Tuesday, July 5th. All other days shift by one day as well. Please do not place bins at the curb until the evening before your rescheduled pickup day.',
        priority: 'IMPORTANT',
        audience: 'ALL_RESIDENTS',
        isPinned: false,
        publishAt: daysAgoFn(8),
        expiresAt: daysFromNow(7),
        createdById: firstAdmin.id,
      },
      {
        title: 'Pool Closure — Scheduled Maintenance June 28–29',
        body: 'The community pool and spa will be closed Saturday, June 28th and Sunday, June 29th for annual mechanical servicing and chemical treatment. The pool deck and restrooms will also be pressure-washed during this time. We expect to reopen Monday morning by 8 AM. Thank you for your patience.',
        priority: 'NORMAL',
        audience: 'ALL_RESIDENTS',
        isPinned: false,
        publishAt: daysAgoFn(10),
        expiresAt: daysFromNow(2),
        createdById: firstAdmin.id,
      },
      {
        title: 'Landscaping Upgrade — South Courtyard Starting July 7',
        body: 'We are excited to announce a major landscaping upgrade to the south courtyard beginning Monday, July 7th. Green Valley Landscaping will be removing the aging shrubs along the south fence and replacing them with drought-tolerant native plants. Work is expected to take approximately 10 days. Please expect some noise and temporary fencing in that area during work hours (7 AM – 5 PM weekdays).',
        priority: 'NORMAL',
        audience: 'ALL_RESIDENTS',
        isPinned: false,
        publishAt: daysAgoFn(3),
        expiresAt: daysFromNow(20),
        createdById: firstAdmin.id,
      },
      {
        title: 'Parking Reminder — No Overnight Parking in Visitor Spots',
        body: 'We have received multiple complaints about vehicles left overnight in visitor parking spaces. As a reminder, visitor parking spots are intended for guests only and may not be used overnight (11 PM – 7 AM). Resident vehicles parked in visitor spots overnight are subject to towing at the owner\'s expense per Section 5.3 of the Community Rules. If you need a temporary parking waiver, please contact the management office.',
        priority: 'IMPORTANT',
        audience: 'ALL_RESIDENTS',
        isPinned: false,
        publishAt: daysAgoFn(15),
        createdById: firstAdmin.id,
      },
      {
        title: 'Summer Block Party — Saturday July 19',
        body: 'Get ready for our annual Summer Block Party! Join your neighbors on Saturday, July 19th from 3:00 PM to 7:00 PM in the main courtyard. There will be a BBQ, games, live music, and activities for kids. Food and non-alcoholic beverages will be provided. Residents are encouraged to bring a side dish to share. RSVP by July 14th by replying to this announcement or contacting the management office.',
        priority: 'NORMAL',
        audience: 'ALL_RESIDENTS',
        isPinned: false,
        publishAt: daysAgoFn(6),
        expiresAt: daysFromNow(18),
        createdById: firstAdmin.id,
      },
      {
        title: 'Gate Access System Upgrade — Brief Outage July 10',
        body: 'Apex Security Solutions will be upgrading the gate access control software on Thursday, July 10th between 10 PM and midnight. During this window, the main vehicle gate will default to the open position and security personnel will be on-site. Pedestrian gates will remain fully operational. After the upgrade, all existing keyfobs and codes will continue to work without any changes required on your part.',
        priority: 'NORMAL',
        audience: 'ALL_RESIDENTS',
        isPinned: false,
        publishAt: daysAgoFn(1),
        expiresAt: daysFromNow(10),
        createdById: firstAdmin.id,
      },
      {
        title: 'Board Financial Summary — Q2 2026',
        body: 'The Q2 2026 financial summary is now available in the Documents section. Highlights: Operating fund balance is healthy at $142,500. Reserve fund is at 87% of target. HOA dues collection rate is 96% for the quarter. Two capital improvement projects (south courtyard landscaping and fitness center equipment) are on budget. Full report with line-item detail and reserve study update is attached.',
        priority: 'NORMAL',
        audience: 'BOARD_MEMBERS',
        isPinned: false,
        publishAt: daysAgoFn(4),
        createdById: firstAdmin.id,
      },
      {
        title: 'Building A — Hallway Painting This Week',
        body: 'Hallways on floors 2 and 3 of Building A will be repainted Tuesday through Thursday this week (July 1–3). Painters will work between 9 AM and 4 PM. Please expect a mild paint smell and temporary plastic sheeting on the floors. Move-in/move-out activities should be avoided on those floors during painting hours. Thank you for your cooperation.',
        priority: 'NORMAL',
        audience: 'SPECIFIC_LOCATION',
        targetLocation: 'Building A',
        isPinned: false,
        publishAt: daysAgoFn(2),
        expiresAt: daysFromNow(4),
        createdById: firstAdmin.id,
      },
      {
        title: 'Elevator Inspection — Building D — July 8',
        body: 'The elevator in Building D is scheduled for its annual state safety inspection on Tuesday, July 8th. The elevator will be out of service from approximately 9 AM to 12 PM. Residents should plan to use the stairs during this period. We apologize for the inconvenience. The elevator will be returned to service as soon as the inspection is complete.',
        priority: 'NORMAL',
        audience: 'SPECIFIC_LOCATION',
        targetLocation: 'Building D',
        isPinned: false,
        publishAt: daysFromNow(5),
        expiresAt: daysFromNow(9),
        createdById: firstAdmin.id,
      },
  ];

  await prisma.announcement.createMany({
    data: announcementDefs.map((a) => ({ ...a, communityId })),
  });

  console.log('Seeding charges and payments…');
  await prisma.payment.deleteMany({});
  await prisma.charge.deleteMany({});
  const HOA_DUES = 25000; // $250.00 in cents
  const now = new Date();

  // Months: March, April, May (always PAID), June (mixed), July (always PENDING upcoming)
  const months = [
    { label: 'March 2026 HOA Dues',    due: new Date('2026-03-01'), status: 'PAID' as const },
    { label: 'April 2026 HOA Dues',    due: new Date('2026-04-01'), status: 'PAID' as const },
    { label: 'May 2026 HOA Dues',      due: new Date('2026-05-01'), status: 'PAID' as const },
    { label: 'July 2026 HOA Dues',     due: new Date('2026-07-01'), status: 'PENDING' as const },
  ];

  // Special seed helpers
  const specialCharges: { idx: number; description: string; amount: number; dueDate: Date; status: 'PAID' | 'OVERDUE' | 'PENDING' }[] = [
    { idx: 0,  description: 'Capital Improvement Assessment', amount: 50000, dueDate: new Date('2026-04-15'), status: 'PAID' },
    { idx: 5,  description: 'Capital Improvement Assessment', amount: 50000, dueDate: new Date('2026-04-15'), status: 'PAID' },
    { idx: 10, description: 'Capital Improvement Assessment', amount: 50000, dueDate: new Date('2026-04-15'), status: 'PAID' },
    { idx: 15, description: 'Late Payment Fee',              amount:  5000, dueDate: new Date('2026-05-15'), status: 'OVERDUE' },
    { idx: 16, description: 'Late Payment Fee',              amount:  5000, dueDate: new Date('2026-05-15'), status: 'OVERDUE' },
    { idx: 19, description: 'Special Assessment — Roof Repair', amount: 75000, dueDate: new Date('2026-06-01'), status: 'PENDING' },
  ];

  let confCounter = 1000;
  function nextConf() { return `CHQ-2026-${String(confCounter++).padStart(6, '0')}`; }

  for (let i = 0; i < createdResidents.length; i++) {
    const resident = createdResidents[i];
    // June status varies by index
    const juneStatus: 'PAID' | 'OVERDUE' | 'PENDING' =
      i < 15 ? 'PAID' : i < 18 ? 'OVERDUE' : 'PENDING';

    await prisma.charge.create({
      data: {
        residentId: resident.id,
        description: 'June 2026 HOA Dues',
        amount: HOA_DUES,
        dueDate: new Date('2026-06-01'),
        status: juneStatus,
        communityId,
      },
    });

    // Monthly charges
    for (const month of months) {
      await prisma.charge.create({
        data: {
          residentId: resident.id,
          description: month.label,
          amount: HOA_DUES,
          dueDate: month.due,
          status: month.status,
          communityId,
        },
      });
    }

    // Special charges for certain residents
    const special = specialCharges.find((s) => s.idx === i);
    if (special) {
      await prisma.charge.create({
        data: {
          residentId: resident.id,
          description: special.description,
          amount: special.amount,
          dueDate: special.dueDate,
          status: special.status,
          communityId,
        },
      });
    }

    // Create payments for each PAID charge (regular months + June if paid + special if paid)
    const paidMonths = [...months.filter((m) => m.status === 'PAID')];
    if (juneStatus === 'PAID') paidMonths.push({ label: 'June 2026 HOA Dues', due: new Date('2026-06-01'), status: 'PAID' });

    for (const month of paidMonths) {
      await prisma.payment.create({
        data: {
          residentId: resident.id,
          amount: HOA_DUES,
          paymentMethod: i % 3 === 0 ? 'Bank Transfer' : i % 3 === 1 ? 'Credit Card' : 'Check',
          status: 'PAID',
          paidAt: new Date(month.due.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before due
          confirmationNumber: nextConf(),
          communityId,
        },
      });
    }

    // Payment for special assessment if paid
    if (special?.status === 'PAID') {
      await prisma.payment.create({
        data: {
          residentId: resident.id,
          amount: special.amount,
          paymentMethod: 'Bank Transfer',
          status: 'PAID',
          paidAt: new Date(special.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          confirmationNumber: nextConf(),
          communityId,
        },
      });
    }
  }

  void now; // suppress unused warning

  console.log('Seeding sample documents…');
  const PLACEHOLDER_BASE = 'https://cdn.example.com/hoa-docs';
  const documentDefs: {
    title: string;
    description: string;
    category: 'CC_AND_RS' | 'RULES_AND_REGS' | 'MEETING_MINUTES' | 'FINANCIALS' | 'INSURANCE' | 'COMMUNITY_FORMS' | 'MAINTENANCE' | 'OTHER';
    fileUrl: string;
    fileName: string;
    uploadedById: string;
  }[] = [
      {
        title: 'Declaration of CC&Rs (2024 Restatement)',
        description: 'The governing document establishing the covenants, conditions, and restrictions for the community. All residents are required to comply with these rules.',
        category: 'CC_AND_RS',
        fileUrl: `${PLACEHOLDER_BASE}/cc-rs-2024.pdf`,
        fileName: 'CC-Rs-2024-Restatement.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Community Rules and Regulations — Revised 2024',
        description: 'Detailed community rules covering noise, parking, common area use, landscaping standards, and enforcement procedures.',
        category: 'RULES_AND_REGS',
        fileUrl: `${PLACEHOLDER_BASE}/rules-regulations-2024.pdf`,
        fileName: 'Rules-and-Regulations-2024.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Pet Policy',
        description: 'Community pet policy including approved animals, leash requirements, waste disposal rules, and nuisance pet procedures.',
        category: 'RULES_AND_REGS',
        fileUrl: `${PLACEHOLDER_BASE}/pet-policy.pdf`,
        fileName: 'Pet-Policy.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Board Meeting Minutes — January 2026',
        description: 'Official minutes from the January 15, 2026 board of directors meeting. Topics: budget review, maintenance approvals, and architectural request decisions.',
        category: 'MEETING_MINUTES',
        fileUrl: `${PLACEHOLDER_BASE}/minutes-jan-2026.pdf`,
        fileName: 'Board-Meeting-Minutes-Jan-2026.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Annual Members Meeting Minutes — December 2025',
        description: 'Minutes from the annual homeowners meeting held December 10, 2025. Includes election results, financial report summary, and open discussion items.',
        category: 'MEETING_MINUTES',
        fileUrl: `${PLACEHOLDER_BASE}/annual-meeting-dec-2025.pdf`,
        fileName: 'Annual-Meeting-Minutes-Dec-2025.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: '2025 Annual Financial Report',
        description: 'Audited financial statements for fiscal year 2025, including income statement, balance sheet, and notes from the CPA firm.',
        category: 'FINANCIALS',
        fileUrl: `${PLACEHOLDER_BASE}/financial-report-2025.pdf`,
        fileName: 'Annual-Financial-Report-2025.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: '2026 Adopted Annual Budget',
        description: 'Board-approved operating and reserve budget for calendar year 2026. Includes line-item detail and reserve fund contribution schedule.',
        category: 'FINANCIALS',
        fileUrl: `${PLACEHOLDER_BASE}/budget-2026.pdf`,
        fileName: 'Budget-2026-Adopted.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Master Property Insurance Policy Summary 2026',
        description: 'Summary of the community master insurance policy covering common areas, general liability, and directors & officers coverage. Policy #HOA-2026-8821.',
        category: 'INSURANCE',
        fileUrl: `${PLACEHOLDER_BASE}/insurance-summary-2026.pdf`,
        fileName: 'Insurance-Policy-Summary-2026.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Architectural Change Request Form',
        description: 'Required form for submitting any exterior modification, addition, or improvement to your property. Allow 30 days for board review.',
        category: 'COMMUNITY_FORMS',
        fileUrl: `${PLACEHOLDER_BASE}/arch-change-request.pdf`,
        fileName: 'Architectural-Change-Request-Form.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Move-In / Move-Out Notification Form',
        description: 'Residents must submit this form at least 48 hours before a scheduled move. Includes elevator reservation and common area usage agreement.',
        category: 'COMMUNITY_FORMS',
        fileUrl: `${PLACEHOLDER_BASE}/move-in-out-form.pdf`,
        fileName: 'Move-In-Out-Notification-Form.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Pool & Amenity Maintenance Schedule 2026',
        description: 'Annual schedule for pool chemical treatments, equipment inspections, and seasonal closures. Posted for resident awareness.',
        category: 'MAINTENANCE',
        fileUrl: `${PLACEHOLDER_BASE}/maintenance-schedule-2026.pdf`,
        fileName: 'Pool-Maintenance-Schedule-2026.pdf',
        uploadedById: firstAdmin.id,
      },
      {
        title: 'Community Emergency Contact Directory',
        description: 'List of key contacts including property management, emergency maintenance, local fire and police non-emergency lines, and board member contacts.',
        category: 'OTHER',
        fileUrl: `${PLACEHOLDER_BASE}/emergency-contacts.pdf`,
        fileName: 'Emergency-Contact-Directory.pdf',
        uploadedById: firstAdmin.id,
      },
  ];

  await prisma.document.createMany({
    skipDuplicates: false,
    data: documentDefs.map((d) => ({ ...d, communityId })),
  });

  console.log('Seeding issues…');
  await prisma.issueActivity.deleteMany({});
  await prisma.issueComment.deleteMany({});
  await prisma.issue.deleteMany({});
  const createdVendors = await prisma.vendor.findMany({ take: 5, orderBy: { createdAt: 'asc' } });
  const [vendorLandscape, vendorPlumbing, , , vendorSecurity] = createdVendors;

  const issueDefs: {
    residentIdx: number;
    category: 'LANDSCAPING' | 'MAINTENANCE' | 'PARKING' | 'SAFETY' | 'NOISE' | 'GATE_ACCESS' | 'TRASH' | 'OTHER';
    title: string;
    description: string;
    location: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_ON_VENDOR' | 'RESOLVED' | 'CLOSED';
    preferredContactMethod: string;
    daysAgo: number;
    vendorId?: string;
    assignedToId?: string;
    dueDate?: Date;
  }[] = [
    {
      residentIdx: 0,
      category: 'MAINTENANCE',
      title: 'Broken sprinkler head near Building A entrance',
      description: 'The sprinkler head at the main entrance to Building A is broken and spraying water onto the sidewalk. It has been like this for about a week and is creating a slip hazard when temperatures drop.',
      location: 'Building A, Main Entrance — east sidewalk',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      preferredContactMethod: 'Email',
      daysAgo: 18,
      vendorId: vendorLandscape?.id,
      assignedToId: firstAdmin.id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      residentIdx: 1,
      category: 'NOISE',
      title: 'Loud music from unit 3B every weekend night',
      description: 'The tenant in unit 3B has been playing loud music until 2–3 AM on Friday and Saturday nights. I have knocked on the door twice but the noise continues. This has been ongoing for the past month.',
      location: 'Building C, Unit 3B',
      priority: 'HIGH',
      status: 'UNDER_REVIEW',
      preferredContactMethod: 'Phone',
      daysAgo: 12,
    },
    {
      residentIdx: 2,
      category: 'PARKING',
      title: 'Unknown vehicle parked in my assigned spot (#47)',
      description: 'A white Honda Civic with no HOA permit sticker has been parked in my assigned parking spot #47 for three days straight. I cannot park in my own space.',
      location: 'Parking Level 1, Spot #47',
      priority: 'URGENT',
      status: 'RESOLVED',
      preferredContactMethod: 'Text',
      daysAgo: 25,
      assignedToId: firstAdmin.id,
    },
    {
      residentIdx: 3,
      category: 'LANDSCAPING',
      title: 'Dead shrubs along the south fence need removal',
      description: 'Several large shrubs along the south boundary fence have died and are now brown and unsightly. They appear to have died during the dry spell last month. Removal and replanting would greatly improve the area.',
      location: 'South boundary fence, between Gates 2 and 3',
      priority: 'LOW',
      status: 'SUBMITTED',
      preferredContactMethod: 'Email',
      daysAgo: 5,
    },
    {
      residentIdx: 4,
      category: 'SAFETY',
      title: 'Burned-out streetlight on Maple Path',
      description: 'The streetlight at the bend in Maple Path has been out for about two weeks. This section of the path is completely dark at night and is a safety concern, especially for residents walking dogs in the evening.',
      location: 'Maple Path, approximately 50 feet past the mailbox cluster',
      priority: 'HIGH',
      status: 'ASSIGNED',
      preferredContactMethod: 'Email',
      daysAgo: 14,
      assignedToId: firstAdmin.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      residentIdx: 5,
      category: 'GATE_ACCESS',
      title: 'Main gate keypad not accepting my access code',
      description: 'My access code for the main vehicle entry gate stopped working on Monday evening. I had to wait for another resident to let me in. I have not changed my code recently.',
      location: 'Main vehicle entry gate — north entrance',
      priority: 'URGENT',
      status: 'RESOLVED',
      preferredContactMethod: 'Phone',
      daysAgo: 30,
      vendorId: vendorSecurity?.id,
      assignedToId: firstAdmin.id,
    },
    {
      residentIdx: 6,
      category: 'TRASH',
      title: 'Overflowing trash bins at the dog waste station',
      description: 'The dog waste bin near the dog park has been overflowing for three days. Bags and waste are accumulating on the ground around the station. This is an odor and sanitation issue for nearby residents.',
      location: 'Dog park area, near the water fountain',
      priority: 'MEDIUM',
      status: 'CLOSED',
      preferredContactMethod: 'Email',
      daysAgo: 40,
    },
    {
      residentIdx: 7,
      category: 'MAINTENANCE',
      title: 'Pool gate latch is broken — gate swings open',
      description: 'The latch on the pool area gate is no longer functioning correctly. The gate will not stay latched and swings open on its own, meaning the pool area is accessible without a key fob. This is a safety concern especially with children in the complex.',
      location: 'Pool area, main entry gate',
      priority: 'URGENT',
      status: 'WAITING_ON_VENDOR',
      preferredContactMethod: 'Email',
      daysAgo: 8,
      vendorId: vendorPlumbing?.id,
      assignedToId: firstAdmin.id,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      residentIdx: 8,
      category: 'LANDSCAPING',
      title: 'Tree branches overhanging parking area — vehicle damage risk',
      description: 'A large oak tree near visitor parking has several dead branches hanging directly over the parking spaces. One branch looks like it could fall in heavy winds. I am concerned about damage to my vehicle and those of visitors.',
      location: 'Visitor parking lot, northeast corner',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      preferredContactMethod: 'Email',
      daysAgo: 10,
      vendorId: vendorLandscape?.id,
      assignedToId: firstAdmin.id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      residentIdx: 9,
      category: 'NOISE',
      title: 'Construction noise starting before 7 AM',
      description: 'The renovation work happening in unit 4A has been starting before 7 AM multiple days this week. According to the community rules, construction noise is not allowed before 8 AM on weekdays and not at all on weekends.',
      location: 'Building D, Unit 4A',
      priority: 'MEDIUM',
      status: 'UNDER_REVIEW',
      preferredContactMethod: 'Text',
      daysAgo: 6,
    },
    {
      residentIdx: 10,
      category: 'SAFETY',
      title: 'Cracked sidewalk is a trip hazard near Building B',
      description: 'There is a section of sidewalk near the main entrance to Building B that has cracked and lifted significantly. I nearly tripped on it last week. An elderly neighbor also had difficulty navigating it with her walker.',
      location: 'Building B, north sidewalk entrance — approximately 10 feet from the door',
      priority: 'HIGH',
      status: 'ASSIGNED',
      preferredContactMethod: 'Email',
      daysAgo: 20,
      assignedToId: firstAdmin.id,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
    {
      residentIdx: 11,
      category: 'PARKING',
      title: 'Resident consistently blocking fire lane on weekends',
      description: 'A resident vehicle (dark blue SUV) is regularly parked in the fire lane on Saturday and Sunday mornings, apparently during a regular visitor pickup. The fire lane must remain clear at all times per city code.',
      location: 'Fire lane adjacent to Building A side entrance',
      priority: 'HIGH',
      status: 'CLOSED',
      preferredContactMethod: 'Email',
      daysAgo: 45,
    },
    {
      residentIdx: 12,
      category: 'OTHER',
      title: 'Request for additional bike rack near Building C',
      description: 'The existing bike rack near Building C is always full. Several residents including myself have started locking bikes to the fence or trees nearby, which is not ideal. Requesting one additional rack be installed.',
      location: 'Building C, near the south entrance',
      priority: 'LOW',
      status: 'UNDER_REVIEW',
      preferredContactMethod: 'Email',
      daysAgo: 15,
    },
    {
      residentIdx: 13,
      category: 'MAINTENANCE',
      title: 'Common area hallway light flickering in Building D',
      description: 'The fluorescent light fixture in the second-floor hallway of Building D has been flickering on and off for about a week. It goes dark for several minutes at a time, making the hallway difficult to navigate safely at night.',
      location: 'Building D, 2nd floor hallway, near elevator',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      preferredContactMethod: 'Email',
      daysAgo: 22,
      assignedToId: firstAdmin.id,
    },
    {
      residentIdx: 14,
      category: 'GATE_ACCESS',
      title: 'Pedestrian gate remote not working after battery replacement',
      description: 'I replaced the battery in my pedestrian gate remote as suggested but it still does not work. The remote is less than a year old. I need either a replacement remote or to have my current one reprogrammed.',
      location: 'Pedestrian side gate — west side of property',
      priority: 'MEDIUM',
      status: 'SUBMITTED',
      preferredContactMethod: 'Phone',
      daysAgo: 3,
    },
    {
      residentIdx: 15,
      category: 'TRASH',
      title: 'Bulk item abandoned next to recycling bins',
      description: 'Someone has left a large mattress and a broken dresser next to the recycling bins for the past five days. They are blocking access to the bins and look very messy.',
      location: 'Recycling enclosure, Building B side',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      preferredContactMethod: 'Text',
      daysAgo: 7,
      assignedToId: firstAdmin.id,
    },
    {
      residentIdx: 16,
      category: 'MAINTENANCE',
      title: 'Gym treadmill #2 making grinding noise and vibrating excessively',
      description: 'The second treadmill in the fitness center has been making a loud grinding noise and shaking during use. I am concerned it may be unsafe. I have seen other residents using it and wanted to report it before someone gets hurt.',
      location: 'Fitness center, treadmill station #2',
      priority: 'HIGH',
      status: 'WAITING_ON_VENDOR',
      preferredContactMethod: 'Email',
      daysAgo: 11,
      assignedToId: firstAdmin.id,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const def of issueDefs) {
    const createdAt = new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000);
    const issue = await prisma.issue.create({
      data: {
        residentId: createdResidents[def.residentIdx].id,
        vendorId: def.vendorId ?? null,
        assignedToId: def.assignedToId ?? null,
        category: def.category,
        title: def.title,
        description: def.description,
        location: def.location,
        priority: def.priority,
        status: def.status,
        preferredContactMethod: def.preferredContactMethod,
        dueDate: def.dueDate ?? null,
        communityId,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // Seed initial activity
    await prisma.issueActivity.create({
      data: {
        issueId: issue.id,
        actorId: createdResidents[def.residentIdx].id,
        action: 'created',
        details: 'Issue submitted',
        createdAt,
      },
    });

    // Seed a status-change activity for non-submitted issues
    if (def.status !== 'SUBMITTED') {
      await prisma.issueActivity.create({
        data: {
          issueId: issue.id,
          actorId: firstAdmin.id,
          action: 'status_changed',
          details: `Status updated to ${def.status.replace(/_/g, ' ').toLowerCase()}`,
          createdAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
        },
      });
    }

    // Seed a sample comment for resolved/closed issues
    if (def.status === 'RESOLVED' || def.status === 'CLOSED') {
      await prisma.issueComment.create({
        data: {
          issueId: issue.id,
          authorId: firstAdmin.id,
          body: 'This issue has been reviewed and addressed. Please let us know if you experience any further problems.',
          isInternal: false,
          createdAt: new Date(createdAt.getTime() + 48 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log('Seeding architectural requests…');
  await prisma.architecturalRequestActivity.deleteMany({});
  await prisma.architecturalRequestComment.deleteMany({});
  await prisma.architecturalRequestAttachment.deleteMany({});
  await prisma.architecturalRequest.deleteMany({});

  const [boardUser] = await prisma.user.findMany({ where: { role: 'BOARD_MEMBER' }, take: 1 });

  type ArchStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'NEEDS_MORE_INFORMATION' | 'APPROVED' | 'DENIED' | 'WITHDRAWN';
  type ArchType = 'FENCE' | 'EXTERIOR_PAINT' | 'LANDSCAPING' | 'SOLAR' | 'ROOF' | 'SHED' | 'OTHER';

  const archDefs: {
    residentIdx: number;
    requestType: ArchType;
    description: string;
    desiredStartDate?: Date;
    status: ArchStatus;
    governingRuleReference?: string;
    decisionReason?: string;
    daysAgo: number;
    comments?: { body: string; isInternal: boolean; authorIsBoard?: boolean }[];
  }[] = [
    {
      residentIdx: 0,
      requestType: 'FENCE',
      description: 'I would like to install a 6-foot cedar privacy fence along the rear property line (approximately 80 linear feet). The fence will be stained in a natural cedar tone to match the existing landscape. All posts will be set in concrete per local code. I have obtained bids from two licensed contractors and the work is planned to begin in mid-August, weather permitting. I have reviewed the CC&Rs and believe this modification complies with Section 7.2.',
      desiredStartDate: new Date('2026-08-15'),
      status: 'APPROVED',
      governingRuleReference: 'CC&Rs Section 7.2.1 — Rear Fence Allowance (max 6 ft, natural materials)',
      decisionReason: 'Request approved. The proposed cedar fence meets height, material, and style requirements. Contractor must obtain required city permit before work begins.',
      daysAgo: 45,
      comments: [
        { body: 'Your fence request is approved. Please ensure the contractor pulls the required city permit before work begins.', isInternal: false, authorIsBoard: true },
      ],
    },
    {
      residentIdx: 1,
      requestType: 'EXTERIOR_PAINT',
      description: 'I am requesting approval to repaint the front door and shutters of my unit. The current color is faded and peeling. I would like to change to Benjamin Moore HC-172 (Newburyport Blue, a deep navy). All other exterior surfaces will remain unchanged. A professional painter will complete the work over one weekend.',
      status: 'UNDER_REVIEW',
      governingRuleReference: 'CC&Rs Section 6.1 — Approved Exterior Color Palette',
      daysAgo: 12,
      comments: [
        { body: 'The board is reviewing this color selection against the current approved palette. We will have an answer within the next two weeks.', isInternal: false, authorIsBoard: true },
        { body: 'Need to verify if navy blue is on the 2024 approved palette — checking with the PM.', isInternal: true, authorIsBoard: true },
      ],
    },
    {
      residentIdx: 2,
      requestType: 'SOLAR',
      description: 'I am requesting approval to install a rooftop solar PV system consisting of 18 panels (SunPower Maxeon 6 AC) mounted flush to the south-facing roof slope. Total system size: 7.2 kW. Installation will be performed by SunRise Solar LLC (licensed contractor). All equipment meets UL and NEC standards. Panel layout diagram and specs are available upon request.',
      desiredStartDate: new Date('2026-09-01'),
      status: 'SUBMITTED',
      daysAgo: 4,
    },
    {
      residentIdx: 3,
      requestType: 'LANDSCAPING',
      description: 'I would like to convert approximately 400 sq ft of front yard lawn to drought-tolerant native landscaping. Plan includes decomposed granite, lavender, sage, penstemon, and a small decorative boulder arrangement. This aligns with the city water conservation program and should significantly reduce water usage.',
      desiredStartDate: new Date('2026-07-20'),
      status: 'NEEDS_MORE_INFORMATION',
      daysAgo: 21,
      comments: [
        { body: 'To complete our review, please provide: (1) a scaled site plan showing placement of all new plantings and hardscape elements, and (2) a list of all plant species with their mature heights. Our concern is maintaining adequate sightlines from the street to the entrance.', isInternal: false, authorIsBoard: true },
        { body: 'Resident was notified. Follow-up needed by 6/25.', isInternal: true, authorIsBoard: true },
      ],
    },
    {
      residentIdx: 4,
      requestType: 'SHED',
      description: 'I would like to install a prefabricated storage shed (Tuff Shed TR-700, 10x12 feet) in the rear left corner of my backyard to store lawn equipment and sports gear. It will be painted to match the existing house color. Location is set back 3 feet from both property lines per local code.',
      desiredStartDate: new Date('2026-08-01'),
      status: 'DENIED',
      governingRuleReference: 'CC&Rs Section 8.4.2 — Accessory Structures (max 100 sq ft, 8 ft height)',
      decisionReason: 'Request denied. The proposed 10x12 ft shed (120 sq ft) exceeds the maximum allowable footprint of 100 sq ft per CC&Rs Section 8.4.2. Additionally, the proposed location would be visible from a common area walkway, which is not permitted. Please revise your application with a smaller shed in a non-visible location.',
      daysAgo: 35,
      comments: [
        { body: 'Is there any possibility of an exception if I use a smaller 8x12 model? That would be 96 sq ft and under the limit.', isInternal: false },
        { body: 'A revised application with a compliant shed size and revised location would be considered. An 8x10 or smaller shed placed against the rear fence line (not the side) would likely be approvable.', isInternal: false, authorIsBoard: true },
      ],
    },
    {
      residentIdx: 5,
      requestType: 'ROOF',
      description: 'My roof is approximately 22 years old and has reached end-of-life. I am requesting approval for a full replacement using Owens Corning Duration Premium asphalt shingles in Driftwood (medium gray-brown), which matches several other homes in the community. The project will be completed by Apex Roofing Co. and is expected to take 2-3 days.',
      desiredStartDate: new Date('2026-07-28'),
      status: 'APPROVED',
      governingRuleReference: 'CC&Rs Section 6.3 — Roofing Materials and Colors',
      decisionReason: 'Request approved. Owens Corning Duration in Driftwood is on the approved roofing material list per Section 6.3. Please coordinate with the management office if crane staging in common areas is needed.',
      daysAgo: 28,
    },
    {
      residentIdx: 6,
      requestType: 'OTHER',
      description: 'I would like to install a 12x16 ft wooden pergola in the rear patio area of my backyard. The pergola will be constructed from pressure-treated lumber, painted white to match existing trim, and will have a fabric shade canopy. No electrical work is planned. Contractor quote and drawings available upon request.',
      status: 'DRAFT',
      daysAgo: 2,
    },
    {
      residentIdx: 7,
      requestType: 'FENCE',
      description: 'I was planning to extend my side yard fence to enclose a larger area for my dog. However, after speaking with my neighbor, we have decided to pursue a joint fence project instead. I am withdrawing this individual request.',
      status: 'WITHDRAWN',
      daysAgo: 18,
      comments: [
        { body: 'Withdrawal acknowledged. No action required.', isInternal: true, authorIsBoard: true },
      ],
    },
    {
      residentIdx: 8,
      requestType: 'EXTERIOR_PAINT',
      description: 'I would like to repaint the entire exterior of my home using the same color scheme as the existing paint (SW 7015 Repose Gray body, SW 7004 Snowbound trim, SW 6258 Tricorn Black accents) — a refreshed version of the current colors. The current paint is from 2008 and is significantly faded. A licensed painter will complete the work.',
      desiredStartDate: new Date('2026-08-10'),
      status: 'UNDER_REVIEW',
      daysAgo: 9,
    },
    {
      residentIdx: 9,
      requestType: 'SHED',
      description: 'Requesting approval for a small metal storage shed (Arrow Shed Classic, 8x6 feet, 48 sq ft) in the far rear corner of my backyard, fully behind the existing privacy fence and not visible from any common area or neighboring property. The shed will store seasonal items and a lawn mower.',
      desiredStartDate: new Date('2026-07-15'),
      status: 'SUBMITTED',
      daysAgo: 6,
    },
  ];

  for (const def of archDefs) {
    const createdAt = new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000);
    const request = await prisma.architecturalRequest.create({
      data: {
        residentId: createdResidents[def.residentIdx].id,
        requestType: def.requestType,
        description: def.description,
        desiredStartDate: def.desiredStartDate ?? null,
        status: def.status,
        governingRuleReference: def.governingRuleReference ?? null,
        decisionReason: def.decisionReason ?? null,
        communityId,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.architecturalRequestActivity.create({
      data: {
        requestId: request.id,
        actorId: createdResidents[def.residentIdx].id,
        action: 'created',
        details: def.status === 'DRAFT' ? 'Draft saved' : 'Request submitted for review',
        createdAt,
      },
    });

    if (def.status !== 'DRAFT' && def.status !== 'SUBMITTED') {
      await prisma.architecturalRequestActivity.create({
        data: {
          requestId: request.id,
          actorId: firstAdmin.id,
          action: 'status_changed',
          details: `Status changed to ${def.status.replace(/_/g, ' ').toLowerCase()}`,
          createdAt: new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
      });
    }

    if (def.governingRuleReference) {
      await prisma.architecturalRequestActivity.create({
        data: {
          requestId: request.id,
          actorId: boardUser?.id ?? firstAdmin.id,
          action: 'rule_referenced',
          details: `Governing rule referenced`,
          createdAt: new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000),
        },
      });
    }

    for (const c of def.comments ?? []) {
      const authorId = c.authorIsBoard ? (boardUser?.id ?? firstAdmin.id) : createdResidents[def.residentIdx].id;
      await prisma.architecturalRequestComment.create({
        data: {
          requestId: request.id,
          authorId,
          body: c.body,
          isInternal: c.isInternal,
          createdAt: new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // ─── Violations ────────────────────────────────────────────────────────────
  console.log('Seeding violations…');
  await prisma.violationAppeal.deleteMany({});
  await prisma.violationActivity.deleteMany({});
  await prisma.violationComment.deleteMany({});
  await prisma.violation.deleteMany({});

  type ViolationStatus = 'DRAFT' | 'NOTICE_SENT' | 'RESIDENT_RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
  type ViolationType = 'LANDSCAPING_MAINTENANCE' | 'PARKING' | 'NOISE' | 'PROPERTY_APPEARANCE' | 'UNAUTHORIZED_MODIFICATION' | 'PET_VIOLATION' | 'TRASH_AND_DEBRIS' | 'OTHER';

  const vDefs: {
    residentIdx: number;
    violationType: ViolationType;
    ruleCitation: string;
    description: string;
    resolutionSteps?: string;
    deadline?: Date;
    status: ViolationStatus;
    daysAgo: number;
    appeal?: { reason: string; status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED'; outcome?: string };
    comment?: { body: string; isInternal: boolean };
    internalNote?: string;
  }[] = [
    {
      residentIdx: 0,
      violationType: 'LANDSCAPING_MAINTENANCE',
      ruleCitation: "CC&Rs Section 5.1 — Landscaping Maintenance Standards",
      description: "The front lawn at this property has not been mowed in approximately four weeks. Grass is significantly overgrown and extends into the sidewalk easement. This is visible from the street and affects the appearance of the community.",
      resolutionSteps: "Please mow and trim the lawn to a height of 3 inches or less. Edging along the sidewalk and driveway is also required. This should be completed within the deadline below.",
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'NOTICE_SENT',
      daysAgo: 5,
    },
    {
      residentIdx: 1,
      violationType: 'PARKING',
      ruleCitation: "Community Rules Section 3.2 — Vehicle Parking",
      description: "An RV belonging to this household has been parked in the community parking lot for 22 consecutive days, exceeding the 72-hour maximum for recreational vehicles. The vehicle is taking up two spaces.",
      resolutionSteps: "The recreational vehicle must be removed from the community parking lot within 7 days. RVs may only be parked in designated storage areas with prior approval. Please contact the office to inquire about RV storage availability.",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'RESIDENT_RESPONDED',
      daysAgo: 10,
      comment: { body: "We understand the concern. We have arranged for the RV to be moved to off-site storage within 3 days. We were unaware of the 72-hour limit — thank you for the information.", isInternal: false },
    },
    {
      residentIdx: 2,
      violationType: 'UNAUTHORIZED_MODIFICATION',
      ruleCitation: "CC&Rs Section 7.4 — Exterior Modifications Require Prior Approval",
      description: "A wood pergola structure has been installed in the rear yard without an architectural review approval. The structure appears to be approximately 12×14 feet and is visible over the fence line from the adjacent property. No architectural review application was submitted or approved prior to installation.",
      resolutionSteps: "You may submit a retroactive architectural review application for the pergola within 30 days. If the application is approved, no further action is needed. If the application is denied or not submitted within the timeframe, the structure will need to be removed.",
      deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: 'UNDER_REVIEW',
      daysAgo: 14,
      internalNote: "Resident has submitted a retroactive arch request (ID on file). Putting this on hold pending board decision.",
    },
    {
      residentIdx: 3,
      violationType: 'PET_VIOLATION',
      ruleCitation: "Community Rules Section 6.1 — Pet Registration and Leash Requirements",
      description: "A large dog from this unit was observed off-leash in the common area green space on two separate occasions: June 15 and June 18. The dog approached other residents and their pets. All pets must be on a leash no longer than 6 feet when in any common area.",
      resolutionSteps: "Please ensure your pet is on a leash at all times in common areas. All pets must also be registered with the management office. If your pet is not yet registered, please submit a pet registration form within 15 days.",
      deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'ESCALATED',
      daysAgo: 20,
      appeal: {
        reason: "Our dog was in a designated off-leash area both times. We believe the notices reference the wrong location. We would like to appeal this violation and request a review of the specific areas involved.",
        status: 'SUBMITTED',
      },
    },
    {
      residentIdx: 4,
      violationType: 'NOISE',
      ruleCitation: "Community Rules Section 4.3 — Quiet Hours (10pm–8am)",
      description: "Multiple neighbors reported loud music and outdoor gathering noise originating from this property on Saturday, June 14 from approximately 11pm to 2am. This is the second noise complaint for this address in 60 days.",
      resolutionSteps: "Please ensure all outdoor gatherings and amplified music end by 10:00 PM. Repeated noise violations may result in fines per the community's enforcement schedule.",
      status: 'RESOLVED',
      daysAgo: 25,
      comment: { body: "We apologize for the disturbance. We were hosting a graduation party and lost track of the time. It will not happen again.", isInternal: false },
    },
    {
      residentIdx: 5,
      violationType: 'TRASH_AND_DEBRIS',
      ruleCitation: "CC&Rs Section 5.5 — Trash Enclosures and Debris",
      description: "Trash cans and a collection of broken furniture and cardboard boxes have been left at the curb for approximately 8 days since the last collection date. Non-collection items should be taken to the bulk waste area or scheduled for pickup.",
      resolutionSteps: "Please remove all non-collection debris and store trash cans within the garage or behind the gate. Bulk items can be scheduled for removal by calling the city at 555-CLEAN-UP or using the city's online portal.",
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'NOTICE_SENT',
      daysAgo: 3,
    },
    {
      residentIdx: 6,
      violationType: 'PROPERTY_APPEARANCE',
      ruleCitation: "CC&Rs Section 5.2 — Property Upkeep and Appearance",
      description: "The exterior paint on the garage door and front facade of this property is severely faded, chipping, and peeling in multiple areas. The condition has been ongoing for more than six months and has been noted in two prior drive-through inspections.",
      resolutionSteps: "A fresh coat of paint must be applied to all affected exterior surfaces within 60 days. Any new paint color must comply with the approved community color palette. Please submit an Exterior Paint application if choosing a new color.",
      deadline: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000),
      status: 'UNDER_REVIEW',
      daysAgo: 8,
      appeal: {
        reason: "We scheduled a painting contractor two months ago but they cancelled. We have a new appointment booked for next week. We are working on this and respectfully ask that the violation be withdrawn or the deadline extended.",
        status: 'UNDER_REVIEW',
        outcome: "Board acknowledged scheduling difficulty. Extended deadline by 30 days. Appeal under review pending completion.",
      },
    },
    {
      residentIdx: 19, // demo resident
      violationType: 'LANDSCAPING_MAINTENANCE',
      ruleCitation: "CC&Rs Section 5.1 — Landscaping Maintenance Standards",
      description: "Hedges along the side yard fence line have grown significantly over the neighboring property line and above the permitted fence height of 6 feet. This affects both the neighbor's property and the appearance of the community boundary.",
      resolutionSteps: "Please trim all hedges so they do not exceed the 6-foot fence height and do not extend over the property line. This should be completed within the deadline.",
      deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: 'DRAFT',
      daysAgo: 1,
    },
  ];

  const secondAdmin = createdAdmins[1] ?? firstAdmin;

  for (const def of vDefs) {
    const observedAt = new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000);
    const v = await prisma.violation.create({
      data: {
        residentId: createdResidents[def.residentIdx].id,
        createdById: def.status === 'DRAFT' ? firstAdmin.id : secondAdmin.id,
        violationType: def.violationType,
        ruleCitation: def.ruleCitation,
        description: def.description,
        resolutionSteps: def.resolutionSteps ?? null,
        deadline: def.deadline ?? null,
        status: def.status,
        communityId,
        observedAt,
        createdAt: observedAt,
        updatedAt: observedAt,
      },
    });

    await prisma.violationActivity.create({
      data: {
        violationId: v.id,
        actorId: def.status === 'DRAFT' ? firstAdmin.id : secondAdmin.id,
        action: 'created',
        details: def.status === 'DRAFT' ? 'Draft created' : 'Violation recorded',
        createdAt: observedAt,
      },
    });

    if (def.status !== 'DRAFT') {
      await prisma.violationActivity.create({
        data: {
          violationId: v.id,
          actorId: secondAdmin.id,
          action: 'notice_sent',
          details: 'Notice sent to resident via email',
          createdAt: new Date(observedAt.getTime() + 1 * 60 * 60 * 1000),
        },
      });
    }

    if (def.comment) {
      const authorId = def.comment.isInternal ? firstAdmin.id : createdResidents[def.residentIdx].id;
      await prisma.violationComment.create({
        data: {
          violationId: v.id,
          authorId,
          body: def.comment.body,
          isInternal: def.comment.isInternal,
          createdAt: new Date(observedAt.getTime() + 48 * 60 * 60 * 1000),
        },
      });
      if (!def.comment.isInternal) {
        await prisma.violationActivity.create({
          data: {
            violationId: v.id,
            actorId: authorId,
            action: 'resident_responded',
            details: 'Resident submitted a written response',
            createdAt: new Date(observedAt.getTime() + 48 * 60 * 60 * 1000),
          },
        });
      }
    }

    if (def.internalNote) {
      await prisma.violationComment.create({
        data: {
          violationId: v.id,
          authorId: firstAdmin.id,
          body: def.internalNote,
          isInternal: true,
          createdAt: new Date(observedAt.getTime() + 72 * 60 * 60 * 1000),
        },
      });
    }

    if (['UNDER_REVIEW', 'RESOLVED', 'ESCALATED', 'CLOSED'].includes(def.status)) {
      await prisma.violationActivity.create({
        data: {
          violationId: v.id,
          actorId: firstAdmin.id,
          action: 'status_changed',
          details: `Status updated to ${def.status.toLowerCase().replace(/_/g, ' ')}`,
          createdAt: new Date(observedAt.getTime() + 4 * 24 * 60 * 60 * 1000),
        },
      });
    }

    if (def.appeal) {
      const appeal = await prisma.violationAppeal.create({
        data: {
          violationId: v.id,
          submittedById: createdResidents[def.residentIdx].id,
          reason: def.appeal.reason,
          status: def.appeal.status,
          outcome: def.appeal.outcome ?? null,
          reviewedById: ['APPROVED', 'DENIED'].includes(def.appeal.status) ? firstAdmin.id : null,
          reviewedAt: ['APPROVED', 'DENIED'].includes(def.appeal.status) ? new Date(observedAt.getTime() + 6 * 24 * 60 * 60 * 1000) : null,
          createdAt: new Date(observedAt.getTime() + 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(observedAt.getTime() + 5 * 24 * 60 * 60 * 1000),
        },
      });
      await prisma.violationActivity.create({
        data: {
          violationId: v.id,
          actorId: createdResidents[def.residentIdx].id,
          action: 'appeal_filed',
          details: 'Resident filed an appeal',
          createdAt: new Date(observedAt.getTime() + 5 * 24 * 60 * 60 * 1000),
        },
      });
      if (['APPROVED', 'DENIED'].includes(def.appeal.status)) {
        await prisma.violationActivity.create({
          data: {
            violationId: v.id,
            actorId: firstAdmin.id,
            action: 'appeal_reviewed',
            details: `Appeal ${def.appeal.status.toLowerCase()}`,
            createdAt: new Date(observedAt.getTime() + 6 * 24 * 60 * 60 * 1000),
          },
        });
      }
      void appeal;
    }
  }

  console.log('\nSeed complete!');
  console.log('─────────────────────────────────');
  console.log('Demo credentials (password: password123)');
  console.log('  Resident:     resident@communityhq.local');
  console.log('  Admin:        admin@communityhq.local');
  console.log('  Board Member: board@communityhq.local');
  console.log('─────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
