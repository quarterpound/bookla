import {
  BookingSource,
  BookingStatus,
  BusinessPlan,
  PrismaClient,
  UserRole,
  UserSubRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set to run the seed');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SLUG = 'turals-barbershop';
const OWNER_PHONE = '+994501234567';
const CLIENT_PHONE = '+994551112233';

const toDateOnly = (d: Date): Date => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const addDays = (d: Date, days: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};
const addMinutesHHMM = (hhmm: string, minutes: number): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h! * 60 + m! + minutes;
  const hh = Math.floor(total / 60).toString().padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

async function main() {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Tenant "${SLUG}" already exists, skipping seed.`);
    return;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: "Tural's Barbershop",
      slug: SLUG,
      description: 'Klassik və müasir saç düzümü, üz qırxılması, saqqal forması.',
      address: 'Nizami küç. 12, Bakı',
      phone: '+994122223344',
      plan: BusinessPlan.personal,
      timezone: 'Asia/Baku',
      users: {
        create: {
          phone: OWNER_PHONE,
          name: 'Tural Mammadov',
          role: UserRole.owner,
          subRole: UserSubRole.admin,
        },
      },
    },
    include: { users: true },
  });

  const owner = tenant.users[0]!;

  const staff = await prisma.staff.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      name: owner.name ?? 'Tural',
      phone: OWNER_PHONE,
      isActive: true,
      sortOrder: 0,
    },
  });

  const [haircut, shave, beardTrim] = await Promise.all([
    prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: 'Saç düzümü',
        durationMinutes: 30,
        priceAmount: 1500,
        sortOrder: 0,
      },
    }),
    prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: 'Üz qırxılması',
        durationMinutes: 20,
        priceAmount: 1000,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: 'Saqqal forması',
        durationMinutes: 25,
        priceAmount: 1200,
        sortOrder: 2,
      },
    }),
  ]);

  // Mon–Sat working hours (dayOfWeek 0=Mon ... 5=Sat). Closed on Sunday (6).
  await prisma.workingHours.createMany({
    data: [0, 1, 2, 3, 4, 5].map((dayOfWeek) => ({
      staffId: staff.id,
      dayOfWeek,
      startTime: '09:00',
      endTime: '19:00',
      breakStartTime: '13:00',
      breakEndTime: '14:00',
    })),
  });

  const client = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      name: 'Elvin Aliyev',
      phone: CLIENT_PHONE,
    },
  });

  const today = toDateOnly(new Date());

  const bookings: Array<{
    date: Date;
    startTime: string;
    serviceId: number;
    durationMinutes: number;
    status: BookingStatus;
    source: BookingSource;
  }> = [
    {
      date: addDays(today, -7),
      startTime: '10:00',
      serviceId: haircut!.id,
      durationMinutes: haircut!.durationMinutes,
      status: BookingStatus.completed,
      source: BookingSource.online,
    },
    {
      date: addDays(today, -2),
      startTime: '15:00',
      serviceId: shave!.id,
      durationMinutes: shave!.durationMinutes,
      status: BookingStatus.no_show,
      source: BookingSource.manual,
    },
    {
      date: today,
      startTime: '11:00',
      serviceId: haircut!.id,
      durationMinutes: haircut!.durationMinutes,
      status: BookingStatus.confirmed,
      source: BookingSource.online,
    },
    {
      date: addDays(today, 1),
      startTime: '16:30',
      serviceId: beardTrim!.id,
      durationMinutes: beardTrim!.durationMinutes,
      status: BookingStatus.confirmed,
      source: BookingSource.manual,
    },
    {
      date: addDays(today, 5),
      startTime: '09:30',
      serviceId: haircut!.id,
      durationMinutes: haircut!.durationMinutes,
      status: BookingStatus.confirmed,
      source: BookingSource.online,
    },
  ];

  for (const b of bookings) {
    await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        staffId: staff.id,
        serviceId: b.serviceId,
        clientId: client.id,
        date: b.date,
        startTime: b.startTime,
        endTime: addMinutesHHMM(b.startTime, b.durationMinutes),
        status: b.status,
        source: b.source,
      },
    });
  }

  console.log(`Seeded tenant ${tenant.slug} (owner phone ${OWNER_PHONE}).`);
  console.log(`  - ${1} owner user, ${1} staff`);
  console.log(`  - 3 services, 6 working-hours rows (Mon–Sat)`);
  console.log(`  - 1 client, ${bookings.length} bookings`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
