# OpenCode Per-File Model Retry Design

## Goal

Recover automatically when an individual OpenCode model request fails transiently, without rerunning successful file reviews or the entire GitHub Actions workflow.

## Problem

PR #101 contained seven reviewable files. The first workflow attempt completed four model reviews, then three requests timed out after 180 seconds. The current orchestration converts each timeout directly into a file warning, and any warning makes the review gate fail. Rerunning the whole workflow repeats workflow setup and can leave a fresh review gate pending even though earlier file reviews already succeeded.

## Design

Add the retry policy at the per-file orchestration boundary in `scripts/opencode-review.mjs`. A file review may make at most two model requests: the initial request and one immediate retry.

Retry only a `ReviewFailure` whose stage is `model-request` and whose `retryable` property is `true`. The OpenCode client will classify timeouts and transport failures as retryable, in addition to the existing HTTP 429 and HTTP 5xx classification. Invalid model configuration, unsupported requests, other HTTP 4xx responses, and `model-response` validation failures remain non-retryable.

The retry is immediate. No configurable retry count, backoff policy, or workflow-level rerun mechanism is introduced.

## Result Handling

- If the first request succeeds, publish the normal file review after one attempt.
- If the first request fails transiently and the retry succeeds, publish the normal file review.
- If both retryable attempts fail, publish the existing sanitized file warning and fail the review gate.
- If a non-retryable failure occurs, publish the existing warning after one attempt and fail the gate.
- Successful and cached file reviews are not repeated because another file needs a retry.

The existing comment markers, summaries, check-run conclusions, commit-status gate, source redaction, and provider request payload remain unchanged.

## Testing

Add focused orchestration tests proving:

- a successful model request is attempted once;
- a retryable model-request failure is attempted twice and can recover;
- two retryable failures produce the existing warning and failed gate;
- a non-retryable model-request failure is attempted once;
- a model-response failure is attempted once.

Update client tests to require timeout and transport failures to be retryable while retaining the existing HTTP status classifications and sanitized diagnostics. Run the focused OpenCode tests, the workflow tests, and the complete test suite.

## Success Criteria

- PRs recover from one transient model-request failure per file without a workflow rerun.
- No file makes more than two model requests in one review run.
- Permanent failures are not retried.
- Exhausted retries remain visible and continue to fail the review gate.
- No secret, submitted source, or raw provider response is added to diagnostics.

## Out of Scope

- Parallel model requests
- More than one retry
- Delayed or exponential backoff
- Reading provider `Retry-After` headers
- Automatically rerunning GitHub Actions
- Changing the 180-second request deadline or 45-minute job timeout
