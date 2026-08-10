"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, GitCompare } from "lucide-react";
import { difficultyLabel, formatDate, statusLabel } from "@/lib/format";
import { formatCatalogSection, formatProblemTitle } from "@/lib/i18n";
import { filterProviderProblems, paginateProviderProblems } from "@/lib/provider-problem-filter";
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

type ProviderPagination = {
  provider: CatalogProvider;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
};

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

function getProviderDataUrl(provider: CatalogProvider) {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
  return `${basePath}/provider-data/${encodeURIComponent(provider)}/data.json`;
}

function getProviderPageHref(
  provider: CatalogProvider,
  page: number,
  filters: { selectedUserId: string; status: string; difficulty: string },
) {
  const params = new URLSearchParams();
  if (filters.selectedUserId) params.set("user", filters.selectedUserId);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.difficulty !== "all") params.set("difficulty", filters.difficulty);
  const query = params.toString();
  return `/providers/${encodeURIComponent(provider)}/${page}/${query ? `?${query}` : ""}`;
}

export function CatalogProblemBrowser({
  items,
  users,
  providerPagination,
}: {
  items: Item[];
  users: User[];
  providerPagination?: ProviderPagination;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const provider = providerPagination?.provider ?? items[0]?.problem.provider ?? "leetcode";
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [providerItems, setProviderItems] = useState<Item[] | null>(null);
  const [providerLoadError, setProviderLoadError] = useState(false);
  const [currentPage, setCurrentPage] = useState(providerPagination?.currentPage ?? 1);
  const [urlFiltersReady, setUrlFiltersReady] = useState(!providerPagination);
  const filterSourceItems = providerPagination ? providerItems ?? items : items;
  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedSubmissions = selectedUserId ? filterSourceItems.map((item) => item.submissions[selectedUserId]) : [];
  const solvedCount = selectedSubmissions.filter((submission) => submission?.status === "SOLVED").length;
  const providerFiltersReady = !providerPagination || providerItems !== null;

  useEffect(() => {
    if (providerPagination) {
      const params = new URLSearchParams(window.location.search);
      const queryUserId = params.get("user");
      const storedUserId = getStoredDashboardViewerId(window.localStorage);
      const nextUserId = [queryUserId, storedUserId].find(
        (candidate): candidate is string => Boolean(candidate && users.some((user) => user.id === candidate)),
      );
      const queryStatus = params.get("status");
      const queryDifficulty = params.get("difficulty");

      setSelectedUserId(nextUserId ?? "");
      setStatusFilter(statusOptions.some((option) => option.value === queryStatus) ? queryStatus! : "all");
      setDifficultyFilter(
        difficultyOptions[provider].some((option) => option.value === queryDifficulty) ? queryDifficulty! : "all",
      );
      setCurrentPage(providerPagination.currentPage);
      setUrlFiltersReady(true);
      return;
    }

    const storedUserId = getStoredDashboardViewerId(window.localStorage);
    if (storedUserId && users.some((user) => user.id === storedUserId)) {
      setSelectedUserId(storedUserId);
    }
  }, [provider, providerPagination, users]);

  useEffect(() => {
    if (!providerPagination) return;

    const controller = new AbortController();
    setProviderItems(null);
    setProviderLoadError(false);

    fetch(getProviderDataUrl(provider), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Provider data request failed: ${response.status}`);
        const payload = await response.json() as { items?: Item[] };
        if (!Array.isArray(payload.items)) throw new Error("Provider data response is invalid");
        setProviderItems(payload.items);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProviderLoadError(true);
      });

    return () => controller.abort();
  }, [provider, providerPagination]);

  useEffect(() => {
    if (!providerPagination || !urlFiltersReady) return;

    const params = new URLSearchParams();
    if (selectedUserId) params.set("user", selectedUserId);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (difficultyFilter !== "all") params.set("difficulty", difficultyFilter);

    const pathParts = window.location.pathname.split("/");
    let pagePartIndex = -1;
    for (let index = pathParts.length - 1; index >= 0; index -= 1) {
      if (/^\d+$/.test(pathParts[index] ?? "")) {
        pagePartIndex = index;
        break;
      }
    }
    if (pagePartIndex >= 0) pathParts[pagePartIndex] = String(currentPage);
    const pathname = pathParts.join("/");
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [currentPage, difficultyFilter, providerPagination, selectedUserId, statusFilter, urlFiltersReady]);

  function handleUserChange(userId: string) {
    setSelectedUserId(userId);
    saveStoredDashboardViewerId(window.localStorage, userId || null);
    if (providerPagination) setCurrentPage(1);
  }

  const filteredItems = useMemo(() => filterProviderProblems(filterSourceItems, {
    selectedUserId,
    status: statusFilter,
    difficulty: difficultyFilter,
  }), [difficultyFilter, filterSourceItems, selectedUserId, statusFilter]);
  const paginatedItems = useMemo(() => {
    if (!providerPagination || !providerItems) {
      return {
        currentPage: providerPagination?.currentPage ?? 1,
        totalPages: providerPagination?.totalPages ?? 1,
        items: filteredItems,
      };
    }
    return paginateProviderProblems(filteredItems, currentPage, providerPagination.pageSize);
  }, [currentPage, filteredItems, providerItems, providerPagination]);

  useEffect(() => {
    if (providerPagination && providerItems && currentPage !== paginatedItems.currentPage) {
      setCurrentPage(paginatedItems.currentPage);
    }
  }, [currentPage, paginatedItems.currentPage, providerItems, providerPagination]);

  const visibleItems = paginatedItems.items;
  const paginationFilters = { selectedUserId, status: statusFilter, difficulty: difficultyFilter };

  return (
    <><section className="panel" aria-labelledby="catalog-problems-title">
      <div className="panel-header">
        <div>
          <h2 id="catalog-problems-title">문제목록</h2>
          <p className="panel-subtitle">
            {providerPagination && !providerFiltersReady
              ? "전체 문제의 필터 데이터를 불러오는 중입니다"
              : selectedUser
                ? `${selectedUser.displayName} 기준 풀이 ${solvedCount}/${filterSourceItems.length}개`
                : "닉네임을 선택하면 풀이 상태를 확인할 수 있습니다"}
          </p>
        </div>
      </div>
      <div className="filter-bar">
        <div className="viewer-control">
          <label className="filter-label" htmlFor="catalog-user-filter">닉네임</label>
          <select id="catalog-user-filter" value={selectedUserId} disabled={!providerFiltersReady} onChange={(event) => handleUserChange(event.target.value)}>
            <option value="">사용자 선택</option>
            {users.map((user) => <option value={user.id} key={user.id}>{user.displayName} (@{user.githubUsername})</option>)}
          </select>
        </div>
        <div className="viewer-control">
          <label className="filter-label" htmlFor="catalog-status-filter">상태</label>
          <select id="catalog-status-filter" value={statusFilter} disabled={!providerFiltersReady} onChange={(event) => {
            setStatusFilter(event.target.value);
            if (providerPagination) setCurrentPage(1);
          }}>
            {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="viewer-control">
          <label className="filter-label" htmlFor="catalog-difficulty-filter">난이도</label>
          <select id="catalog-difficulty-filter" value={difficultyFilter} disabled={!providerFiltersReady} onChange={(event) => {
            setDifficultyFilter(event.target.value);
            if (providerPagination) setCurrentPage(1);
          }}>
            {difficultyOptions[provider].map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
      <p className="catalog-user-hint">닉네임을 모르겠다면 관리자에게 문의하세요.</p>
      {providerLoadError ? <div className="empty">전체 문제 데이터를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</div> : null}
      {visibleItems.length === 0 ? <div className="empty">조건에 맞는 문제가 없습니다.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>문제</th><th>난이도</th><th>상태</th><th>언어</th><th>풀이 일시</th><th>링크</th></tr></thead>
            <tbody>{visibleItems.map((item) => {
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
    {providerPagination ? (
      <nav className="history-pagination" aria-label="Provider 문제 페이지">
        {paginatedItems.currentPage > 1 ? (
          <Link className="button" href={getProviderPageHref(provider, paginatedItems.currentPage - 1, paginationFilters)}>이전</Link>
        ) : null}
        <span className="muted">
          {paginatedItems.currentPage} / {paginatedItems.totalPages} · {providerItems ? filteredItems.length : providerPagination.totalItems}개
        </span>
        {paginatedItems.currentPage < paginatedItems.totalPages ? (
          <Link className="button" href={getProviderPageHref(provider, paginatedItems.currentPage + 1, paginationFilters)}>다음</Link>
        ) : null}
      </nav>
    ) : null}</>
  );
}
