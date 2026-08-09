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

describe("deploy build pipeline ordering", () => {
  it("runs progress data generation before review sync before the site build", () => {
    const dataStep = workflow.indexOf("run: npm run build:data");
    const syncStep = workflow.indexOf("run: npm run reviews:sync");
    const siteStep = workflow.indexOf("run: npm run build:site");

    expect(dataStep).toBeGreaterThanOrEqual(0);
    expect(syncStep).toBeGreaterThan(dataStep);
    expect(siteStep).toBeGreaterThan(syncStep);
  });

  it("keeps the full build deterministic as data then site", () => {
    expect(workflow).toContain("run: npm run build:site");
  });
});

describe("deploy data generation", () => {
  it("runs deploy data generation with the central repository and exact source revision", () => {
    expect(workflow).toContain(
      "      - name: Generate progress data (deploy)\n"
        + "        if: github.event_name != 'pull_request'\n"
        + "        run: npm run build:data\n"
        + "        env:\n"
        + "          SOURCE_REPOSITORY_URL: https://github.com/whoisyourbias/leetdash\n"
        + "          BRANCH: master\n"
        + "          SOURCE_REVISION: ${{ github.sha }}",
    );
  });
});

describe("pull request build path", () => {
  it("runs exactly the full token-free build on eligible pull requests", () => {
    expect(workflow).toContain(
      "      - name: Full build (pull request)\n"
        + "        if: github.event_name == 'pull_request' && steps.pr-scope.outputs.submission_only != 'true'\n"
        + "        run: npm run build\n"
        + "        env:\n"
        + "          NEXT_PUBLIC_BASE_PATH: /leetdash\n"
        + "          SOURCE_REPOSITORY_URL: https://github.com/whoisyourbias/leetdash\n"
        + "          BRANCH: master",
    );
  });

  it("keeps the pull request build free of source revision, token, and review sync", () => {
    const prBuildStart = workflow.indexOf("name: Full build (pull request)");
    const syncStart = workflow.indexOf("name: Sync review artifacts");
    expect(prBuildStart).toBeGreaterThanOrEqual(0);

    const prBlock = workflow.slice(prBuildStart, syncStart);
    expect(prBlock).not.toContain("SOURCE_REVISION");
    expect(prBlock).not.toContain("GITHUB_TOKEN");
    expect(prBlock).not.toContain("reviews:sync");

    // SOURCE_REVISION exists only on the deploy data step, never on pull requests.
    expect((workflow.match(/SOURCE_REVISION/g) ?? [])).toHaveLength(1);
  });

  it("runs the site build only on deploy events, never redundantly on pull requests", () => {
    expect(workflow).toContain(
      "      - name: Build static site\n"
        + "        if: github.event_name != 'pull_request'\n"
        + "        run: npm run build:site",
    );
  });
});

describe("review artifact synchronization", () => {
  it("runs review sync only on deploy runs (push or workflow dispatch), never on pull_request", () => {
    expect(workflow).toContain(
      "      - name: Sync review artifacts\n"
        + "        if: github.event_name != 'pull_request'\n"
        + "        timeout-minutes: 15\n"
        + "        run: npm run reviews:sync",
    );
  });

  it("exposes the repository and token only on the review sync step", () => {
    expect(workflow).toContain(
      "        run: npm run reviews:sync\n"
        + "        env:\n"
        + "          GITHUB_REPOSITORY: ${{ github.repository }}\n"
        + "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
    );
    expect((workflow.match(/GITHUB_REPOSITORY/g) ?? [])).toHaveLength(1);
    expect((workflow.match(/GITHUB_TOKEN: /g) ?? [])).toHaveLength(1);
  });
});

describe("workflow least privilege", () => {
  it("grants only contents and issues read at workflow scope", () => {
    expect(workflow).toContain("permissions:\n  contents: read\n  issues: read");
    expect(workflow).not.toContain("write-all");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("issues: write");
  });

  it("scopes pages and id-token permissions to the deploy job", () => {
    const deployJob = workflow.slice(workflow.indexOf("deploy:\n"));
    expect(deployJob).toContain("permissions:\n      pages: write\n      id-token: write");
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
