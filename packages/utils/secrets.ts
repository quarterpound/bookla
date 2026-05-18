import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// AWS SDK v3 honours AWS_ENDPOINT_URL automatically, so LocalStack works
// without further wiring.
const secretsManager = new SecretsManagerClient({});

// ARN → in-flight or resolved promise. Multiple call sites within one lambda
// invocation coalesce to a single GetSecretValue request. Failures evict so
// retries actually re-fetch.
const cache = new Map<string, Promise<string>>();

const fetchRaw = (arn: string): Promise<string> => {
  const cached = cache.get(arn);
  if (cached) return cached;

  const promise = (async () => {
    const result = await secretsManager.send(new GetSecretValueCommand({ SecretId: arn }));
    if (!result.SecretString) {
      throw new Error(`Secret ${arn} has no SecretString`);
    }
    return result.SecretString;
  })();

  promise.catch(() => cache.delete(arn));
  cache.set(arn, promise);
  return promise;
};

/**
 * Plain-string secret. Returns `devFallback` when `arn` is empty or undefined,
 * never hitting AWS in dev mode.
 */
export async function fetchStringSecretByArn(
  arn: string | undefined,
  devFallback: string,
): Promise<string> {
  if (!arn) return devFallback;
  return fetchRaw(arn);
}

/**
 * JSON secret. Fetches, `JSON.parse`s, and casts to `T`. Pass the expected shape
 * as the generic so the call site is typed.
 */
export async function fetchJsonSecretByArn<T>(
  arn: string | undefined,
  devFallback: T,
): Promise<T> {
  if (!arn) return devFallback;
  const raw = await fetchRaw(arn);
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`Secret ${arn} is not valid JSON: ${(err as Error).message}`);
  }
}
