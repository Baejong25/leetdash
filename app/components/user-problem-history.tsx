"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDateTime, statusLabel } from "@/lib/format";
import { formatCatalogListTitle, formatProblemTitle } from "@/lib/i18n";
import type { UserHistoryItem } from "@/lib/progress";

const PAGE_SIZE = 20;

export function UserProblemHistory({ history, userId }: { history: UserHistoryItem[]; userId: string }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const visibleItems = useMemo(
    () => history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [history, page],
  );

  return (
    <section className="panel" aria-labelledby="user-problem-history-title">
      <div className="panel-header">
        <div>
          <h2 id="user-problem-history-title">풀이 이력</h2>
          <p className="panel-subtitle">총 {history.length}개의 풀이를 최신 제출일 순으로 표시합니다.</p>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="empty">아직 기록된 풀이가 없습니다.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>문제</th><th>제공자</th><th>상태</th><th>언어</th><th>제출일</th><th>목록</th></tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        className="problem-link"
                        href={`/problems/${encodeURIComponent(item.problemProvider)}/${encodeURIComponent(item.problemId)}?user=${encodeURIComponent(userId)}`}
                      >
                        {formatProblemTitle(item.problemTitle)}
                      </Link>
                    </td>
                    <td>{item.problemProvider}</td>
                    <td><span className={`badge ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span></td>
                    <td className="mono">{item.language ?? "-"}</td>
                    <td>{formatDateTime(item.submittedAt ?? item.solvedAt)}</td>
                    <td>{formatCatalogListTitle(item.listTitle)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="history-pagination" aria-label="풀이 이력 페이지네이션">
            <button className="button" type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>이전</button>
            <span className="muted">{page} / {pageCount}</span>
            <button className="button" type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>다음</button>
          </div>
        </>
      )}
    </section>
  );
}
