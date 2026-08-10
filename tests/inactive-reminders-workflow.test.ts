import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/inactive-reminders.yml", "utf8").replaceAll("\r\n", "\n");

describe("inactive reminder workflow", () => {
  it("runs daily at 09:00 Seoul time and supports manual dispatch", () => {
    expect(workflow).toContain('cron: "0 0 * * *"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("has only the permissions needed to read activity and comment", () => {
    expect(workflow).toContain("permissions:\n  contents: read\n  issues: write");
    expect(workflow).not.toContain("contents: write");
  });

  it("checks out full history before generating progress and sending reminders", () => {
    expect(workflow).toContain("fetch-depth: 0");
    const buildIndex = workflow.indexOf("node scripts/build-progress.mjs");
    const reminderIndex = workflow.indexOf("node scripts/send-inactive-reminders.mjs");
    expect(buildIndex).toBeGreaterThan(0);
    expect(reminderIndex).toBeGreaterThan(buildIndex);
  });

  it("uses the built-in token and repository variable for the fixed issue", () => {
    expect(workflow).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(workflow).toContain("REMINDER_ISSUE_NUMBER: ${{ vars.REMINDER_ISSUE_NUMBER }}");
    expect(workflow).toContain("GITHUB_API_URL: ${{ github.api_url }}");
  });
});
