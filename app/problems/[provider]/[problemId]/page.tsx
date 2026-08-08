import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProblemSolutionExplorer } from "@/app/components/problem-solution-explorer";
import { difficultyLabel, statusLabel, formatDateTime } from "@/lib/format";
import { getGithubProfileUrl } from "@/lib/github";
import {
  getProblemSolutionDetail,
  listComparableProblemParams,
  type ProblemDetailUser,
  type ProblemSolver,
} from "@/lib/problem-solutions";
import explorerStyles from "@/app/components/problem-solution-explorer.module.css";
import codeStyles from "@/app/components/solution-code-viewer.module.css";
import reviewStyles from "@/app/components/solution-review-panel.module.css";

export const dynamicParams = false;

export async function generateStaticParams() {
  return listComparableProblemParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ provider: string; problemId: string }>;
}): Promise<Metadata> {
  const { provider, problemId } = await params;
  const detail = getProblemSolutionDetail(provider, problemId);
  if (!detail) {
    return { title: "문제를 찾을 수 없습니다" };
  }
  return {
    title: `${detail.problem.title} — 풀이 비교`,
    description: `${detail.problem.title} (${detail.problem.difficulty}) ${detail.solvers.length}명 풀이`,
  };
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    leetcode: "LeetCode",
    programmers: "Programmers",
    swea: "SWEA",
  };
  return labels[provider] ?? provider;
}

function difficultyBadgeClass(difficulty: string): string {
  const lower = difficulty.toLowerCase();
  if (lower === "easy" || lower.startsWith("lv.1") || lower.startsWith("d1") || lower.startsWith("d2")) {
    return "success";
  }
  if (lower === "medium" || lower.startsWith("lv.2") || lower.startsWith("d3")) {
    return "running";
  }
  if (lower === "hard" || lower.startsWith("lv.3") || lower.startsWith("lv.4") || lower.startsWith("lv.5")) {
    return "failed";
  }
  return "neutral";
}

function solverStatusBadgeClass(status: string): string {
  if (status === "SOLVED") return "success";
  if (status === "REVIEWING") return "running";
  if (status === "SKIPPED") return "failed";
  return "neutral";
}

export default async function ProblemComparisonPage({
  params,
}: {
  params: Promise<{ provider: string; problemId: string }>;
}) {
  const { provider, problemId } = await params;
  const detail = getProblemSolutionDetail(provider, problemId);
  if (!detail) {
    notFound();
  }

  // ── Pre-compute server-side data for the Suspense fallback ──
  //  When no ?user= is present (static export), the explorer selects
  //  the first solver.  We mirror that geometry in the fallback so
  //  hydration does not shift the layout.
  const solverIds = new Set(detail.solvers.map((s) => s.user.id));
  const unsolvedUsersForFallback = detail.users.filter(
    (u) => !solverIds.has(u.id),
  );
  const defaultSolver: ProblemSolver | null =
    detail.solvers.length > 0 ? detail.solvers[0] : null;

  return (
    <div className="page comparison-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <Link href="/">대시보드</Link>
            {" / "}
            <span>{providerLabel(detail.problem.provider)}</span>
            {" / "}
            <span className="mono">{detail.problem.problemId}</span>
          </p>
          <h1>{detail.problem.title}</h1>
          <p className="lede">
            <span className={`badge ${difficultyBadgeClass(detail.problem.difficulty)}`}>
              {difficultyLabel(detail.problem.difficulty)}
            </span>
            {" "}
            <a
              className="problem-link"
              href={detail.problem.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              원본 문제 열기
            </a>
            {" • "}
            <span>{detail.solvers.length}명 풀이 완료</span>
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <GeometryStableFallback
            detail={detail}
            unsolvedUsers={unsolvedUsersForFallback}
            defaultSolver={defaultSolver}
          />
        }
      >
        <ProblemSolutionExplorer detail={detail} />
      </Suspense>
    </div>
  );
}

