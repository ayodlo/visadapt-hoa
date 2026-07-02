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

  console.log('Seeding residents…');
  const createdResidents = await Promise.all(
    residents.map((r) =>
      prisma.user.upsert({
        where: { email: r.email },
        update: {},
        create: { ...r, passwordHash, role: 'RESIDENT' },
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
  await Promise.all(
    boardMembers.map((b) =>
      prisma.user.upsert({
        where: { email: b.email },
        update: {},
        create: { ...b, passwordHash, role: 'BOARD_MEMBER' },
      })
    )
  );

  console.log('Seeding vendors…');
  await Promise.all(
    vendors.map((v) =>
      prisma.vendor.upsert({
        where: { id: v.email },
        update: {},
        create: v,
      }).catch(() =>
        prisma.vendor.create({ data: v })
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
        data: { ...p, ownerId: propertyOwners[i % propertyOwners.length].id },
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
  await prisma.announcement.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Welcome to CommunityHQ!',
        body: 'We are excited to launch our new community management platform. Use it to stay informed about announcements, events, maintenance requests, and more.',
        authorId: firstAdmin.id,
      },
      {
        title: 'Pool Maintenance — Closed This Weekend',
        body: 'The community pool will be closed Saturday and Sunday for routine maintenance. We apologize for the inconvenience and expect it to reopen Monday morning.',
        authorId: firstAdmin.id,
      },
    ],
  });

  console.log('Seeding charges and payments…');
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
        },
      });
    }
  }

  void now; // suppress unused warning

  console.log('Seeding sample documents…');
  const PLACEHOLDER_BASE = 'https://cdn.example.com/hoa-docs';
  await prisma.document.createMany({
    skipDuplicates: false,
    data: [
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
    ],
  });

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
