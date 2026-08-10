import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildMascotUrl,
  buildSourcePermalink,
  reviewContentKey,
  reviewFileKey,
} from "../scripts/opencode-review-core.mjs";
import { syncReviewArtifacts } from "../scripts/sync-review-artifacts.mjs";

// --- Fixture helpers ---------------------------------------------------------

// Model the REAL producer pipeline exactly like the Task 4 parser tests: the
// body a managed file review comment contains is renderReviewFileComment output
// (sanitized markdown with injected commit-pinned line permalinks).
const solutionPath = "submissions/whoisyourbias/programmers/12906/solution.java";
const source = Array.from({ length: 42 }, (_v, i) => `int value${i} = ${i};`).join("\n");
const pathKey = reviewFileKey(solutionPath);
const contentKey = reviewContentKey(source);

const staleSource = `${source}\n// changed`;
const staleContentKey = reviewContentKey(staleSource);
const stalePathKey = reviewFileKey("submissions/other/programmers/12906/solution.java");

const headSha = "0a134a1";
const serverUrl = "https://github.com";
const repository = "whoisyourbias/leetdash";
const runUrl = "https://github.com/whoisyourbias/leetdash/actions/runs/1234";
const sourceUrl = buildSourcePermalink({ serverUrl, repository, headSha, path: solutionPath });
const mascotUrl = buildMascotUrl({ serverUrl, repository, baseSha: headSha });

// Build a producer-shaped body whose marker lines carry the EXACT keys given,
// without re-hashing them (mirrors what the bot posts for an arbitrary path).
function markerBody({ markerPathKey = pathKey, markerContentKey = contentKey, prose = reviewProse }) {
  return [
    `<!-- leetdash-opencode-review-file:${markerPathKey} -->`,
    `<!-- leetdash-opencode-review-content:${markerContentKey} -->`,
    `<img src="${mascotUrl}" width="72" alt="찰싹봇 캐릭터" align="left">`,
    "## 찰싹봇의 코드 리뷰",
    "",
    `파일: [${solutionPath}](${sourceUrl})`,
    `커밋: ${headSha}`,
    `워크플로: ${runUrl}`,
    "",
    prose,
  ].join("\n");
}

const reviewProse = [
  "L15 `if (arr[i] === target) {` [분류: 정확성] target이 두 번 이상 등장하면 첫 인덱스만 반환합니다.",
  "L19 `return -1;` [분류: 스타일] 매직 넘버 대신 상수를 사용하세요.",
].join("\n");

function managedComment({ id, updatedAt, markerPathKey = pathKey, markerContentKey = contentKey, prose = reviewProse, body }) {
  return {
    id,
    user: { login: "github-actions[bot]" },
    html_url: `https://github.com/whoisyourbias/leetdash/pull/126#issuecomment-${id}`,
    updated_at: updatedAt,
    body: body ?? markerBody({ markerPathKey, markerContentKey, prose }),
  };
}

function progressFixture(pairs) {
  return {
    generatedAt: "2026-08-08T00:00:00.000Z",
    users: pairs.map((pair, index) => ({
      id: `user${index}`,
      displayName: `User ${index}`,
      githubUsername: `user${index}`,
      active: true,
      submissions: [
        {
          id: `user${index}:p${index}`,
          userId: `user${index}`,
          problemKey: `programmers:${100 + index}`,
          sourceKey: "programmers",
          submissionKey: String(100 + index),
          status: "SOLVED",
          language: "JAVA",
          solutionPath,
          solutionPathKey: pair.pathKey,
          solutionContentKey: pair.contentKey,
        },
      ],
    })),
  };
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function captureLogger() {
  const lines = [];
  return {
    lines,
    log: (message) => lines.push(`[log] ${message}`),
    warn: (message) => lines.push(`[warn] ${message}`),
  };
}

const revision = "398a0c8680e4aadde6b15e78656045349ff3d222";
const now = new Date("2026-08-08T12:00:00.000Z");
const token = "ghs_test-sync-token-abcdef";

async function makeOutputDir() {
  const root = await mkdtemp(path.join(tmpdir(), "reviews-sync-"));
  return {
    root,
    outputDir: path.join(root, "public", "generated", "reviews"),
    parentDir: path.join(root, "public", "generated"),
  };
}

async function listRelativeFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const nested of await listRelativeFiles(full)) files.push(`${entry.name}/${nested}`);
    } else {
      files.push(entry.name);
    }
  }
  return files.sort();
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function runSync({ fetchImpl, logger = captureLogger(), outputDir, ...options }) {
  return syncReviewArtifacts({
    fetchImpl,
    token,
    repository,
    revision,
    now,
    logger,
    outputDir,
    ...options,
  });
}

