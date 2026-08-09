// Repository-wide managed review comment synchronization.
//
// Reads current solution path/content hash pairs from the generated progress
// metadata, paginates the repository-wide issue-comments endpoint, filters
// comments through the verified Task 4 parser (scripts/review-artifacts-core.mjs),
// and atomically publishes one split JSON per current-hash review plus a status
// index under `public/generated/reviews/`.
//
// Failure model (documented split):
//   - Safe failures (-> unavailable index, workflow warning, resolve normally):
//     absent credentials/repository, unreadable progress metadata, GitHub API
//     HTTP/rate-limit/network/timeout errors, malformed or non-array responses.
//     The deploy must never be blocked by an auxiliary review-sync outage.
//   - Programmer/config errors (-> throw, non-zero CLI exit):
//     invalid option types, malformed `owner/repo`, invalid page/max limits,
//     a `progress` option that is not an object, and filesystem errors while
//     writing the output tree (cannot even produce the unavailable index).
//
// Safety guarantees:
//   - Token and raw comment bodies are never logged; diagnostics carry only
//     reason codes, HTTP status, and a GitHub request id.
//   - Pagination is capped at `maxPages` pages / `maxComments` comments.
//   - Output is staged in a sibling temp directory on the same filesystem and
//     swapped in with rename(); partial data never lands in the target path.
//   - Old/temp sibling directories are cleaned on success and every failure.

import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseReviewArtifact } from "./review-artifacts-core.mjs";

const schemaVersion = 1;
const defaultPerPage = 100;
const defaultMaxPages = 20;
const defaultMaxComments = 2000;
const defaultRequestTimeoutMs = 30_000;
const apiVersion = "2022-11-28";
const mediaType = "application/vnd.github.full+json";
const hex64Pattern = /^[a-f0-9]{64}$/;
const repositoryPattern = /^[^/\s]+\/[^/\s]+$/;
const requestIdHeaderNames = ["x-github-request-id", "x-request-id", "cf-ray"];

