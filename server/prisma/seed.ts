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
