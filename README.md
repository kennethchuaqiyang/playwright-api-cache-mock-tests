# playwright-api-cache-mock-tests

Playwright API automation covering the three cache-mock-api backends:
[redis-cache-mock-api](https://github.com/kennethchuaqiyang/redis-cache-mock-api), [inmemory-cache-mock-api](https://github.com/kennethchuaqiyang/inmemory-cache-mock-api), and [elk-cache-mock-api](https://github.com/kennethchuaqiyang/elk-cache-mock-api) (local-only).

Mirrors [go-api-cache-mock-tests](https://github.com/kennethchuaqiyang/go-api-cache-mock-tests) — same three test cases, same target APIs, different framework.

**CI:** [Jenkins job](http://localhost:8080/job/playwright-api-cache-mock-tests/) — Redis and in-memory only, on every SCM poll, with the Playwright HTML report published alongside the JUnit results.

## Test cases

`tests/redis-inmemory-cache.spec.ts` (Redis + in-memory) and `tests/elk-cache.spec.ts` (ELK, local-only):

1. **GET, first time / not cached → MISS.** Ends by forcing a genuine update, so the cache is guaranteed empty for whatever runs next.
2. **GET, second time within TTL → HIT.** Same cleanup at the end.
3. **PUT after the cache is confirmed set (HIT) → invalidates it.** The next GET must MISS and reflect the new value.

`forceCacheInvalidation()` keeps bumping the candidate salary and retrying until the API confirms `"Success"`, rather than accepting a coincidental `"No update"` no-op as a completed action.

## A real concurrency bug found during setup

Playwright's default scaffold runs every test across three browser projects (chromium/firefox/webkit) — meaningless for pure API tests that never launch a browser, but worse: those three projects ran **concurrently against the same live cache and Postgres row**, causing real cross-project races (one project's `PUT` invalidating a cache entry mid-assertion in another). Fixed by:

- Reducing `playwright.config.ts` to a single `api` project
- `fullyParallel: false` — `test.describe.serial()` only orders tests *within* a block, it doesn't stop a different block (or spec file) running concurrently in another worker
- `workers: 1` — the actual enforcement: only one test executes at any moment, across the whole run

The trade-off is speed for correctness, which is the right call for integration tests against shared live infrastructure.

## Environment variables

| Var | Default |
|---|---|
| `REDIS_BASE_URL` | `https://redis-cache-mock-api.onrender.com` |
| `INMEMORY_BASE_URL` | `https://inmemory-cache-mock-api.onrender.com` |
| `ELK_BASE_URL` | `http://localhost:8082` |
| `TEST_USER_ID` | `2` |

## Running locally

```bash
npm ci

# Redis + in-memory (against live Render deployments by default)
npx playwright test tests/redis-inmemory-cache.spec.ts

# ELK (requires local Elasticsearch + elk-cache-mock-api running)
npx playwright test tests/elk-cache.spec.ts

# view the HTML report after a run
npx playwright show-report
```

## CI

The Jenkins pipeline (`mcr.microsoft.com/playwright:v1.62.1-jammy` Docker agent) runs only `redis-inmemory-cache.spec.ts`. Results are published two ways: JUnit XML (Jenkins' native `Tests` view) and the actual Playwright HTML report, via the HTML Publisher plugin.