# OpenCode Per-File Model Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retry each transiently failed OpenCode model request once without repeating successful file reviews or rerunning the GitHub Actions workflow.

**Architecture:** Keep provider failure classification in `OpenCodeClient` and put retry policy at the per-file orchestration boundary in `opencode-review.mjs`. The orchestration will make at most two attempts and will preserve the existing warning, comment, check-run, and commit-status behavior when retry is not allowed or is exhausted.

**Tech Stack:** Node.js ES modules, GitHub Actions orchestration, Vitest

## Global Constraints

- Each file receives at most one initial model request and one immediate retry.
- Retry only `ReviewFailure` values with `stage === "model-request"` and `retryable === true`.
- Timeouts, transport failures, HTTP 408, HTTP 425, HTTP 429, and HTTP 5xx responses are retryable.
- Invalid model configuration, other HTTP 4xx responses, and model-response failures are not retryable.
- Do not add backoff, configurable retry counts, parallel requests, workflow reruns, or provider payload changes.
- Preserve sanitized diagnostics, the 180-second request deadline, and the 45-minute job timeout.

---

### Task 1: Classify OpenCode timeouts and transport failures as retryable

**Files:**
- Modify: `tests/opencode-review-clients.test.mjs:34-120`
- Modify: `scripts/opencode-review-clients.mjs:69-102`

**Interfaces:**
- Consumes: `OpenCodeClient.review({ model, apiKey, prompt })`
- Produces: `ReviewFailure` with `stage: "model-request"` and `retryable: true` for timeouts and transport failures

- [ ] **Step 1: Extend the timeout test and add a transport-failure test**

In the existing timeout assertion, require:

```js
expect(failure).toMatchObject({
  stage: "model-request",
  reason: "MODEL_REQUEST_FAILED",
  detail: "OpenCode request timed out after 180s.",
  retryable: true,
});
```

Add this test beside the timeout case:

