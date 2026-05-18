import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { fetchJsonSecretByArn } from '@bookla/utils';

export interface DatabaseCredentials {
  username: string;
  password: string;
  host?: string;
  port?: number;
  dbname?: string;
}

export type CustomPrismaClient = ReturnType<typeof getClient>;
export type CustomPrismaTx = Parameters<Parameters<CustomPrismaClient['$transaction']>[0]>[0];

const globalForPrisma = globalThis as unknown as { prisma?: CustomPrismaClient };
let initPromise: Promise<CustomPrismaClient> | null = null;

/**
 * Prod: pull `{ username, password, host?, port?, dbname? }` from Secrets
 * Manager and point the connection at the RDS Proxy.
 * Dev: pass `DATABASE_URL` through unchanged.
 */
const resolveDatabaseUrl = async (): Promise<string> => {
  const arn = process.env.DATABASE_SECRET_ARN;
  if (!arn) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL or DATABASE_SECRET_ARN must be set');
    }
    return url;
  }

  const creds = await fetchJsonSecretByArn<DatabaseCredentials>(arn, {
    username: '',
    password: '',
  });
  if (!creds.username || !creds.password) {
    throw new Error(`Database secret ${arn} is missing username/password`);
  }
  const host = process.env.DATABASE_PROXY_ENDPOINT ?? creds.host;
  if (!host) {
    throw new Error('Database host not resolvable — set DATABASE_PROXY_ENDPOINT or include host in the secret');
  }
  const port = creds.port ?? 5432;
  const dbname = creds.dbname ?? 'postgres';
  return `postgresql://${creds.username}:${encodeURIComponent(creds.password)}@${host}:${port}/${dbname}?sslmode=require`;
};

export const getPrismaClient = async (): Promise<CustomPrismaClient> => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const connectionString = await resolveDatabaseUrl();
    const adapter = new PrismaPg({ connectionString });
    const client = getClient(adapter);
    globalForPrisma.prisma = client;
    return client;
  })();

  // Evict on failure so the next caller re-attempts initialisation.
  initPromise.catch(() => {
    initPromise = null;
  });

  return initPromise;
};

function getClient(adapter: PrismaPg) {
  return new PrismaClient({ adapter });
}

export type { Tenant, TenantUser, UserRole, UserSubRole } from '@prisma/client';
