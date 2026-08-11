import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const reviewWorkflowPath = ".github/workflows/opencode-review.yml";
const retryDelaysSeconds = Object.freeze([10, 30, 90]);
const retryableArtifactPattern = /^opencode-review-retryable-([1-9]\d*)-([1-9]\d*)-([a-f0-9]{40})$/;
const githubRequestTimeoutMs = 30_000;

class GitHubRecoveryError extends Error {
  constructor(message, { status, requestId } = {}) {
    super(message);
    this.name = "GitHubRecoveryError";
    if (status !== undefined) this.status = status;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseRepository(repository) {
  if (typeof repository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new TypeError("GITHUB_REPOSITORY must be owner/repo.");
  }
  return repository;
}

function extractRequestId(response) {
  for (const header of ["x-github-request-id", "x-request-id"]) {
    const value = response?.headers?.get?.(header);
    if (value) return value;
  }
  return undefined;
}

class GitHubRecoveryClient {
  constructor({ repository, token, fetchImpl = fetch } = {}) {
    this.repository = parseRepository(repository);
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, apiPath, { body, params } = {}) {
    const url = new URL(`https://api.github.com/repos/${this.repository}${apiPath}`);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(githubRequestTimeoutMs),
      });
    } catch {
      throw new GitHubRecoveryError("GitHub recovery request failed.");
    }
    if (!response?.ok) {
      throw new GitHubRecoveryError("GitHub recovery request failed.", {
        status: response?.status,
        requestId: extractRequestId(response),
      });
    }
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new GitHubRecoveryError("GitHub recovery response was malformed.", {
        status: response.status,
        requestId: extractRequestId(response),
      });
    }
  }

  getWorkflowRun(runId) {
    return this.request("GET", `/actions/runs/${runId}`);
  }

  async listWorkflowRunArtifacts(runId) {
    const response = await this.request("GET", `/actions/runs/${runId}/artifacts`, {
      params: { per_page: 100 },
    });
    if (!Array.isArray(response?.artifacts)) {
      throw new GitHubRecoveryError("GitHub workflow artifacts response was malformed.");
    }
    return response.artifacts;
  }

  getPullRequest(pullNumber) {
    return this.request("GET", `/pulls/${pullNumber}`);
  }

  rerunFailedJobs(runId) {
    return this.request("POST", `/actions/runs/${runId}/rerun-failed-jobs`, {
      body: { enable_debug_logging: false },
    });
  }
}

