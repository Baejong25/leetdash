import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8").replaceAll("\r\n", "\n");

describe("deploy workflow triggers", () => {
  it("uploads and deploys Pages for both push and workflow dispatch runs", () => {
    expect(workflow).toContain("if: github.event_name != 'pull_request'\n        run: touch out/.nojekyll");
    expect(workflow).toContain("if: github.event_name != 'pull_request'\n        uses: actions/upload-pages-artifact@v4");
    expect(workflow).toContain("deploy:\n    if: github.event_name != 'pull_request'");
  });
});

describe("OpenCode submission review isolation", () => {
  it("keeps secret-bearing review execution out of the pull_request workflow", () => {
    expect(workflow).not.toContain("review-submission:");
    expect(workflow).not.toContain("node scripts/opencode-review.mjs");
    expect(workflow).not.toContain("OPENCODE_API_KEY");
    expect(workflow).not.toContain("OPENCODE_REVIEW_MODEL");
    expect(workflow).not.toContain("checks: write");
    expect(workflow).not.toContain("pull-requests: write");
  });
});
