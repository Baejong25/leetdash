import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deepseek-status-check.yml", "utf8").replaceAll("\r\n", "\n");

describe("DeepSeek status workflow triggers", () => {
  it("runs hourly and supports manual dispatch", () => {
    expect(workflow).toContain('cron: "0 * * * *"');
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("concurrency:");
  });
});

describe("DeepSeek status workflow permissions", () => {
  it("grants only contents: write for the status-data push", () => {
    expect(workflow).toContain("permissions:\n    contents: write");
  });
});

describe("DeepSeek status workflow status publishing", () => {
  it("runs the status probe into RUNNER_TEMP and publishes badge JSON to status-data", () => {
    expect(workflow).toContain("node scripts/check-ai-review-status.mjs");
    expect(workflow).toContain('node scripts/check-ai-review-status.mjs --out "$RUNNER_TEMP/status"');
    expect(workflow).toContain("OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}");
    expect(workflow).toContain('cp "$RUNNER_TEMP/status/gateway-status.json" status/');
    expect(workflow).toContain('cp "$RUNNER_TEMP/status/deepseek-flash-status.json" status/');
    expect(workflow).toContain("git add status/");
    expect(workflow).toContain("git push origin status-data");
  });

  it("never writes probe output into the repo tree before the branch switch", () => {
    expect(workflow).not.toContain("--out status");
  });

  it("self-bootstraps the status-data branch without blocking or empty commits", () => {
    expect(workflow).toContain("git fetch origin status-data:refs/remotes/origin/status-data 2>/dev/null || true");
    expect(workflow).toContain("git checkout --orphan status-data");
    expect(workflow).toContain("git rm -rf --cached .");
    expect(workflow).toContain("if git diff --cached --quiet; then");
  });
});

describe("DeepSeek status workflow secret hygiene", () => {
  it("uses only OPENCODE_API_KEY and never installs dependencies or names the vendor endpoint", () => {
    expect(workflow).not.toContain("OPENCODE_REVIEW_MODEL");
    expect(workflow).not.toContain("DEEPSEEK_API_KEY");
    expect(workflow).not.toContain("npm ci");
    expect(workflow).not.toContain("api.deepseek.com");
  });
});