class SyncFailure extends Error {
  constructor(reason, { httpStatus, requestId } = {}) {
    super(reason);
    this.name = "SyncFailure";
    this.reason = reason;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

function extractRequestId(response) {
  const headers = response?.headers;
  if (!headers) return undefined;
  for (const name of requestIdHeaderNames) {
    const value = typeof headers.get === "function" ? headers.get(name) : headers[name] ?? headers[name.toLowerCase()];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function safeWarning(reason, failure) {
  const parts = [`Review sync unavailable: ${reason}`];
  if (failure?.httpStatus !== undefined) parts.push(`http_status=${failure.httpStatus}`);
  if (failure?.requestId !== undefined) parts.push(`request_id=${failure.requestId}`);
  parts.push("Deploying without review assets.");
  return parts.join(" ");
}

/**
 * Collect the strict path/content SHA-256 pairs from progress metadata.
 * Records missing either key, or with non-64-hex values, are ignored.
 * Returns a Set of "pathKey:contentKey" strings.
 */
export function collectCurrentHashPairs(progress) {
  const pairs = new Set();
  if (!progress || typeof progress !== "object") return pairs;
  const users = Array.isArray(progress) ? progress : progress.users;
  if (!Array.isArray(users)) return pairs;
  for (const user of users) {
    if (!Array.isArray(user?.submissions)) continue;
    for (const submission of user.submissions) {
      const pathKey = submission?.solutionPathKey;
      const contentKey = submission?.solutionContentKey;
      if (typeof pathKey !== "string" || typeof contentKey !== "string") continue;
      if (!hex64Pattern.test(pathKey) || !hex64Pattern.test(contentKey)) continue;
      pairs.add(`${pathKey}:${contentKey}`);
    }
  }
  return pairs;
}

function buildCommentsUrl({ owner, repo, perPage, page }) {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues/comments`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  return url;
}

function buildHeaders(token) {
  return {
    Accept: mediaType,
    "X-GitHub-Api-Version": apiVersion,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchPage({ fetchImpl, url, token, requestTimeoutMs }) {
  let timer;
  const controller = new AbortController();
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new SyncFailure("timeout"));
    }, requestTimeoutMs);
  });
  let response;
  try {
    response = await Promise.race([
      fetchImpl(url, { headers: buildHeaders(token), signal: controller.signal }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof SyncFailure) throw error;
    throw new SyncFailure("network_error");
  } finally {
    clearTimeout(timer);
  }

  if (!response?.ok) {
    const httpStatus = response?.status;
    const requestId = extractRequestId(response);
    const reason = httpStatus === 429 ? "rate_limited" : "http_error";
    throw new SyncFailure(reason, {
      ...(httpStatus === undefined ? {} : { httpStatus }),
      ...(requestId === undefined ? {} : { requestId }),
    });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new SyncFailure("malformed_response");
  }
  if (!Array.isArray(body)) {
    throw new SyncFailure("malformed_response");
  }
  return body;
}

async function fetchAllComments({ fetchImpl, owner, repo, token, perPage, maxPages, maxComments, requestTimeoutMs }) {
  const comments = [];
  let pagesFetched = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = buildCommentsUrl({ owner, repo, perPage, page });
    const pageComments = await fetchPage({ fetchImpl, url, token, requestTimeoutMs });
    pagesFetched += 1;
    comments.push(...pageComments);
    if (pageComments.length < perPage) break; // short page -> no more pages
    if (comments.length >= maxComments) break; // hard cap
  }
  return { comments, pagesFetched };
}

/**
 * Parse every raw comment once through the verified Task 4 parser, keep only
 * artifacts whose path/content pair is currently expected, and select the
 * newest comment per pair (newest `updated_at`, then highest numeric id).
 */
export function selectArtifacts(comments, currentPairs) {
  const newestByPair = new Map();
  for (const comment of comments) {
    const artifact = parseReviewArtifact(comment);
    if (!artifact) continue;
    const pair = `${artifact.pathKey}:${artifact.contentKey}`;
    if (!currentPairs.has(pair)) continue;
    const existing = newestByPair.get(pair);
    if (!existing) {
      newestByPair.set(pair, { artifact, comment });
      continue;
    }
    const currentTime = Date.parse(existing.artifact.updatedAt);
    const candidateTime = Date.parse(artifact.updatedAt);
    const isNewer = candidateTime > currentTime
      || (candidateTime === currentTime && comment.id > existing.comment.id);
    if (isNewer) newestByPair.set(pair, { artifact, comment });
  }
  return [...newestByPair.values()].map(({ artifact }) => artifact);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Remove leftover sibling temp/old directories from a previously interrupted
 * run (e.g. a crashed process between the two rename() steps). Kept scoped to
 * the exact `.${base}.tmp-*` / `.${base}.old-*` prefixes so no foreign data is
 * ever touched.
 */
async function sweepStaleSiblings(parent, base) {
  let entries;
  try {
    entries = await readdir(parent, { withFileTypes: true });
  } catch {
    return;
  }
  const tmpPrefix = `.${base}.tmp-`;
  const oldPrefix = `.${base}.old-`;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(tmpPrefix) || entry.name.startsWith(oldPrefix)) {
      await rm(path.join(parent, entry.name), { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function listFilesRecursive(dir, base = "") {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(path.join(dir, entry.name), rel)));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/**
 * Stage `files` (relativePath + content) into a sibling temp directory on the
 * same filesystem, then atomically swap it over `outputDir`. The previous tree
 * is moved aside and deleted only after the swap succeeds; on failure the old
 * tree is restored and the temp dir removed. Returns the removed relative
 * paths (previous files not present in the new tree).
 */
async function atomicWriteTree({ outputDir, files }) {
  const parent = path.dirname(outputDir);
  const base = path.basename(outputDir);
  await mkdir(parent, { recursive: true });
  await sweepStaleSiblings(parent, base);

  const previousFiles = await listFilesRecursive(outputDir);
  const tempDir = await mkdtemp(path.join(parent, `.${base}.tmp-`));
  let oldDir;
  try {
    for (const file of files) {
      const filePath = path.join(tempDir, file.relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content);
    }

    if (await pathExists(outputDir)) {
      oldDir = path.join(parent, `.${base}.old-${Date.now()}-${process.pid}`);
      await rename(outputDir, oldDir);
    }
    await rename(tempDir, outputDir);
    if (oldDir) await rm(oldDir, { recursive: true, force: true });
  } catch (error) {
    if (oldDir) {
      try {
        await rm(outputDir, { recursive: true, force: true });
        await rename(oldDir, outputDir);
      } catch {
        // Best-effort rollback; the original error is the one to report.
      }
    }
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  const writtenSet = new Set(files.map((file) => file.relativePath));
  return { removed: previousFiles.filter((file) => !writtenSet.has(file)) };
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildIndex({ status, revision, generatedAt, keys, reason, counts }) {
  return {
    schemaVersion,
    revision,
    status,
    ...(reason ? { reason } : {}),
    ...(status === "complete" ? { keys } : {}),
    generatedAt,
    counts,
  };
}

async function readProgress(progressPath, progress) {
  if (progress !== undefined) return progress;
  try {
    return JSON.parse(await readFile(progressPath, "utf8"));
  } catch {
    throw new SyncFailure("progress_unavailable");
  }
}

/**
 * Synchronize repository-wide managed reviews into split Pages assets.
 *
 * `options`:
 *   fetchImpl        - injectable fetch (default: global fetch)
 *   repository       - "owner/repo"; from GITHUB_REPOSITORY in the CLI
 *   token            - bearer token, only present in Actions
 *   progress         - injected progress object (tests); else read progressPath
 *   progressPath     - default <cwd>/data/progress.json
 *   outputDir        - default <cwd>/public/generated/reviews
 *   revision         - build revision for the index; default SOURCE_REVISION/GITHUB_SHA/"local"
 *   now              - injectable Date for generatedAt (tests)
 *   logger           - injectable { log, warn }
 *   perPage/maxPages/maxComments/requestTimeoutMs - pagination and timeout limits
 *
 * Resolves with { status: "complete"|"unavailable", reason?, index, written,
 * removed, counts }. Safe failures resolve normally; programmer/config errors
 * throw.
 */
export async function syncReviewArtifacts(options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    repository,
    token,
    progress,
    progressPath = path.resolve(process.cwd(), "data", "progress.json"),
    outputDir = path.resolve(process.cwd(), "public", "generated", "reviews"),
    revision = process.env.SOURCE_REVISION || process.env.GITHUB_SHA || "local",
    now = new Date(),
    logger = console,
    perPage = defaultPerPage,
    maxPages = defaultMaxPages,
    maxComments = defaultMaxComments,
    requestTimeoutMs = defaultRequestTimeoutMs,
  } = options;

  // Programmer/config validation: unsafe to continue -> throw explicitly.
  if (typeof fetchImpl !== "function") throw new TypeError("sync-review-artifacts: fetchImpl must be a function");
  if (repository !== undefined && (typeof repository !== "string" || !repositoryPattern.test(repository))) {
    throw new TypeError("sync-review-artifacts: repository must be owner/repo");
  }
  if (!Number.isInteger(perPage) || perPage < 1) throw new TypeError("sync-review-artifacts: perPage must be a positive integer");
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new TypeError("sync-review-artifacts: maxPages must be a positive integer");
  if (!Number.isInteger(maxComments) || maxComments < 1) throw new TypeError("sync-review-artifacts: maxComments must be a positive integer");
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) throw new TypeError("sync-review-artifacts: requestTimeoutMs must be a positive integer");
  if (typeof progressPath !== "string" || !progressPath) throw new TypeError("sync-review-artifacts: progressPath must be a non-empty string");
  if (typeof outputDir !== "string" || !outputDir) throw new TypeError("sync-review-artifacts: outputDir must be a non-empty string");
  if (progress !== undefined && (typeof progress !== "object" || progress === null)) {
    throw new TypeError("sync-review-artifacts: progress must be an object");
  }
  if (typeof logger?.log !== "function" || typeof logger?.warn !== "function") {
    throw new TypeError("sync-review-artifacts: logger must provide log and warn");
  }

  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const repositoryMatch = repositoryPattern.exec(repository ?? "");

  // Credentials/repository absent (local invocation): unavailable, no fetch, no leak.
  if (!repositoryMatch || !token) {
    const index = buildIndex({
      status: "unavailable",
      revision,
      generatedAt,
      reason: "credentials_missing",
      counts: { reviews: 0, currentSolutions: 0, pagesFetched: 0, commentsFetched: 0 },
    });
    const { removed } = await atomicWriteTree({ outputDir, files: [{ relativePath: "index.json", content: serialize(index) }] });
    logger.warn(safeWarning("credentials_missing"));
    return {
      status: "unavailable",
      reason: "credentials_missing",
      index,
      written: ["index.json"],
      removed,
      counts: index.counts,
    };
  }

  const [owner, repo] = repository.split("/");

  // Read current hash pairs. Unreadable/malformed progress is a safe failure.
  let progressData;
  try {
    progressData = await readProgress(progressPath, progress);
  } catch (error) {
    if (error instanceof SyncFailure) {
      const index = buildIndex({
        status: "unavailable",
        revision,
        generatedAt,
        reason: error.reason,
        counts: { reviews: 0, currentSolutions: 0, pagesFetched: 0, commentsFetched: 0 },
      });
      const { removed } = await atomicWriteTree({ outputDir, files: [{ relativePath: "index.json", content: serialize(index) }] });
      logger.warn(safeWarning(error.reason));
      return {
        status: "unavailable",
        reason: error.reason,
        index,
        written: ["index.json"],
        removed,
        counts: index.counts,
      };
    }
    throw error;
  }

  const currentPairs = collectCurrentHashPairs(progressData);
  const currentSolutions = currentPairs.size;

  // Nothing current to match: publish an empty complete index without fetching.
  if (currentPairs.size === 0) {
    const counts = { reviews: 0, currentSolutions: 0, pagesFetched: 0, commentsFetched: 0 };
    const index = buildIndex({ status: "complete", revision, generatedAt, keys: [], counts });
    const files = [{ relativePath: "index.json", content: serialize(index) }];
    const { removed } = await atomicWriteTree({ outputDir, files });
    logger.log(`Review sync complete: 0 reviews for 0 current solutions.`);
    return { status: "complete", index, written: ["index.json"], removed, counts };
  }

  let comments = [];
  let pagesFetched = 0;
  try {
    const result = await fetchAllComments({ fetchImpl, owner, repo, token, perPage, maxPages, maxComments, requestTimeoutMs });
    comments = result.comments;
    pagesFetched = result.pagesFetched;
  } catch (error) {
    if (error instanceof SyncFailure) {
      const counts = { reviews: 0, currentSolutions, pagesFetched, commentsFetched: comments.length };
      const index = buildIndex({ status: "unavailable", revision, generatedAt, reason: error.reason, counts });
      const files = [{ relativePath: "index.json", content: serialize(index) }];
      const { removed } = await atomicWriteTree({ outputDir, files });
      logger.warn(safeWarning(error.reason, error));
      return { status: "unavailable", reason: error.reason, index, written: ["index.json"], removed, counts };
    }
    throw error;
  }

  const artifacts = selectArtifacts(comments, currentPairs);
  const files = artifacts.map((artifact) => ({
    relativePath: `${artifact.pathKey}/${artifact.contentKey}.json`,
    content: serialize(artifact),
  }));
  const keys = artifacts.map(({ pathKey: p, contentKey: c }) => ({ pathKey: p, contentKey: c }));
  const counts = { reviews: artifacts.length, currentSolutions, pagesFetched, commentsFetched: comments.length };
  const index = buildIndex({ status: "complete", revision, generatedAt, keys, counts });
  files.push({ relativePath: "index.json", content: serialize(index) });

  const { removed } = await atomicWriteTree({ outputDir, files });
  logger.log(`Review sync complete: ${artifacts.length} review(s) for ${currentSolutions} current solution(s) (${pagesFetched} page(s), ${comments.length} comment(s)).`);
  return {
    status: "complete",
    index,
    written: files.map((file) => file.relativePath),
    removed,
    counts,
  };
}

async function runCli() {
  return syncReviewArtifacts({
    fetchImpl: globalThis.fetch,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    revision: process.env.SOURCE_REVISION || process.env.GITHUB_SHA || "local",
    logger: console,
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await runCli();
  if (result.status === "complete") {
    console.log(`Review sync complete: ${result.counts.reviews} review(s) for ${result.counts.currentSolutions} current solution(s).`);
  } else {
    console.log(`Review sync unavailable (${result.reason}); deploy continues without review assets.`);
  }
}

export { SyncFailure };
