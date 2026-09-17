# playwright-api-cache-mock-tests

Playwright API automation covering [redis-cache-mock-api](https://github.com/kennethchuaqiyang/redis-cache-mock-api) and [inmemory-cache-mock-api](https://github.com/kennethchuaqiyang/inmemory-cache-mock-api).

Mirrors [go-api-cache-mock-tests](https://github.com/kennethchuaqiyang/go-api-cache-mock-tests) — same test cases, same target APIs, different framework.

The equivalent spec file for [elk-cache-mock-api](https://github.com/kennethchuaqiyang/elk-cache-mock-api) (`elk-cache.spec.ts`) is **not** in this repo — it's kept as a standalone backup in [elk-cache-tests-backup](https://github.com/kennethchuaqiyang/elk-cache-tests-backup), since ELK runs locally-only and isn't part of this repo's CI story.

**CI:** [Jenkins job](http://localhost:8080/job/playwright-api-cache-mock-tests/) — on every SCM poll, with the Playwright HTML report published alongside the JUnit results.

## Test cases

`tests/redis-inmemory-cache.spec.ts` covers both backends (`redis`, `inmemory`), running the same three cases per environment:

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
| `TEST_USER_ID` | `2` |

## Running locally

```bash
npm ci
npx playwright test tests/redis-inmemory-cache.spec.ts

# view the HTML report after a run
npx playwright show-report
```

## Running the ELK tests

Not part of this repo — see [elk-cache-tests-backup](https://github.com/kennethchuaqiyang/elk-cache-tests-backup) for `elk-cache.spec.ts` and its own run instructions (requires a local Elasticsearch + `elk-cache-mock-api`).

## CI

The Jenkins pipeline (`mcr.microsoft.com/playwright:v1.62.1-jammy` Docker agent) runs `redis-inmemory-cache.spec.ts`. Results are published two ways: JUnit XML (Jenkins' native `Tests` view) and the actual Playwright HTML report, via the HTML Publisher plugin.