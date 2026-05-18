import { PrismaClient, UserRole, UserSubRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const slug = 'acme';
  const email = 'owner@acme.test';
  const password = 'password123';

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Tenant "${slug}" already exists, skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Acme Co.',
      slug,
      users: {
        create: {
          email,
          passwordHash,
          name: 'Acme Owner',
          role: UserRole.owner,
          subRole: UserSubRole.admin,
        },
      },
    },
    include: { users: true },
  });

  console.log(`Seeded tenant ${tenant.slug} with owner ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
