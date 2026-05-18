import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

const secretsManager = new SecretsManagerClient({});
export const secretCache = new Map<string, string>();

export const fetchSecretByArn = async (secretArn: string): Promise<string> => {
  const cached = secretCache.get(secretArn);
  if (cached) return cached;

  // In dev, the "ARN" env var is treated as the literal value.
  if (process.env.NODE_ENV === 'development') return secretArn;

  const secret = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!secret.SecretString) throw new Error(`Secret ${secretArn} has no SecretString`);
  secretCache.set(secretArn, secret.SecretString);
  return secret.SecretString;
};

export const getDatabaseCredentialsByArn = async (secretArn: string): Promise<DatabaseCredentials> => {
  const secret = await fetchSecretByArn(secretArn);
  return JSON.parse(secret) as DatabaseCredentials;
};

export const buildDatabaseUrl = (creds: DatabaseCredentials, proxyEndpoint?: string): string => {
  const host = proxyEndpoint || creds.host;
  return `postgresql://${creds.username}:${creds.password}@${host}:${creds.port}/${creds.dbname}?sslmode=no-verify&schema=public`;
};
