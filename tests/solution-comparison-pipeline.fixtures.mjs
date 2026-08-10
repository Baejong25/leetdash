// Offline fixture builders for the Task 14 solution-comparison pipeline
// integration test. Kept in a separate module so the test file stays under
// the 250 pure-LOC ceiling. No live GitHub calls; all production contracts
// are exercised through the real scripts and lib modules.

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  buildMascotUrl,
  buildSourcePermalink,
  injectLinePermalinks,
  renderReviewFileComment,
  reviewContentKey,
  reviewFileKey,
  sanitizeReviewMarkdown,
} from "../scripts/opencode-review-core.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "build-progress.mjs");

// --- Stable fixture constants (no live network, no platform noise) ----------

export const revision = "0123456789abcdef0123456789abcdef01234567";
export const centralRepositoryUrl = "https://github.com/example/leetdash";
export const repository = "example/leetdash";
const serverUrl = "https://github.com";
const headSha = revision.slice(0, 7);
const runUrl = "https://github.com/example/leetdash/actions/runs/9001";
export const now = new Date("2026-08-08T12:00:00.000Z");
export const token = "ghs_test-integration-token";

export const adaSource = "function twoSum(nums, target) {\n  return [];\n}\n";
export const bobSource = "class TwoSum {\n  // bob's approach\n}\n";
export const bobProgSource = "class Solution {\n  public int solution(int[] numbers) { return 0; }\n}\n";
export const sources = { ada: adaSource, bob: bobSource, bobProg: bobProgSource };

const adaPath = "submissions/ada/top interview/1/solution.ts";
const bobProgPath = "submissions/bob/programmers/1/solution.java";
export const adaPathKey = reviewFileKey(adaPath);
export const adaContentKey = reviewContentKey(adaSource);
const staleContentKey = reviewContentKey("// completely different content\n");
export const bobProgPathKey = reviewFileKey(bobProgPath);
export const bobProgContentKey = reviewContentKey(bobProgSource);

const adaSourceUrl = buildSourcePermalink({ serverUrl, repository, headSha, path: adaPath });
const bobProgSourceUrl = buildSourcePermalink({ serverUrl, repository, headSha, path: bobProgPath });
const mascotUrl = buildMascotUrl({ serverUrl, repository, baseSha: headSha });

// Producer-shaped markdown: sanitized + commit-pinned permalinks injected,
// exactly like scripts/opencode-review.mjs posts it.
const adaReviewMarkdown = injectLinePermalinks(
  sanitizeReviewMarkdown(
    "L1 `function twoSum(nums, target) {` [분류: 정확성] target이 두 번 이상 등장하면 첫 인덱스만 반환합니다.\n"
      + "L2 `return [];` [분류: 효율성] 해시 맵으로 한 번에 찾을 수 있습니다.",
  ),
  adaSourceUrl,
);
const staleReviewMarkdown = injectLinePermalinks(
  sanitizeReviewMarkdown("L1 `old` [분류: 스타일] STALE_REVIEW_SENTINEL 이전 내용 기준 리뷰입니다."),
  adaSourceUrl,
);
const wrongBotMarkdown = injectLinePermalinks(
  sanitizeReviewMarkdown("L1 `human` [분류: 스타일] WRONG_BOT_SENTINEL 사람이 남긴 리뷰입니다."),
  adaSourceUrl,
);

// --- Offline helper builders -------------------------------------------------

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function runGit(repo, args) {
  await execFileAsync("git", args, { cwd: repo, env: { ...process.env } });
}

async function commitAll(repo, message, timestamp) {
  const env = { GIT_AUTHOR_DATE: timestamp, GIT_COMMITTER_DATE: timestamp };
  await execFileAsync("git", ["add", "."], { cwd: repo, env: { ...process.env, ...env } });
  await execFileAsync("git", ["commit", "-m", message], { cwd: repo, env: { ...process.env, ...env } });
}

function botComment({ id, updatedAt, body }) {
  return {
    id,
    user: { login: "github-actions[bot]" },
    html_url: `https://github.com/example/leetdash/pull/126#issuecomment-${id}`,
    updated_at: updatedAt,
    body,
  };
}