// --- Tests -------------------------------------------------------------------

describe("sync-review-artifacts: pagination and request contract", () => {
  afterEach(async () => {
    for (const root of []) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fetches one page, stops on a short page, and writes only matching current artifacts", async () => {
    const { outputDir, parentDir, root } = await makeOutputDir();
    const requests = [];
    const comments = [
      managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z" }),
      managedComment({ id: 2, updatedAt: "2026-08-08T09:00:00Z" }),
    ];
    const fetchImpl = async (url, init) => {
      requests.push({ url: String(url), headers: init.headers });
      return jsonResponse(comments);
    };

    const result = await runSync({
      fetchImpl,
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    });

    expect(requests).toHaveLength(1);
    expect(result.status).toBe("complete");
    expect(result.written.sort()).toEqual([`${pathKey}/${contentKey}.json`, "index.json"]);
    expect(result.removed).toEqual([]);

    const artifact = await readJson(path.join(outputDir, pathKey, `${contentKey}.json`));
    expect(artifact).toEqual({
      pathKey,
      contentKey,
      commentUrl: `https://github.com/whoisyourbias/leetdash/pull/126#issuecomment-2`,
      updatedAt: "2026-08-08T09:00:00Z",
      text: reviewProse,
      lineReferences: [
        { start: 15, end: 15 },
        { start: 19, end: 19 },
      ],
      reviews: [
        {
          text: reviewProse.split("\n")[0],
          lineReference: { start: 15, end: 15 },
        },
        {
          text: reviewProse.split("\n")[1],
          lineReference: { start: 19, end: 19 },
        },
      ],
    });

    const index = await readJson(path.join(outputDir, "index.json"));
    expect(index).toEqual({
      schemaVersion: 1,
      revision,
      status: "complete",
      generatedAt: "2026-08-08T12:00:00.000Z",
      keys: [{ pathKey, contentKey }],
      counts: { reviews: 1, currentSolutions: 1, pagesFetched: 1, commentsFetched: 2 },
    });

    // Only the intended files exist; no temp/old siblings leak.
    expect(await readdir(parentDir)).toEqual(["reviews"]);
    expect(await listRelativeFiles(outputDir)).toEqual([`${pathKey}/${contentKey}.json`, "index.json"]);
    await rm(root, { recursive: true, force: true });
  });

  it("paginates three full 100-item pages and stops on the short page", async () => {
    const { outputDir, root } = await makeOutputDir();
    const requests = [];
    // 100 + 100 + 39 = 239 managed comments across three pages.
    const makePage = (startId) =>
      Array.from({ length: 100 }, (_v, i) => managedComment({ id: startId + i, updatedAt: "2026-08-08T09:00:00Z" }));
    const page3 = Array.from({ length: 39 }, (_v, i) => managedComment({ id: 200 + i, updatedAt: "2026-08-08T09:00:00Z" }));
    const fetchImpl = async (url) => {
      requests.push(String(url));
      const page = Number(new URL(url).searchParams.get("page"));
      if (page === 1) return jsonResponse(makePage(1));
      if (page === 2) return jsonResponse(makePage(101));
      if (page === 3) return jsonResponse(page3);
      return jsonResponse([]);
    };

    const result = await runSync({
      fetchImpl,
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    });

    expect(requests).toHaveLength(3);
    expect(result.status).toBe("complete");
    expect(result.index.counts).toEqual({ reviews: 1, currentSolutions: 1, pagesFetched: 3, commentsFetched: 239 });
    // Newest (highest id 238 across all pages) comment wins the pair.
    const artifact = await readJson(path.join(outputDir, pathKey, `${contentKey}.json`));
    expect(artifact.commentUrl).toContain("#issuecomment-238");
    await rm(root, { recursive: true, force: true });
  });

  it("uses the exact query, media type, API version, and bearer auth header", async () => {
    const { outputDir, root } = await makeOutputDir();
    const requests = [];
    const fetchImpl = async (url, init) => {
      requests.push({ url: String(url), headers: init.headers });
      return jsonResponse([managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z" })]);
    };

    await runSync({ fetchImpl, outputDir, progress: progressFixture([{ pathKey, contentKey }]) });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      "https://api.github.com/repos/whoisyourbias/leetdash/issues/comments?per_page=100&page=1&sort=updated&direction=desc",
    );
    expect(requests[0].headers.Accept).toBe("application/vnd.github.full+json");
    expect(requests[0].headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(requests[0].headers.Authorization).toBe(`Bearer ${token}`);
    await rm(root, { recursive: true, force: true });
  });

  it("reads hash pairs from a progress file on disk and ignores records missing either key", async () => {
    const { outputDir, root } = await makeOutputDir();
    const progress = {
      generatedAt: "2026-08-08T00:00:00.000Z",
      users: [
        { id: "a", displayName: "A", githubUsername: "a", submissions: [
          { id: "a:1", userId: "a", problemKey: "programmers:1", status: "SOLVED", solutionPathKey: pathKey, solutionContentKey: contentKey },
          { id: "a:2", userId: "a", problemKey: "programmers:2", status: "SOLVED", solutionPathKey: pathKey },
          { id: "a:3", userId: "a", problemKey: "programmers:3", status: "SOLVED", solutionContentKey: contentKey },
          { id: "a:4", userId: "a", problemKey: "programmers:4", status: "SOLVED", solutionPathKey: "not-hex", solutionContentKey: contentKey },
        ] },
      ],
    };
    await mkdir(path.dirname(path.join(root, "data", "progress.json")), { recursive: true });
    await writeFile(path.join(root, "data", "progress.json"), `${JSON.stringify(progress, null, 2)}\n`);

    const fetchImpl = async () => jsonResponse([managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z" })]);
    const result = await runSync({ fetchImpl, outputDir, progressPath: path.join(root, "data", "progress.json") });

    expect(result.status).toBe("complete");
    // Only the record with BOTH valid 64-hex keys counts.
    expect(result.index.counts.currentSolutions).toBe(1);
    await rm(root, { recursive: true, force: true });
  });
});

describe("sync-review-artifacts: current-hash filtering and duplicate selection", () => {
  it("filters comments whose path/content keys are not current", async () => {
    const { outputDir, root } = await makeOutputDir();
    const comments = [
      managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z", markerContentKey: staleContentKey }),
      managedComment({ id: 2, updatedAt: "2026-08-08T09:00:00Z", markerPathKey: stalePathKey }),
      managedComment({ id: 3, updatedAt: "2026-08-08T09:00:00Z", markerContentKey: "not-hex" }),
      managedComment({ id: 4, updatedAt: "2026-08-08T09:00:00Z" }),
      { id: 5, user: { login: "octocat" }, html_url: "https://github.com/x/y/issues/1", updated_at: "2026-08-08T09:00:00Z", body: "human noise" },
    ];
    const fetchImpl = async () => jsonResponse(comments);

    const result = await runSync({
      fetchImpl,
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    });

    expect(result.status).toBe("complete");
    expect(result.index.counts.reviews).toBe(1);
    expect(result.index.keys).toEqual([{ pathKey, contentKey }]);
    expect(await listRelativeFiles(outputDir)).toEqual([`${pathKey}/${contentKey}.json`, "index.json"]);
    await rm(root, { recursive: true, force: true });
  });

  it("selects the newest comment per pair (latest wins) and breaks id ties by highest id", async () => {
    const { outputDir, root } = await makeOutputDir();
    const comments = [
      managedComment({ id: 20, updatedAt: "2026-08-08T08:00:00Z", prose: "oldest review" }),
      managedComment({ id: 30, updatedAt: "2026-08-08T10:00:00Z", prose: "newest review" }),
      managedComment({ id: 25, updatedAt: "2026-08-08T09:00:00Z", prose: "middle review" }),
    ];
    const fetchImpl = async () => jsonResponse(comments);

    await runSync({ fetchImpl, outputDir, progress: progressFixture([{ pathKey, contentKey }]) });

    const artifact = await readJson(path.join(outputDir, pathKey, `${contentKey}.json`));
    expect(artifact.updatedAt).toBe("2026-08-08T10:00:00Z");
    expect(artifact.text).toContain("newest review");

    // Same updatedAt -> highest id wins.
    const tieComments = [
      managedComment({ id: 10, updatedAt: "2026-08-08T11:00:00Z", prose: "tie lower id" }),
      managedComment({ id: 99, updatedAt: "2026-08-08T11:00:00Z", prose: "tie higher id" }),
    ];
    const fetchImpl2 = async () => jsonResponse(tieComments);
    await runSync({ fetchImpl: fetchImpl2, outputDir, progress: progressFixture([{ pathKey, contentKey }]) });

    const artifact2 = await readJson(path.join(outputDir, pathKey, `${contentKey}.json`));
    expect(artifact2.text).toContain("tie higher id");
    await rm(root, { recursive: true, force: true });
  });
});

describe("sync-review-artifacts: atomic replacement and stale cleanup", () => {
  it("atomically replaces the previous tree and reports removed stale files", async () => {
    const { outputDir, parentDir, root } = await makeOutputDir();
    const pairA = { pathKey, contentKey };
    const pairB = { pathKey: stalePathKey, contentKey: staleContentKey };

    // First run: artifact A only.
    const fetchImplA = async () => jsonResponse([managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z" })]);
    const first = await runSync({ fetchImpl: fetchImplA, outputDir, progress: progressFixture([pairA]) });
    expect(first.written.sort()).toEqual([`${pathKey}/${contentKey}.json`, "index.json"]);

    // Second run: artifact B only; A is no longer current and must be cleaned.
    const fetchImplB = async () => jsonResponse([
      managedComment({ id: 2, updatedAt: "2026-08-08T09:00:00Z", markerPathKey: stalePathKey, markerContentKey: staleContentKey }),
    ]);
    const second = await runSync({ fetchImpl: fetchImplB, outputDir, progress: progressFixture([pairB]) });

    expect(second.status).toBe("complete");
    expect(second.written.sort()).toEqual([`${stalePathKey}/${staleContentKey}.json`, "index.json"]);
    expect(second.removed.sort()).toEqual([`${pathKey}/${contentKey}.json`]);

    // No stale artifact remains and no temp/old siblings leak.
    expect(await readdir(parentDir)).toEqual(["reviews"]);
    expect(await listRelativeFiles(outputDir)).toEqual([`${stalePathKey}/${staleContentKey}.json`, "index.json"]);
    await rm(root, { recursive: true, force: true });
  });

  it("sweeps leftover temp/old siblings from a previously interrupted run", async () => {
    const { outputDir, parentDir, root } = await makeOutputDir();
    await mkdir(path.join(parentDir, ".reviews.tmp-interrupted"), { recursive: true });
    await mkdir(path.join(parentDir, ".reviews.old-1234"), { recursive: true });
    await writeFile(path.join(parentDir, ".reviews.old-1234", "leftover.json"), "{}");

    const fetchImpl = async () => jsonResponse([managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z" })]);
    const result = await runSync({ fetchImpl, outputDir, progress: progressFixture([{ pathKey, contentKey }]) });

    expect(result.status).toBe("complete");
    // Interrupted-run siblings are cleaned; only the real tree remains.
    expect(await readdir(parentDir)).toEqual(["reviews"]);
    expect(await listRelativeFiles(outputDir)).toEqual([`${pathKey}/${contentKey}.json`, "index.json"]);
    await rm(root, { recursive: true, force: true });
  });
});

describe("sync-review-artifacts: safe unavailable fallback", () => {
  it("replaces all data with only an unavailable index on HTTP 429 and exits successfully", async () => {
    const { outputDir, root } = await makeOutputDir();
    // Pre-seed a complete tree that must be atomically replaced.
    await mkdir(path.join(outputDir, pathKey), { recursive: true });
    await writeFile(
      path.join(outputDir, pathKey, `${contentKey}.json`),
      JSON.stringify({ pathKey, contentKey }),
    );
    await writeFile(path.join(outputDir, "index.json"), JSON.stringify({ status: "complete" }));

    const logger = captureLogger();
    const fetchImpl = async () => new Response("rate limit exceeded", {
      status: 429,
      headers: { "x-ratelimit-remaining": "0", "x-github-request-id": "req-429-xyz" },
    });

    const result = await runSync({
      fetchImpl,
      outputDir,
      logger,
      progress: progressFixture([{ pathKey, contentKey }]),
    });

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("rate_limited");

    // Only the unavailable index exists; the seeded complete tree is gone.
    expect(await listRelativeFiles(outputDir)).toEqual(["index.json"]);
    const index = await readJson(path.join(outputDir, "index.json"));
    expect(index.status).toBe("unavailable");
    expect(index.reason).toBe("rate_limited");
    expect(index.keys).toBeUndefined();

    // Diagnostics are logged with status + request id, never token or body.
    expect(logger.lines.some((line) => line.includes("429"))).toBe(true);
    expect(logger.lines.some((line) => line.includes("req-429-xyz"))).toBe(true);
    expect(logger.lines.some((line) => line.includes(token))).toBe(false);
    expect(logger.lines.some((line) => line.includes("rate limit exceeded"))).toBe(false);
    await rm(root, { recursive: true, force: true });
  });

  it("handles malformed JSON and non-array responses as unavailable", async () => {
    const { outputDir, root } = await makeOutputDir();

    const badJson = await runSync({
      fetchImpl: async () => new Response("not json", { status: 200 }),
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    });
    expect(badJson.status).toBe("unavailable");
    expect(badJson.reason).toBe("malformed_response");

    const nonArray = await runSync({
      fetchImpl: async () => jsonResponse({ items: [] }),
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    });
    expect(nonArray.status).toBe("unavailable");
    expect(nonArray.reason).toBe("malformed_response");
    expect(await listRelativeFiles(outputDir)).toEqual(["index.json"]);
    await rm(root, { recursive: true, force: true });
  });

  it("produces an unavailable index without fetching when credentials or repository are absent", async () => {
    const { outputDir, root } = await makeOutputDir();
    let fetchCalled = 0;
    const fetchImpl = async () => { fetchCalled += 1; return jsonResponse([]); };
    const logger = captureLogger();

    const noToken = await syncReviewArtifacts({
      fetchImpl,
      repository,
      revision,
      now,
      logger,
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    });
    expect(noToken.status).toBe("unavailable");
    expect(noToken.reason).toBe("credentials_missing");

    const noRepository = await syncReviewArtifacts({
      fetchImpl,
      token,
      revision,
      now,
      logger,
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    });
    expect(noRepository.status).toBe("unavailable");
    expect(noRepository.reason).toBe("credentials_missing");

    expect(fetchCalled).toBe(0);
    expect(await listRelativeFiles(outputDir)).toEqual(["index.json"]);
    expect(logger.lines.some((line) => line.includes("unavailable"))).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  it("produces an unavailable index when the progress file cannot be read", async () => {
    const { outputDir, root } = await makeOutputDir();
    const fetchImpl = async () => { throw new Error("must not be called"); };
    const logger = captureLogger();

    const result = await runSync({
      fetchImpl,
      outputDir,
      logger,
      progressPath: path.join(root, "data", "does-not-exist.json"),
    });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("progress_unavailable");
    expect(await listRelativeFiles(outputDir)).toEqual(["index.json"]);
    await rm(root, { recursive: true, force: true });
  });

  it("publishes an empty complete index without fetching when no current hash pairs exist", async () => {
    const { outputDir, root } = await makeOutputDir();
    let fetchCalled = false;
    const fetchImpl = async () => { fetchCalled = true; return jsonResponse([]); };
    const logger = captureLogger();

    const result = await runSync({
      fetchImpl,
      outputDir,
      logger,
      progress: { generatedAt: "2026-08-08T00:00:00.000Z", users: [{ id: "u1", displayName: "U", githubUsername: "u", submissions: [] }] },
    });

    expect(result.status).toBe("complete");
    expect(result.index.counts.currentSolutions).toBe(0);
    expect(result.index.keys).toEqual([]);
    expect(fetchCalled).toBe(false);
    expect(await listRelativeFiles(outputDir)).toEqual(["index.json"]);
    await rm(root, { recursive: true, force: true });
  });

  it("caps pages and comments, stopping at the configured limits", async () => {
    const { outputDir, root } = await makeOutputDir();
    const requests = [];
    const fullPage = Array.from({ length: 100 }, (_v, i) => managedComment({ id: i + 1, updatedAt: "2026-08-08T09:00:00Z" }));
    const fetchImpl = async (url) => {
      requests.push(String(url));
      return jsonResponse(fullPage);
    };

    const result = await runSync({
      fetchImpl,
      outputDir,
      maxPages: 2,
      progress: progressFixture([{ pathKey, contentKey }]),
    });

    expect(requests).toHaveLength(2);
    expect(result.status).toBe("complete");
    expect(result.index.counts).toEqual({ reviews: 1, currentSolutions: 1, pagesFetched: 2, commentsFetched: 200 });
    await rm(root, { recursive: true, force: true });
  });

  it("treats a hung external fetch as a safe timeout, never leaking request details", async () => {
    const { outputDir, root } = await makeOutputDir();
    const logger = captureLogger();
    const fetchImpl = () => new Promise(() => {}); // never resolves

    const result = await runSync({
      fetchImpl,
      outputDir,
      logger,
      requestTimeoutMs: 30,
      progress: progressFixture([{ pathKey, contentKey }]),
    });

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("timeout");
    expect(await listRelativeFiles(outputDir)).toEqual(["index.json"]);
    expect(logger.lines.some((line) => line.includes(token))).toBe(false);
    await rm(root, { recursive: true, force: true });
  });
});

describe("sync-review-artifacts: programmer errors fail explicitly", () => {
  it("throws for invalid configuration that is unsafe to continue", async () => {
    const { outputDir, root } = await makeOutputDir();

    await expect(syncReviewArtifacts({
      fetchImpl: "not-a-function",
      token,
      repository,
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    })).rejects.toThrow(TypeError);

    await expect(syncReviewArtifacts({
      fetchImpl: async () => jsonResponse([]),
      token,
      repository: "not-owner-repo",
      outputDir,
      progress: progressFixture([{ pathKey, contentKey }]),
    })).rejects.toThrow(TypeError);

    await expect(syncReviewArtifacts({
      fetchImpl: async () => jsonResponse([]),
      token,
      repository,
      outputDir,
      maxPages: 0,
      progress: progressFixture([{ pathKey, contentKey }]),
    })).rejects.toThrow(TypeError);

    await expect(syncReviewArtifacts({
      fetchImpl: async () => jsonResponse([]),
      token,
      repository,
      outputDir,
      progress: "not-an-object",
    })).rejects.toThrow(TypeError);

    await rm(root, { recursive: true, force: true });
  });
});

describe("sync-review-artifacts: token and comment-body redaction", () => {
  it("never logs the token or raw comment bodies on success or failure", async () => {
    const { outputDir, root } = await makeOutputDir();
    const logger = captureLogger();
    const bodySentinel = "RAW_BODY_SENTINEL_do_not_log";
    const proseSentinel = "PROSE_SENTINEL_may_appear_in_artifact_only";

    const fetchImpl = async () => jsonResponse([
      managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z", prose: `${reviewProse}\n${proseSentinel}` }),
    ]);
    const result = await runSync({ fetchImpl, outputDir, logger, progress: progressFixture([{ pathKey, contentKey }]) });

    expect(result.status).toBe("complete");
    // The prose is a legitimate artifact field...
    const artifact = await readJson(path.join(outputDir, pathKey, `${contentKey}.json`));
    expect(artifact.text).toContain(proseSentinel);
    // ...but neither prose nor the token appears in any log line.
    expect(logger.lines.some((line) => line.includes(token))).toBe(false);
    expect(logger.lines.some((line) => line.includes(proseSentinel))).toBe(false);
    expect(logger.lines.some((line) => line.includes(bodySentinel))).toBe(false);
    // The raw body (with markers and workflow URL) is never echoed to logs either.
    expect(logger.lines.some((line) => line.includes("actions/runs/1234"))).toBe(false);
    await rm(root, { recursive: true, force: true });
  });
});
