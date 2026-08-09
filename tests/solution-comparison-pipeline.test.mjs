// Task 14 integration: prove the full metadata -> review artifacts -> static
// routes chain with deterministic offline fixtures. No live GitHub calls.
//
// Flow under test (all real production entry points, never reimplemented):
//   1. a temporary git repository with two users solving the same canonical
//      problem, a same-numeric-id problem on another provider, and a
//      registered unsolved third user;
//   2. progress generation via the real scripts/build-progress.mjs with a
//      known 40-hex SOURCE_REVISION and central repository URL;
//   3. repository-wide managed comments (current, stale, wrong-bot, explicit
//      no-comment) through the real scripts/sync-review-artifacts.mjs;
//   4. problem detail selection through lib/problem-solutions.ts and route
//      hrefs through lib/routes.ts;
//   5. exported asset paths under <pathKey>/<contentKey>.json.
//
// Every fixture string that could look like source code is scanned across the
// progress JSON, the problem detail/page-prop payload, and the generated
// review assets, and must appear ONLY in the mocked raw response.

import { rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { syncReviewArtifacts } from "../scripts/sync-review-artifacts.mjs";
import { getProblemSolutionDetail, listComparableProblemParams } from "../lib/problem-solutions.ts";
import { getProblemComparisonHref } from "../lib/routes.ts";
import {
  adaContentKey,
  adaPathKey,
  adaSource,
  bobProgContentKey,
  bobProgPathKey,
  captureLogger,
  createFixtureRepo,
  jsonResponse,
  listRelativeFiles,
  managedComments,
  now,
  readJson,
  repository,
  revision,
  sources,
  token,
} from "./solution-comparison-pipeline.fixtures.mjs";

let fixture;

beforeAll(async () => {
  fixture = await createFixtureRepo();
}, 30_000);

afterAll(async () => {
  if (fixture) await rm(fixture.repo, { recursive: true, force: true });
});

describe("solution comparison pipeline integration", () => {
  it("resolves two solver artifacts and one valid review end to end", async () => {
    const { progress, catalog, repo } = fixture;
    const { users } = progress;

    // Two users solve the same canonical problem; the numeric id stays
    // provider-distinct; the unsolved third user remains registered.
    const adaSub = users.find((u) => u.id === "ada").submissions.find((s) => s.problemKey === "leetcode:1");
    const bobSub = users.find((u) => u.id === "bob").submissions.find((s) => s.problemKey === "leetcode:1");
    const bobProgSub = users.find((u) => u.id === "bob").submissions.find((s) => s.problemKey === "programmers:1");
    const graceSub = users.find((u) => u.id === "grace").submissions[0];

    expect(adaSub.status).toBe("SOLVED");
    expect(bobSub.status).toBe("SOLVED");
    expect(adaSub.problemKey).toBe("leetcode:1");
    expect(bobProgSub.problemKey).toBe("programmers:1");
    expect(adaSub.problemKey).not.toBe(bobProgSub.problemKey);
    expect(graceSub.status).toBe("REVIEWING");
    expect(graceSub.solutionPath).toBeUndefined();
    expect(graceSub.solutionRawUrl).toBeUndefined();

    // Known valid 40-hex revision + central repository URL, with URL-encoded
    // segments in the commit-pinned raw/blob URLs.
    expect(adaSub.solutionRawUrl).toBe(
      `https://raw.githubusercontent.com/example/leetdash/${revision}/submissions/ada/top%20interview/1/solution.ts`,
    );
    expect(adaSub.solutionPermalink).toBe(
      `https://github.com/example/leetdash/blob/${revision}/submissions/ada/top%20interview/1/solution.ts`,
    );
    expect(adaSub.solutionPathKey).toBe(adaPathKey);
    expect(adaSub.solutionContentKey).toBe(adaContentKey);

    // Progress stays metadata-only: no source body anywhere.
    const progressText = JSON.stringify(progress);
    for (const body of Object.values(sources)) expect(progressText).not.toContain(body);

    // Repository-wide comment sync keeps only current path/content composites.
    const outputDir = path.join(repo, "public", "generated", "reviews");
    const requests = [];
    const logger = captureLogger();
    const fetchImpl = async (url, init) => {
      requests.push(String(url));
      return jsonResponse(managedComments);
    };
    const result = await syncReviewArtifacts({ fetchImpl, token, repository, revision, now, logger, outputDir, progress });

    expect(requests).toHaveLength(1);
    expect(result.status).toBe("complete");
    expect(result.index.counts).toEqual({ reviews: 2, currentSolutions: 3, pagesFetched: 1, commentsFetched: 4 });
    expect(result.index.keys).toEqual([
      { pathKey: adaPathKey, contentKey: adaContentKey },
      { pathKey: bobProgPathKey, contentKey: bobProgContentKey },
    ]);

    const files = await listRelativeFiles(outputDir);
    expect(files).toEqual([`${adaPathKey}/${adaContentKey}.json`, `${bobProgPathKey}/${bobProgContentKey}.json`, "index.json"]);

    const adaArtifact = await readJson(path.join(outputDir, adaPathKey, `${adaContentKey}.json`));
    expect(adaArtifact).toMatchObject({
      pathKey: adaPathKey,
      contentKey: adaContentKey,
      updatedAt: "2026-08-08T09:01:00Z",
      lineReferences: [{ start: 1, end: 1 }, { start: 2, end: 2 }],
    });
    expect(adaArtifact.text).toContain("정확성");

    const noCommentArtifact = await readJson(path.join(outputDir, bobProgPathKey, `${bobProgContentKey}.json`));
    expect(noCommentArtifact.text).toBeNull();
    expect(noCommentArtifact.lineReferences).toEqual([]);

    // Stale-review and wrong-bot comments never become artifacts or leak text.
    let artifactText = JSON.stringify(result.index);
    for (const file of files) {
      if (file.endsWith(".json") && file !== "index.json") artifactText += JSON.stringify(await readJson(path.join(outputDir, file)));
    }
    expect(artifactText).not.toContain("STALE_REVIEW_SENTINEL");
    expect(artifactText).not.toContain("WRONG_BOT_SENTINEL");
    for (const body of Object.values(sources)) expect(artifactText).not.toContain(body);

    // Static route selection + problem detail, preserving the requested
    // unsolved user without silently selecting a solver.
    const params = listComparableProblemParams(progress, catalog);
    expect(params).toEqual([{ provider: "leetcode", problemId: "1" }, { provider: "programmers", problemId: "1" }]);

    const detail = getProblemSolutionDetail("leetcode", "1", progress, catalog);
    expect(detail?.solvers.map((s) => s.user.id).sort()).toEqual(["ada", "bob"]);
    expect(detail?.users.map((u) => u.id)).toContain("grace");
    expect(detail?.solvers.some((s) => s.user.id === "grace")).toBe(false);
    expect(getProblemComparisonHref("leetcode", "1", "grace")).toBe("/problems/leetcode/1/?user=grace");

    const progDetail = getProblemSolutionDetail("programmers", "1", progress, catalog);
    expect(progDetail?.problem.problemKey).toBe("programmers:1");
    expect(progDetail?.problem.title).toBe("폰켓몬");

    // Page-prop payload stays metadata-only too.
    const payload = JSON.stringify(detail);
    for (const body of Object.values(sources)) expect(payload).not.toContain(body);

    // The source body exists ONLY in the mocked raw response the loader would
    // receive at the commit-pinned raw URL.
    const rawResponse = new Response(adaSource, {
      headers: { "content-type": "text/plain;charset=utf-8", "content-length": String(Buffer.byteLength(adaSource)) },
    });
    expect(await rawResponse.text()).toBe(adaSource);
    expect(adaSub.solutionRawUrl).toMatch(
      new RegExp(`^https://raw\\.githubusercontent\\.com/example/leetdash/${revision}/`),
    );
  });

  it("turns an HTTP 429 sync into an unavailable index while route generation still succeeds", async () => {
    const { progress, catalog, repo } = fixture;
    const outputDir = path.join(repo, "public", "generated", "reviews-429");
    const logger = captureLogger();

    await syncReviewArtifacts({
      fetchImpl: async () => jsonResponse([managedComments[0]]),
      token, repository, revision, now, logger, outputDir, progress,
    });

    const result = await syncReviewArtifacts({
      fetchImpl: async () => new Response("rate limit exceeded", {
        status: 429,
        headers: { "x-github-request-id": "req-429-xyz" },
      }),
      token, repository, revision, now, logger, outputDir, progress,
    });

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("rate_limited");
    expect(await listRelativeFiles(outputDir)).toEqual(["index.json"]);
    const index = await readJson(path.join(outputDir, "index.json"));
    expect(index.status).toBe("unavailable");
    expect(index.reason).toBe("rate_limited");
    expect(index.keys).toBeUndefined();
    expect(logger.lines.some((line) => line.includes("429"))).toBe(true);
    expect(logger.lines.some((line) => line.includes(token))).toBe(false);

    // A sync outage never blocks route/detail generation.
    expect(listComparableProblemParams(progress, catalog)).toHaveLength(2);
    expect(getProblemSolutionDetail("leetcode", "1", progress, catalog)?.solvers).toHaveLength(2);
  });
});
