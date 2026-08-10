"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, GitCompare } from "lucide-react";
import { difficultyLabel, formatDate, statusLabel } from "@/lib/format";
import { formatCatalogSection, formatProblemTitle } from "@/lib/i18n";
import { getComparisonLinkHref } from "@/lib/user-problem-comparison-link";
import { getStoredDashboardViewerId, saveStoredDashboardViewerId } from "@/lib/dashboard-viewer";
import type { CatalogProblem, CatalogProvider } from "@/lib/catalog";
import type { Submission } from "@/lib/types";

type Item = {
  problemKey: string;
  order: number;
  section: string;
  problem: CatalogProblem;
  submissions: Record<string, Submission | null>;
  communitySolutionCount: number;
};

type User = { id: string; displayName: string; githubUsername: string };

const providerLabels: Record<CatalogProvider, string> = {
  leetcode: "LeetCode",
  programmers: "Programmers",
  swea: "SWEA",
};

const statusOptions = [
  { value: "all", label: "전체" },
  { value: "SOLVED", label: "풀이 완료" },
  { value: "REVIEWING", label: "검토 중" },
  { value: "SKIPPED", label: "건너뜀" },
  { value: "UNSOLVED", label: "시작 전" },
] as const;

const difficultyOptions: Record<CatalogProvider, { value: string; label: string }[]> = {
  leetcode: [
    { value: "all", label: "전체" },
    { value: "easy", label: "쉬움" },
    { value: "medium", label: "보통" },
    { value: "hard", label: "어려움" },
  ],
  programmers: [
    { value: "all", label: "전체" },
    ...[0, 1, 2, 3, 4, 5].map((level) => ({ value: `level-${level}`, label: `Level ${level}` })),
  ],
  swea: Array.from({ length: 8 }, (_, index) => ({ value: `D${index + 1}`, label: `D${index + 1}` })).concat([
    { value: "all", label: "전체" },
  ]).sort((a, b) => (a.value === "all" ? -1 : b.value === "all" ? 1 : a.value.localeCompare(b.value))),
};

export function CatalogProblemBrowser({ items, users }: { items: Item[]; users: User[] }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const provider = items[0]?.problem.provider ?? "leetcode";
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedSubmissions = selectedUserId ? items.map((item) => item.submissions[selectedUserId]) : [];
  const solvedCount = selectedSubmissions.filter((submission) => submission?.status === "SOLVED").length;

  useEffect(() => {
    const storedUserId = getStoredDashboardViewerId(window.localStorage);
    if (storedUserId && users.some((user) => user.id === storedUserId)) {
      setSelectedUserId(storedUserId);
    }
  }, [users]);

  function handleUserChange(userId: string) {
    setSelectedUserId(userId);
    saveStoredDashboardViewerId(window.localStorage, userId || null);
  }

  const filteredItems = useMemo(() => items.filter((item) => {
    const submission = selectedUserId ? item.submissions[selectedUserId] : null;
    if (difficultyFilter !== "all" && item.problem.difficulty !== difficultyFilter) return false;
    if (statusFilter === "UNSOLVED") return !submission;
    if (statusFilter !== "all" && submission?.status !== statusFilter) return false;
    return true;
  }), [difficultyFilter, items, selectedUserId, statusFilter]);

  return (
    <section className="panel" aria-labelledby="catalog-problems-title">
      <div className="panel-header">
        <div>
          <h2 id="catalog-problems-title">문제목록</h2>
          <p className="panel-subtitle">
            {selectedUser ? `${selectedUser.displayName} 기준 풀이 ${solvedCount}/${items.length}개` : "닉네임을 선택하면 풀이 상태를 확인할 수 있습니다"}
          </p>
        </div>
      </div>
      <div className="filter-bar">
        <div className="viewer-control">
          <label className="filter-label" htmlFor="catalog-user-filter">닉네임</label>
          <select id="catalog-user-filter" value={selectedUserId} onChange={(event) => handleUserChange(event.target.value)}>
            <option value="">사용자 선택</option>
            {users.map((user) => <option value={user.id} key={user.id}>{user.displayName} (@{user.githubUsername})</option>)}
          </select>
        </div>
        <div className="viewer-control">
          <label className="filter-label" htmlFor="catalog-status-filter">상태</label>
          <select id="catalog-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="viewer-control">
          <label className="filter-label" htmlFor="catalog-difficulty-filter">난이도</label>
          <select id="catalog-difficulty-filter" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
            {difficultyOptions[provider].map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
      <p className="catalog-user-hint">닉네임을 모르겠다면 관리자에게 문의하세요.</p>
      {filteredItems.length === 0 ? <div className="empty">조건에 맞는 문제가 없습니다.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>문제</th><th>난이도</th><th>상태</th><th>언어</th><th>풀이 일시</th><th>링크</th></tr></thead>
            <tbody>{filteredItems.map((item) => {
              const submission = selectedUserId ? item.submissions[selectedUserId] : null;
              const comparisonHref = selectedUserId ? getComparisonLinkHref(item.problem.provider, item.problem.problemId, selectedUserId, item.communitySolutionCount) : null;
              return <tr key={item.problemKey}>
                <td className="mono">{item.problem.problemId}</td>
                <td><div className="problem-title">{comparisonHref ? <Link className="problem-link" href={comparisonHref}>{formatProblemTitle(item.problem.title)}</Link> : formatProblemTitle(item.problem.title)}</div><div className="muted mono">{formatCatalogSection(item.section)}</div></td>
                <td><span className="badge neutral">{difficultyLabel(item.problem.difficulty)}</span></td>
                <td>{submission ? <><span className={`badge ${submission.status.toLowerCase()}`}>{statusLabel(submission.status)}</span>{submission.notes ? <div className="muted">{submission.notes}</div> : null}</> : <span className="badge neutral">시작 전</span>}</td>
                <td className="mono">{submission?.language ?? "-"}</td>
                <td>{formatDate(submission?.solvedAt)}</td>
                <td><div className="actions">
                  {comparisonHref ? <Link className="button" href={comparisonHref}><GitCompare size={16} aria-hidden="true" />비교</Link> : null}
                  <a className="button catalog-source-button" href={item.problem.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" />{providerLabels[item.problem.provider]}</a>
                  {submission?.githubUrl ? <a className="button" href={submission.githubUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" />GitHub</a> : null}
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
