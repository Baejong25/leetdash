"use client";

import { useState } from "react";
import Link from "next/link";
import { CatalogProblemList } from "@/app/components/catalog-problem-list";
import { UserProblemActions } from "@/app/components/user-problem-actions";
import { difficultyLabel, formatDate, statusLabel } from "@/lib/format";
import { formatCatalogListTitle, formatCatalogSection, formatProblemTitle } from "@/lib/i18n";
import { getComparisonLinkHref } from "@/lib/user-problem-comparison-link";
import type { CatalogProblem, CatalogProvider } from "@/lib/catalog";
import type { Submission } from "@/lib/types";

type ListItem = {
  problemKey: string;
  order: number;
  section: string;
  submissionKey: string;
  problem: CatalogProblem;
  submission: Submission | null;
  communitySolutionCount: number;
};

type ListData = {
  key: string;
  title: string;
  url: string;
  summary: string[];
  problems: CatalogProblem[];
  items: ListItem[];
  progress: {
    key: string;
    title: string;
    total: number;
    solved: number;
    reviewing: number;
    skipped: number;
    percent: number;
  };
};

type Props = {
  lists: ListData[];
  firstUnsolvedProblemTarget: {
    elementId: string;
    listKey: string;
    problemKey: string;
  } | null;
  profileUserId: string;
};

const providerLabels = {
  leetcode: "LeetCode",
  programmers: "Programmers",
  swea: "SWEA",
} as const;

const statusOptions = [
  { value: "all", label: "전체" },
  { value: "SOLVED", label: "풀이 완료" },
  { value: "UNSOLVED", label: "시작 전" },
] as const;

const difficultyOptionsByProvider: Record<CatalogProvider, { value: string; label: string }[]> = {
  leetcode: [
    { value: "all", label: "전체" },
    { value: "easy", label: "쉬움" },
    { value: "medium", label: "보통" },
    { value: "hard", label: "어려움" },
  ],
  swea: [
    { value: "all", label: "전체" },
    { value: "D1", label: "D1" },
    { value: "D2", label: "D2" },
    { value: "D3", label: "D3" },
    { value: "D4", label: "D4" },
    { value: "D5", label: "D5" },
    { value: "D6", label: "D6" },
    { value: "D7", label: "D7" },
    { value: "D8", label: "D8" },
  ],
  programmers: [
    { value: "all", label: "전체" },
    { value: "level-0", label: "Level 0" },
    { value: "level-1", label: "Level 1" },
    { value: "level-2", label: "Level 2" },
    { value: "level-3", label: "Level 3" },
    { value: "level-4", label: "Level 4" },
    { value: "level-5", label: "Level 5" },
  ],
};

function getListProvider(items: ListItem[]): CatalogProvider {
  return items[0]?.problem?.provider ?? "leetcode";
}

export function FilterableUserProblemLists({ lists, firstUnsolvedProblemTarget, profileUserId }: Props) {
  const [difficultyFilters, setDifficultyFilters] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");

  const hasActiveFilter =
    Object.values(difficultyFilters).some((v) => v !== "all") || statusFilter !== "all";

  function setDifficultyFilter(listKey: string, value: string) {
    setDifficultyFilters((prev) => ({ ...prev, [listKey]: value }));
  }

  function matchesFilters(item: ListItem, listKey: string) {
    const difficultyFilter = difficultyFilters[listKey] ?? "all";

    if (difficultyFilter !== "all" && item.problem.difficulty !== difficultyFilter) {
      return false;
    }

    if (statusFilter === "UNSOLVED") {
      return !item.submission;
    }

    if (statusFilter !== "all") {
      return item.submission?.status === statusFilter;
    }

    return true;
  }

  return (
    <>
      <div className="filter-bar">
        <div className="viewer-control">
          <label className="filter-label" htmlFor="status-filter">
            상태
          </label>
          <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilter ? (
          <button className="button" type="button" onClick={() => { setDifficultyFilters({}); setStatusFilter("all"); }}>
            초기화
          </button>
        ) : null}
      </div>

      {lists.map((list) => {
        const provider = getListProvider(list.items);
        const difficultyOptions = difficultyOptionsByProvider[provider];
        const listDifficulty = difficultyFilters[list.key] ?? "all";
        const filteredItems = hasActiveFilter ? list.items.filter((item) => matchesFilters(item, list.key)) : list.items;
        const subtitleSuffix =
          hasActiveFilter && filteredItems.length !== list.items.length
            ? ` · 필터 ${filteredItems.length}개`
            : "";

        return (
          <CatalogProblemList
            key={list.key}
            title={formatCatalogListTitle(list.title)}
            subtitle={`풀이 완료 ${list.progress.solved}개, 검토 중 ${list.progress.reviewing}개, 건너뜀 ${list.progress.skipped}개${subtitleSuffix}`}
          >
            <div className="filter-bar">
              <div className="viewer-control">
                <label className="filter-label" htmlFor={`difficulty-filter-${list.key}`}>
                  난이도
                </label>
                <select
                  id={`difficulty-filter-${list.key}`}
                  value={listDifficulty}
                  onChange={(e) => setDifficultyFilter(list.key, e.target.value)}
                >
                  {difficultyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {filteredItems.length === 0 ? (
              <div className="empty">조건에 맞는 문제가 없습니다</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>문제</th>
                      <th>난이도</th>
                      <th>상태</th>
                      <th>언어</th>
                      <th>풀이 일시</th>
                      <th>링크</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const isFirstUnsolvedProblem =
                        firstUnsolvedProblemTarget?.listKey === list.key &&
                        firstUnsolvedProblemTarget.problemKey === item.problemKey;
                      const comparisonHref = getComparisonLinkHref(
                        item.problem.provider,
                        item.problem.problemId,
                        profileUserId,
                        item.communitySolutionCount,
                      );

                      return (
                        <tr
                          className={isFirstUnsolvedProblem ? "problem-row-target" : undefined}
                          id={isFirstUnsolvedProblem ? firstUnsolvedProblemTarget.elementId : undefined}
                          key={`${list.key}-${item.problemKey}`}
                        >
                          <td className="mono">{item.order}</td>
                          <td>
                            {comparisonHref ? (
                              <Link className="problem-link" href={comparisonHref}>
                                {formatProblemTitle(item.problem.title)}
                              </Link>
                            ) : (
                              <div className="problem-title">{formatProblemTitle(item.problem.title)}</div>
                            )}
                            <div className="muted mono">{formatCatalogSection(item.section)}</div>
                          </td>
                          <td>
                            <span className="badge neutral">{difficultyLabel(item.problem.difficulty)}</span>
                          </td>
                          <td>
                            {item.submission ? (
                              <>
                                <span className={`badge ${item.submission.status.toLowerCase()}`}>
                                  {statusLabel(item.submission.status)}
                                </span>
                                {item.submission.notes ? <div className="muted">{item.submission.notes}</div> : null}
                              </>
                            ) : (
                              <span className="badge neutral">시작 전</span>
                            )}
                          </td>
                          <td className="mono">{item.submission?.language ?? "-"}</td>
                          <td>{formatDate(item.submission?.solvedAt)}</td>
                          <td>
                            <UserProblemActions
                              problem={item.problem}
                              submission={item.submission}
                              comparisonHref={comparisonHref}
                              providerLabels={providerLabels}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CatalogProblemList>
        );
      })}
    </>
  );
}