function selectRetryableMarker(artifacts, { runId, runAttempt }) {
  const candidates = [];
  for (const artifact of artifacts) {
    const match = retryableArtifactPattern.exec(artifact?.name ?? "");
    if (!match || Number(match[1]) !== runAttempt) continue;
    if (!Number.isSafeInteger(artifact?.id) || artifact.id <= 0 || artifact.expired === true) continue;
    if (artifact.workflow_run?.id !== undefined && artifact.workflow_run.id !== runId) continue;
    candidates.push({
      artifactId: artifact.id,
      name: artifact.name,
      runAttempt,
      pullNumber: Number(match[2]),
      headSha: match[3],
    });
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

function validateRun(run, { runId, runAttempt, marker }) {
  return (
    run?.id === runId
    && run.path === reviewWorkflowPath
    && run.event === "workflow_run"
    && run.status === "completed"
    && run.conclusion === "failure"
    && run.run_attempt === runAttempt
    && run.display_title === `opencode-review:${marker.headSha}`
  );
}

function validatePullRequest(pullRequest, { baseBranch, marker }) {
  return (
    pullRequest?.number === marker.pullNumber
    && pullRequest.state === "open"
    && pullRequest.base?.ref === baseBranch
    && pullRequest.head?.sha === marker.headSha
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function recoverOpenCodeReview({
  client,
  runId,
  baseBranch = "master",
  delaysSeconds = retryDelaysSeconds,
  sleepImpl = sleep,
}) {
  const initialRun = await client.getWorkflowRun(runId);
  const runAttempt = initialRun?.run_attempt;
  if (!Number.isSafeInteger(runAttempt) || runAttempt <= 0) {
    return { status: "skipped", reason: "workflow run attempt is invalid" };
  }
  if (runAttempt > delaysSeconds.length) {
    return { status: "skipped", reason: `maximum recovery attempts reached at attempt ${runAttempt}` };
  }

  const artifacts = await client.listWorkflowRunArtifacts(runId);
  const marker = selectRetryableMarker(artifacts, { runId, runAttempt });
  if (!marker) {
    return { status: "skipped", reason: `attempt ${runAttempt} has no unique retryable failure marker` };
  }
  if (!validateRun(initialRun, { runId, runAttempt, marker })) {
    return { status: "skipped", reason: "workflow run is not an eligible failed OpenCode review" };
  }

  const initialPullRequest = await client.getPullRequest(marker.pullNumber);
  if (!validatePullRequest(initialPullRequest, { baseBranch, marker })) {
    return { status: "skipped", reason: "pull request is closed, moved, or targets another base" };
  }

  const delaySeconds = delaysSeconds[runAttempt - 1];
  await sleepImpl(delaySeconds * 1000);

  const [currentRun, currentPullRequest] = await Promise.all([
    client.getWorkflowRun(runId),
    client.getPullRequest(marker.pullNumber),
  ]);
  if (!validateRun(currentRun, { runId, runAttempt, marker })) {
    return { status: "skipped", reason: "workflow run changed during recovery backoff" };
  }
  if (!validatePullRequest(currentPullRequest, { baseBranch, marker })) {
    return { status: "skipped", reason: "pull request changed during recovery backoff" };
  }

  await client.rerunFailedJobs(runId);
  return {
    status: "rerun_requested",
    runId,
    runAttempt,
    nextAttempt: runAttempt + 1,
    pullNumber: marker.pullNumber,
    headSha: marker.headSha,
    delaySeconds,
  };
}

function appendStepSummary(result, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryPath) return;
  const fields = [
    "## OpenCode review recovery",
    "",
    `Status: ${result.status}`,
    ...(result.reason ? [`Reason: ${result.reason}`] : []),
    ...(result.runId ? [`Run: ${result.runId}`] : []),
    ...(result.pullNumber ? [`Pull request: #${result.pullNumber}`] : []),
    ...(result.nextAttempt ? [`Next attempt: ${result.nextAttempt}`] : []),
    ...(result.delaySeconds ? [`Backoff: ${result.delaySeconds}s`] : []),
    "",
  ];
  appendFileSync(summaryPath, `${fields.join("\n")}\n`);
}

async function main(options = {}) {
  const env = options.env ?? process.env;
  if (!env.GITHUB_TOKEN) throw new TypeError("GITHUB_TOKEN is required.");
  const repository = parseRepository(env.GITHUB_REPOSITORY);
  const runId = positiveInteger(env.OPENCODE_RECOVERY_RUN_ID, "OPENCODE_RECOVERY_RUN_ID");
  const baseBranch = env.OPENCODE_RECOVERY_BASE_BRANCH || "master";
  const client = options.client ?? new GitHubRecoveryClient({ repository, token: env.GITHUB_TOKEN });
  const result = await recoverOpenCodeReview({
    client,
    runId,
    baseBranch,
    ...(options.delaysSeconds ? { delaysSeconds: options.delaysSeconds } : {}),
    ...(options.sleepImpl ? { sleepImpl: options.sleepImpl } : {}),
  });
  appendStepSummary(result, options.summaryPath ?? env.GITHUB_STEP_SUMMARY);
  console.log(result.status === "rerun_requested"
    ? `Requested OpenCode review run ${runId} attempt ${result.nextAttempt}.`
    : `Skipped OpenCode review recovery: ${result.reason}.`);
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const fields = [error instanceof Error ? error.message : "OpenCode review recovery failed."];
    if (error?.status !== undefined) fields.push(`status=${error.status}`);
    if (error?.requestId !== undefined) fields.push(`request_id=${error.requestId}`);
    console.error(fields.join(" "));
    process.exitCode = 1;
  });
}

export {
  GitHubRecoveryClient,
  appendStepSummary,
  main,
  recoverOpenCodeReview,
  selectRetryableMarker,
  validatePullRequest,
  validateRun,
};
