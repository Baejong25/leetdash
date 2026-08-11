import { describe, expect, it } from "vitest";

import {
  GitHubRecoveryClient,
  recoverOpenCodeReview,
  selectRetryableMarker,
} from "../scripts/recover-opencode-review.mjs";

const runId = 901;
const pullNumber = 42;
const headSha = "a".repeat(40);

function workflowRun(overrides = {}) {
  return {
    id: runId,
    path: ".github/workflows/opencode-review.yml",
    event: "workflow_run",
    status: "completed",
    conclusion: "failure",
    run_attempt: 1,
    display_title: `opencode-review:${headSha}`,
    ...overrides,
  };
}

function retryableArtifact(attempt = 1, overrides = {}) {
  return {
    id: 701 + attempt,
    name: `opencode-review-retryable-${attempt}-${pullNumber}-${headSha}`,
    expired: false,
    workflow_run: { id: runId },
    ...overrides,
  };
}

function pullRequest(overrides = {}) {
  return {
    number: pullNumber,
    state: "open",
    base: { ref: "master" },
    head: { sha: headSha },
    ...overrides,
  };
}

function recoveryClient({ runs, artifacts, pullRequests } = {}) {
  const calls = [];
  const runValues = runs ?? [workflowRun(), workflowRun()];
  const pullValues = pullRequests ?? [pullRequest(), pullRequest()];
  return {
    calls,
    getWorkflowRun: async (id) => {
      calls.push(["getWorkflowRun", id]);
      return runValues.shift();
    },
    listWorkflowRunArtifacts: async (id) => {
      calls.push(["listWorkflowRunArtifacts", id]);
      return artifacts ?? [retryableArtifact()];
    },
    getPullRequest: async (number) => {
      calls.push(["getPullRequest", number]);
      return pullValues.shift();
    },
    rerunFailedJobs: async (id) => {
      calls.push(["rerunFailedJobs", id]);
    },
  };
}

describe("OpenCode review recovery policy", () => {
  it.each([
    [1, 10],
    [2, 30],
    [3, 90],
  ])("backs off at workflow attempt %s for %ss before re-running failed jobs", async (attempt, delaySeconds) => {
    const run = workflowRun({ run_attempt: attempt });
    const client = recoveryClient({
      runs: [{ ...run }, { ...run }],
      artifacts: [retryableArtifact(attempt)],
    });
    const sleeps = [];

    await expect(recoverOpenCodeReview({
      client,
      runId,
      sleepImpl: async (milliseconds) => { sleeps.push(milliseconds); },
    })).resolves.toEqual({
      status: "rerun_requested",
      runId,
      runAttempt: attempt,
      nextAttempt: attempt + 1,
      pullNumber,
      headSha,
      delaySeconds,
    });

    expect(sleeps).toEqual([delaySeconds * 1000]);
    expect(client.calls.at(-1)).toEqual(["rerunFailedJobs", runId]);
  });

  it("fails closed when the failed run has no unique retryable marker", async () => {
    const client = recoveryClient({ artifacts: [] });

    await expect(recoverOpenCodeReview({ client, runId, sleepImpl: async () => {} })).resolves.toEqual({
      status: "skipped",
      reason: "attempt 1 has no unique retryable failure marker",
    });
    expect(client.calls).toEqual([
      ["getWorkflowRun", runId],
      ["listWorkflowRunArtifacts", runId],
    ]);
  });

  it("does not recover a permanent or ambiguous artifact signal", () => {
    expect(selectRetryableMarker([
      retryableArtifact(1, { expired: true }),
      { id: 99, name: `opencode-review-failure-1-${pullNumber}-${headSha}`, expired: false },
    ], { runId, runAttempt: 1 })).toBeUndefined();

    expect(selectRetryableMarker([
      retryableArtifact(),
      retryableArtifact(1, { id: 999 }),
    ], { runId, runAttempt: 1 })).toBeUndefined();
  });

  it("stops after the three configured recovery attempts", async () => {
    const client = recoveryClient({ runs: [workflowRun({ run_attempt: 4 })] });

    await expect(recoverOpenCodeReview({ client, runId, sleepImpl: async () => {} })).resolves.toEqual({
      status: "skipped",
      reason: "maximum recovery attempts reached at attempt 4",
    });
    expect(client.calls).toEqual([["getWorkflowRun", runId]]);
  });

  it("requires an open pull request with the same head and base", async () => {
    const client = recoveryClient({
      pullRequests: [pullRequest({ head: { sha: "b".repeat(40) } })],
    });

    await expect(recoverOpenCodeReview({ client, runId, sleepImpl: async () => {} })).resolves.toEqual({
      status: "skipped",
      reason: "pull request is closed, moved, or targets another base",
    });
    expect(client.calls.some(([name]) => name === "rerunFailedJobs")).toBe(false);
  });

  it("rechecks the run and pull request after backoff to avoid racing manual recovery", async () => {
    const client = recoveryClient({
      runs: [workflowRun(), workflowRun({ run_attempt: 2, status: "in_progress", conclusion: null })],
    });

    await expect(recoverOpenCodeReview({ client, runId, sleepImpl: async () => {} })).resolves.toEqual({
      status: "skipped",
      reason: "workflow run changed during recovery backoff",
    });
    expect(client.calls.some(([name]) => name === "rerunFailedJobs")).toBe(false);
  });
});

describe("GitHubRecoveryClient", () => {
  it("uses the failed-jobs rerun endpoint with Actions API headers", async () => {
    const requests = [];
    const client = new GitHubRecoveryClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(null, { status: 201 });
      },
    });

    await expect(client.rerunFailedJobs(runId)).resolves.toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(`https://api.github.com/repos/example/leetdash/actions/runs/${runId}/rerun-failed-jobs`);
    expect(requests[0].init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer github-secret",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    expect(JSON.parse(requests[0].init.body)).toEqual({ enable_debug_logging: false });
  });

  it("rejects malformed artifact responses without exposing their body", async () => {
    const client = new GitHubRecoveryClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async () => new Response(JSON.stringify({ artifacts: null, secret: "raw-secret" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(client.listWorkflowRunArtifacts(runId)).rejects.toThrow("GitHub workflow artifacts response was malformed.");
  });
});
