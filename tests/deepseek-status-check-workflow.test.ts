import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deepseek-status-check.yml", "utf8").replaceAll("\r\n", "\n");
const readme = readFileSync("README.md", "utf8");

describe("DeepSeek status workflow triggers", () => {
  it("runs hourly and supports manual dispatch", () => {
    expect(workflow).toContain('cron: "0 * * * *"');
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("cancel-in-progress: false");
  });
});

describe("DeepSeek status workflow permissions", () => {
  it("grants only contents: write for the status-data push", () => {
    expect(workflow).toContain("permissions:\n    contents: write");
  });
});

describe("DeepSeek status workflow job bound", () => {
  it("bounds the check job with a 15-minute timeout at the job level", () => {
    expect(workflow).toContain("timeout-minutes: 15");
    expect(workflow).toContain("runs-on: ubuntu-latest\n    timeout-minutes: 15");
  });

  it("does not substitute a step-level shell timeout for the job bound", () => {
    expect(workflow).not.toContain("timeout 900");
    expect(workflow).not.toContain("timeout 15m");
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

  it("copies exactly the two badge JSON files and nothing else", () => {
    const copyCommands = workflow.match(/cp "\$RUNNER_TEMP\/status\/[^"]+" status\//g) ?? [];
    expect(copyCommands).toHaveLength(2);
    expect(copyCommands).toEqual([
      'cp "$RUNNER_TEMP/status/gateway-status.json" status/',
      'cp "$RUNNER_TEMP/status/deepseek-flash-status.json" status/',
    ]);
  });

  it("never copies or stages wildcard output, summaries, or diagnostics", () => {
    expect(workflow).not.toMatch(/cp .*\*/);
    expect(workflow).not.toMatch(/cp .*summary/i);
    expect(workflow).not.toMatch(/cp .*diagnostic/i);
    expect(workflow).not.toMatch(/cp .*\.log/i);
    expect(workflow).not.toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).not.toContain("git add .");
    expect(workflow).not.toContain("git add -A");
    expect(workflow).not.toContain("git add -u");
  });

  it("never writes probe output into the repo tree before the branch switch", () => {
    expect(workflow).not.toContain("--out status");
  });

  it("runs the probe before switching to the status-data branch", () => {
    const probeStep = workflow.indexOf("Run status probes");
    const switchStep = workflow.indexOf("Switch to status-data branch");
    expect(probeStep).toBeGreaterThanOrEqual(0);
    expect(switchStep).toBeGreaterThan(probeStep);
  });

  it("self-bootstraps the status-data branch without blocking or empty commits", () => {
    expect(workflow).toContain("git fetch origin status-data:refs/remotes/origin/status-data 2>/dev/null || true");
    expect(workflow).toContain("git checkout --orphan status-data");
    expect(workflow).toContain("git rm -rf --cached .");
    expect(workflow).toContain("if git diff --cached --quiet; then");
  });
});

describe("DeepSeek status workflow dependency hygiene", () => {
  it("never installs dependencies for the probes", () => {
    expect(workflow).not.toMatch(/npm (ci|install)/);
    expect(workflow).not.toMatch(/\b(pnpm|yarn|bun)\b/);
  });
});

describe("DeepSeek status workflow secret hygiene", () => {
  it("uses only OPENCODE_API_KEY and never names the vendor endpoint", () => {
    expect(workflow).not.toContain("OPENCODE_REVIEW_MODEL");
    expect(workflow).not.toContain("DEEPSEEK_API_KEY");
    expect(workflow).not.toContain("api.deepseek.com");
  });
});

describe("DeepSeek status README semantics", () => {
  it("preserves every existing badge image URL byte-for-byte", () => {
    expect(readme).toContain(
      "![OpenCode Go Gateway](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwhoisyourbias%2Fleetdash%2Fstatus-data%2Fstatus%2Fgateway-status.json)",
    );
    expect(readme).toContain(
      "![DeepSeek V4 Flash (AI Review)](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwhoisyourbias%2Fleetdash%2Fstatus-data%2Fstatus%2Fdeepseek-flash-status.json)",
    );
    expect(readme).toContain("![GitHub Pages](https://img.shields.io/github/deployments/whoisyourbias/leetdash/github-pages)");
    expect(readme).toContain(
      "![GitHub Actions - Deploy](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/deploy-pages.yml?branch=master)",
    );
    expect(readme).toContain(
      "![GitHub Actions - OpenCode Review](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/opencode-review.yml)",
    );
    expect(readme).toContain(
      "![GitHub Actions - Sweep](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/sweep-submission-prs.yml)",
    );
  });

  it("states that a green Actions run means measurement and status-data publication succeeded", () => {
    expect(readme).toContain("측정과 `status-data` 게시가 모두 성공");
  });

  it("states that each API badge reports the measured service result", () => {
    expect(readme).toContain("각 API 배지는 해당 서비스의 측정 결과");
  });

  it("keeps the OpenCode Review Actions badge as the review-workflow result", () => {
    expect(readme).toContain("OpenCode Review 배지는 이와 별개로 리뷰 워크플로우 실행 결과를 나타냅니다");
  });

  it("never claims the workflow run turns red when the service is down", () => {
    expect(readme).not.toContain("워크플로우가 빨간색");
    expect(readme).not.toContain("실행이 빨간색");
  });
});