```js
it("classifies transport failures as retryable without exposing request secrets", async () => {
  const apiKey = "transport-api-key";
  const rawFailure = "provider-network-sentinel";
  const client = new OpenCodeClient({
    fetchImpl: async () => { throw new Error(rawFailure); },
  });

  const failure = await client.review({
    model: "opencode-go/deepseek-v4-flash",
    apiKey,
    prompt: "review prompt",
  }).catch((error) => error);

  expect(failure).toMatchObject({
    stage: "model-request",
    reason: "MODEL_REQUEST_FAILED",
    retryable: true,
  });
  expect(failure.detail).not.toContain(apiKey);
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run:

```bash
npm test -- tests/opencode-review-clients.test.mjs
```

Expected: the timeout and transport tests fail because both failures currently default to `retryable: false`.

- [ ] **Step 3: Mark locally generated request failures as retryable**

Change the request-failure factory and timeout failure in `OpenCodeClient.review`:

```js
const requestFailure = (error) => new ReviewFailure({
  stage: "model-request",
  reason: "MODEL_REQUEST_FAILED",
  detail: error instanceof Error && error.message
    ? `OpenCode request failed: ${error.message}`
    : "OpenCode request failed.",
  retryable: true,
});
```

```js
reject(new ReviewFailure({
  stage: "model-request",
  reason: "MODEL_REQUEST_FAILED",
  detail: `OpenCode request timed out after ${openCodeRequestTimeoutMs / 1000}s.`,
  retryable: true,
}));
```

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run:

```bash
npm test -- tests/opencode-review-clients.test.mjs
```

Expected: all OpenCode and GitHub client tests pass.

- [ ] **Step 5: Commit the classification change**

```bash
git add tests/opencode-review-clients.test.mjs scripts/opencode-review-clients.mjs
git commit -m "fix: classify transient OpenCode failures"
```

---

### Task 2: Retry one transient model request per file

**Files:**
- Modify: `tests/opencode-review.test.mjs:220-410,1020-1060`
- Modify: `scripts/opencode-review.mjs:225-245`

**Interfaces:**
- Consumes: `ReviewFailure`, `openCodeClient.review({ model, apiKey, prompt })`
- Produces: `requestModelReview({ openCodeClient, model, apiKey, prompt }) -> Promise<string>`
- Preserves: `reviewOneFile(...) -> { status: "reviewed" | "reused" | "warning", ... }`

- [ ] **Step 1: Add a test proving one retry can recover**

Add to `describe("reviewPullRequest")`:

```js
it("retries one transient model-request failure for only the affected file", async () => {
  let attempts = 0;
  const { options, comments } = reviewOptions({
    openCodeClient: {
      review: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ReviewFailure({
            stage: "model-request",
            reason: "MODEL_REQUEST_FAILED",
            detail: "temporary",
            retryable: true,
          });
        }
        return passResult();
      },
    },
  });

  const result = await reviewPullRequest(options);

  expect(attempts).toBe(2);
  expect(result.results).toMatchObject([{ path: firstPath, status: "reviewed" }]);
  expect(result.failures).toEqual([]);
  expect(comments[0].body).toContain("찰싹봇의 코드 리뷰");
});
```

- [ ] **Step 2: Run the recovery test to verify RED**

Run:

```bash
npm test -- tests/opencode-review.test.mjs -t "retries one transient model-request failure"
```

Expected: FAIL because the file becomes a warning after one request and `attempts` is `1`.

- [ ] **Step 3: Add the minimal per-file retry helper**

Add immediately before `reviewOneFile`:

```js
async function requestModelReview({ openCodeClient, model, apiKey, prompt }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await openCodeClient.review({ model, apiKey, prompt });
    } catch (error) {
      const canRetry = error instanceof ReviewFailure
        && error.stage === "model-request"
        && error.retryable === true
        && attempt === 0;
      if (!canRetry) throw error;
    }
  }
  throw new Error("Unreachable model retry state.");
}
```

Replace the direct provider call in `reviewOneFile` with:

```js
const raw = await requestModelReview({ openCodeClient, model, apiKey, prompt });
```

- [ ] **Step 4: Run the recovery test to verify GREEN**

Run:

```bash
npm test -- tests/opencode-review.test.mjs -t "retries one transient model-request failure"
```

Expected: PASS with exactly two attempts and a normal file review.

- [ ] **Step 5: Add exhaustion and non-retry regression tests**

Add tests that exercise the real `reviewPullRequest` result:

```js
it("stops after two transient model-request failures and keeps the warning", async () => {
  let attempts = 0;
  const { options, comments } = reviewOptions({
    openCodeClient: {
      review: async () => {
        attempts += 1;
        throw new ReviewFailure({
          stage: "model-request",
          reason: "MODEL_REQUEST_FAILED",
          detail: "temporary",
          retryable: true,
        });
      },
    },
  });

  const result = await reviewPullRequest(options);

  expect(attempts).toBe(2);
  expect(result.results).toMatchObject([{ status: "warning" }]);
  expect(comments[0].body).toContain("MODEL_REQUEST_FAILED");
});
```

```js
it.each([
  ["permanent model request", new ReviewFailure({
    stage: "model-request",
    reason: "MODEL_REQUEST_FAILED",
    detail: "permanent",
    retryable: false,
  })],
  ["invalid model response", new ReviewFailure({
    stage: "model-response",
    reason: "MODEL_RESPONSE_INVALID",
    detail: "invalid",
    retryable: true,
  })],
])("does not retry a %s failure", async (_name, failure) => {
  let attempts = 0;
  const { options } = reviewOptions({
    openCodeClient: {
      review: async () => {
        attempts += 1;
        throw failure;
      },
    },
  });

  const result = await reviewPullRequest(options);

  expect(attempts).toBe(1);
  expect(result.results).toMatchObject([{ status: "warning" }]);
});
```

Update the existing CLI gate test to use `retryable: true`, count calls, and assert `reviewCalls === 2`; retain its assertions that the final status sequence is `["pending", "failure"]`.

- [ ] **Step 6: Run the focused orchestration tests**

Run:

```bash
npm test -- tests/opencode-review.test.mjs
```

Expected: all orchestration and CLI tests pass, including successful recovery, exhausted retries, non-retry failures, and the failed gate after exhaustion.

- [ ] **Step 7: Run the complete OpenCode test group**

Run:

```bash
npm test -- tests/opencode-review-core.test.mjs tests/opencode-review-clients.test.mjs tests/opencode-review.test.mjs tests/opencode-review-workflow.test.ts
```

Expected: all focused OpenCode tests pass.

- [ ] **Step 8: Commit the per-file retry**

```bash
git add tests/opencode-review.test.mjs scripts/opencode-review.mjs
git commit -m "fix: retry transient model requests per file"
```

---

### Task 3: Verify the integrated change

**Files:**
- Verify: all files changed in Tasks 1 and 2

**Interfaces:**
- Consumes: the complete repository test and lint configuration
- Produces: a clean, verified implementation branch

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: every repository test passes.

- [ ] **Step 2: Run static checks**

Run:

```bash
npm run lint
```

Expected: lint completes successfully with no new errors.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff --check HEAD~2
git status --short
```

Expected: `git diff --check` has no output and the worktree is clean.
