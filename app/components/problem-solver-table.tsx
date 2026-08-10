"use client";

import type { ProblemDetailUser, ProblemSolver } from "@/lib/problem-solutions";
import { getGithubProfileUrl } from "@/lib/github";
import { formatDateTime, statusLabel } from "@/lib/format";
import styles from "./problem-solver-table.module.css";

// ── Helpers ──

export function statusBadgeClass(status: string): string {
  if (status === "SOLVED") return "success";
  if (status === "REVIEWING") return "running";
  if (status === "SKIPPED") return "failed";
  return "neutral";
}

// ── Row components ──

export function SolverTableRow({
  solver,
  isSelected,
  onClick,
}: {
  solver: ProblemSolver;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <tr data-testid="solver-row" aria-current={isSelected ? "true" : undefined}>
      <td className="user-cell">
        <button
          type="button"
          className="link-button user-name"
          onClick={onClick}
          aria-pressed={isSelected ? "true" : undefined}
        >
          {solver.user.displayName}
        </button>
        {!solver.user.active && (
          <span className="badge neutral">비활성</span>
        )}
      </td>
      <td>
        <a
          className="github-link"
          href={getGithubProfileUrl(solver.user.githubUsername)}
          target="_blank"
          rel="noreferrer noopener"
        >
          @{solver.user.githubUsername}
        </a>
      </td>
      <td>
        <span className={`badge ${statusBadgeClass(solver.submission.status)}`}>
          {statusLabel(solver.submission.status)}
        </span>
      </td>
      <td className="muted">{solver.submission.language ?? "—"}</td>
      <td className="muted">
        {solver.submission.submittedAt
          ? formatDateTime(solver.submission.submittedAt)
          : "—"}
      </td>
    </tr>
  );
}

export function UnsolvedUserTableRow({
  user,
  isSelected,
  onClick,
}: {
  user: ProblemDetailUser;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <tr data-testid="unsolved-user-row" aria-current={isSelected ? "true" : undefined}>
      <td className="user-cell">
        <button
          type="button"
          className="link-button user-name"
          onClick={onClick}
          aria-pressed={isSelected ? "true" : undefined}
        >
          {user.displayName}
        </button>
        {!user.active && (
          <span className="badge neutral">비활성</span>
        )}
      </td>
      <td>
        <a
          className="github-link"
          href={getGithubProfileUrl(user.githubUsername)}
          target="_blank"
          rel="noreferrer noopener"
        >
          @{user.githubUsername}
        </a>
      </td>
      <td>
        <span className="badge neutral">미제출</span>
      </td>
      <td className="muted" colSpan={2} />
    </tr>
  );
}

// ── Full table ──

export function ProblemSolverTable({
  detail,
  unsolvedUsers,
  selectedUserId,
  onSelectUser,
}: {
  detail: { users: ProblemDetailUser[]; solvers: ProblemSolver[] };
  unsolvedUsers: ProblemDetailUser[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}) {
  if (detail.users.length === 0) {
    return (
      <section className="panel" aria-label="사용자별 풀이 현황">
        <div className="panel-header">
          <div>
            <h2>풀이 현황</h2>
            <p className="panel-subtitle">등록된 사용자가 없습니다.</p>
          </div>
        </div>
        <div className="empty">등록된 사용자가 없습니다.</div>
      </section>
    );
  }

  return (
    <section className="panel" aria-label="사용자별 풀이 현황">
      <div className="panel-header">
        <div>
          <h2>풀이 현황</h2>
          <p className="panel-subtitle">
            등록 사용자 {detail.users.length}명 중 {detail.solvers.length}명이
            풀이를 제출했습니다
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table className={styles.solverTable}>
          <thead>
            <tr>
              <th>사용자</th>
              <th>GitHub</th>
              <th>풀이 상태</th>
              <th>제출 언어</th>
              <th>제출 시각</th>
            </tr>
          </thead>
          <tbody>
            {detail.solvers.map((solver) => (
              <SolverTableRow
                key={solver.user.id}
                solver={solver}
                isSelected={selectedUserId === solver.user.id}
                onClick={() => onSelectUser(solver.user.id)}
              />
            ))}
            {unsolvedUsers.map((user) => (
              <UnsolvedUserTableRow
                key={user.id}
                user={user}
                isSelected={selectedUserId === user.id}
                onClick={() => onSelectUser(user.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