// ── Geometry-stable Suspense fallback ─────────────────────────────────────
//  Duplicates the explorer DOM structure at its initial hydration geometry
//  so that replacing the fallback does not shift the page layout.

function GeometryStableFallback({
  detail,
  unsolvedUsers,
  defaultSolver,
}: {
  detail: { users: ProblemDetailUser[]; solvers: ProblemSolver[] };
  unsolvedUsers: ProblemDetailUser[];
  defaultSolver: ProblemSolver | null;
}) {
  return (
    <div className={explorerStyles.explorerRoot}>
      <div className={explorerStyles.detailSection}>
        {defaultSolver && (
          <div>
            <section
              className={`${explorerStyles.selectedSummary} panel`}
              aria-label="선택한 풀이"
            >
              <div className="panel-header">
                <h2 tabIndex={-1}>{defaultSolver.user.displayName}의 풀이</h2>
                <div className="solver-meta">
                  <span
                    className={`badge ${solverStatusBadgeClass(defaultSolver.submission.status)}`}
                  >
                    {statusLabel(defaultSolver.submission.status)}
                  </span>
                  {defaultSolver.submission.language && (
                    <span className="badge neutral">
                      {defaultSolver.submission.language}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <div className={explorerStyles.explorerDetailLayout}>
              <div className={explorerStyles.codeColumn}>
                <div className={codeStyles.surface}>
                  <div className={codeStyles.header}>
                    <span className={codeStyles.headerLabel}>
                      Solution Source
                    </span>
                  </div>
                  <div className={codeStyles.loadingSkeleton}>
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className={codeStyles.skeletonLine} />
                    ))}
                  </div>
                </div>
              </div>

              <div className={explorerStyles.reviewColumn}>
                <section className="panel" aria-live="polite">
                  <div className="panel-header">
                    <h2>리뷰</h2>
                  </div>
                  <div
                    className={reviewStyles.body}
                    role="region"
                    aria-label="솔루션 리뷰"
                  >
                    <p className={reviewStyles.status} aria-busy="true">
                      리뷰를 불러오는 중…
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={explorerStyles.solverSection}>
        <StaticSolverTable
          users={detail.users}
          solvers={detail.solvers}
          unsolvedUsers={unsolvedUsers}
          defaultSolverId={defaultSolver?.user.id ?? null}
        />
      </div>
    </div>
  );
}

function StaticSolverTable({
  users,
  solvers,
  unsolvedUsers,
  defaultSolverId,
}: {
  users: ProblemDetailUser[];
  solvers: ProblemSolver[];
  unsolvedUsers: ProblemDetailUser[];
  defaultSolverId: string | null;
}) {
  if (users.length === 0) {
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
            등록 사용자 {users.length}명 중 {solvers.length}명이
            풀이를 제출했습니다
          </p>
        </div>
      </div>

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
            {solvers.map((solver) => {
              const isSelected = defaultSolverId === solver.user.id;
              return (
                <tr
                  key={solver.user.id}
                  data-testid="solver-row"
                  aria-current={isSelected ? "true" : undefined}
                >
                  <td className="user-cell">
                    <span
                      className="link-button user-name"
                      aria-pressed={isSelected ? "true" : undefined}
                    >
                      {solver.user.displayName}
                    </span>
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
                    <span
                      className={`badge ${solverStatusBadgeClass(solver.submission.status)}`}
                    >
                      {statusLabel(solver.submission.status)}
                    </span>
                  </td>
                  <td className="muted">
                    {solver.submission.language ?? "—"}
                  </td>
                  <td className="muted">
                    {solver.submission.submittedAt
                      ? formatDateTime(solver.submission.submittedAt)
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {unsolvedUsers.map((user) => {
              const isSelected = defaultSolverId === user.id;
              return (
                <tr
                  key={user.id}
                  data-testid="unsolved-user-row"
                  aria-current={isSelected ? "true" : undefined}
                >
                  <td className="user-cell">
                    <span
                      className="link-button user-name"
                      aria-pressed={isSelected ? "true" : undefined}
                    >
                      {user.displayName}
                    </span>
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
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
