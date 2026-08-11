import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const reviewWorkflow = readFileSync(".github/workflows/opencode-review.yml", "utf8").replaceAll("\r\n", "\n");
const recoveryWorkflow = readFileSync(".github/workflows/recover-opencode-review.yml", "utf8").replaceAll("\r\n", "\n");

describe("OpenCode review recovery workflow", () => {
  it("publishes a trusted attempt-specific marker only after review failure", () => {
    expect(reviewWorkflow).toContain("OPENCODE_RECOVERY_MARKER_PATH: ${{ runner.temp }}/opencode-review-recovery.json");
    expect(reviewWorkflow).toContain("name: Publish retryable failure marker\n        if: failure()");
    expect(reviewWorkflow).toContain("uses: actions/upload-artifact@v4");
    expect(reviewWorkflow).toContain("name: opencode-review-retryable-${{ github.run_attempt }}-${{ steps.resolve-pr.outputs.pull-number }}-${{ steps.resolve-pr.outputs.head-sha }}");
    expect(reviewWorkflow).toContain("if-no-files-found: ignore");
  });

  it("runs recovery only for failed review runs or explicit manual dispatch", () => {
    expect(recoveryWorkflow).toContain('workflows: ["OpenCode Submission Review"]');
    expect(recoveryWorkflow).toContain("workflow_dispatch:");
    expect(recoveryWorkflow).toContain("github.event.workflow_run.conclusion == 'failure'");
    expect(recoveryWorkflow).toContain("group: recover-opencode-review-${{ github.event.workflow_run.id || inputs.run_id }}");
    expect(recoveryWorkflow).toContain("cancel-in-progress: false");
  });

  it("checks out only trusted default-branch code and grants bounded recovery permissions", () => {
    expect(recoveryWorkflow).toContain("permissions: {}\n");
    expect(recoveryWorkflow).toContain("actions: write\n      contents: read\n      pull-requests: read");
    expect(recoveryWorkflow).toContain("ref: ${{ github.event.repository.default_branch }}");
    expect(recoveryWorkflow).toContain("persist-credentials: false");
    expect(recoveryWorkflow).toContain("run: node scripts/recover-opencode-review.mjs");
    expect(recoveryWorkflow).not.toContain("pull_request_target:");
    expect(recoveryWorkflow).not.toMatch(/ref:.*(?:head_sha|\.head\.sha)/);
  });
});
