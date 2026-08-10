import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEOUL_TIME_ZONE = "Asia/Seoul";
const GITHUB_API_VERSION = "2022-11-28";
const DEFAULT_DASHBOARD_BASE_URL = "https://whoisyourbias.github.io/leetdash";

const seoulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getSeoulDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required.");
  }

  const parts = Object.fromEntries(
    seoulDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyToUtcMs(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid activity date: ${dateKey}`);
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = Date.UTC(year, month - 1, day);
  if (new Date(value).toISOString().slice(0, 10) !== dateKey) {
    throw new Error(`Invalid activity date: ${dateKey}`);
  }
  return value;
}

function daysBetween(startDateKey, endDateKey) {
  return Math.floor((dateKeyToUtcMs(endDateKey) - dateKeyToUtcMs(startDateKey)) / 86_400_000);
}

function isReminderDay(daysInactive) {
  return daysInactive === 3 || daysInactive === 7 || (daysInactive >= 14 && daysInactive % 7 === 0);
}

function normalizeUsersInput(input) {
  const users = Array.isArray(input) ? input : input?.users;
  if (!Array.isArray(users)) {
    throw new Error("data/users.json must contain a users array.");
  }
  return users;
}

function selectReminderTargets({ usersInput, progressInput, today = new Date() }) {
  const todayKey = getSeoulDateKey(today);
  const explicitlyActiveIds = new Set(
    normalizeUsersInput(usersInput)
      .filter((user) => user?.active === true)
      .map((user) => String(user.id)),
  );
  const progressUsers = Array.isArray(progressInput?.users) ? progressInput.users : [];

  return progressUsers.flatMap((user) => {
    if (!explicitlyActiveIds.has(String(user.id))) {
      return [];
    }
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(user.githubUsername ?? "")) {
      throw new Error(`Invalid GitHub username for active user ${user.id}.`);
    }

    const lastActivity = Array.isArray(user.activity)
      ? user.activity
        .filter((day) => day?.solved > 0 && typeof day.date === "string" && day.date <= todayKey)
        .sort((left, right) => left.date.localeCompare(right.date))
        .at(-1)
      : undefined;
    if (!lastActivity) {
      return [];
    }

    const daysInactive = daysBetween(lastActivity.date, todayKey);
    return isReminderDay(daysInactive)
      ? [{
        id: String(user.id),
        githubUsername: user.githubUsername,
        daysInactive,
        lastActiveDate: lastActivity.date,
      }]
      : [];
  });
}

function reminderMarker(dateKey) {
  return `<!-- leetdash-reminder:${dateKey} -->`;
}

function renderReminderComment({ dateKey, targets, dashboardBaseUrl = DEFAULT_DASHBOARD_BASE_URL }) {
  const baseUrl = dashboardBaseUrl.replace(/\/+$/, "");
  const rows = targets.map((target) => (
    `- @${target.githubUsername} 최근 **${target.daysInactive}일간** 풀이 기록이 없습니다. `
    + `[대시보드 확인](${baseUrl}/users/${encodeURIComponent(target.id)}/)`
  ));

  return [
    reminderMarker(dateKey),
    "",
    `## ${dateKey} 문제 풀이 알림`,
    "",
    ...rows,
    "",
    "오늘 한 문제부터 다시 시작해 보세요 🚀",
  ].join("\n");
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

async function githubRequest({ fetchImpl, url, token, method = "GET", body }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      ...githubHeaders(token),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${method} ${response.status}`);
  }
  return response.status === 204 ? undefined : response.json();
}

async function hasReminderComment({ fetchImpl, apiUrl, repository, issueNumber, token, marker }) {
  for (let page = 1; ; page += 1) {
    const comments = await githubRequest({
      fetchImpl,
      token,
      url: `${apiUrl}/repos/${repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
    });
    if (comments.some((comment) => typeof comment.body === "string" && comment.body.includes(marker))) {
      return true;
    }
    if (comments.length < 100) {
      return false;
    }
  }
}

async function sendInactiveReminders({
  usersInput,
  progressInput,
  fetchImpl = fetch,
  now = () => new Date(),
  apiUrl,
  repository,
  issueNumber,
  token,
  dashboardBaseUrl = DEFAULT_DASHBOARD_BASE_URL,
} = {}) {
  if (!token) throw new Error("GITHUB_TOKEN is required.");
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY is required.");
  if (!/^[1-9]\d*$/.test(String(issueNumber ?? ""))) throw new Error("REMINDER_ISSUE_NUMBER must be a positive issue number.");
  if (!apiUrl) throw new Error("GITHUB_API_URL is required.");

  const currentTime = now();
  const dateKey = getSeoulDateKey(currentTime);
  const targets = selectReminderTargets({ usersInput, progressInput, today: currentTime });
  if (targets.length === 0) {
    return { status: "no-targets", dateKey, targetCount: 0 };
  }

  const issue = await githubRequest({
    fetchImpl,
    token,
    url: `${apiUrl}/repos/${repository}/issues/${issueNumber}`,
  });
  if (issue.pull_request || issue.state !== "open") {
    throw new Error(`Reminder issue #${issueNumber} must be an open issue.`);
  }

  const marker = reminderMarker(dateKey);
  if (await hasReminderComment({ fetchImpl, apiUrl, repository, issueNumber, token, marker })) {
    return { status: "duplicate", dateKey, targetCount: targets.length };
  }

  await githubRequest({
    fetchImpl,
    token,
    method: "POST",
    url: `${apiUrl}/repos/${repository}/issues/${issueNumber}/comments`,
    body: { body: renderReminderComment({ dateKey, targets, dashboardBaseUrl }) },
  });
  return { status: "sent", dateKey, targetCount: targets.length };
}

async function main({ env = process.env, readFileImpl = readFile, fetchImpl = fetch, now = () => new Date() } = {}) {
  const [usersInput, progressInput] = await Promise.all([
    readFileImpl(path.join(process.cwd(), "data", "users.json"), "utf8").then(JSON.parse),
    readFileImpl(path.join(process.cwd(), "data", "progress.json"), "utf8").then(JSON.parse),
  ]);
  const result = await sendInactiveReminders({
    usersInput,
    progressInput,
    fetchImpl,
    now,
    apiUrl: env.GITHUB_API_URL,
    repository: env.GITHUB_REPOSITORY,
    issueNumber: env.REMINDER_ISSUE_NUMBER,
    token: env.GITHUB_TOKEN,
    dashboardBaseUrl: env.DASHBOARD_BASE_URL || DEFAULT_DASHBOARD_BASE_URL,
  });
  console.log(`inactive-reminders: status=${result.status} date=${result.dateKey} targets=${result.targetCount}`);
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`send-inactive-reminders: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export {
  daysBetween,
  getSeoulDateKey,
  isReminderDay,
  main,
  reminderMarker,
  renderReminderComment,
  selectReminderTargets,
  sendInactiveReminders,
};
