import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildDatabaseUrl, getDatabaseCredentialsByArn } from '@bookla/utils';

export type CustomPrismaClient = ReturnType<typeof getClient>;
export type CustomPrismaTx = Parameters<Parameters<CustomPrismaClient['$transaction']>[0]>[0];

const globalForPrisma = globalThis as unknown as { prisma?: CustomPrismaClient };
let initPromise: Promise<CustomPrismaClient> | null = null;

export const getPrismaClient = async (): Promise<CustomPrismaClient> => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let databaseUrl = process.env.DATABASE_URL;
    if (process.env.DATABASE_SECRET_ARN) {
      const creds = await getDatabaseCredentialsByArn(process.env.DATABASE_SECRET_ARN);
      databaseUrl = buildDatabaseUrl(creds, process.env.DATABASE_PROXY_ENDPOINT);
    }
    if (!databaseUrl) {
      throw new Error('DATABASE_URL or DATABASE_SECRET_ARN must be set');
    }
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    const client = getClient(adapter);
    globalForPrisma.prisma = client;
    return client;
  })();

  return initPromise;
};

function getClient(adapter: PrismaPg) {
  return new PrismaClient({ adapter });
}

export type { Tenant, TenantUser, UserRole, UserSubRole } from '@prisma/client';
