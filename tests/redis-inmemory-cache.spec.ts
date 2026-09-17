import { test, expect, APIRequestContext } from '@playwright/test';

// Covers redis-cache-mock-api and inmemory-cache-mock-api against their
// live Render URLs (overridable via env vars for local testing).
//
// Both environments share the SAME underlying Postgres row for the test
// user, so each environment's cases run serially (test.describe.serial)
// and the two environment blocks aren't forced to interleave either —
// running them concurrently could let one environment's update race
// against the other's read of the same DB row.
//
// Three cases, in order, per environment:
//   1. GET (first time / not cached)        -> MISS. Ends by forcing a
//      real update so the cache is guaranteed empty for the next run.
//   2. GET (second time, within TTL)        -> HIT. Same cleanup at the end.
//   3. PUT after the cache is confirmed set -> deletes the cache entry;
//      the next GET must MISS and reflect the new value.
//
// forceCacheInvalidation() answers "if PUT doesn't actually update
// anything, keep changing the value until it does": the update endpoint
// replies {"message":"No update"} when the new salary equals the
// current DB value, so this keeps bumping the candidate and retrying
// until it gets "Success" back.
//
// Run with: npx playwright test
// Env vars (optional, default to the live Render deployments):
//   REDIS_BASE_URL, INMEMORY_BASE_URL, TEST_USER_ID

interface UserResponse {
  user_id: number;
  username: string;
  location: string;
  salary: number;
}

interface UpdateResponse {
  message: string;
}

const TEST_USER_ID = Number(process.env.TEST_USER_ID ?? 2);

const environments = [
  { name: 'redis', baseURL: process.env.REDIS_BASE_URL ?? 'https://redis-cache-mock-api.onrender.com' },
  { name: 'inmemory', baseURL: process.env.INMEMORY_BASE_URL ?? 'https://inmemory-cache-mock-api.onrender.com' },
];

async function getUser(
  request: APIRequestContext,
  baseURL: string,
  userId: number
): Promise<{ status: number; cache: string | null; body: Partial<UserResponse> }> {
  const res = await request.get(`${baseURL}/api/user`, { params: { user_id: userId } });
  let body: Partial<UserResponse> = {};
  try {
    body = await res.json();
  } catch {
    // error responses may not be valid JSON shaped like UserResponse; that's fine
  }
  return { status: res.status(), cache: res.headers()['x-cache'] ?? null, body };
}

async function putSalary(
  request: APIRequestContext,
  baseURL: string,
  userId: number,
  salary: number
): Promise<{ status: number; body: UpdateResponse }> {
  const res = await request.put(`${baseURL}/api/user/update`, {
    data: { user_id: userId, salary },
  });
  const body: UpdateResponse = await res.json();
  return { status: res.status(), body };
}

async function currentSalary(request: APIRequestContext, baseURL: string, userId: number): Promise<number> {
  const { body } = await getUser(request, baseURL, userId);
  return body.salary ?? 0;
}

// Keeps bumping the candidate salary and retrying until the API confirms
// a genuine update ("Success"), rather than silently accepting a
// coincidental no-op ("No update") as if the test had done something.
async function forceCacheInvalidation(request: APIRequestContext, baseURL: string, userId: number): Promise<number> {
  let candidate = await currentSalary(request, baseURL, userId);

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    candidate += 1000 + attempt;
    const { status, body } = await putSalary(request, baseURL, userId, candidate);
    expect(status, `unexpected status on update attempt ${attempt}: ${JSON.stringify(body)}`).toBe(200);

    if (body.message === 'Success') return candidate;
    if (body.message === 'No Success') {
      throw new Error(`update failed unexpectedly on attempt ${attempt}: ${JSON.stringify(body)}`);
    }
    // "No update": candidate coincided with the current value; loop and try a bigger jump.
  }
  throw new Error(`could not force a real update after ${maxAttempts} attempts`);
}

for (const env of environments) {
  test.describe.serial(`cache behavior — ${env.name}`, () => {
    test('GET first time is a cache miss', async ({ request }) => {
      // Guarantee the cache is empty before asserting MISS.
      await forceCacheInvalidation(request, env.baseURL, TEST_USER_ID);

      const { status, cache, body } = await getUser(request, env.baseURL, TEST_USER_ID);
      expect(status).toBe(200);
      expect(cache).toBe('MISS');
      expect(body.user_id).toBe(TEST_USER_ID);

      // End by invalidating again so the cache is guaranteed empty for
      // whatever runs next — not dependent on TTL having expired.
      await forceCacheInvalidation(request, env.baseURL, TEST_USER_ID);
    });

    test('GET second time is a cache hit', async ({ request }) => {
      const first = await getUser(request, env.baseURL, TEST_USER_ID);
      expect(first.status).toBe(200);
      expect(first.cache).toBe('MISS');

      const second = await getUser(request, env.baseURL, TEST_USER_ID);
      expect(second.status).toBe(200);
      expect(second.cache).toBe('HIT');

      await forceCacheInvalidation(request, env.baseURL, TEST_USER_ID);
    });

    test('PUT after cache is set invalidates it', async ({ request }) => {
      // Populate the cache, then explicitly confirm it's set (HIT)
      // before trying to delete it.
      await getUser(request, env.baseURL, TEST_USER_ID); // MISS, populates
      const primed = await getUser(request, env.baseURL, TEST_USER_ID);
      expect(primed.cache, 'cache should be populated before testing invalidation').toBe('HIT');

      const newSalary = await forceCacheInvalidation(request, env.baseURL, TEST_USER_ID);

      const after = await getUser(request, env.baseURL, TEST_USER_ID);
      expect(after.status).toBe(200);
      expect(after.cache).toBe('MISS');
      expect(after.body.salary).toBe(newSalary);
    });
  });
}