export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export function captureLogger() {
  const lines = [];
  return { lines, log: (m) => lines.push(`[log] ${m}`), warn: (m) => lines.push(`[warn] ${m}`) };
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function listRelativeFiles(dir) {
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

export const managedComments = [
  botComment({
    id: 100,
    updatedAt: "2026-08-08T09:01:00Z",
    body: renderReviewFileComment({ path: adaPath, sourceUrl: adaSourceUrl, contentKey: adaContentKey, headSha, runUrl, mascotUrl, markdown: adaReviewMarkdown, lineCount: 3 }),
  }),
  botComment({
    id: 200,
    updatedAt: "2026-08-08T10:00:00Z",
    body: renderReviewFileComment({ path: adaPath, sourceUrl: adaSourceUrl, contentKey: staleContentKey, headSha, runUrl, mascotUrl, markdown: staleReviewMarkdown, lineCount: 3 }),
  }),
  {
    id: 300,
    user: { login: "octocat" },
    html_url: "https://github.com/example/leetdash/pull/126#issuecomment-300",
    updated_at: "2026-08-08T09:02:00Z",
    body: renderReviewFileComment({ path: adaPath, sourceUrl: adaSourceUrl, contentKey: adaContentKey, headSha, runUrl, mascotUrl, markdown: wrongBotMarkdown, lineCount: 3 }),
  },
  botComment({
    id: 400,
    updatedAt: "2026-08-08T09:03:00Z",
    body: renderReviewFileComment({ path: bobProgPath, sourceUrl: bobProgSourceUrl, contentKey: bobProgContentKey, headSha, runUrl, mascotUrl, markdown: "리뷰 코멘트 없음.", lineCount: 2 }),
  }),
];

// --- Fixture: temporary git repository + real progress generation -----------

export async function createFixtureRepo() {
  const repo = await mkdtemp(path.join(tmpdir(), "pipeline-comparison-"));
  await runGit(repo, ["init"]);
  await runGit(repo, ["config", "user.email", "study@example.com"]);
  await runGit(repo, ["config", "user.name", "Study Bot"]);
  await mkdir(path.join(repo, "data"), { recursive: true });

  await writeJson(path.join(repo, "data", "problem-catalog.json"), {
    generatedAt: "2026-08-08T00:00:00.000Z",
    sources: [],
    lists: [
      { key: "top interview", title: "Top Interview", url: "https://example.com/top", summary: [], problems: [], items: [{ problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" }] },
      { key: "leetcode-75", title: "LeetCode 75", url: "https://example.com/75", summary: [], problems: [], items: [{ problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" }] },
      { key: "programmers", title: "Programmers", url: "https://example.com/prog", summary: [], problems: [], items: [{ problemKey: "programmers:1", order: 1, section: "PCCE", submissionKey: "1" }] },
    ],
    problems: [
      { provider: "leetcode", problemId: "1", problemKey: "leetcode:1", title: "Two Sum", difficulty: "Easy", sourceUrl: "https://leetcode.com/problems/two-sum/" },
      { provider: "programmers", problemId: "1", problemKey: "programmers:1", title: "폰켓몬", difficulty: "Lv.1", sourceUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/1" },
    ],
  });
  await writeJson(path.join(repo, "data", "users.json"), {
    users: [
      { id: "ada", displayName: "Ada Lovelace", githubUsername: "ada", active: true },
      { id: "bob", displayName: "Bob Builder", githubUsername: "bob", active: true },
      { id: "grace", displayName: "Grace Hopper", githubUsername: "grace", active: true },
    ],
  });

  await mkdir(path.join(repo, "submissions", "ada", "top interview", "1"), { recursive: true });
  await writeFile(path.join(repo, "submissions", "ada", "top interview", "1", "solution.ts"), adaSource);
  await mkdir(path.join(repo, "submissions", "bob", "leetcode-75", "1"), { recursive: true });
  await writeFile(path.join(repo, "submissions", "bob", "leetcode-75", "1", "solution.ts"), bobSource);
  await mkdir(path.join(repo, "submissions", "bob", "programmers", "1"), { recursive: true });
  await writeFile(path.join(repo, "submissions", "bob", "programmers", "1", "solution.java"), bobProgSource);
  await mkdir(path.join(repo, "submissions", "grace", "top interview", "1"), { recursive: true });
  await writeJson(path.join(repo, "submissions", "grace", "top interview", "1", "meta.json"), { status: "reviewing" });

  await commitAll(repo, "fixture submissions", "2026-08-08T09:00:00.000Z");

  await execFileAsync(process.execPath, [scriptPath], {
    cwd: repo,
    env: { ...process.env, SOURCE_REPOSITORY_URL: centralRepositoryUrl, BRANCH: "master", SOURCE_REVISION: revision },
  });

  return {
    repo,
    progress: await readJson(path.join(repo, "data", "progress.json")),
    catalog: await readJson(path.join(repo, "data", "problem-catalog.json")),
  };
}
