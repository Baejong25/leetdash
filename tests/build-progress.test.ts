import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(__dirname, "..", "scripts", "build-progress.mjs");

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function runGit(repo: string, args: string[], env: Partial<Record<string, string>> = {}) {
  await execFileAsync("git", args, {
    cwd: repo,
    env: { ...process.env, ...env },
  });
}

async function commitAll(repo: string, message: string, timestamp: string) {
  const env = {
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_DATE: timestamp,
  };

  await runGit(repo, ["add", "."], env);
  await runGit(repo, ["commit", "-m", message], env);
}

describe("build-progress", () => {
  it("keeps the same numeric problem ID distinct across providers", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-radar-providers-"));
    await mkdir(path.join(repo, "data"), { recursive: true });

    for (const sourceKey of ["leetcode", "programmers", "swea"]) {
      await mkdir(path.join(repo, "submissions", "ada", sourceKey, "1"), { recursive: true });
      await writeFile(path.join(repo, "submissions", "ada", sourceKey, "1", "solution.ts"), "// solved\n");
    }

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [
        { provider: "leetcode", problemId: "1", problemKey: "leetcode:1" },
        { provider: "programmers", problemId: "1", problemKey: "programmers:1" },
        { provider: "swea", problemId: "1", problemKey: "swea:1" },
      ],
      lists: [
        { key: "leetcode", items: [{ problemKey: "leetcode:1", submissionKey: "1" }] },
        { key: "programmers", items: [{ problemKey: "programmers:1", submissionKey: "1" }] },
        { key: "swea", items: [{ problemKey: "swea:1", submissionKey: "1" }] },
      ],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });

    await execFileAsync(process.execPath, [scriptPath], { cwd: repo });

    const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
    expect(progress.users[0].submissions).toHaveLength(3);
    expect(progress.users[0].submissions.map((item: { problemKey: string }) => item.problemKey)).toEqual([
      "leetcode:1",
      "programmers:1",
      "swea:1",
    ]);
  });

  it("builds per-user progress from checked-in submission folders", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-radar-"));
    await mkdir(path.join(repo, "data"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "1"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "leetcode-75", "1"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "leetcode-75", "1768"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-150", "88"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "20"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "solutions", "20"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "two-sum"), { recursive: true });

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [
        { provider: "leetcode", problemId: "1", problemKey: "leetcode:1", slug: "two-sum", title: "Two Sum", difficulty: "easy" },
        {
          provider: "leetcode",
          problemId: "88",
          problemKey: "leetcode:88",
          slug: "merge-sorted-array",
          title: "Merge Sorted Array",
          difficulty: "easy",
        },
        {
          provider: "leetcode",
          problemId: "1768",
          problemKey: "leetcode:1768",
          slug: "merge-strings-alternately",
          title: "Merge Strings Alternately",
          difficulty: "easy",
        },
        {
          provider: "leetcode",
          problemId: "20",
          problemKey: "leetcode:20",
          slug: "valid-parentheses",
          title: "Valid Parentheses",
          difficulty: "easy",
        },
      ],
      lists: [
        {
          key: "top-interview-easy",
          items: [
            { problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" },
            { problemKey: "leetcode:20", order: 2, section: "Others", submissionKey: "20" },
          ],
        },
        {
          key: "leetcode-75",
          items: [
            { problemKey: "leetcode:1", order: 1, section: "Hash Map", submissionKey: "1" },
            { problemKey: "leetcode:1768", order: 2, section: "Array / String", submissionKey: "1768" },
          ],
        },
        {
          key: "top-interview-150",
          items: [{ problemKey: "leetcode:88", order: 1, section: "Array / String", submissionKey: "88" }],
        },
      ],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "solution.ts"), "// solved\n");
    await writeJson(path.join(repo, "submissions", "ada", "leetcode-75", "1", "meta.json"), {
      status: "reviewing",
      notes: "Duplicate source should lose to solved.",
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "two-sum", "solution.ts"), "// ignored\n");
    await writeJson(path.join(repo, "submissions", "ada", "solutions", "20", "meta.json"), {
      status: "solved",
      notes: "Old path should be ignored.",
    });
    await writeJson(path.join(repo, "submissions", "ada", "leetcode-75", "1768", "meta.json"), {
      status: "reviewing",
      language: "TypeScript",
      notes: "Needs another pass.",
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "20", "Solution.java"), "// solved\n");
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-150", "88", "solution.py"), "# solved\n");

    await execFileAsync(process.execPath, [scriptPath], {
      cwd: repo,
      env: { ...process.env, SOURCE_REPOSITORY_URL: "https://github.com/example/progress", BRANCH: "master" },
    });

    const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
    expect(progress.users).toHaveLength(1);
    expect(progress.users[0]).toMatchObject({
      id: "ada",
      active: true,
      submissionsPath: "submissions/ada",
    });
    expect(progress.users[0].activity).toEqual([]);
    expect(progress.users[0].submissions).toEqual([
      expect.objectContaining({
        problemKey: "leetcode:1",
        status: "SOLVED",
        sourceKey: "top-interview-easy",
        submissionKey: "1",
        language: "TS",
        solutionPath: "submissions/ada/top-interview-easy/1/solution.ts",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top-interview-easy/1/solution.ts",
        source: "solution-file",
      }),
      expect.objectContaining({
        problemKey: "leetcode:1768",
        status: "REVIEWING",
        sourceKey: "leetcode-75",
        submissionKey: "1768",
        language: "TypeScript",
        notes: "Needs another pass.",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/leetcode-75/1768/meta.json",
        source: "meta",
      }),
      expect.objectContaining({
        problemKey: "leetcode:20",
        status: "SOLVED",
        sourceKey: "top-interview-easy",
        submissionKey: "20",
        language: "JAVA",
        solutionPath: "submissions/ada/top-interview-easy/20/Solution.java",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top-interview-easy/20/Solution.java",
        source: "solution-file",
      }),
      expect.objectContaining({
        problemKey: "leetcode:88",
        status: "SOLVED",
        sourceKey: "top-interview-150",
        submissionKey: "88",
        language: "PY",
        solutionPath: "submissions/ada/top-interview-150/88/solution.py",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top-interview-150/88/solution.py",
        source: "solution-file",
      }),
    ]);
  });

  it("builds per-user daily activity from git add timestamps", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-radar-git-"));
    await mkdir(path.join(repo, "data"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "1"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "20"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "3"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "15"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "leetcode-75", "1768"), { recursive: true });

    await runGit(repo, ["init"]);
    await runGit(repo, ["config", "user.email", "study@example.com"]);
    await runGit(repo, ["config", "user.name", "Study Bot"]);

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [
        { provider: "leetcode", problemId: "1", problemKey: "leetcode:1", slug: "two-sum", title: "Two Sum", difficulty: "easy" },
        {
          provider: "leetcode",
          problemId: "3",
          problemKey: "leetcode:3",
          slug: "longest-substring-without-repeating-characters",
          title: "Longest Substring Without Repeating Characters",
          difficulty: "medium",
        },
        { provider: "leetcode", problemId: "15", problemKey: "leetcode:15", slug: "3sum", title: "3Sum", difficulty: "medium" },
        { provider: "leetcode", problemId: "20", problemKey: "leetcode:20", slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "easy" },
        {
          provider: "leetcode",
          problemId: "1768",
          problemKey: "leetcode:1768",
          slug: "merge-strings-alternately",
          title: "Merge Strings Alternately",
          difficulty: "easy",
        },
      ],
      lists: [
        {
          key: "top-interview-easy",
          items: [
            { problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" },
            { problemKey: "leetcode:20", order: 2, section: "Others", submissionKey: "20" },
            {
              problemKey: "leetcode:3",
              order: 3,
              section: "String",
              submissionKey: "3",
            },
            { problemKey: "leetcode:15", order: 4, section: "Array", submissionKey: "15" },
          ],
        },
        {
          key: "leetcode-75",
          items: [{ problemKey: "leetcode:1768", order: 1, section: "Array / String", submissionKey: "1768" }],
        },
      ],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });

    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "solution.ts"), "// solved\n");
    await commitAll(repo, "add two sum", "2026-07-17T15:30:00.000Z");

    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "20", "Solution.java"), "// solved\n");
    await writeJson(path.join(repo, "submissions", "ada", "top-interview-easy", "3", "meta.json"), {
      status: "skipped",
    });
    await writeJson(path.join(repo, "submissions", "ada", "top-interview-easy", "15", "meta.json"), {
      status: "solved",
    });
    await writeJson(path.join(repo, "submissions", "ada", "leetcode-75", "1768", "meta.json"), {
      status: "reviewing",
      notes: "Does not count as solved activity.",
    });
    await commitAll(repo, "add valid parentheses and reviewing meta", "2026-07-18T02:10:00+09:00");

    await execFileAsync(process.execPath, [scriptPath], {
      cwd: repo,
      env: { ...process.env, SOURCE_REPOSITORY_URL: "https://github.com/example/progress", BRANCH: "master" },
    });

    const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
    expect(progress.users[0].activity).toEqual([
      {
        date: "2026-07-18",
        solved: 3,
        submissions: [
          { problemKey: "leetcode:1", sourceKey: "top-interview-easy", submissionKey: "1" },
          { problemKey: "leetcode:15", sourceKey: "top-interview-easy", submissionKey: "15" },
          { problemKey: "leetcode:20", sourceKey: "top-interview-easy", submissionKey: "20" },
        ],
      },
    ]);
  });

  it("records submittedAt from the latest commit that touched the submission artifact", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-radar-git-"));
    await mkdir(path.join(repo, "data"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "1"), { recursive: true });

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [{ provider: "leetcode", problemId: "1", problemKey: "leetcode:1", slug: "two-sum", title: "Two Sum", difficulty: "easy" }],
      lists: [
        {
          key: "top-interview-easy",
          items: [{ problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" }],
        },
      ],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "solution.ts"), "// solved\n");

    await runGit(repo, ["init"]);
    await runGit(repo, ["config", "user.email", "ada@example.com"]);
    await runGit(repo, ["config", "user.name", "Ada"]);
    await commitAll(repo, "add two sum solution", "2024-02-03T04:05:06+00:00");

    await execFileAsync(process.execPath, [scriptPath], { cwd: repo });

    const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
    expect(progress.users[0].submissions[0]).toMatchObject({
      problemKey: "leetcode:1",
      sourceKey: "top-interview-easy",
      submissionKey: "1",
      submittedAt: "2024-02-03T04:05:06.000Z",
    });
  });

  it("exposes commit-pinned raw and blob URLs with exact SHA-256 keys for central solutions", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-assets-"));
    await mkdir(path.join(repo, "data"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "1"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top interview", "2"), { recursive: true });

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [
        { provider: "leetcode", problemId: "1", problemKey: "leetcode:1", slug: "two-sum", title: "Two Sum", difficulty: "easy" },
        {
          provider: "leetcode",
          problemId: "2",
          problemKey: "leetcode:2",
          slug: "add-two-numbers",
          title: "Add Two Numbers",
          difficulty: "medium",
        },
      ],
      lists: [
        { key: "top-interview-easy", items: [{ problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" }] },
        { key: "top interview", items: [{ problemKey: "leetcode:2", order: 1, section: "List", submissionKey: "2" }] },
      ],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "solution.ts"), "// a\r\n// b\n");
    await writeFile(path.join(repo, "submissions", "ada", "top interview", "2", "Solution.java"), "class Solution {}\n");

    const revision = "0123456789abcdef0123456789abcdef01234567";
    await execFileAsync(process.execPath, [scriptPath], {
      cwd: repo,
      env: {
        ...process.env,
        SOURCE_REPOSITORY_URL: "https://github.com/example/progress",
        BRANCH: "master",
        SOURCE_REVISION: revision,
      },
    });

    const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
    const submissions = new Map(
      progress.users[0].submissions.map((item: { problemKey: string }) => [item.problemKey, item]),
    );

    expect(submissions.get("leetcode:1")).toMatchObject({
      solutionPath: "submissions/ada/top-interview-easy/1/solution.ts",
      solutionRawUrl: `https://raw.githubusercontent.com/example/progress/${revision}/submissions/ada/top-interview-easy/1/solution.ts`,
      solutionPermalink: `https://github.com/example/progress/blob/${revision}/submissions/ada/top-interview-easy/1/solution.ts`,
      solutionPathKey: sha256Hex("submissions/ada/top-interview-easy/1/solution.ts"),
      solutionContentKey: sha256Hex(Buffer.from("// a\r\n// b\n")),
      githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top-interview-easy/1/solution.ts",
    });

    expect(submissions.get("leetcode:2")).toMatchObject({
      solutionPath: "submissions/ada/top interview/2/Solution.java",
      solutionRawUrl: `https://raw.githubusercontent.com/example/progress/${revision}/submissions/ada/top%20interview/2/Solution.java`,
      solutionPermalink: `https://github.com/example/progress/blob/${revision}/submissions/ada/top%20interview/2/Solution.java`,
      solutionPathKey: sha256Hex("submissions/ada/top interview/2/Solution.java"),
      solutionContentKey: sha256Hex(Buffer.from("class Solution {}\n")),
      githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top%20interview/2/Solution.java",
    });
  });

  it("omits solution asset URLs when SOURCE_REVISION is missing or invalid without failing the build", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-revision-"));
    await mkdir(path.join(repo, "data"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "1"), { recursive: true });

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [
        { provider: "leetcode", problemId: "1", problemKey: "leetcode:1", slug: "two-sum", title: "Two Sum", difficulty: "easy" },
      ],
      lists: [{ key: "top-interview-easy", items: [{ problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" }] }],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "solution.ts"), "// solved\n");

    const baseEnv = { ...process.env, SOURCE_REPOSITORY_URL: "https://github.com/example/progress", BRANCH: "master" };
    const invalidRevisions = ["abc/def", "abc\ndef", "1234567890abcdef1234567890abcdef1234567", "z".repeat(40)];

    for (const revision of [undefined, ...invalidRevisions]) {
      await execFileAsync(process.execPath, [scriptPath], {
        cwd: repo,
        env: revision === undefined ? baseEnv : { ...baseEnv, SOURCE_REVISION: revision },
      });

      const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
      const submission = progress.users[0].submissions[0];
      expect(submission.solutionRawUrl).toBeUndefined();
      expect(submission.solutionPermalink).toBeUndefined();
      expect(submission.solutionPathKey).toBeUndefined();
      expect(submission.solutionContentKey).toBeUndefined();
      expect(submission.githubUrl).toBe(
        "https://github.com/example/progress/blob/master/submissions/ada/top-interview-easy/1/solution.ts",
      );
    }

    await execFileAsync(process.execPath, [scriptPath], {
      cwd: repo,
      env: { ...baseEnv, SOURCE_REVISION: "0123456789ABCDEF0123456789ABCDEF01234567" },
    });
    const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
    expect(progress.users[0].submissions[0]).toMatchObject({
      solutionRawUrl:
        "https://raw.githubusercontent.com/example/progress/0123456789abcdef0123456789abcdef01234567/submissions/ada/top-interview-easy/1/solution.ts",
      solutionPermalink:
        "https://github.com/example/progress/blob/0123456789abcdef0123456789abcdef01234567/submissions/ada/top-interview-easy/1/solution.ts",
    });
  });

  it("keeps generated progress metadata-only without any source body", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-nobody-"));
    await mkdir(path.join(repo, "data"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "1"), { recursive: true });

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [
        { provider: "leetcode", problemId: "1", problemKey: "leetcode:1", slug: "two-sum", title: "Two Sum", difficulty: "easy" },
      ],
      lists: [{ key: "top-interview-easy", items: [{ problemKey: "leetcode:1", order: 1, section: "Array", submissionKey: "1" }] }],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });
    const body = "const secretBody = 'fragile'; // leetdash-no-bundle\n";
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "solution.ts"), body);

    await execFileAsync(process.execPath, [scriptPath], {
      cwd: repo,
      env: {
        ...process.env,
        SOURCE_REPOSITORY_URL: "https://github.com/example/progress",
        SOURCE_REVISION: "0123456789abcdef0123456789abcdef01234567",
      },
    });

    const serialized = await readFile(path.join(repo, "data", "progress.json"), "utf8");
    expect(serialized).not.toContain(body);
    expect(serialized).not.toContain("secretBody");

    const progress = JSON.parse(serialized);
    expect(progress.users[0].submissions[0]).toMatchObject({
      solutionRawUrl: expect.stringContaining("solution.ts"),
      solutionContentKey: sha256Hex(Buffer.from(body)),
    });
  });
});
