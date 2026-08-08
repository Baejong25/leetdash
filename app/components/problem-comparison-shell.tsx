"use client";

import Link from "next/link";
import { getGithubProfileUrl } from "@/lib/github";
import { getUserProfileHref } from "@/lib/routes";
import { formatDateTime, statusLabel } from "@/lib/format";
import { type ProblemSolutionDetail } from "@/lib/problem-solutions";

function statusBadgeClass(status: string): string {
  if (status === "SOLVED") {
    return "success";
  }
  if (status === "REVIEWING") {
    return "running";
  }
  if (status === "SKIPPED") {
    return "failed";
  }
  return "neutral";
}

export function ProblemComparisonShell({
  detail,
  solverIds,
}: {
  detail: ProblemSolutionDetail;
  solverIds: Set<string>;
}) {
  const unsolvedUsers = detail.users.filter((user) => !solverIds.has(user.id));

  return (
    <section className="panel" aria-label="사용자별 풀이 현황">
      <div className="panel-header">
        <div>
          <h2>풀이 현황</h2>
          <p className="panel-subtitle">
            등록 사용자 {detail.users.length}명 중 {detail.solvers.length}명이 풀이를 제출했습니다
          </p>
        </div>
      </div>

      {detail.users.length === 0 ? (
        <div className="empty">등록된 사용자가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
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
                <tr key={solver.user.id}>
                  <td className="user-cell">
                    <Link className="user-name" href={getUserProfileHref(solver.user.id, "")}>
                      {solver.user.displayName}
                    </Link>
                    {!solver.user.active && <span className="badge neutral">비활성</span>}
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
                  <td className="muted">{formatDateTime(solver.submission.submittedAt)}</td>
                </tr>
              ))}
              {unsolvedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="user-cell">
                    <span className="user-name">{user.displayName}</span>
                    {!user.active && <span className="badge neutral">비활성</span>}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
