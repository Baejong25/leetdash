import { describe, expect, it, vi } from "vitest";

import {
  getSeoulDateKey,
  isReminderDay,
  renderReminderComment,
  selectReminderTargets,
  sendInactiveReminders,
} from "../scripts/send-inactive-reminders.mjs";

function usersInput(users) {
  return { users };
}

function progressUser({ id, githubUsername = id, activity = [], active = true }) {
  return { id, githubUsername, activity, active };
}

describe("inactive reminder target selection", () => {
  it("selects only explicitly active users on the configured reminder days", () => {
    const targets = selectReminderTargets({
      today: new Date("2026-08-10T00:00:00.000Z"),
      usersInput: usersInput([
        { id: "day3", active: true },
        { id: "day7", active: true },
        { id: "day14", active: true },
        { id: "inactive", active: false },
        { id: "omitted" },
        { id: "day4", active: true },
      ]),
      progressInput: {
        users: [
          progressUser({ id: "day3", activity: [{ date: "2026-08-07", solved: 1 }] }),
          progressUser({ id: "day7", activity: [{ date: "2026-08-03", solved: 1 }] }),
          progressUser({ id: "day14", activity: [{ date: "2026-07-27", solved: 1 }] }),
          progressUser({ id: "inactive", activity: [{ date: "2026-08-07", solved: 1 }] }),
          progressUser({ id: "omitted", activity: [{ date: "2026-08-07", solved: 1 }] }),
          progressUser({ id: "day4", activity: [{ date: "2026-08-06", solved: 1 }] }),
        ],
      },
    });

    expect(targets.map(({ id, daysInactive }) => ({ id, daysInactive }))).toEqual([
      { id: "day3", daysInactive: 3 },
      { id: "day7", daysInactive: 7 },
      { id: "day14", daysInactive: 14 },
    ]);
  });

  it("excludes users without solved activity", () => {
    expect(selectReminderTargets({
      today: new Date("2026-08-10T00:00:00.000Z"),
      usersInput: usersInput([{ id: "new-user", active: true }]),
      progressInput: { users: [progressUser({ id: "new-user" })] },
    })).toEqual([]);
  });

  it("uses the latest solved activity no later than today", () => {
    const targets = selectReminderTargets({
      today: new Date("2026-08-10T00:00:00.000Z"),
      usersInput: usersInput([{ id: "ada", active: true }]),
      progressInput: {
        users: [progressUser({
          id: "ada",
          activity: [
            { date: "2026-08-07", solved: 1 },
            { date: "2026-08-08", solved: 0 },
            { date: "2026-08-20", solved: 1 },
          ],
        })],
      },
    });
    expect(targets).toEqual([expect.objectContaining({ id: "ada", daysInactive: 3 })]);
  });
});

describe("inactive reminder dates and rendering", () => {
  it("uses the Asia/Seoul calendar date", () => {
    expect(getSeoulDateKey("2026-08-09T15:00:00.000Z")).toBe("2026-08-10");
  });

  it.each([
    [3, true], [7, true], [14, true], [21, true], [4, false], [8, false], [13, false], [15, false],
  ])("applies the 3-day, 7-day, then weekly cadence for day %i", (day, expected) => {
    expect(isReminderDay(day)).toBe(expected);
  });

  it("renders a dated marker, mentions, and encoded profile links", () => {
    const body = renderReminderComment({
      dateKey: "2026-08-10",
      dashboardBaseUrl: "https://example.test/leetdash/",
      targets: [{ id: "user id", githubUsername: "ada", daysInactive: 3 }],
    });
    expect(body.startsWith("<!-- leetdash-reminder:2026-08-10 -->\n")).toBe(true);
    expect(body).toContain("@ada 최근 **3일간** 풀이 기록이 없습니다.");
    expect(body).toContain("https://example.test/leetdash/users/user%20id/");
  });
});

describe("inactive reminder delivery", () => {
  const baseOptions = {
    now: () => new Date("2026-08-10T00:00:00.000Z"),
    apiUrl: "https://api.github.test",
    repository: "owner/repo",
    issueNumber: "42",
    token: "token",
    usersInput: usersInput([{ id: "ada", active: true }]),
    progressInput: { users: [progressUser({ id: "ada", activity: [{ date: "2026-08-07", solved: 1 }] })] },
  };

  it("does not call GitHub when there are no targets", async () => {
    const fetchImpl = vi.fn();
    const result = await sendInactiveReminders({
      ...baseOptions,
      fetchImpl,
      progressInput: { users: [progressUser({ id: "ada", activity: [{ date: "2026-08-06", solved: 1 }] })] },
    });
    expect(result.status).toBe("no-targets");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips posting when today's managed marker already exists", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: "open" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ body: "<!-- leetdash-reminder:2026-08-10 -->" }]), { status: 200 }));
    const result = await sendInactiveReminders({ ...baseOptions, fetchImpl });
    expect(result.status).toBe("duplicate");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("posts one comment to an open issue", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: "open" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 201 }));
    const result = await sendInactiveReminders({ ...baseOptions, fetchImpl });
    expect(result).toEqual({ status: "sent", dateKey: "2026-08-10", targetCount: 1 });
    const [url, request] = fetchImpl.mock.calls[2];
    expect(url).toBe("https://api.github.test/repos/owner/repo/issues/42/comments");
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body).body).toContain("@ada");
  });

  it("fails when the configured issue is closed", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "closed" }), { status: 200 }),
    );
    await expect(sendInactiveReminders({ ...baseOptions, fetchImpl })).rejects.toThrow("must be an open issue");
  });
});
