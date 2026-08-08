import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProblemComparisonShell } from "@/app/components/problem-comparison-shell";
import { difficultyLabel } from "@/lib/format";
import {
  getProblemSolutionDetail,
  listComparableProblemParams,
} from "@/lib/problem-solutions";

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

  const solverIds = new Set(detail.solvers.map((solver) => solver.user.id));

  return (
    <div className="page">
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
          <div className="panel">
            <div className="empty">풀이 현황을 불러오는 중…</div>
          </div>
        }
      >
        <ProblemComparisonShell detail={detail} solverIds={solverIds} />
      </Suspense>
    </div>
  );
}
